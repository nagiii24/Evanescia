'use client';

import { AlertCircle, X, RefreshCw, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { clearCache } from '@/lib/cache';

export default function QuotaWarning({ error }: { error: string | null }) {
  const [dismissed, setDismissed] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);

  if (!error || !error.includes('quota') || dismissed) {
    return null;
  }

  const handleClearCache = () => {
    clearCache();
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto mb-6 p-4 bg-yellow-900/30 backdrop-blur-md border border-yellow-500/50 rounded-lg relative">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 p-1 hover:bg-yellow-800/50 rounded transition-colors"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
      
      <div className="flex items-start gap-3">
        <AlertCircle className="text-yellow-400 mt-0.5 flex-shrink-0" size={20} />
        <div className="flex-1">
          <h3 className="font-semibold text-yellow-300 mb-1">YouTube API Quota Exceeded</h3>
          <p className="text-sm text-yellow-200 mb-3">
            You&apos;ve reached the daily limit for YouTube API requests. Some features may be limited.
          </p>
          
          <div className="text-xs text-yellow-300/80 space-y-2 mb-3">
            <p><strong>Quick Solutions:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>✅ <strong>Cached songs work instantly</strong> - Previously searched songs load from cache (no API calls)</li>
              <li>⏰ <strong>Wait 24 hours</strong> - Your quota resets daily at midnight Pacific Time</li>
              <li>📈 <strong>Request quota increase</strong> - Google Cloud Console allows up to 1,000,000 units/day</li>
            </ul>
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            <button
              onClick={handleClearCache}
              className="px-3 py-1.5 bg-yellow-600/30 hover:bg-yellow-600/50 border border-yellow-500/50 rounded text-xs text-yellow-200 transition-colors flex items-center gap-1.5"
            >
              <RefreshCw size={14} />
              {cacheCleared ? 'Cache Cleared!' : 'Clear Cache'}
            </button>
            <a
              href="https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/50 rounded text-xs text-cyan-200 transition-colors flex items-center gap-1.5"
            >
              <ExternalLink size={14} />
              Request Quota Increase
            </a>
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/50 rounded text-xs text-purple-200 transition-colors flex items-center gap-1.5"
            >
              <ExternalLink size={14} />
              Create New API Key
            </a>
          </div>

          {cacheCleared && (
            <p className="text-xs text-green-300 mt-2">✓ Cache cleared! The app will fetch fresh data when quota resets.</p>
          )}
        </div>
      </div>
    </div>
  );
}
