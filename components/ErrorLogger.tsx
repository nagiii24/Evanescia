'use client';

import { useEffect, useState } from 'react';

export default function ErrorLogger() {
  const [errorInfo, setErrorInfo] = useState<{ message: string; stack?: string } | null>(null);

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      try {
        const message = event?.message || 'Unknown error';
        const stack = event?.error?.stack || undefined;
        console.error('Captured window.error:', message, stack || event.error);
        setErrorInfo({ message, stack });
      } catch (err) {
        console.error('ErrorLogger failed to process error event', err);
      }
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      try {
        const reason = event?.reason;
        const message = (reason && reason.message) || String(reason) || 'Unhandled rejection';
        const stack = reason?.stack || undefined;
        console.error('Captured unhandledrejection:', message, stack || reason);
        setErrorInfo({ message, stack });
      } catch (err) {
        console.error('ErrorLogger failed to process rejection event', err);
      }
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);

    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  if (!errorInfo) return null;

  const copyDetails = async () => {
    const text = `${errorInfo.message}\n\n${errorInfo.stack || ''}`;
    try {
      await navigator.clipboard.writeText(text);
      // small visual feedback could be added, but keep it simple
      console.info('Error details copied to clipboard');
    } catch (err) {
      console.error('Failed to copy error details', err);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center pointer-events-none">
      <div className="max-w-3xl w-full m-4 pointer-events-auto bg-black/80 text-white p-4 rounded-lg shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <strong className="block">Client-side error captured</strong>
            <p className="text-sm text-gray-300 mt-1">{errorInfo.message}</p>
            {errorInfo.stack && (
              <details className="mt-2 text-xs text-gray-400 max-h-48 overflow-auto">{errorInfo.stack}</details>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={copyDetails}
              className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-700 text-white text-sm"
            >
              Copy details
            </button>
            <button
              onClick={() => setErrorInfo(null)}
              className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white text-sm"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
