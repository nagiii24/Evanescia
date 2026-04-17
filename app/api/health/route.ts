import { NextRequest, NextResponse } from 'next/server';
import {
  classify,
  HealthReport,
  HealthStatus,
  pollAfterSecondsFor,
} from '@/lib/systemHealth';

/**
 * /api/health — System Health signal for the "Guardian" load-shedding system.
 *
 * SRE justification for design choices:
 *
 * 1. `dynamic = 'force-dynamic'` + `revalidate = 0`:
 *    The health endpoint must NEVER be cached by Vercel's edge or the browser. A
 *    stale "GREEN" cached response during a real RED incident would defeat the
 *    whole point. We return Cache-Control: no-store to make that contract explicit.
 *
 * 2. Runtime: nodejs (default). The in-memory simulated metrics store below is
 *    per-instance, which is actually *desirable* for the mock — every lambda
 *    reports its own local view, just like a real service's /healthz. When you
 *    swap this for Redis, all instances will agree on a global view.
 *
 * 3. `simulate_load` / `force` query params:
 *    Production SRE tooling always needs a "break glass" override so humans can
 *    force a degraded state to run game-days / chaos drills without waiting for
 *    real traffic to spike. In prod you'd gate this behind an admin-only token;
 *    for the mock we accept any caller but keep the surface small.
 */

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

/**
 * In-memory simulated metric store.
 *
 * NOTE: This is *deliberately* a module-level global. It represents the kind of
 * lightweight metric cache you'd otherwise keep in Redis / Memcached so every
 * pod sees the same view. To swap to Redis later:
 *   - replace readMetric()/writeMetric() with ioredis GET/SET (EX 60)
 *   - key: `evanescia:health:sim`
 * The rest of the route (classification, response shape) does not change.
 */
type SimState = {
  forced: HealthStatus | null;
  /** Unix ms when the forced state expires and we fall back to measured metrics. */
  forcedUntil: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __evanesciaHealthSim: SimState | undefined;
}

const sim: SimState =
  globalThis.__evanesciaHealthSim ??
  (globalThis.__evanesciaHealthSim = { forced: null, forcedUntil: 0 });

/**
 * Produce a realistic-looking metric sample.
 * Uses Math.random with a slow sine drift so dashboards look organic rather
 * than a pure uniform distribution.
 */
function measureSample(): { latencyMs: number; errorRate: number; saturation: number } {
  const t = Date.now() / 1000;
  // Gentle sinusoidal baseline + noise — feels like a real system at light load.
  const baseLatency = 80 + Math.sin(t / 17) * 20 + Math.random() * 40;
  const baseErrors = Math.max(0, 0.001 + Math.random() * 0.005);
  const baseSat = 0.2 + Math.sin(t / 31) * 0.05 + Math.random() * 0.1;
  return {
    latencyMs: Math.round(baseLatency),
    errorRate: Number(baseErrors.toFixed(4)),
    saturation: Number(baseSat.toFixed(3)),
  };
}

/**
 * Map a forced status back to a synthetic sample so the response shape is
 * consistent whether the state is real or simulated. This means the Context
 * provider and UI have ONE code path — no branching on "is this real?" which
 * is another SRE principle: production and staging/chaos should look identical
 * to the code that consumes the signal.
 */
function sampleFor(status: HealthStatus) {
  switch (status) {
    case 'GREEN':
      return { latencyMs: 90, errorRate: 0.001, saturation: 0.25 };
    case 'YELLOW':
      return { latencyMs: 650, errorRate: 0.03, saturation: 0.75 };
    case 'RED':
      return { latencyMs: 1800, errorRate: 0.15, saturation: 0.95 };
  }
}

function parseForced(req: NextRequest): HealthStatus | null {
  const url = req.nextUrl;

  // Preferred: explicit ?force=green|yellow|red
  const force = url.searchParams.get('force')?.toUpperCase();
  if (force === 'GREEN' || force === 'YELLOW' || force === 'RED') {
    return force;
  }

  // Convenience: ?simulate_load=true -> RED (matches spec).
  // ?simulate_load=yellow or ?simulate_load=red also accepted.
  const sl = url.searchParams.get('simulate_load');
  if (sl) {
    const v = sl.toLowerCase();
    if (v === 'true' || v === '1' || v === 'red') return 'RED';
    if (v === 'yellow') return 'YELLOW';
    if (v === 'false' || v === '0' || v === 'green') return 'GREEN';
  }
  return null;
}

function buildReport(status: HealthStatus, sample: ReturnType<typeof measureSample>, note?: string): HealthReport {
  const { reason } = classify(sample);
  return {
    status,
    latencyMs: sample.latencyMs,
    errorRate: sample.errorRate,
    saturation: sample.saturation,
    timestamp: new Date().toISOString(),
    reason: note ? `${note} — ${reason}` : reason,
    pollAfterSeconds: pollAfterSecondsFor(status),
  };
}

export async function GET(req: NextRequest) {
  try {
    const forcedNow = parseForced(req);
    const url = req.nextUrl;

    // If caller provided a force override, persist it briefly (default 60s) so
    // subsequent polls from the Context provider see the same forced state
    // without needing the query param. This makes game-days one-click.
    if (forcedNow) {
      const ttlSecondsRaw = Number(url.searchParams.get('ttl') ?? '60');
      const ttlSeconds = Number.isFinite(ttlSecondsRaw)
        ? Math.max(5, Math.min(ttlSecondsRaw, 3600))
        : 60;
      sim.forced = forcedNow;
      sim.forcedUntil = Date.now() + ttlSeconds * 1000;
    }

    // Clear override (?clear=1)
    if (url.searchParams.get('clear') === '1') {
      sim.forced = null;
      sim.forcedUntil = 0;
    }

    // Resolve effective status.
    let status: HealthStatus;
    let sample: ReturnType<typeof measureSample>;
    let note: string | undefined;

    const forcedActive = sim.forced && Date.now() < sim.forcedUntil;
    if (forcedActive && sim.forced) {
      status = sim.forced;
      sample = sampleFor(sim.forced);
      note = `FORCED(${sim.forced})`;
    } else {
      sample = measureSample();
      status = classify(sample).status;
    }

    const body = buildReport(status, sample, note);

    return NextResponse.json(body, {
      status: 200,
      headers: {
        // SRE: health checks must never be cached by any intermediary.
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        // Advise clients of the recommended poll cadence (used by SystemHealthProvider).
        'X-Poll-After-Seconds': String(body.pollAfterSeconds),
      },
    });
  } catch (err) {
    /**
     * If the health endpoint itself blows up, return RED — "fail safe" means
     * admitting you're unhealthy so clients can shed load. The UI's GREEN default
     * already errs optimistic, so we MUST signal RED explicitly on server error.
     */
    const sample = { latencyMs: 9999, errorRate: 1, saturation: 1 };
    const body: HealthReport = {
      status: 'RED',
      ...sample,
      timestamp: new Date().toISOString(),
      reason: `Health probe failure: ${(err as Error)?.message ?? 'unknown'}`,
      pollAfterSeconds: pollAfterSecondsFor('RED'),
    };
    return NextResponse.json(body, {
      status: 200, // 200 is intentional: this IS the health signal, not an app error.
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
