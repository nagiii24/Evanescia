'use client';

import React from 'react';

type State = { hasError: boolean; error?: Error };

export default class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, State> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    // Log to console (could integrate Sentry or other service)
    console.error('ErrorBoundary caught an error:', error, info);
  }

  reset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children as React.ReactElement;
    }

    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-black/90 text-white p-6 rounded-lg shadow-lg">
          <h2 className="text-lg font-semibold mb-2">An unexpected error occurred</h2>
          <p className="text-sm text-gray-300 mb-4">A client-side exception was caught and prevented the app from crashing. You can copy the details and try again.</p>
          <details className="mb-4 text-xs text-gray-400 max-h-64 overflow-auto" open>
            <summary className="cursor-pointer">Error details</summary>
            <pre className="whitespace-pre-wrap mt-2">{this.state.error?.stack || String(this.state.error)}</pre>
          </details>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                try {
                  navigator.clipboard.writeText(this.state.error?.stack || String(this.state.error) || 'No stack');
                } catch (err) {
                  console.error('Failed to copy error details', err);
                }
              }}
              className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-700 text-white text-sm"
            >
              Copy details
            </button>
            <button
              onClick={this.reset}
              className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white text-sm"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  }
}
