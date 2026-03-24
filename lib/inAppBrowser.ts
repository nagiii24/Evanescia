/**
 * Meta / TikTok / etc. embed your URL in a WebView. Google OAuth rejects those user agents (403 disallowed_useragent).
 */
export function isLikelyInAppEmbeddedBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /FBAN|FBAV|Instagram|Line\/|MicroMessenger|Snapchat|TikTok/i.test(ua);
}
