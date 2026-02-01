'use client';

import { useQuery, useMutation } from 'convex/react';
import { usePlayerStore } from '@/lib/store';
import { useEffect, useCallback, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import type { Song } from '@/types';

// Import Convex API
let api: any;
let isConvexAvailable = false;

// Helper to detect if we're using stub functions
function isStubFunction(fn: any): boolean {
  if (!fn || typeof fn !== 'function') return true;
  // Stub functions are empty arrow functions with no properties
  // Check if the function stringifies to '() => {}' or similar
  const fnStr = fn.toString().trim();
  // Match various forms of empty functions: '() => {}', 'function(){}', etc.
  const isEmptyFunction = /^\s*\(\)\s*=>\s*\{\}\s*$/.test(fnStr) || 
                          /^\s*function\s*\(\s*\)\s*\{\}\s*$/.test(fnStr) ||
                          fnStr === '() => {}' ||
                          fnStr === 'function () {}';
  return isEmptyFunction;
}

try {
  api = require('@/convex/_generated/api').api;
  // Check if we're using stub functions or if Convex URL is configured
  // If any function is a stub, Convex isn't properly set up
  const hasStubs = isStubFunction(api?.songs?.getHistory) || 
                   isStubFunction(api?.songs?.addHistory);
  // Also check if Convex URL is configured (available at build time)
  const hasConvexUrl = typeof process !== 'undefined' && !!process.env.NEXT_PUBLIC_CONVEX_URL;
  isConvexAvailable = !hasStubs && hasConvexUrl;
} catch {
  // Using stub API - Convex is not available
  api = {
    songs: {
      getHistory: () => {},
      addHistory: () => {},
      clearHistory: () => {},
    },
  };
  isConvexAvailable = false;
}

export function useHistory() {
  const { isSignedIn } = useUser();
  const { history, setHistory } = usePlayerStore();

  // Check if we have a valid Convex function (not a stub)
  const hasValidFunction = useMemo(() => {
    const fn = api?.songs?.getHistory;
    return fn && !isStubFunction(fn) && isConvexAvailable;
  }, []);
  
  // Get the function reference - provide a safe fallback to satisfy Rules of Hooks
  const getHistoryFn = useMemo(() => {
    return api?.songs?.getHistory || (() => []);
  }, []);
  
  const shouldSkip = !hasValidFunction || !isSignedIn;
  
  // Always call useQuery to satisfy Rules of Hooks; use skip option to avoid fetching when not ready
  const convexHistory = useQuery(getHistoryFn, shouldSkip ? 'skip' : { limit: 100 });

  // Sync Convex data to store
  useEffect(() => {
    if (isSignedIn && convexHistory && Array.isArray(convexHistory)) {
      // Convert to Song[] format (without timestamp for store)
      const songs: Song[] = convexHistory.map((item: any) => ({
        id: item.id,
        title: item.title,
        artist: item.artist,
        thumbnailUrl: item.thumbnailUrl,
        duration: item.duration,
      }));
      setHistory(songs);
    } else if (!isSignedIn) {
      setHistory([]);
    }
  }, [convexHistory, isSignedIn, setHistory]);

  return { history, isSignedIn };
}

export function useAddToHistory() {
  const { isSignedIn } = useUser();

  // Check if we have a valid Convex function (not a stub)
  const isValidFn = useMemo(() => {
    const fn = api?.songs?.addHistory;
    return fn && !isStubFunction(fn) && isConvexAvailable;
  }, []);
  
  // Get the function reference - provide safe fallback to satisfy Rules of Hooks
  const addHistoryFn = useMemo(() => {
    return api?.songs?.addHistory || (() => {});
  }, []);
  
  // Always call useMutation; only use it when isValidFn is true
  const addHistoryMutation = useMutation(addHistoryFn);

  // Memoize the function to prevent infinite loops
  const addToHistory = useCallback(async (song: Song) => {
    if (!isSignedIn || !addHistoryMutation || !isValidFn) return;

    try {
      await addHistoryMutation({
        songId: song.id,
        title: song.title,
        artist: song.artist,
        thumbnailUrl: song.thumbnailUrl,
        duration: song.duration,
      });
    } catch (error) {
      console.error('Failed to save to history:', error);
    }
  }, [isSignedIn, addHistoryMutation, isValidFn]);

  return { addToHistory, isSignedIn };
}
