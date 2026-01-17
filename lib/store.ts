import { create } from 'zustand';
import type { Song, PlayerState } from '@/types';
import { getRelatedVideos, searchYoutube } from '@/lib/youtube';

interface PlayerStore extends PlayerState {
  // Actions
  setSong: (song: Song) => void;
  togglePlay: () => void;
  addToQueue: (song: Song) => void;
  playNext: () => Promise<void>;
  playPrevious: (currentTime: number, seekTo?: (time: number) => void) => void;
  setVolume: (volume: number) => void;
  setMinimized: (isMinimized: boolean) => void;
  setDuration: (duration: number) => void;
  setCurrentTime: (currentTime: number) => void;
  // Liked songs
  likedSongs: Song[];
  setLikedSongs: (songs: Song[]) => void;
  // History tracking
  history: Song[];
  setHistory: (songs: Song[]) => void;
  // Callback to save history to Convex
  onHistoryAdd?: (song: Song) => void;
  setOnHistoryAdd: (callback: ((song: Song) => void) | undefined) => void;
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  // Initial state
  isPlaying: false,
  currentSong: null,
  queue: [],
  volume: 1,
  isMinimized: false,
  duration: 0,
  currentTime: 0,
  history: [],
  likedSongs: [],
  onHistoryAdd: undefined,

  setLikedSongs: (songs: Song[]) => {
    set({ likedSongs: songs });
  },

  setHistory: (songs: Song[]) => {
    set({ history: songs });
  },

  setOnHistoryAdd: (callback: ((song: Song) => void) | undefined) => {
    set({ onHistoryAdd: callback });
  },

  // Actions
  setSong: (song: Song) => {
    const currentSong = get().currentSong;
    const { onHistoryAdd } = get();
    
    // Add previous song to history if it exists
    if (currentSong) {
      const newHistory = [currentSong, ...get().history.filter(s => s.id !== currentSong.id)].slice(0, 100);
      set({ history: newHistory });
      
      // Save to Convex if callback is set
      if (onHistoryAdd) {
        onHistoryAdd(currentSong);
      }
    }
    
    set({
      currentSong: song,
      isPlaying: true,
      // Clear queue when manually selecting a new song to ensure fresh related content
      queue: [],
      currentTime: 0, // Reset time for new song
    });
  },

  togglePlay: () => {
    set((state) => ({
      isPlaying: !state.isPlaying,
    }));
  },

  addToQueue: (song: Song) => {
    set((state) => ({
      queue: [...state.queue, song],
    }));
  },

  playNext: async () => {
    const { queue, currentSong } = get();
    
    // Scenario A: Queue has songs
    if (queue.length > 0) {
      const [nextSong, ...remainingQueue] = queue;
      const { onHistoryAdd } = get();
      
      // Add previous song to history
      if (currentSong) {
        const newHistory = [currentSong, ...get().history.filter(s => s.id !== currentSong.id)].slice(0, 100);
        set({ history: newHistory });
        
        // Save to Convex if callback is set
        if (onHistoryAdd) {
          onHistoryAdd(currentSong);
        }
      }
      
      set({
        currentSong: nextSong,
        queue: remainingQueue,
        isPlaying: true,
        currentTime: 0, // Reset time for new song
      });
      return;
    }

    // Scenario B: Queue is empty, get related videos
    if (currentSong) {
      try {
        let relatedSongs: Song[] = [];
        
        // Try to get related videos
        try {
          relatedSongs = await getRelatedVideos(currentSong.id);
        } catch (error) {
          console.warn('Failed to get related videos, falling back to search:', error);
        }

        // Fallback: If related videos are empty, search by song title/keywords
        if (relatedSongs.length === 0 && currentSong.title) {
          try {
            // Extract keywords from title (remove common words, take first few meaningful words)
            const titleWords = currentSong.title
              .toLowerCase()
              .replace(/[^\w\s]/g, ' ') // Remove special characters
              .split(/\s+/)
              .filter(word => word.length > 2) // Filter out short words
              .filter(word => !['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'].includes(word))
              .slice(0, 3) // Take first 3 meaningful words
              .join(' ');
            
            // Search using the song title or extracted keywords
            const searchQuery = titleWords || currentSong.title;
            relatedSongs = await searchYoutube(searchQuery);
          } catch (error) {
            console.error('Failed to search by title:', error);
          }
        }

        // Filter out current song and songs from history to avoid duplicates
        const { history } = get();
        const historyIds = new Set(history.map(song => song.id));
        relatedSongs = relatedSongs.filter(song => 
          song.id !== currentSong.id && !historyIds.has(song.id)
        );

        if (relatedSongs.length > 0) {
          const [nextSong, ...restSongs] = relatedSongs;
          // Also filter restSongs to avoid duplicates in queue
          const existingQueueIds = new Set(get().queue.map(song => song.id));
          const filteredRestSongs = restSongs.filter(song => 
            song.id !== currentSong.id && 
            !historyIds.has(song.id) && 
            !existingQueueIds.has(song.id)
          );
          
          const { onHistoryAdd } = get();
          
          // Add previous song to history
          if (currentSong) {
            const newHistory = [currentSong, ...get().history.filter(s => s.id !== currentSong.id)].slice(0, 100);
            set({ history: newHistory });
            
            // Save to Convex if callback is set
            if (onHistoryAdd) {
              onHistoryAdd(currentSong);
            }
          }
          
          set({
            currentSong: nextSong,
            queue: filteredRestSongs, // Add the rest to queue as buffer (filtered)
            isPlaying: true,
            currentTime: 0, // Reset time for new song
          });
        }
      } catch (error) {
        console.error('Error in playNext auto-play:', error);
      }
    }
  },

  playPrevious: (currentTime: number, seekTo?: (time: number) => void) => {
    const { history, currentSong } = get();
    
    // If currentTime > 3 seconds, just restart the current song
    if (currentTime > 3 && currentSong && seekTo) {
      seekTo(0);
      set({ currentTime: 0 });
      return;
    }

    // If currentTime <= 3 seconds or no seekTo function, go to previous song
    if (history.length > 0) {
      const [previousSong, ...remainingHistory] = history;
      set({
        currentSong: previousSong,
        history: remainingHistory,
        isPlaying: true,
        // Add current song to queue if it exists
        queue: currentSong ? [currentSong, ...get().queue] : get().queue,
        currentTime: 0, // Reset time for previous song
      });
    } else if (currentSong && seekTo) {
      // If no history but we have a current song, just restart it
      seekTo(0);
      set({ currentTime: 0 });
    }
  },

  setVolume: (volume: number) => {
    set({ volume: Math.max(0, Math.min(1, volume)) });
  },

  setMinimized: (isMinimized: boolean) => {
    set({ isMinimized });
  },

  setDuration: (duration: number) => {
    set({ duration });
  },

  setCurrentTime: (currentTime: number) => {
    set({ currentTime });
  },
}));
