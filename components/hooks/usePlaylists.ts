'use client';

import { useQuery, useMutation } from 'convex/react';
import { useMemo } from 'react';
import type { Song } from '@/types';
import { isConvexFunctionRef } from '@/lib/convexFunctionRef';
import { useConvexUserLinkState } from '@/lib/useConvexUserQueryReady';

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

export type PlaylistBackendHelp =
  | { kind: 'ok' }
  | { kind: 'clerk_loading' }
  | { kind: 'missing_convex_url' }
  | { kind: 'convex_connecting' }
  | { kind: 'convex_auth_setup' };

export function usePlaylists() {
  const link = useConvexUserLinkState();
  const convexUserReady = link.ready;

  const playlistBackendHelp: PlaylistBackendHelp = useMemo(() => {
    if (!isConvexAvailable) return { kind: 'missing_convex_url' };
    if (!link.clerkLoaded) return { kind: 'clerk_loading' };
    if (!link.signedIn) return { kind: 'ok' };
    if (link.convexAuthLoading) return { kind: 'convex_connecting' };
    if (!link.convexAuthenticated) return { kind: 'convex_auth_setup' };
    return { kind: 'ok' };
  }, [link.clerkLoaded, link.signedIn, link.convexAuthLoading, link.convexAuthenticated]);

  const getListsValid =
    isConvexAvailable && isConvexFunctionRef(api?.playlists?.getUserPlaylists);
  const createValid = isConvexAvailable && isConvexFunctionRef(api?.playlists?.createPlaylist);
  const addValid = isConvexAvailable && isConvexFunctionRef(api?.playlists?.addSongToPlaylist);
  const removeValid =
    isConvexAvailable && isConvexFunctionRef(api?.playlists?.removeSongFromPlaylist);

  const getUserPlaylistsRef = useMemo(() => api.playlists.getUserPlaylists, []);
  const createPlaylistRef = useMemo(() => api.playlists.createPlaylist, []);
  const addSongRef = useMemo(() => api.playlists.addSongToPlaylist, []);
  const removeSongRef = useMemo(() => api.playlists.removeSongFromPlaylist, []);

  const skipListQuery = !getListsValid || !convexUserReady;
  const getListsQuery = useQuery(getUserPlaylistsRef, skipListQuery ? 'skip' : undefined);

  const createMutation = useMutation(createPlaylistRef);
  const addMutation = useMutation(addSongRef);
  const removeMutation = useMutation(removeSongRef);

  async function createPlaylist(name: string, description?: string) {
    return await createMutation({ name, description });
  }

  async function addSongToPlaylist(playlistId: any, song: Song) {
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
    return await removeMutation({ playlistId, songId });
  }

  return {
    playlists: getListsQuery || [],
    createPlaylist: convexUserReady && createValid ? createPlaylist : null,
    addSongToPlaylist: convexUserReady && addValid ? addSongToPlaylist : null,
    removeSongFromPlaylist:
      convexUserReady && removeValid ? removeSongFromPlaylist : null,
    enabled: convexUserReady && (getListsValid || createValid || addValid),
    playlistBackendHelp,
  };
}

/** Songs inside one playlist; skips when signed out or playlistId is null. */
export function usePlaylistSongs(playlistId: string | null) {
  const link = useConvexUserLinkState();
  const convexUserReady = link.ready;

  const songsValid =
    isConvexAvailable && isConvexFunctionRef(api?.playlists?.getPlaylistSongs);
  const getPlaylistSongsRef = useMemo(() => api.playlists.getPlaylistSongs, []);

  const skip = !convexUserReady || !playlistId || !songsValid;
  const songsQuery = useQuery(
    getPlaylistSongsRef,
    skip ? 'skip' : { playlistId: playlistId as any },
  );

  const isLoading = !skip && songsQuery === undefined;
  return {
    songs: Array.isArray(songsQuery) ? songsQuery : [],
    isLoading,
  };
}
