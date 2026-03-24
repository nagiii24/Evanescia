'use client';

import { useEffect, useState } from 'react';
import { isLikelyInAppEmbeddedBrowser } from '@/lib/inAppBrowser';
import { ExternalLink } from 'lucide-react';

export default function InAppBrowserAuthHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(isLikelyInAppEmbeddedBrowser());
  }, []);

  if (!show) return null;

  return (
    <div
      className="mb-4 rounded-xl border border-amber-400/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-50 shadow-[0_0_20px_rgba(251,191,36,0.12)]"
      role="alert"
    >
      <p className="font-semibold text-amber-100 mb-2 flex items-center gap-2">
        <ExternalLink className="shrink-0" size={18} aria-hidden />
        Open in your real browser to sign in with Google
      </p>
      <p className="text-amber-100/90 leading-relaxed mb-2">
        Apps like <strong className="text-amber-50">Messenger, Instagram, or Facebook</strong> use an embedded browser.
        Google blocks sign-in there for security (error <code className="text-amber-200/90">403: disallowed_useragent</code>).
      </p>
      <ol className="list-decimal list-inside space-y-1 text-amber-100/85 mb-3">
        <li>Tap <strong className="text-amber-50">•••</strong> or <strong className="text-amber-50">Share</strong> in the app&apos;s menu.</li>
        <li>Choose <strong className="text-amber-50">Open in Chrome</strong>, <strong className="text-amber-50">Safari</strong>, or <strong className="text-amber-50">Browser</strong>.</li>
        <li>Go to this same site and sign in again.</li>
      </ol>
      <p className="text-xs text-amber-200/70">
        Email/password or other providers may still work in some apps; Google specifically requires a full browser.
      </p>
      <button
        type="button"
        onClick={() => setShow(false)}
        className="mt-3 text-xs text-amber-300/90 underline hover:text-amber-200"
      >
        Dismiss
      </button>
    </div>
  );
}
