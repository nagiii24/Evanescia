'use client';

import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { searchYoutube } from '@/lib/youtube';
import { usePlayerStore } from '@/lib/store';
import {
  computeRoomPlaybackPosition,
  ROOM_PLAYBACK_SYNC_TOLERANCE_SEC,
  ROOM_PLAYBACK_RESYNC_COOLDOWN_MS,
} from '@/lib/roomPlayback';
import type { Song } from '@/types';
import { usePlaylists, usePlaylistSongs } from '@/components/hooks/usePlaylists';
import { useConvexUserLinkState } from '@/lib/useConvexUserQueryReady';
import { ShedableArea } from '@/components/system-health/ShedableArea';
import { ArrowLeft, DoorOpen, Loader2, Play, Search, Shuffle, Users } from 'lucide-react';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const slug = typeof params.slug === 'string' ? params.slug : Array.isArray(params.slug) ? params.slug[0] : '';

  const { isSignedIn, isLoaded } = useUser();
  const link = useConvexUserLinkState();
  const room = useQuery(api.listeningRooms.getRoomWithMembersBySlug, slug ? { slug } : 'skip');
  const myConvexUserId = useQuery(
    api.listeningRooms.getMyConvexUserId,
    slug && link.ready ? {} : 'skip',
  );

  const joinRoom = useMutation(api.listeningRooms.joinRoom);
  const leaveRoom = useMutation(api.listeningRooms.leaveRoom);
  const syncRoomPlayback = useMutation(api.listeningRooms.syncRoomPlayback);
  const pingListeningRoom = useMutation(api.listeningRooms.pingListeningRoom);

  const { playlists } = usePlaylists();
  const { playPlaylistFrom, playPlaylistShuffled, setSong, syncPlaybackFromRoom, clearPlayer } =
    usePlayerStore();

  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const { songs, isLoading: songsLoading } = usePlaylistSongs(selectedPlaylistId);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const roomStatus =
    room === undefined ? 'loading' : room === null ? 'missing' : 'ok';

  const sortedPlaylists = useMemo(() => {
    if (!Array.isArray(playlists)) return [];
    return [...playlists].sort((a: { createdAt?: number }, b: { createdAt?: number }) => {
      return (b.createdAt ?? 0) - (a.createdAt ?? 0);
    });
  }, [playlists]);

  const selectedPlaylist = sortedPlaylists.find(
    (p: { id?: string; _id?: string }) => String(p.id ?? p._id) === String(selectedPlaylistId),
  );

  const doLeave = useCallback(async () => {
    if (!slug) return;
    try {
      await leaveRoom({ slug });
    } catch {
      /* best effort */
    }
  }, [slug, leaveRoom]);

  // Join when the room exists; leave when you close the page or navigate away (avoids "ghost" listeners).
  useEffect(() => {
    if (!slug || !link.ready || roomStatus !== 'ok') return;

    void (async () => {
      try {
        await joinRoom({ slug });
      } catch {
        /* ignore; user may retry via refresh */
      }
    })();

    return () => {
      void leaveRoom({ slug }).catch(() => {});
    };
  }, [slug, link.ready, roomStatus, joinRoom, leaveRoom]);

  // Heartbeat so "ghost" membership from crashes doesn't keep you "in the room" forever for listener counts.
  useEffect(() => {
    if (!slug || !link.ready || roomStatus !== 'ok') return;
    const ping = () => void pingListeningRoom({ slug }).catch(() => {});
    ping();
    const id = window.setInterval(ping, 25_000);
    return () => window.clearInterval(id);
  }, [slug, link.ready, roomStatus, pingListeningRoom]);

  const hadRoomPlaybackRef = useRef(false);
  useEffect(() => {
    if (roomStatus !== 'ok' || !slug) return;
    const hasPlayback = Boolean(room?.playback?.song?.id);
    if (hadRoomPlaybackRef.current && !hasPlayback) {
      clearPlayer();
    }
    hadRoomPlaybackRef.current = hasPlayback;
  }, [room, roomStatus, slug, clearPlayer]);

  const lastRoomSyncAtRef = useRef(0);
  // Estimated difference between the Convex server clock and this client's Date.now(),
  // refreshed every query snapshot so we can project the leader's position to "right now"
  // instead of to whatever server time the snapshot was taken at. Without this, follower
  // seeks land behind by however long Convex delivery + React render took.
  const serverClockOffsetMsRef = useRef(0);

  // Match the room's shared playback (same track + position as whoever is driving the player).
  useEffect(() => {
    if (roomStatus !== 'ok' || !room?.playback || room.serverNowMs === undefined) return;
    const pb = room.playback;
    if (!pb?.song?.id) return;

    serverClockOffsetMsRef.current = room.serverNowMs - Date.now();
    const projectedServerNowMs = Date.now() + serverClockOffsetMsRef.current;
    const remotePos = computeRoomPlaybackPosition(
      {
        anchorMs: pb.anchorMs,
        positionSec: pb.positionSec,
        isPlaying: pb.isPlaying,
        song: pb.song,
      },
      projectedServerNowMs,
    );
    const { currentSong, currentTime, isPlaying } = usePlayerStore.getState();
    const sameSong = currentSong?.id === pb.song.id;

    // Play/pause transitions must propagate immediately — applying a cooldown here would
    // make a follower keep playing for several seconds after the leader pauses.
    const playStateChanged = sameSong && isPlaying !== pb.isPlaying;
    if (sameSong && !playStateChanged) {
      const drift = Math.abs(currentTime - remotePos);
      if (drift < ROOM_PLAYBACK_SYNC_TOLERANCE_SEC) return;
      // Only the drift-only reseek path respects the cooldown (seeks cause YouTube buffer stutter).
      if (Date.now() - lastRoomSyncAtRef.current < ROOM_PLAYBACK_RESYNC_COOLDOWN_MS) return;
    }

    lastRoomSyncAtRef.current = Date.now();
    syncPlaybackFromRoom(pb.song, remotePos, pb.isPlaying);
  }, [room, roomStatus, syncPlaybackFromRoom]);

  const handleLeave = async () => {
    if (!slug) return;
    clearPlayer();
    try {
      await syncRoomPlayback({
        slug,
        positionSec: 0,
        isPlaying: false,
        clear: true,
      });
    } catch {
      /* still leave membership */
    }
    await doLeave();
    router.push('/rooms');
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setSearchError(null);
    try {
      const songsFound = await searchYoutube(searchQuery.trim());
      setSearchResults(songsFound);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed');
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  if (!isLoaded) {
    return (
      <main className="min-h-screen text-gray-800 pb-24 pt-8 pl-0 md:pl-64">
        <div className="container mx-auto px-4 py-8">
          <p className="text-gray-200">Loading\u2026</p>
        </div>
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="min-h-screen text-gray-800 pb-24 pt-8 pl-0 md:pl-64">
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <Link href="/rooms" className="text-sm text-cyan-400 hover:text-cyan-300 mb-4 inline-block">
            \u2190 All rooms
          </Link>
          <h1 className="text-3xl font-bold text-white mb-4">Listening room</h1>
          <p className="text-gray-300">Sign in to enter a room and use your playlists or search.</p>
        </div>
      </main>
    );
  }

  if (room === undefined) {
    return (
      <main className="min-h-screen text-gray-800 pb-24 pt-8 pl-0 md:pl-64">
        <div className="container mx-auto px-4 py-8 flex items-center gap-2 text-gray-200">
          <Loader2 className="animate-spin" size={22} />
          Loading room\u2026
        </div>
      </main>
    );
  }

  if (room === null) {
    return (
      <main className="min-h-screen text-gray-800 pb-24 pt-8 pl-0 md:pl-64">
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <p className="text-gray-200">This room does not exist.</p>
          <Link href="/rooms" className="text-cyan-400 hover:text-cyan-300 mt-4 inline-block">
            Back to rooms
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen text-gray-800 pb-24 pt-8 pl-0 md:pl-64">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex flex-wrap items-start gap-4 mb-8">
          <Link
            href="/rooms"
            className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300"
          >
            <ArrowLeft size={16} />
            All rooms
          </Link>
          <div className="flex-1 min-w-0">
            <h1
              className="text-3xl md:text-4xl font-bold text-white flex items-center gap-3 flex-wrap"
              style={{ fontFamily: 'var(--font-playfair), serif' }}
            >
              <DoorOpen className="text-cyan-400 shrink-0" size={32} />
              <span className="min-w-0 break-words">{room.name}</span>
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              {room.memberCount} in this room &middot; Playback is shared: everyone hears the same track and position while
              someone is playing from this room page.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleLeave()}
            className="px-4 py-2 rounded-lg border border-white/20 text-white text-sm hover:bg-white/10 transition-colors"
          >
            Leave room
          </button>
        </div>

        {/* SRE: the three sections below are the "collaborative surface" —
            live presence, playlist browsing, search. All three run Convex
            subscriptions + YouTube API calls. At RED we unmount them entirely
            so the Convex queries are cancelled, sockets released, and the
            backend can breathe. Music playback (via <PlayerBar />) continues
            uninterrupted because it lives in the root layout, not here. */}
        <ShedableArea
          minStatus="YELLOW"
          fallback={
            <section className="mb-6 p-4 rounded-xl bg-black/35 border border-red-500/40 backdrop-blur-md">
              <h2 className="text-lg font-semibold text-white mb-2">
                Collaborative features paused
              </h2>
              <p className="text-gray-300 text-sm">
                We&apos;re shedding non-essential features to keep playback smooth.
                Your queue will continue to play. Live presence, playlist browsing,
                and search will return automatically when the system recovers.
              </p>
            </section>
          }
        >
        <section className="mb-6 p-4 rounded-xl bg-black/35 border border-white/10 backdrop-blur-md">
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Users size={20} className="text-pink-300" />
            Here now
          </h2>
          {room.members.length === 0 ? (
            <p className="text-gray-400 text-sm">No one&apos;s listed yet\u2014joining\u2026</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {room.members.map((m) => {
                const isYou =
                  myConvexUserId !== undefined &&
                  myConvexUserId !== null &&
                  String(m.userId) === String(myConvexUserId);
                return (
                  <li
                    key={String(m.userId)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/45 border border-white/15 text-sm text-white"
                  >
                    <span className="truncate max-w-[200px]">{m.name}</span>
                    {isYou && (
                      <span className="text-[10px] uppercase tracking-wide text-cyan-300/90 shrink-0">You</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="mb-10 p-4 rounded-xl bg-black/35 border border-white/10 backdrop-blur-md">
          <h2 className="text-lg font-semibold text-white mb-3">Your playlists</h2>
          {sortedPlaylists.length === 0 ? (
            <p className="text-gray-400 text-sm">
              No playlists yet.{' '}
              <Link href="/playlists" className="text-cyan-400 hover:text-cyan-300">
                Create one
              </Link>
              .
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 mb-4">
                {sortedPlaylists.map((p: { id?: string; _id?: string; name: string }) => {
                  const id = String(p.id ?? p._id);
                  const active = selectedPlaylistId === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSelectedPlaylistId(id)}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                        active
                          ? 'bg-cyan-900/50 border-cyan-500/50 text-white'
                          : 'bg-black/30 border-white/10 text-gray-200 hover:border-white/20'
                      }`}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
              {selectedPlaylistId && (
                <>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-white font-medium truncate">{selectedPlaylist?.name}</span>
                    {!songsLoading && songs.length > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => playPlaylistFrom(songs, 0)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 text-white text-sm"
                        >
                          <Play size={16} fill="currentColor" />
                          Play all
                        </button>
                        <button
                          type="button"
                          onClick={() => playPlaylistShuffled(songs)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/50 border border-white/20 text-white text-sm"
                        >
                          <Shuffle size={16} />
                          Shuffle
                        </button>
                      </>
                    )}
                  </div>
                  {songsLoading ? (
                    <p className="text-gray-400 text-sm">Loading tracks\u2026</p>
                  ) : songs.length === 0 ? (
                    <p className="text-gray-400 text-sm">This playlist is empty.</p>
                  ) : (
                    <ul className="space-y-2 max-h-64 overflow-y-auto">
                      {songs.map((song: Song & { addedAt?: number }, index: number) => (
                        <li
                          key={`${song.id}-${song.addedAt ?? index}`}
                          className="flex items-center gap-3 p-2 rounded-lg bg-black/40 border border-white/5 group"
                        >
                          <img
                            src={song.thumbnailUrl}
                            alt=""
                            className="w-10 h-10 rounded object-cover shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm truncate">{song.title}</p>
                            <p className="text-cyan-300/90 text-xs truncate">{song.artist}</p>
                          </div>
                          {song.duration > 0 && (
                            <span className="text-gray-500 text-xs">{formatDuration(song.duration)}</span>
                          )}
                          <button
                            type="button"
                            onClick={() => playPlaylistFrom(songs, index)}
                            className="p-1.5 text-cyan-400 opacity-70 group-hover:opacity-100"
                            aria-label={`Play ${song.title}`}
                          >
                            <Play size={18} fill="currentColor" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </>
          )}
        </section>

        <section className="p-4 rounded-xl bg-black/35 border border-white/10 backdrop-blur-md">
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Search size={20} className="text-cyan-400" />
            Search &amp; play
          </h2>
          <form onSubmit={handleSearch} className="flex flex-wrap gap-2 mb-4">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Type a song or artist\u2026"
              className="flex-1 min-w-[200px] px-3 py-2 text-sm rounded-lg bg-black/40 border border-white/15 text-white placeholder:text-gray-500"
            />
            <button
              type="submit"
              disabled={searchLoading || !searchQuery.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm disabled:opacity-40"
            >
              {searchLoading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
              Search
            </button>
          </form>
          {searchError && (
            <p className="text-red-300 text-sm mb-3">{searchError}</p>
          )}
          {searchResults.length > 0 && (
            <ul className="space-y-2 max-h-80 overflow-y-auto">
              {searchResults.map((song) => (
                <li
                  key={song.id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-black/40 border border-white/5 group"
                >
                  <img
                    src={song.thumbnailUrl}
                    alt=""
                    className="w-10 h-10 rounded object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{song.title}</p>
                    <p className="text-cyan-300/90 text-xs truncate">{song.artist}</p>
                  </div>
                  {song.duration > 0 && (
                    <span className="text-gray-500 text-xs">{formatDuration(song.duration)}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => setSong(song)}
                    className="p-1.5 text-cyan-400 opacity-70 group-hover:opacity-100"
                    aria-label={`Play ${song.title}`}
                  >
                    <Play size={18} fill="currentColor" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        </ShedableArea>
      </div>
    </main>
  );
}
