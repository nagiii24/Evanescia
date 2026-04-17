/**
 * System Health — shared types & helpers.
 *
 * SRE justification:
 * We define a small, explicit state machine (GREEN/YELLOW/RED) rather than raw
 * numbers so every consumer (API, Context, UI) degrades using the *same vocabulary*.
 * This is the "traffic light" pattern used by Google SRE: a compressed signal that
 * collapses dozens of SLIs (latency, error rate, saturation) into one decision input
 * the UI can react to cheaply. Cheap client-side decisions are critical — they run
 * on every render and must not themselves become a bottleneck.
 */

export type HealthStatus = 'GREEN' | 'YELLOW' | 'RED';

export interface HealthReport {
  /** Current bucketed health. */
  status: HealthStatus;
  /** Measured (or simulated) p95-ish latency in ms for the sample window. */
  latencyMs: number;
  /** 0..1 — simulated/measured error ratio over the sample window. */
  errorRate: number;
  /** 0..1 — CPU/queue saturation proxy. */
  saturation: number;
  /** ISO timestamp the report was produced. */
  timestamp: string;
  /** Human-readable reason for the current bucket (useful for logs/banners). */
  reason: string;
  /** Seconds the client is advised to wait before polling again. Server drives cadence
   *  so we can *slow polling down* under RED to shed load on the health endpoint itself. */
  pollAfterSeconds: number;
}

/**
 * Thresholds are intentionally conservative. In a real system these would be tuned
 * against SLOs (e.g. "YELLOW if latency > 50% of SLO budget burn"). Centralised here
 * so the API is the single source of truth — the client must *never* re-classify.
 */
export const HEALTH_THRESHOLDS = {
  yellow: { latencyMs: 400, errorRate: 0.02, saturation: 0.7 },
  red: { latencyMs: 1200, errorRate: 0.1, saturation: 0.9 },
} as const;

export interface HealthSample {
  latencyMs: number;
  errorRate: number;
  saturation: number;
}

export function classify(sample: HealthSample): { status: HealthStatus; reason: string } {
  const { latencyMs, errorRate, saturation } = sample;
  const red =
    latencyMs >= HEALTH_THRESHOLDS.red.latencyMs ||
    errorRate >= HEALTH_THRESHOLDS.red.errorRate ||
    saturation >= HEALTH_THRESHOLDS.red.saturation;
  if (red) {
    return {
      status: 'RED',
      reason:
        latencyMs >= HEALTH_THRESHOLDS.red.latencyMs
          ? `Latency ${latencyMs}ms exceeded RED threshold`
          : errorRate >= HEALTH_THRESHOLDS.red.errorRate
          ? `Error rate ${(errorRate * 100).toFixed(1)}% exceeded RED threshold`
          : `Saturation ${(saturation * 100).toFixed(0)}% exceeded RED threshold`,
    };
  }

  const yellow =
    latencyMs >= HEALTH_THRESHOLDS.yellow.latencyMs ||
    errorRate >= HEALTH_THRESHOLDS.yellow.errorRate ||
    saturation >= HEALTH_THRESHOLDS.yellow.saturation;
  if (yellow) {
    return {
      status: 'YELLOW',
      reason:
        latencyMs >= HEALTH_THRESHOLDS.yellow.latencyMs
          ? `Latency ${latencyMs}ms elevated`
          : errorRate >= HEALTH_THRESHOLDS.yellow.errorRate
          ? `Error rate ${(errorRate * 100).toFixed(1)}% elevated`
          : `Saturation ${(saturation * 100).toFixed(0)}% elevated`,
    };
  }

  return { status: 'GREEN', reason: 'All indicators within SLO' };
}

/**
 * Server-driven poll cadence.
 *
 * SRE justification:
 * Under RED we *increase* the poll interval. Counter-intuitive until you realise
 * the health endpoint is itself a dependency — 10k clients hammering /api/health
 * every 5s during an outage turns the health check into the DDoS. We slow clients
 * down exactly when the backend is sick. This is "backoff at the source" and
 * mirrors what Envoy/AWS ALB do with adaptive health checks.
 */
export function pollAfterSecondsFor(status: HealthStatus): number {
  switch (status) {
    case 'GREEN':
      return 30;
    case 'YELLOW':
      return 45;
    case 'RED':
      return 60;
  }
}
