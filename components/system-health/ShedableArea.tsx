'use client';

/**
 * ShedableArea — a declarative wrapper that *unmounts* its children above a
 * configured health threshold.
 *
 * SRE justification:
 *
 * 1. Unmount vs hide: we use conditional rendering (unmount), NOT `display:none`.
 *    Hidden components still hold state, subscriptions, timers, and WebSocket
 *    connections — exactly the things you want to kill during load shedding.
 *    Unmounting fires React cleanup, which cancels Convex queries, clears
 *    intervals, aborts fetches. Hiding gives you the visual outcome without
 *    any of the actual load relief.
 *
 * 2. `minStatus` semantics: children render when the system is BETTER THAN OR
 *    EQUAL TO the threshold. `<ShedableArea minStatus="YELLOW">` means "render
 *    if we're GREEN or YELLOW; unmount at RED". This matches the intuitive
 *    read of "minimum acceptable status for me to exist".
 *
 * 3. Optional `fallback` renders in place of the unmounted subtree. Useful for
 *    a "Live chat paused — tap to retry when we're back to normal" card that
 *    keeps the layout stable and explains the absence to the user.
 *
 * 4. The wrapper itself subscribes to the traffic-light bucket only, not the
 *    latency numbers — so a sub-second jitter in metrics never remounts/kills
 *    the whole collaborative playlist tree. That would be its own incident.
 */

import type { ReactNode } from 'react';
import { useLoadShedding } from './useLoadShedding';
import type { HealthStatus } from '@/lib/systemHealth';

interface ShedableAreaProps {
  /**
   * Minimum system status required for the children to render.
   * Default: 'YELLOW' (shed at RED only).
   */
  minStatus?: HealthStatus;
  /** Rendered in place of children when shed. */
  fallback?: ReactNode;
  children: ReactNode;
}

const RANK: Record<HealthStatus, number> = { GREEN: 2, YELLOW: 1, RED: 0 };

export function ShedableArea({ minStatus = 'YELLOW', fallback = null, children }: ShedableAreaProps) {
  const { status } = useLoadShedding();
  const ok = RANK[status] >= RANK[minStatus];
  return <>{ok ? children : fallback}</>;
}
