'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { usePlayerStore } from '@/lib/store';
import { api } from '@/convex/_generated/api';
import { useConvexUserLinkState } from '@/lib/useConvexUserQueryReady';
import {
  parseRoomSlugFromPathname,
  ROOM_PLAYBACK_POSITION_INTERVAL_MS,
  ROOM_PLAYBACK_SEEK_RETRY_DELAYS_MS,
} from '@/lib/roomPlayback';
import ReactPlayer from 'react-player';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Plus, X, ListMusic } from 'lucide-react';
import AudioVisualizer from './AudioVisualizer';
import QueuePanel from './QueuePanel';
import { usePlaylists } from '@/components/hooks/usePlaylists';
import { useUser } from '@clerk/nextjs';
import type { Song } from '@/types';

function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function PlayerBar() {
  const playerRef = useRef<ReactPlayer>(null);
  const [isSeeking, setIsSeeking] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  
  const {
    currentSong,
    isPlaying,
    togglePlay,
    playNext,
    playPrevious,
    volume,
    setVolume,
    queue,
    history,
    duration,
    currentTime,
    setDuration,
    setCurrentTime,
    oneShotSeekSeconds,
    clearPlayer,
  } = usePlayerStore();

  const isValidYoutubeId =
    Boolean(currentSong) &&
    typeof currentSong!.id === 'string' &&
    /^[A-Za-z0-9_-]{6,}$/.test(currentSong!.id);
  const youtubeUrl =
    isValidYoutubeId && currentSong
      ? `https://www.youtube.com/watch?v=${currentSong.id}`
      : null;

  const pathname = usePathname();
  const roomSlug = parseRoomSlugFromPathname(pathname);
  const link = useConvexUserLinkState();
  const room = useQuery(
    api.listeningRooms.getRoomWithMembersBySlug,
    roomSlug && link.ready ? { slug: roomSlug } : 'skip',
  );
  const myConvexUserId = useQuery(
    api.listeningRooms.getMyConvexUserId,
    roomSlug && link.ready ? {} : 'skip',
  );
  const syncRoomPlayback = useMutation(api.listeningRooms.syncRoomPlayback);

  const shouldSendPeriodicRoomHeartbeat = useCallback((): boolean => {
    if (!roomSlug || !link.ready) return false;
    if (room === undefined || room === null) return false;
    if (myConvexUserId === undefined) return false;
    const pb = room.playback;
    if (!pb?.song) return true;
    const leader = pb.leaderUserId;
    if (leader === undefined) return true;
    return String(leader) === String(myConvexUserId);
  }, [roomSlug, link.ready, room, myConvexUserId]);

  const pushRoomPlayback = useCallback(
    async (song: Song, positionSec: number, playing: boolean, claimLead: boolean) => {
      if (!roomSlug) return;
      try {
        await syncRoomPlayback({
          slug: roomSlug,
          song: {
            id: song.id,
            title: song.title,
            artist: song.artist,
            thumbnailUrl: song.thumbnailUrl,
            duration: song.duration,
          },
          positionSec,
          isPlaying: playing,
          claimLead,
        });
      } catch {
        /* not a member or offline */
      }
    },
    [roomSlug, syncRoomPlayback],
  );

  // Track nonce so we can tell when a store change came from room sync vs. user action.
  const roomSyncNonceRef = useRef(usePlayerStore.getState()._roomSyncNonce);

  // Publish on track / play-state change — but NOT when the change was caused by room sync.
  useEffect(() => {
    if (!roomSlug || !currentSong) return;
    const state = usePlayerStore.getState();
    if (!state.currentSong) return;
    if (state._roomSyncNonce !== roomSyncNonceRef.current) {
      roomSyncNonceRef.current = state._roomSyncNonce;
      return;
    }
    void pushRoomPlayback(state.currentSong, state.currentTime, state.isPlaying, true);
  }, [roomSlug, currentSong?.id, isPlaying, pushRoomPlayback, currentSong]);

  useEffect(() => {
    if (!roomSlug || !currentSong || !isPlaying) return;
    const id = window.setInterval(() => {
      if (!shouldSendPeriodicRoomHeartbeat()) return;
      const { currentSong: s, currentTime: t, isPlaying: p } = usePlayerStore.getState();
      if (s && p) void pushRoomPlayback(s, t, true, false);
    }, ROOM_PLAYBACK_POSITION_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [
    roomSlug,
    currentSong?.id,
    currentSong,
    isPlaying,
    pushRoomPlayback,
    shouldSendPeriodicRoomHeartbeat,
  ]);

  // Room-synced seek: YouTube needs a moment after load.
  useEffect(() => {
    if (oneShotSeekSeconds == null || !youtubeUrl) return;
    const t = oneShotSeekSeconds;
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      if (playerRef.current) {
        playerRef.current.seekTo(t, 'seconds');
        setCurrentTime(t);
        usePlayerStore.setState({ oneShotSeekSeconds: null });
      }
    };
    run();
    const timeoutIds = ROOM_PLAYBACK_SEEK_RETRY_DELAYS_MS.map((delay) =>
      window.setTimeout(run, delay),
    );
    return () => {
      cancelled = true;
      for (const t of timeoutIds) window.clearTimeout(t);
    };
  }, [oneShotSeekSeconds, youtubeUrl, setCurrentTime, currentSong?.id]);

  // Force play when isPlaying changes and user has interacted
  useEffect(() => {
    if (hasUserInteracted && playerRef.current && isPlaying) {
      const tryPlay = () => {
        try {
          const internalPlayer = playerRef.current?.getInternalPlayer();
          if (internalPlayer) {
            // Try YouTube iframe API first
            if (typeof (internalPlayer as any).playVideo === 'function') {
              (internalPlayer as any).playVideo();
              return true;
            }
            // Fallback to HTML5 play
            if (typeof (internalPlayer as any).play === 'function') {
              (internalPlayer as any).play().catch((err: any) => {
                console.warn('HTML5 play failed, trying YouTube API:', err);
                // Retry with YouTube API
                if (typeof (internalPlayer as any).playVideo === 'function') {
                  (internalPlayer as any).playVideo();
                }
              });
              return true;
            }
          }
        } catch (error) {
          console.warn('Error playing video:', error);
        }
        return false;
      };

      // Try immediately, then retry if needed
      if (!tryPlay()) {
        setTimeout(() => tryPlay(), 200);
      }
    }
  }, [isPlaying, hasUserInteracted]);

  const handleProgress = (state: { played: number; playedSeconds: number; loaded: number; loadedSeconds: number }) => {
    if (!isSeeking) {
      setCurrentTime(state.playedSeconds);
    }
  };

  const handleDuration = (duration: number) => {
    setDuration(duration);
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
  };

  const handleSeekMouseUp = (e: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>) => {
    const newTime = parseFloat((e.currentTarget as HTMLInputElement).value);
    if (playerRef.current) {
      playerRef.current.seekTo(newTime, 'seconds');
    }
    setIsSeeking(false);
    if (roomSlug) {
      const { currentSong: s, isPlaying: p } = usePlayerStore.getState();
      if (s) void pushRoomPlayback(s, newTime, p, true);
    }
  };

  const handleSeekMouseDown = () => {
    setIsSeeking(true);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value));
  };

  const handlePrevious = () => {
    const seekTo = (time: number) => {
      if (playerRef.current) {
        playerRef.current.seekTo(time, 'seconds');
      }
    };
    playPrevious(currentTime, seekTo);
  };

  const handleNext = async () => {
    await playNext();
  };

  const handleEnded = async () => {
    await playNext();
  };

  const handlePlayPauseClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Mark that user has interacted
    setHasUserInteracted(true);
    
    // Toggle play state
    togglePlay();
    
    // On mobile, immediately try to control playback directly
    if (playerRef.current) {
      setTimeout(() => {
        try {
          const internalPlayer = playerRef.current?.getInternalPlayer();
          if (internalPlayer) {
            if (!isPlaying) {
              // User wants to play
              if (typeof (internalPlayer as any).playVideo === 'function') {
                (internalPlayer as any).playVideo();
              } else if (typeof (internalPlayer as any).play === 'function') {
                (internalPlayer as any).play().catch(() => {
                  if (typeof (internalPlayer as any).playVideo === 'function') {
                    (internalPlayer as any).playVideo();
                  }
                });
              }
            } else {
              // User wants to pause
              if (typeof (internalPlayer as any).pauseVideo === 'function') {
                (internalPlayer as any).pauseVideo();
              } else if (typeof (internalPlayer as any).pause === 'function') {
                (internalPlayer as any).pause();
              }
            }
          }
        } catch (error) {
          console.warn('Error controlling playback:', error);
        }
      }, 50);
    }
  };

  // Don't render if there's no current song
  // This must come AFTER all hooks to satisfy Rules of Hooks
  if (!currentSong) {
    return null;
  }

  if (!isValidYoutubeId) {
    console.warn('Current song has an invalid YouTube id:', currentSong);
  }

  return (
    <div className="fixed bottom-0 w-full bg-miko-white/30 backdrop-blur-md border-t border-sakura-primary/30 shadow-[0_0_20px_rgba(255,183,197,0.2)] z-50">
      {/* ReactPlayer for audio playback - only render when we have a valid YouTube URL */}
      {youtubeUrl ? (
        <div 
          style={{ 
            position: 'fixed',
            top: '0',
            left: '0',
            width: '1px',
            height: '1px',
            opacity: 0,
            pointerEvents: 'none',
            zIndex: -1,
          }}
        >
          <ReactPlayer
            ref={playerRef}
            url={youtubeUrl}
            playing={isPlaying}
            volume={volume}
            width="100%"
            height="100%"
            config={{
              youtube: {
                playerVars: {
                  autoplay: 0, // Disable autoplay to allow manual control on mobile
                  controls: 0,
                  disablekb: 1,
                  fs: 0,
                  iv_load_policy: 3,
                  modestbranding: 1,
                  playsinline: 1, // Critical for iOS
                  rel: 0,
                  showinfo: 0,
                  enablejsapi: 1,
                  mute: 0,
                  origin: typeof window !== 'undefined' ? window.location.origin : '',
                },
              },
            }}
            playsinline={true}
            onEnded={handleEnded}
            onProgress={handleProgress}
            onDuration={handleDuration}
            onError={(error) => {
              console.error('Player error:', error);
            }}
            onReady={() => {
              console.log('Player ready');
              // If already playing when ready, try to play
              if (isPlaying && hasUserInteracted) {
                setTimeout(() => {
                  const internalPlayer = playerRef.current?.getInternalPlayer();
                  if (internalPlayer && typeof (internalPlayer as any).playVideo === 'function') {
                    (internalPlayer as any).playVideo();
                  }
                }, 100);
              }
            }}
          />
        </div>
      ) : null}

      {/* Audio Visualizer */}
      <AudioVisualizer />

      {/* Progress Bar */}
      <div className="px-4 pb-2">
        <div className="flex items-center gap-3">
          <span className="text-sakura-deep text-xs font-mono min-w-[3rem] text-right text-gray-800">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeekChange}
            onMouseDown={handleSeekMouseDown}
            onMouseUp={handleSeekMouseUp}
            onTouchStart={handleSeekMouseDown}
            onTouchEnd={handleSeekMouseUp}
            className="flex-1 cyber-slider"
            style={{
              background: `linear-gradient(to right, rgba(255, 183, 197, 0.6) 0%, rgba(255, 183, 197, 0.6) ${(currentTime / (duration || 1)) * 100}%, rgba(0, 0, 0, 0.1) ${(currentTime / (duration || 1)) * 100}%, rgba(0, 0, 0, 0.1) 100%)`,
            }}
          />
          <span className="text-sakura-deep text-xs font-mono min-w-[3rem] text-gray-800">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Player Bar UI */}
      <div className="flex items-center justify-between px-4 py-3">
        {/* Song Info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <img
            src={currentSong.thumbnailUrl}
            alt={currentSong.title}
            className="w-12 h-12 rounded object-cover border border-sakura-primary/30"
          />
          <div className="flex flex-col min-w-0">
            <p className="text-gray-800 font-medium truncate">{currentSong.title}</p>
            <p className="text-sakura-deep text-sm truncate">{currentSong.artist}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevious}
            disabled={history.length === 0 && currentTime <= 3}
            className="p-2 text-sakura-deep hover:text-sakura-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous"
          >
            <SkipBack size={20} />
          </button>

          <button
            onClick={handlePlayPauseClick}
            className="p-2 bg-gradient-to-r from-sakura-deep to-sakura-primary backdrop-blur-sm text-white rounded-full hover:from-sakura-deep/90 hover:to-sakura-primary/90 transition-all border border-sakura-primary/50 shadow-[0_0_15px_rgba(255,183,197,0.6)] hover:ring-2 hover:ring-gold-accent/50 active:scale-95"
            aria-label={isPlaying ? 'Pause' : 'Play'}
            style={{ animation: isPlaying ? 'sakuraGlow 2s ease-in-out infinite' : 'none', WebkitTapHighlightColor: 'transparent' }}
          >
            {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
          </button>

          <button
            onClick={handleNext}
            className="p-2 text-sakura-deep hover:text-sakura-primary transition-colors"
            aria-label="Next"
          >
            <SkipForward size={20} />
          </button>
        </div>

        {/* Volume Control */}
        <div className="flex items-center gap-2 flex-1 justify-end">
          {volume === 0 ? (
            <VolumeX size={18} className="text-sakura-deep" />
          ) : (
            <Volume2 size={18} className="text-sakura-deep" />
          )}
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            className="w-24 cyber-slider"
            style={{
              background: `linear-gradient(to right, rgba(255, 183, 197, 0.6) 0%, rgba(255, 183, 197, 0.6) ${volume * 100}%, rgba(0, 0, 0, 0.1) ${volume * 100}%, rgba(0, 0, 0, 0.1) 100%)`,
            }}
          />
        </div>

        {/* Queue toggle */}
        <div className="ml-4 relative">
          <button
            onClick={() => setQueueOpen((v) => !v)}
            className={`p-2 transition-colors rounded-full flex items-center gap-1 ${
              queueOpen
                ? 'text-sakura-primary'
                : 'text-sakura-deep hover:text-sakura-primary'
            }`}
            aria-label="Toggle queue"
          >
            <ListMusic size={18} />
            {queue.length > 0 && (
              <span className="text-xs font-medium">{queue.length}</span>
            )}
          </button>
          {queueOpen && <QueuePanel onClose={() => setQueueOpen(false)} />}
        </div>

        {/* Add to playlist (+) */}
        <div className="ml-4 relative">
          <AddToPlaylistButton currentSong={currentSong} />
        </div>

        {/* Close / stop playing */}
        <button
          onClick={clearPlayer}
          className="ml-2 p-2 text-sakura-deep hover:text-red-500 transition-colors rounded-full"
          aria-label="Stop playing"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}

function AddToPlaylistButton({ currentSong }: { currentSong: any }) {
  const { playlists, createPlaylist, addSongToPlaylist, enabled, playlistBackendHelp } =
    usePlaylists();
  const { isSignedIn } = useUser();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toggle = () => setOpen((s) => !s);

  if (!currentSong) return null;

  const onCreate = async () => {
    if (!createPlaylist) return;
    if (!newName.trim()) return;
    setCreating(true);
    try {
      setError(null);
      const res = await createPlaylist(newName.trim(), '');
      // After creating, try to add the song to the new playlist
      if (addSongToPlaylist && res) {
        setLoadingId(String(res));
        await addSongToPlaylist(res, currentSong);
        setLoadingId(null);
      }
      setNewName('');
      setOpen(false);
    } catch (err: any) {
      console.error('Create playlist failed', err);
      setError(err?.message || String(err));
    } finally {
      setCreating(false);
    }
  };

  const onAdd = async (playlistId: any) => {
    if (!addSongToPlaylist) return;
    try {
      setError(null);
      setLoadingId(String(playlistId));
      await addSongToPlaylist(playlistId, currentSong);
      setLoadingId(null);
      setOpen(false);
    } catch (err: any) {
      console.error('Add song failed', err);
      setError(err?.message || String(err));
      setLoadingId(null);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={toggle}
        className="p-2 text-sakura-deep hover:text-sakura-primary transition-colors rounded-full bg-white/10"
        aria-label="Add to playlist"
      >
        <Plus size={18} />
      </button>

      {open && (
        <div className="absolute right-0 bottom-12 w-64 bg-miko-white/95 backdrop-blur-sm border border-sakura-primary/20 rounded shadow-lg p-3 z-50">
          <div className="text-sm font-medium text-gray-800 mb-2">Save to playlist</div>
          <div className="max-h-40 overflow-auto">
            {Array.isArray(playlists) && playlists.length > 0 ? (
              playlists.map((p: any) => (
                <button
                  key={String(p.id || p._id || p)}
                  className="w-full text-left py-1 px-2 hover:bg-sakura-primary/10 rounded"
                  onClick={() => onAdd(p.id || p._id || p)}
                  disabled={!enabled || !!loadingId}
                >
                  <div className="flex justify-between items-center">
                    <span className="truncate">{p.name}</span>
                    {loadingId && String(loadingId) === String(p.id || p._id || p) && (
                      <span className="text-xs text-sakura-deep">Adding...</span>
                    )}
                  </div>
                </button>
              ))
            ) : (
              <div className="text-xs text-gray-600 py-2">No playlists yet</div>
            )}
          </div>

          <div className="mt-2 border-t pt-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New playlist"
              className="w-full px-2 py-1 text-sm border rounded bg-white/90"
            />
            {/* Informational hint when create is not available */}
            {!isSignedIn ? (
              <div className="text-xs text-gray-600 mt-1">Sign in to create playlists.</div>
            ) : playlistBackendHelp.kind === 'missing_convex_url' ? (
              <div className="text-xs text-gray-600 mt-1">
                Set <code className="text-gray-500">NEXT_PUBLIC_CONVEX_URL</code> in{' '}
                <code className="text-gray-500">.env.local</code> (local) or Vercel env, then
                redeploy.
              </div>
            ) : playlistBackendHelp.kind === 'clerk_loading' ||
              playlistBackendHelp.kind === 'convex_connecting' ? (
              <div className="text-xs text-gray-600 mt-1">Connecting to your library…</div>
            ) : playlistBackendHelp.kind === 'convex_auth_setup' ? (
              <div className="text-xs text-gray-600 mt-1 leading-snug space-y-1">
                <p>
                  Convex rejected the Clerk token. Most often the JWT <code className="text-gray-500">aud</code>{' '}
                  claim is wrong.
                </p>
                <p>
                  In Clerk, open{' '}
                  <a
                    href="https://dashboard.clerk.com/apps/setup/convex"
                    className="text-cyan-600 underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Activate Convex integration
                  </a>{' '}
                  (sets <code className="text-gray-500">aud</code> for Convex). Or edit your{' '}
                  <code className="text-gray-500">convex</code> JWT template and add claims:{' '}
                  <code className="text-gray-500">{`{"aud":"convex"}`}</code>.
                </p>
                <p>
                  Convex env: <code className="text-gray-500">CLERK_JWT_ISSUER_DOMAIN</code> = template Issuer.
                  If <code className="text-gray-500">aud</code> on{' '}
                  <a href="https://jwt.io" className="text-cyan-600 underline" target="_blank" rel="noreferrer">
                    jwt.io
                  </a>{' '}
                  is not <code className="text-gray-500">convex</code>, fix the Clerk template (or change{' '}
                  <code className="text-gray-500">applicationID</code> in{' '}
                  <code className="text-gray-500">convex/auth.config.ts</code> to match <code className="text-gray-500">aud</code>), then{' '}
                  <code className="text-gray-500">npx convex deploy</code>.
                </p>
              </div>
            ) : !createPlaylist ? (
              <div className="text-xs text-gray-600 mt-1">Playlists are unavailable right now.</div>
            ) : null}

            {error && (
              <div className="text-xs text-red-600 mt-1">{error}</div>
            )}

            <div className="flex gap-2 mt-2">
              <button
                onClick={onCreate}
                disabled={!createPlaylist || creating}
                className="flex-1 bg-sakura-deep text-white text-sm py-1 rounded disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create & Add'}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="flex-1 border border-sakura-primary text-sm py-1 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
