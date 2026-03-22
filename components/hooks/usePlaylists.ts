'use client';

import { useQuery, useMutation } from 'convex/react';
import { useMemo } from 'react';
import type { Song } from '@/types';
import { isConvexFunctionRef } from '@/lib/convexFunctionRef';
import {
  useConvexUserLinkState,
  useConvexUserQueryReady,
} from '@/lib/useConvexUserQueryReady';

// Try to load generated Convex API; fall back to stubs if not available
let api: any;
let isConvexAvailable = false;
try {
  api = require('@/convex/_generated/api').api;
  const hasConvexUrl = typeof process !== 'undefined' && !!process.env.NEXT_PUBLIC_CONVEX_URL;
  const playlistsReady =
    isConvexFunctionRef(api?.playlists?.getUserPlaylists) &&
    isConvexFunctionRef(api?.playlists?.getPlaylistSongs) &&
    isConvexFunctionRef(api?.playlists?.addSongToPlaylist);
  isConvexAvailable = playlistsReady && hasConvexUrl;
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

export function usePlaylists() {
  const convexUserReady = useConvexUserQueryReady();

  const getListsValid =
    isConvexAvailable && isConvexFunctionRef(api?.playlists?.getUserPlaylists);
  const createValid = isConvexAvailable && isConvexFunctionRef(api?.playlists?.createPlaylist);
  const addValid = isConvexAvailable && isConvexFunctionRef(api?.playlists?.addSongToPlaylist);
  const removeValid =
    isConvexAvailable && isConvexFunctionRef(api?.playlists?.removeSongFromPlaylist);

  const getListsFn = useMemo(() => (getListsValid ? api.playlists.getUserPlaylists : null), [getListsValid]);
  const createFn = useMemo(() => (createValid ? api.playlists.createPlaylist : null), [createValid]);
  const addFn = useMemo(() => (addValid ? api.playlists.addSongToPlaylist : null), [addValid]);
  const removeFn = useMemo(() => (removeValid ? api.playlists.removeSongFromPlaylist : null), [removeValid]);

  const skipPlaylists = !convexUserReady;
  const getListsQuery =
    getListsValid && getListsFn
      ? useQuery(getListsFn, skipPlaylists ? 'skip' : undefined)
      : undefined;
  const createMutation = createValid && createFn ? useMutation(createFn) : null;
  const addMutation = addValid && addFn ? useMutation(addFn) : null;
  const removeMutation = removeValid && removeFn ? useMutation(removeFn) : null;

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
    createPlaylist:
      convexUserReady && createMutation ? createPlaylist : null,
    addSongToPlaylist:
      convexUserReady && addMutation ? addSongToPlaylist : null,
    removeSongFromPlaylist:
      convexUserReady && removeMutation ? removeSongFromPlaylist : null,
    enabled:
      convexUserReady && !!(createMutation || addMutation || getListsQuery !== undefined),
    /** Why playlist actions may be disabled (for UI copy when signed in). */
    playlistBackendHelp,
  };
}

/** Songs inside one playlist; skips when signed out or playlistId is null. */
export function usePlaylistSongs(playlistId: string | null) {
  const convexUserReady = useConvexUserQueryReady();

  const songsValid =
    isConvexAvailable && isConvexFunctionRef(api?.playlists?.getPlaylistSongs);
  const getSongsFn = useMemo(
    () => (songsValid ? api.playlists.getPlaylistSongs : null),
    [songsValid],
  );

  const skip = !convexUserReady || !playlistId || !songsValid;
  const songsQuery =
    songsValid && getSongsFn
      ? useQuery(getSongsFn, skip ? 'skip' : { playlistId: playlistId as any })
      : undefined;

  const isLoading = !skip && songsQuery === undefined;
  return {
    songs: Array.isArray(songsQuery) ? songsQuery : [],
    isLoading,
  };
}
