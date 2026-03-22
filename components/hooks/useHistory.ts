'use client';

import { useQuery, useMutation } from 'convex/react';
import { usePlayerStore } from '@/lib/store';
import { useEffect, useCallback, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import type { Song } from '@/types';
import { isConvexFunctionRef } from '@/lib/convexFunctionRef';
import { useConvexUserQueryReady } from '@/lib/useConvexUserQueryReady';

// Import Convex API
let api: any;
let isConvexAvailable = false;

try {
  api = require('@/convex/_generated/api').api;
  const historyReady =
    isConvexFunctionRef(api?.songs?.getHistory) && isConvexFunctionRef(api?.songs?.addHistory);
  const hasConvexUrl = typeof process !== 'undefined' && !!process.env.NEXT_PUBLIC_CONVEX_URL;
  isConvexAvailable = historyReady && hasConvexUrl;
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
  const convexUserReady = useConvexUserQueryReady();
  const { history, setHistory } = usePlayerStore();

  // Check if we have a valid Convex function (not a stub)
  const hasValidFunction = useMemo(() => {
    return isConvexAvailable && isConvexFunctionRef(api?.songs?.getHistory);
  }, []);
  
  // Get the function reference - provide a safe fallback to satisfy Rules of Hooks
  const getHistoryFn = useMemo(() => {
    return api?.songs?.getHistory || (() => []);
  }, []);
  
  const shouldSkip = !hasValidFunction || !convexUserReady;
  
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
  const convexUserReady = useConvexUserQueryReady();

  // Check if we have a valid Convex function (not a stub)
  const isValidFn = useMemo(() => {
    return isConvexAvailable && isConvexFunctionRef(api?.songs?.addHistory);
  }, []);
  
  // Get the function reference - provide safe fallback to satisfy Rules of Hooks
  const addHistoryFn = useMemo(() => {
    return api?.songs?.addHistory || (() => {});
  }, []);
  
  // Always call useMutation; only use it when isValidFn is true
  const addHistoryMutation = useMutation(addHistoryFn);

  // Memoize the function to prevent infinite loops
  const addToHistory = useCallback(async (song: Song) => {
    if (!isSignedIn || !convexUserReady || !addHistoryMutation || !isValidFn) return;

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
  }, [isSignedIn, convexUserReady, addHistoryMutation, isValidFn]);

  return { addToHistory, isSignedIn };
}
