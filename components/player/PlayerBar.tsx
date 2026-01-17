'use client';

import { useRef, useState, useEffect } from 'react';
import { usePlayerStore } from '@/lib/store';
import ReactPlayer from 'react-player';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX } from 'lucide-react';
import AudioVisualizer from './AudioVisualizer';

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
  } = usePlayerStore();

  // Construct YouTube URL from video ID
  const youtubeUrl = currentSong
    ? `https://www.youtube.com/watch?v=${currentSong.id}`
    : null;

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

  const handleSeekMouseUp = (e: React.MouseEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.currentTarget.value);
    if (playerRef.current) {
      playerRef.current.seekTo(newTime, 'seconds');
    }
    setIsSeeking(false);
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

  return (
    <div className="fixed bottom-0 w-full bg-miko-white/30 backdrop-blur-md border-t border-sakura-primary/30 shadow-[0_0_20px_rgba(255,183,197,0.2)] z-50">
      {/* ReactPlayer for audio playback - Mobile compatible */}
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
          url={youtubeUrl || ''}
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

        {/* Queue indicator (optional) */}
        {queue.length > 0 && (
          <div className="text-sakura-deep text-sm ml-4 text-gray-800 hidden md:block">
            {queue.length} in queue
          </div>
        )}
      </div>
    </div>
  );
}
