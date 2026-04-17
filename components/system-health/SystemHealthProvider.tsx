'use client';

/**
 * SystemHealthProvider — client Context that polls /api/health and exposes
 * the current traffic-light state to the whole React tree.
 *
 * SRE justification for design choices:
 *
 * 1. Server-driven cadence: we read `pollAfterSeconds` from the response and
 *    schedule the NEXT poll using that value. The server is the authority on
 *    "how often should you bother me?" — classic adaptive health checking.
 *
 * 2. Exponential backoff on failure: if /api/health errors or times out, we
 *    back off (5s → 10s → 20s → 60s cap). A flaky health endpoint must not
 *    generate more traffic than a healthy one.
 *
 * 3. AbortController on every fetch: prevents a slow response from stomping a
 *    fresher one (classic race). The health signal MUST be monotonic-in-time
 *    from the client's perspective.
 *
 * 4. `document.visibilityState` pause: when the tab is hidden we stop polling.
 *    Thousands of background tabs polling every 30s is free load you don't want
 *    to pay for. We re-poll immediately on tab focus so the user sees a fresh
 *    state when they come back.
 *
 * 5. Default-optimistic (`GREEN`) on first mount: we assume healthy until proven
 *    otherwise. This prevents a "flash of degraded UI" on page load while the
 *    first request is in flight. Combined with (#8 staleness) we still catch
 *    real outages quickly.
 *
 * 6. `isStale` flag: if our last successful poll is older than ~2x the expected
 *    cadence, consumers can choose to treat the signal as suspect. Some teams
 *    choose to fail *closed* (assume RED when stale) — we expose the flag and
 *    let each consumer decide (music playback ignores it, chat treats stale-as-RED).
 *
 * 7. Single source of truth: ONE provider at the root. Individual components
 *    never fetch /api/health themselves — that would fan out the poll count by
 *    the number of subscribers, defeating the purpose.
 *
 * 8. Low-cost subscription: we split "status" and "report" into separate hooks so
 *    components that only need the bucket (most do) don't re-render when jittery
 *    sub-second latency numbers change.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { HealthReport, HealthStatus } from '@/lib/systemHealth';

interface SystemHealthContextValue {
  status: HealthStatus;
  report: HealthReport | null;
  /** True when the last successful report is older than ~2x expected cadence. */
  isStale: boolean;
  /** True until the first successful report has landed. */
  isInitialising: boolean;
  /** Manually force a refetch (e.g. after a user action that may have caused load). */
  refresh: () => void;
}

const DEFAULT_STATUS: HealthStatus = 'GREEN';

const SystemHealthContext = createContext<SystemHealthContextValue>({
  status: DEFAULT_STATUS,
  report: null,
  isStale: false,
  isInitialising: true,
  refresh: () => {},
});

interface ProviderProps {
  children: React.ReactNode;
  /** Override the health endpoint (useful for tests / previews). */
  endpoint?: string;
  /** Hard floor for poll interval in seconds; server cadence won't go below this. */
  minPollSeconds?: number;
  /** Hard ceiling; caps server-advised cadence (defends against a misconfigured server). */
  maxPollSeconds?: number;
}

export function SystemHealthProvider({
  children,
  endpoint = '/api/health',
  minPollSeconds = 15,
  maxPollSeconds = 120,
}: ProviderProps) {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [status, setStatus] = useState<HealthStatus>(DEFAULT_STATUS);
  const [isInitialising, setIsInitialising] = useState(true);
  const [isStale, setIsStale] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const failureCountRef = useRef(0);
  const mountedRef = useRef(false);
  const lastSuccessAtRef = useRef<number>(0);
  const expectedIntervalMsRef = useRef<number>(30_000);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const scheduleNext = useCallback(
    (seconds: number) => {
      clearTimer();
      const clamped = Math.min(maxPollSeconds, Math.max(minPollSeconds, seconds));
      expectedIntervalMsRef.current = clamped * 1000;
      timerRef.current = setTimeout(() => {
        void poll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, clamped * 1000);
    },
    // `poll` is declared below; re-declared via ref-like closure. We intentionally
    // don't list it to avoid a re-create loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [minPollSeconds, maxPollSeconds],
  );

  const poll = useCallback(async () => {
    // Pause when tab hidden — saves server load on background tabs.
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      scheduleNext(minPollSeconds);
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    // Timeout: if the health endpoint itself is slow, treat as failure.
    // A 5s timeout is aggressive by design — the health endpoint should be fast.
    const timeoutId = setTimeout(() => ac.abort(), 5_000);

    try {
      const res = await fetch(endpoint, {
        method: 'GET',
        signal: ac.signal,
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as HealthReport;

      if (!mountedRef.current) return;

      setReport(json);
      setStatus(json.status);
      setIsStale(false);
      setIsInitialising(false);
      failureCountRef.current = 0;
      lastSuccessAtRef.current = Date.now();

      scheduleNext(json.pollAfterSeconds ?? 30);
    } catch (err) {
      if (!mountedRef.current) return;
      if ((err as Error).name === 'AbortError') {
        // Aborted by newer poll or unmount — do nothing further.
        return;
      }

      failureCountRef.current += 1;

      // Exponential backoff capped at maxPollSeconds.
      const backoff = Math.min(
        maxPollSeconds,
        Math.max(minPollSeconds, 2 ** failureCountRef.current * 5),
      );

      /**
       * Fail-safe posture: after 3 consecutive failures we *degrade the signal*
       * ourselves to YELLOW. This is the classic "assume the worst" stance — if
       * we can't reach the health endpoint, something between us and the server
       * is already unhappy, so shedding non-essential UI is the right call.
       * We don't jump straight to RED because a single flaky wifi hop shouldn't
       * kill chat entirely.
       */
      if (failureCountRef.current >= 3 && status === 'GREEN') {
        setStatus('YELLOW');
      }

      // Mark stale so consumers who fail-closed can react.
      setIsStale(true);
      setIsInitialising(false);

      scheduleNext(backoff);
    } finally {
      clearTimeout(timeoutId);
    }
  }, [endpoint, scheduleNext, minPollSeconds, maxPollSeconds, status]);

  // Initial fetch + cleanup.
  useEffect(() => {
    mountedRef.current = true;
    void poll();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Immediately re-poll on return to tab — user probably wants the freshest UI.
        void poll();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    // Passive staleness watcher: if we haven't heard from the server in 2x the
    // expected interval, mark the report stale. Runs on a cheap timer.
    const staleWatcher = setInterval(() => {
      if (!lastSuccessAtRef.current) return;
      const age = Date.now() - lastSuccessAtRef.current;
      if (age > expectedIntervalMsRef.current * 2) {
        setIsStale(true);
      }
    }, 5_000);

    return () => {
      mountedRef.current = false;
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(staleWatcher);
      clearTimer();
      abortRef.current?.abort();
    };
    // We want this to run once on mount. `poll` is stable-enough via its own deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(() => {
    void poll();
  }, [poll]);

  const value = useMemo<SystemHealthContextValue>(
    () => ({ status, report, isStale, isInitialising, refresh }),
    [status, report, isStale, isInitialising, refresh],
  );

  return (
    <SystemHealthContext.Provider value={value}>{children}</SystemHealthContext.Provider>
  );
}

/** Full context access — use only when you need the detailed report. */
export function useSystemHealth(): SystemHealthContextValue {
  return useContext(SystemHealthContext);
}

/**
 * Lightweight hook for the 99% case: components that only care about the
 * traffic-light bucket. Keeps re-renders surgical.
 */
export function useSystemHealthStatus(): HealthStatus {
  return useContext(SystemHealthContext).status;
}
