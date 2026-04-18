# Evanescia

A Next.js music streaming app with a built-in **load-shedding & graceful degradation** system ("The Guardian").

## Local dev

```bash
npm install
npm run dev     # http://localhost:3000
```

---

## The Guardian — load-shedding system

Evanescia actively degrades its own UI when the backend is unhealthy so that **music playback never drops**, even under traffic spikes or partial outages.

### Architecture

```
 /api/health  (GREEN | YELLOW | RED) ──poll 30s──▶  SystemHealthProvider (React Context)
                                                             │
                                                             ▼
                                                      useLoadShedding()
                                                             │
                       ┌────────────────────┬────────────────┼──────────────────┐
                       ▼                    ▼                ▼                  ▼
                  SakuraDrop         High-res album art   Live features    LowBandwidthBanner
                  (off at YELLOW)    (downgraded YT URL)  (rooms chat,     (shown at RED)
                                                          search, presence)
                                                          unmounted at RED
```

The `<PlayerBar>` (audio playback) is structurally isolated: it reads `useLoadShedding()` only for decorative flags (animations, thumbnail quality). Audio output itself is never gated by health state.

### Files

- `app/api/health/route.ts` — health probe endpoint, accepts `?force=red|yellow|green&ttl=N` and `?clear=1`.
- `lib/systemHealth.ts` — traffic-light types, thresholds, `classify()`.
- `components/system-health/SystemHealthProvider.tsx` — client Context, adaptive polling, stale-detection.
- `components/system-health/useLoadShedding.ts` — hook returning feature flags per state.
- `components/system-health/ShedableArea.tsx` — declarative `<ShedableArea minStatus="YELLOW">` wrapper that **unmounts** children under load.
- `components/system-health/LowBandwidthBanner.tsx` — visible user signal in RED.
- `lib/imageQuality.ts` — rewrites YouTube thumbnails to lower-res variants under load.
- `middleware.ts` — excludes `/api/health` from Clerk so monitoring probes don't need auth.

### Manual test

In one terminal:

```bash
npm run dev
```

In another, flip the state:

```bash
# Force RED for 60 seconds
curl.exe "http://localhost:3000/api/health?force=red&ttl=60"

# Clear override
curl.exe "http://localhost:3000/api/health?clear=1"
```

Open http://localhost:3000 and play a song. Within ~30s of forcing RED, you should see:

- Red "Low Bandwidth Mode — Essential Audio Only" banner across the top.
- Album art drops to a tiny placeholder-like thumbnail.
- Sakura petals and play-button glow animations stop.
- `/rooms/<slug>` collaborative UI unmounts, replaced by a "paused" card.
- **Music keeps playing** the whole time.

### Chaos testing

Automated load + state-transition tests, zero dependencies:

```bash
npm run chaos:transitions   # cycle GREEN->YELLOW->RED->GREEN (visual test)
npm run chaos:burst         # 50 concurrent workers for 30s
npm run chaos:ramp          # ramp 1 -> 30 concurrent over 60s
npm run chaos               # default 60s burst @ concurrency 10
node chaos-test.js -h       # all flags
```

Run `chaos:transitions` with the browser open and visually confirm every UI degradation happens at the right state. The script prints a latency histogram (p50/p95/p99), HTTP-status distribution, and health-bucket counts — the same signals you'd use to set SLOs in a real SRE review.

### Against production

```bash
node chaos-test.js --url https://your-app.vercel.app --mode burst --duration 15
```

Use with care — it really does send traffic. The script always clears any `force=` override at exit (including on Ctrl+C).
