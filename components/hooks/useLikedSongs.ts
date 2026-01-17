'use client';

import { useQuery, useMutation } from 'convex/react';
import { usePlayerStore } from '@/lib/store';
import { useEffect, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import type { Song } from '@/types';

// Import Convex API - will use stub if not available
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
  const hasStubs = isStubFunction(api?.songs?.getLikes) || 
                   isStubFunction(api?.songs?.addLike);
  // Also check if Convex URL is configured (available at build time)
  const hasConvexUrl = typeof process !== 'undefined' && !!process.env.NEXT_PUBLIC_CONVEX_URL;
  isConvexAvailable = !hasStubs && hasConvexUrl;
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
  const { likedSongs, setLikedSongs } = usePlayerStore();
  
  // Check if we have a valid Convex function (not a stub)
  const hasValidFunction = useMemo(() => {
    return isConvexAvailable && api?.songs?.getLikes && !isStubFunction(api.songs.getLikes);
  }, []);
  
  // Get the function reference - must be stable
  // We'll always pass a function, but it might be a stub
  const getLikesFn = useMemo(() => {
    return api?.songs?.getLikes || (() => {});
  }, []);
  
  // CRITICAL: We must always call useQuery to satisfy Rules of Hooks
  // However, Convex will throw an error if we pass a stub function
  // The solution: Only call useQuery if we have a valid function reference
  // This is a necessary violation of Rules of Hooks to avoid runtime errors
  // The alternative would be to restructure the app to conditionally render components
  const shouldSkip = !hasValidFunction || !isSignedIn;
  
  // Conditionally call useQuery - this is the only safe way to avoid the error
  // when Convex isn't configured. In a production app, you'd want to ensure
  // Convex is always properly configured, or restructure to avoid this pattern.
  const convexLikedSongs = hasValidFunction && getLikesFn
    ? useQuery(getLikesFn, shouldSkip ? 'skip' : undefined)
    : undefined;

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
  const { likedSongs, setLikedSongs } = usePlayerStore();

  // Check if we have valid Convex functions (not stubs) at module level
  const addLikeIsValid = isConvexAvailable && api?.songs?.addLike && !isStubFunction(api.songs.addLike);
  const removeLikeIsValid = isConvexAvailable && api?.songs?.removeLike && !isStubFunction(api.songs.removeLike);
  
  // Get function references - only if valid
  const addLikeFn = useMemo(() => {
    return addLikeIsValid ? api.songs.addLike : null;
  }, [addLikeIsValid]);
  
  const removeLikeFn = useMemo(() => {
    return removeLikeIsValid ? api.songs.removeLike : null;
  }, [removeLikeIsValid]);
  
  // CRITICAL: We must always call useMutation to satisfy Rules of Hooks
  // However, Convex will throw an error if we pass stub functions
  // The solution: Only call useMutation if we have valid function references
  // This is a necessary violation of Rules of Hooks to avoid runtime errors
  const addLikeMutation = addLikeIsValid && addLikeFn 
    ? useMutation(addLikeFn) 
    : null;
  const removeLikeMutation = removeLikeIsValid && removeLikeFn 
    ? useMutation(removeLikeFn) 
    : null;

  const toggleLike = async (song: Song) => {
    if (!isSignedIn) return;

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
