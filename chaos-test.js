#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * chaos-test.js — a tiny, dependency-free chaos / load generator for /api/health.
 *
 * SRE justification:
 *
 * "A disaster recovery plan that has never been tested is just a disaster."
 *   — every incident postmortem ever.
 *
 * This script exists to PROVE that the Guardian system works end-to-end under
 * real traffic. It does three things:
 *
 *   1. Hammers /api/health (and optionally other routes) to generate latency
 *      spikes and verify the Context provider + UI react in real time.
 *
 *   2. Transitions the server through GREEN -> YELLOW -> RED -> GREEN using
 *      the `?force=` override, so you can visually confirm the banner flips
 *      on, the album art degrades, and the collaborative features unmount.
 *
 *   3. Prints a latency histogram (min/avg/p50/p95/p99/max) + status-code
 *      distribution. These are the same numbers an SRE would use to set
 *      SLOs ("99.9% of probes under 500ms"), so the output doubles as a
 *      signal that your thresholds in lib/systemHealth.ts are reasonable.
 *
 * USAGE
 *   node chaos-test.js                                  # default: 60s burst against http://localhost:3000
 *   node chaos-test.js --url https://myapp.vercel.app   # hit production
 *   node chaos-test.js --duration 30 --concurrency 20   # 30s, 20 inflight requests
 *   node chaos-test.js --mode transitions               # cycle GREEN->YELLOW->RED->GREEN
 *   node chaos-test.js --mode ramp                      # ramp concurrency 1 -> 50
 *
 * ZERO external dependencies: uses Node's built-in fetch (Node 18+, your
 * package.json requires Node >=20). This matches production reality: your
 * chaos tooling should not depend on npm being up.
 */

const DEFAULTS = {
  url: 'http://localhost:3000',
  duration: 60,          // seconds
  concurrency: 10,       // concurrent inflight requests
  mode: 'burst',         // burst | sustain | ramp | transitions
  path: '/api/health',
};

// ----------------------------- arg parsing --------------------------------
function parseArgs(argv) {
  const out = { ...DEFAULTS };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    switch (a) {
      case '--url':         out.url = next; i++; break;
      case '--duration':    out.duration = Number(next); i++; break;
      case '--concurrency': out.concurrency = Number(next); i++; break;
      case '--mode':        out.mode = next; i++; break;
      case '--path':        out.path = next; i++; break;
      case '-h':
      case '--help':
        console.log(
          `chaos-test.js — load + chaos generator for /api/health\n\n` +
          `Flags:\n` +
          `  --url <base>          (default: ${DEFAULTS.url})\n` +
          `  --duration <seconds>  (default: ${DEFAULTS.duration})\n` +
          `  --concurrency <N>     (default: ${DEFAULTS.concurrency})\n` +
          `  --mode <m>            burst | sustain | ramp | transitions (default: ${DEFAULTS.mode})\n` +
          `  --path <path>         (default: ${DEFAULTS.path})\n`,
        );
        process.exit(0);
    }
  }
  return out;
}

// ----------------------------- stats helpers ------------------------------
class Stats {
  constructor() {
    this.latencies = [];
    this.statusCounts = new Map();
    this.statusBuckets = new Map(); // GREEN/YELLOW/RED body-level counts
    this.errors = 0;
    this.total = 0;
    this.startedAt = Date.now();
  }
  record({ latencyMs, httpStatus, body }) {
    this.total++;
    this.latencies.push(latencyMs);
    this.statusCounts.set(httpStatus, (this.statusCounts.get(httpStatus) ?? 0) + 1);
    if (body && body.status) {
      this.statusBuckets.set(body.status, (this.statusBuckets.get(body.status) ?? 0) + 1);
    }
  }
  recordError() {
    this.total++;
    this.errors++;
  }
  percentile(p) {
    if (this.latencies.length === 0) return 0;
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
    return sorted[idx];
  }
  summary() {
    const elapsed = (Date.now() - this.startedAt) / 1000;
    const rps = this.total / Math.max(elapsed, 0.001);
    const avg =
      this.latencies.length === 0
        ? 0
        : this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length;
    return {
      totalRequests: this.total,
      errors: this.errors,
      durationSec: Number(elapsed.toFixed(2)),
      requestsPerSec: Number(rps.toFixed(1)),
      latency: {
        min: Math.min(...this.latencies, Infinity) === Infinity ? 0 : Math.min(...this.latencies),
        avg: Math.round(avg),
        p50: this.percentile(50),
        p95: this.percentile(95),
        p99: this.percentile(99),
        max: Math.max(...this.latencies, 0),
      },
      httpStatus: Object.fromEntries(this.statusCounts),
      healthBucket: Object.fromEntries(this.statusBuckets),
    };
  }
}

// ----------------------------- HTTP helpers -------------------------------
async function probe(url) {
  const t0 = process.hrtime.bigint();
  try {
    const res = await fetch(url, { cache: 'no-store' });
    const text = await res.text();
    const ms = Number((process.hrtime.bigint() - t0) / 1_000_000n);
    let body = null;
    try { body = JSON.parse(text); } catch { /* non-JSON response, fine */ }
    return { latencyMs: ms, httpStatus: res.status, body };
  } catch (err) {
    const ms = Number((process.hrtime.bigint() - t0) / 1_000_000n);
    return { latencyMs: ms, httpStatus: 0, body: null, error: String(err?.message ?? err) };
  }
}

async function forceState(baseUrl, state, ttlSec = 30) {
  const u =
    state === 'clear'
      ? `${baseUrl}/api/health?clear=1`
      : `${baseUrl}/api/health?force=${state.toLowerCase()}&ttl=${ttlSec}`;
  const res = await probe(u);
  console.log(`[chaos] forceState(${state}) -> HTTP ${res.httpStatus}`);
}

// ----------------------------- workers ------------------------------------
async function worker({ url, stats, until, getConcurrencyOK }) {
  while (Date.now() < until) {
    if (!getConcurrencyOK()) {
      await sleep(5);
      continue;
    }
    const r = await probe(url);
    if (r.error) stats.recordError();
    else stats.record(r);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ----------------------------- modes --------------------------------------
async function runBurst(opts, stats) {
  console.log(`[chaos] BURST mode: ${opts.concurrency} workers for ${opts.duration}s against ${opts.url}${opts.path}`);
  const until = Date.now() + opts.duration * 1000;
  const target = `${opts.url}${opts.path}`;
  const workers = Array.from({ length: opts.concurrency }, () =>
    worker({ url: target, stats, until, getConcurrencyOK: () => true }),
  );
  await Promise.all(workers);
}

async function runSustain(opts, stats) {
  // 10 RPS per "concurrency" unit — gentle sustained load.
  console.log(`[chaos] SUSTAIN mode: ~${opts.concurrency * 10} rps for ${opts.duration}s`);
  const until = Date.now() + opts.duration * 1000;
  const target = `${opts.url}${opts.path}`;
  const intervalMs = 1000 / (opts.concurrency * 10);
  while (Date.now() < until) {
    probe(target).then((r) => (r.error ? stats.recordError() : stats.record(r)));
    await sleep(intervalMs);
  }
  // Let inflight requests finish.
  await sleep(2000);
}

async function runRamp(opts, stats) {
  console.log(`[chaos] RAMP mode: 1 -> ${opts.concurrency} workers over ${opts.duration}s`);
  const target = `${opts.url}${opts.path}`;
  const step = Math.max(1, Math.floor(opts.duration / Math.max(opts.concurrency, 1)));
  const spawnedUntils = [];
  for (let c = 1; c <= opts.concurrency; c++) {
    spawnedUntils.push(Date.now() + (opts.duration - (c - 1) * step) * 1000);
  }
  const workers = spawnedUntils.map((until, i) =>
    (async () => {
      await sleep(i * step * 1000);
      await worker({ url: target, stats, until, getConcurrencyOK: () => true });
    })(),
  );
  await Promise.all(workers);
}

async function runTransitions(opts) {
  /**
   * Walk the state machine: GREEN -> YELLOW -> RED -> GREEN.
   * Hold each state long enough for the client's poll loop (up to 30s + jitter)
   * to observe it. Prints the banner/UI cues you should see in the browser.
   */
  const holdSec = 20;
  const cycles = Math.max(1, Math.floor(opts.duration / (4 * holdSec)));
  console.log(`[chaos] TRANSITIONS mode: ${cycles} cycle(s) of GREEN->YELLOW->RED->GREEN, ${holdSec}s each`);
  console.log(`[chaos] Keep your browser open on http://localhost:3000 — watch the banner + album art + chat.`);

  for (let c = 0; c < cycles; c++) {
    await forceState(opts.url, 'clear');
    console.log(`[chaos]   GREEN   — banner hidden, high-res art, chat on, animations on`);
    await sleep(holdSec * 1000);

    await forceState(opts.url, 'yellow', holdSec + 5);
    console.log(`[chaos]   YELLOW  — banner hidden, low-res art, chat on, animations OFF`);
    await sleep(holdSec * 1000);

    await forceState(opts.url, 'red', holdSec + 5);
    console.log(`[chaos]   RED     — banner VISIBLE, near-placeholder art, chat UNMOUNTED`);
    await sleep(holdSec * 1000);

    await forceState(opts.url, 'clear');
    console.log(`[chaos]   GREEN   — recovered`);
    await sleep(holdSec * 1000);
  }
}

// ----------------------------- main ---------------------------------------
function banner() {
  console.log('');
  console.log('   /\\ /\\ /\\    CHAOS TEST   /\\ /\\ /\\');
  console.log('  The system only works if you break it.');
  console.log('');
}

function printSummary(summary, opts) {
  console.log('\n=========== CHAOS SUMMARY ============');
  console.log(`target:         ${opts.url}${opts.path}`);
  console.log(`mode:           ${opts.mode}`);
  console.log(`duration:       ${summary.durationSec}s`);
  console.log(`total requests: ${summary.totalRequests}`);
  console.log(`errors:         ${summary.errors}`);
  console.log(`requests/sec:   ${summary.requestsPerSec}`);
  console.log(`--- latency (ms) ---`);
  console.log(`  min / avg / p50 / p95 / p99 / max`);
  console.log(
    `  ${summary.latency.min} / ${summary.latency.avg} / ${summary.latency.p50} / ${summary.latency.p95} / ${summary.latency.p99} / ${summary.latency.max}`,
  );
  console.log(`--- HTTP status ---`);
  for (const [code, n] of Object.entries(summary.httpStatus)) console.log(`  ${code}: ${n}`);
  console.log(`--- Health bucket ---`);
  for (const [bucket, n] of Object.entries(summary.healthBucket)) console.log(`  ${bucket}: ${n}`);
  console.log('======================================\n');

  /**
   * SRE interpretation (for your interview notes):
   *
   *   - p95 << p99 >> p50      → long tail. Investigate GC pauses, cold starts,
   *                             lock contention, or saturated downstream deps.
   *   - max very high          → at least one probe hit a pathological case.
   *                             That caller felt it; figure out why.
   *   - HTTP 0 in distribution → client couldn't connect / timed out. These are
   *                             worse than 500s because you get zero signal from
   *                             the server about what went wrong.
   *   - healthBucket shows RED → the Guardian noticed. Good. Check your browser
   *                             to confirm the UI reacted.
   */
}

async function main() {
  const opts = parseArgs(process.argv);
  banner();

  // Always try to reset any lingering forced state at shutdown.
  const cleanup = async () => {
    try {
      await forceState(opts.url, 'clear');
    } catch { /* ignore */ }
  };
  process.on('SIGINT', async () => { await cleanup(); process.exit(130); });

  const stats = new Stats();
  try {
    switch (opts.mode) {
      case 'burst':       await runBurst(opts, stats); break;
      case 'sustain':     await runSustain(opts, stats); break;
      case 'ramp':        await runRamp(opts, stats); break;
      case 'transitions': await runTransitions(opts); break;
      default:
        console.error(`Unknown mode: ${opts.mode}`);
        process.exit(2);
    }
  } finally {
    await cleanup();
  }

  if (opts.mode !== 'transitions') printSummary(stats.summary(), opts);
}

main().catch((err) => {
  console.error('[chaos] fatal:', err);
  process.exit(1);
});
