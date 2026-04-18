'use client';

/**
 * LowBandwidthBanner — visible signal to the user that we've shed features.
 *
 * SRE justification:
 *
 * 1. Transparency matters. Users who see "the chat button disappeared" without
 *    context assume a BUG. A one-line banner says "we noticed, and we chose
 *    this to keep your music going." Trust > polish when things degrade.
 *
 * 2. The banner itself is cheap — a single fixed div with static content. It
 *    does not depend on any data fetches, Convex, or Clerk. If those are down,
 *    the banner still renders.
 *
 * 3. Renders ONLY in RED. At YELLOW the degradation is silent and invisible
 *    (lower-res art, no animations) — users shouldn't be alarmed by a routine
 *    traffic bump.
 */

import { useLoadShedding } from './useLoadShedding';

export function LowBandwidthBanner() {
  const { shouldShowDegradedBanner } = useLoadShedding();
  if (!shouldShowDegradedBanner) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-3 px-4 py-2 text-sm font-medium text-white shadow-lg"
      style={{
        background: 'linear-gradient(90deg, #7a1c2e 0%, #b03a3a 50%, #7a1c2e 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.15)',
      }}
    >
      <span
        aria-hidden="true"
        className="inline-block h-2 w-2 rounded-full bg-white"
        style={{ animation: 'pulse 1.2s ease-in-out infinite' }}
      />
      <span className="tracking-wide">
        Low Bandwidth Mode — Essential Audio Only
      </span>
      <span className="hidden sm:inline text-white/70 text-xs">
        Non-critical features paused to keep playback smooth
      </span>
    </div>
  );
}
