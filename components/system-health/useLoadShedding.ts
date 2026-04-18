'use client';

/**
 * useLoadShedding — derives feature flags from the current system health.
 *
 * SRE justification:
 *
 * The Context provider exposes WHAT the system feels like (GREEN/YELLOW/RED).
 * It does NOT decide what to do about it — that's a policy decision per product.
 * This hook is the single place that translates state → policy, so the whole
 * app degrades consistently. If a PM later says "add high-res art back at YELLOW
 * but drop recommendations instead", you change ONE file.
 *
 * The flags are intentionally coarse-grained and boolean. Sub-component decisions
 * ("should I animate the caret?") are fine to branch on these, but we do NOT
 * expose raw latency numbers here — that would tempt every component to invent
 * its own thresholds, destroying the consistency the traffic-light pattern buys.
 *
 * "Fail-closed for decorations, fail-open for core":
 *   - Decorative features (animations, high-res art, live chat) default to OFF
 *     when we're uncertain (stale signal).
 *   - Core features (audio playback, basic navigation) NEVER read this hook —
 *     they're structurally isolated so no bug here can kill playback.
 */

import { useMemo } from 'react';
import { useSystemHealth } from './SystemHealthProvider';
import type { HealthStatus } from '@/lib/systemHealth';

export interface LoadSheddingFlags {
  /** Current underlying status. Exposed for edge-cases; prefer the flags below. */
  status: HealthStatus;
  /** True when the signal is stale — consumers may choose to fail-closed. */
  isStale: boolean;
  /** Quantised "mode" string, handy for className switches and analytics tags. */
  mode: 'full' | 'degraded' | 'essential';

  /** GREEN only: render full-quality album art (maxresdefault thumbnails etc). */
  allowHighResArt: boolean;
  /** GREEN only: CSS animations, sakura petals, vinyl spin, audio visualizer bars. */
  allowAnimations: boolean;
  /** GREEN/YELLOW: run non-critical background data fetches (related tracks, prefetch). */
  allowBackgroundPrefetch: boolean;
  /** GREEN/YELLOW: render chat, collaborative playlist edits, presence indicators. */
  allowLiveFeatures: boolean;
  /** Always true unless we go OFFLINE. Core music playback is never shed. */
  allowCorePlayback: boolean;

  /** If true, show the "Low Bandwidth Mode" banner. */
  shouldShowDegradedBanner: boolean;
}

export function useLoadShedding(): LoadSheddingFlags {
  const { status, isStale } = useSystemHealth();

  return useMemo(() => {
    /**
     * Effective status: if the signal is stale (can't reach /api/health reliably),
     * we downgrade our assumption by one level. This is the "fail-safe" principle —
     * assume slightly worse than optimistic when the evidence is missing.
     * GREEN-stale → treat as YELLOW; YELLOW-stale → treat as RED; RED stays RED.
     */
    const effective: HealthStatus =
      isStale && status === 'GREEN' ? 'YELLOW' : isStale && status === 'YELLOW' ? 'RED' : status;

    const isGreen = effective === 'GREEN';
    const isYellow = effective === 'YELLOW';
    const isRed = effective === 'RED';

    return {
      status: effective,
      isStale,
      mode: isGreen ? 'full' : isYellow ? 'degraded' : 'essential',

      allowHighResArt: isGreen,
      allowAnimations: isGreen,
      allowBackgroundPrefetch: !isRed,
      allowLiveFeatures: !isRed,
      allowCorePlayback: true,

      shouldShowDegradedBanner: isRed,
    };
  }, [status, isStale]);
}
