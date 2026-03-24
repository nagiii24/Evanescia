/** How often the DJ publishes position while playing (lower = followers stay closer in time; more Convex writes). */
export const ROOM_PLAYBACK_POSITION_INTERVAL_MS = 700;

/** Extra YouTube seek attempts after load (ms). Keep small to reduce join/ skip latency. */
export const ROOM_PLAYBACK_SEEK_RETRY_DELAYS_MS = [80, 220] as const;

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
