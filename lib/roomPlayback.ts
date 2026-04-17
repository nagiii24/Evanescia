/** How often the leader publishes position while playing. */
export const ROOM_PLAYBACK_POSITION_INTERVAL_MS = 2_000;

/** Extra YouTube seek attempts after load (ms). Keep small to reduce join/skip latency. */
export const ROOM_PLAYBACK_SEEK_RETRY_DELAYS_MS = [80, 300] as const;

/**
 * Followers ignore drift below this threshold to avoid unnecessary seeks (seeks cause buffer stutter).
 * Kept tight so fixed offsets introduced by YouTube startup / seek-retry warmup get corrected quickly;
 * otherwise listeners hear a permanent lag that feels like the track is playing at a different speed.
 */
export const ROOM_PLAYBACK_SYNC_TOLERANCE_SEC = 1.5;

/** After a room-sync seek, ignore further drift-only re-syncs for this many ms (gives YouTube time to buffer). */
export const ROOM_PLAYBACK_RESYNC_COOLDOWN_MS = 3_000;

/** Compute track position from server anchor + query snapshot time. */
export function computeRoomPlaybackPosition(
  playback: {
    anchorMs: number;
    positionSec: number;
    isPlaying: boolean;
    song: { duration: number };
  },
  serverNowMs: number,
): number {
  const elapsedSec = (serverNowMs - playback.anchorMs) / 1000;
  const raw = playback.positionSec + (playback.isPlaying ? Math.max(0, elapsedSec) : 0);
  const dur = playback.song.duration;
  if (dur > 0) return Math.min(raw, dur);
  return Math.max(0, raw);
}

export function parseRoomSlugFromPathname(pathname: string | null): string | null {
  if (!pathname) return null;
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "rooms" || !parts[1]) return null;
  return parts[1];
}
