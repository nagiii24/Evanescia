/**
 * imageQuality — adaptive thumbnail URL rewriting.
 *
 * SRE justification:
 *
 * The #1 bandwidth hog in a music app is album art. A single 1280×720
 * `maxresdefault.jpg` is ~80–150 KB; the 120×90 `default.jpg` is ~2–5 KB —
 * roughly a 20–50× reduction per track. When a system is under load, *clients*
 * can individually cut bandwidth by reducing the quality of an asset they
 * were going to fetch anyway. No server coordination required.
 *
 * This is the "do less work on the client" companion to server-side load
 * shedding. Together they form an end-to-end congestion response.
 *
 * YouTube thumbnail URLs follow a predictable pattern:
 *   https://i.ytimg.com/vi/<VIDEO_ID>/<QUALITY>.jpg
 * Known QUALITY keys (smallest → largest):
 *   default (120×90), mqdefault (320×180), hqdefault (480×360),
 *   sddefault (640×480), maxresdefault (1280×720)
 */

export type ImageQualityMode = 'full' | 'degraded' | 'essential';

const QUALITY_FOR_MODE: Record<ImageQualityMode, string> = {
  full: 'hqdefault',       // 480×360 — already our default on GREEN
  degraded: 'mqdefault',   // 320×180 — ~3-4× smaller on YELLOW
  essential: 'default',    // 120×90  — ~20× smaller on RED, near-placeholder
};

const YT_QUALITY_TOKENS = ['maxresdefault', 'sddefault', 'hqdefault', 'mqdefault', 'default'];

/**
 * Rewrite a YouTube thumbnail URL to the requested quality. Non-YouTube URLs
 * are returned unchanged — we fail-open rather than risk breaking images we
 * don't understand.
 */
export function getAdaptiveThumbnail(url: string | undefined | null, mode: ImageQualityMode): string {
  if (!url) return '';
  const target = QUALITY_FOR_MODE[mode];

  // Fast path: not a YouTube thumbnail we recognise.
  if (!url.includes('ytimg.com') && !url.includes('youtube.com')) return url;

  for (const token of YT_QUALITY_TOKENS) {
    // Match /<quality>.jpg (case-sensitive, as YouTube serves them).
    const pattern = new RegExp(`/${token}\\.(jpg|jpeg|png|webp)(\\?.*)?$`);
    if (pattern.test(url)) {
      return url.replace(pattern, (_m, ext: string, qs: string = '') => `/${target}.${ext}${qs || ''}`);
    }
  }
  return url;
}
