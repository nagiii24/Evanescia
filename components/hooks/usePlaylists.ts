'use client';

import { useQuery, useMutation } from 'convex/react';
import { useMemo } from 'react';
import type { Song } from '@/types';

// Try to load generated Convex API; fall back to stubs if not available
let api: any;
let isConvexAvailable = false;
try {
  api = require('@/convex/_generated/api').api;
  const hasConvexUrl = typeof process !== 'undefined' && !!process.env.NEXT_PUBLIC_CONVEX_URL;
  // Rough stub detection: ensure expected functions exist
  const hasStubs = !api?.playlists?.getUserPlaylists || !api?.playlists?.addSongToPlaylist;
  isConvexAvailable = !hasStubs && hasConvexUrl;
} catch {
  api = {
    playlists: {
      getUserPlaylists: () => {},
      createPlaylist: () => {},
      addSongToPlaylist: () => {},
      getPlaylistSongs: () => {},
      removeSongFromPlaylist: () => {},
    },
  };
  isConvexAvailable = false;
}

function isStubFunction(fn: any): boolean {
  if (!fn || typeof fn !== 'function') return true;
  const fnStr = fn.toString().trim();
  return /^\s*(\(\)|function\s*\(\))\s*=>\s*\{\}\s*$/.test(fnStr) || fnStr === '() => {}';
}

export function usePlaylists() {
  const getListsValid = isConvexAvailable && api?.playlists?.getUserPlaylists && !isStubFunction(api.playlists.getUserPlaylists);
  const createValid = isConvexAvailable && api?.playlists?.createPlaylist && !isStubFunction(api.playlists.createPlaylist);
  const addValid = isConvexAvailable && api?.playlists?.addSongToPlaylist && !isStubFunction(api.playlists.addSongToPlaylist);
  const removeValid = isConvexAvailable && api?.playlists?.removeSongFromPlaylist && !isStubFunction(api.playlists.removeSongFromPlaylist);

  const getListsFn = useMemo(() => api.playlists.getUserPlaylists || (() => []), []);
  const createFn = useMemo(() => api.playlists.createPlaylist || (() => {}), []);
  const addFn = useMemo(() => api.playlists.addSongToPlaylist || (() => {}), []);
  const removeFn = useMemo(() => api.playlists.removeSongFromPlaylist || (() => {}), []);

  const getListsQuery = useQuery(getListsFn);
  const createMutation = useMutation(createFn);
  const addMutation = useMutation(addFn);
  const removeMutation = useMutation(removeFn);

  // Public API
  async function createPlaylist(name: string, description?: string) {
    if (!createMutation) throw new Error('Convex createPlaylist not available');
    return await createMutation({ name, description });
  }

  async function addSongToPlaylist(playlistId: any, song: Song) {
    if (!addMutation) throw new Error('Convex addSongToPlaylist not available');
    return await addMutation({
      playlistId,
      songId: song.id,
      title: song.title,
      artist: song.artist,
      thumbnailUrl: song.thumbnailUrl,
      duration: song.duration,
    });
  }

  async function removeSongFromPlaylist(playlistId: any, songId: string) {
    if (!removeMutation) throw new Error('Convex removeSongFromPlaylist not available');
    return await removeMutation({ playlistId, songId });
  }

  return {
    playlists: getListsQuery || [],
    createPlaylist: createValid ? createPlaylist : null,
    addSongToPlaylist: addValid ? addSongToPlaylist : null,
    removeSongFromPlaylist: removeValid ? removeSongFromPlaylist : null,
    enabled: !!(getListsValid || createValid || addValid || removeValid),
  };
}
