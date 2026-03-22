'use client';

import { useQuery, useMutation } from 'convex/react';
import { usePlayerStore } from '@/lib/store';
import { useEffect, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import type { Song } from '@/types';
import { isConvexFunctionRef } from '@/lib/convexFunctionRef';
import { useConvexUserQueryReady } from '@/lib/useConvexUserQueryReady';

// Import Convex API - will use stub if not available
let api: any;
let isConvexAvailable = false;

try {
  api = require('@/convex/_generated/api').api;
  const likesReady =
    isConvexFunctionRef(api?.songs?.getLikes) && isConvexFunctionRef(api?.songs?.addLike);
  const hasConvexUrl = typeof process !== 'undefined' && !!process.env.NEXT_PUBLIC_CONVEX_URL;
  isConvexAvailable = likesReady && hasConvexUrl;
} catch {
  // Using stub API - Convex is not available
  api = {
    songs: {
      getLikes: () => {},
      addLike: () => {},
      removeLike: () => {},
    },
  };
  isConvexAvailable = false;
}

export function useLikedSongs() {
  const { isSignedIn } = useUser();
  const convexUserReady = useConvexUserQueryReady();
  const { likedSongs, setLikedSongs } = usePlayerStore();
  
  // Check if we have a valid Convex function (not a stub)
  const hasValidFunction = useMemo(() => {
    return isConvexAvailable && isConvexFunctionRef(api?.songs?.getLikes);
  }, []);
  
  // Get the function reference - must be stable
  // Get the function reference - provide a stable fallback
  const getLikesFn = useMemo(() => {
    return api?.songs?.getLikes || (() => []);
  }, []);
  
  const shouldSkip = !hasValidFunction || !convexUserReady;
  
  // Always call useQuery; use skip option to avoid fetching when not ready
  const convexLikedSongs = useQuery(getLikesFn, shouldSkip ? 'skip' : undefined);

  // Sync Convex data to store
  useEffect(() => {
    if (isSignedIn && convexLikedSongs && Array.isArray(convexLikedSongs)) {
      setLikedSongs(convexLikedSongs as Song[]);
    } else if (!isSignedIn) {
      setLikedSongs([]);
    }
  }, [convexLikedSongs, isSignedIn, setLikedSongs]);

  return { likedSongs, isSignedIn };
}

export function useLikeSong() {
  const { isSignedIn } = useUser();
  const convexUserReady = useConvexUserQueryReady();
  const { likedSongs, setLikedSongs } = usePlayerStore();

  // Check if we have valid Convex functions (not stubs) at module level
  const addLikeIsValid = isConvexAvailable && isConvexFunctionRef(api?.songs?.addLike);
  const removeLikeIsValid = isConvexAvailable && isConvexFunctionRef(api?.songs?.removeLike);
  
  // Get function references - provide safe fallbacks so hooks can be called unconditionally
  const addLikeFn = useMemo(() => {
    return api?.songs?.addLike || (() => {});
  }, []);
  
  const removeLikeFn = useMemo(() => {
    return api?.songs?.removeLike || (() => {});
  }, []);
  
  // Always call useMutation; only invoke them when the corresponding valid flags are true
  const addLikeMutation = useMutation(addLikeFn);
  const removeLikeMutation = useMutation(removeLikeFn);

  const toggleLike = async (song: Song) => {
    if (!isSignedIn || !convexUserReady) return;

    const isCurrentlyLiked = likedSongs.some(s => s.id === song.id);
    
    // Only use Convex if mutations are valid
    if (addLikeIsValid && removeLikeIsValid && addLikeMutation && removeLikeMutation) {
      try {
        if (isCurrentlyLiked) {
          await removeLikeMutation({ songId: song.id });
        } else {
          await addLikeMutation({
            songId: song.id,
            title: song.title,
            artist: song.artist,
            thumbnailUrl: song.thumbnailUrl,
            duration: song.duration,
          });
        }
      } catch (error) {
        // Fallback to local state if Convex fails
        if (isCurrentlyLiked) {
          setLikedSongs(likedSongs.filter(s => s.id !== song.id));
        } else {
          setLikedSongs([...likedSongs, song]);
        }
      }
    } else {
      // Fallback: update local state only (won't persist)
      if (isCurrentlyLiked) {
        setLikedSongs(likedSongs.filter(s => s.id !== song.id));
      } else {
        setLikedSongs([...likedSongs, song]);
      }
    }
  };

  return { toggleLike, isSignedIn };
}
