'use client';

import { useState, useEffect, useRef } from 'react';
import { searchYoutube, getRelatedVideos } from '@/lib/youtube';
import { usePlayerStore } from '@/lib/store';
import type { Song } from '@/types';
import { Play, Search, Loader2, Heart, TrendingUp, History } from 'lucide-react';
import { useLikeSong } from '@/components/hooks/useLikedSongs';
import QuotaWarning from '@/components/ui/QuotaWarning';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Popular/recommended songs to show on initial load
const POPULAR_SEARCHES = [
  'trending music 2024',
  'top hits',
  'popular songs',
  'latest music',
  'chart toppers',
];

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Song[]>([]);
  const [suggestions, setSuggestions] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recommendedSongs, setRecommendedSongs] = useState<Song[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const setSong = usePlayerStore((state) => state.setSong);
  const { toggleLike, isSignedIn } = useLikeSong();
  const likedSongs = usePlayerStore((state) => state.likedSongs);
  const history = usePlayerStore((state) => state.history);
  const currentSong = usePlayerStore((state) => state.currentSong);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const songs = await searchYoutube(query);
      setResults(songs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search for songs');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlay = (song: Song) => {
    setSong(song);
  };

  // Load personalized recommended songs ONLY based on actual listening history
  useEffect(() => {
    // Don't show recommendations if user has no listening history
    if (!currentSong && history.length === 0) {
      setRecommendedSongs([]);
      return;
    }

    const loadRecommended = async () => {
      try {
        let recommended: Song[] = [];
        const MIN_DURATION = 120; // Filter out songs shorter than 2 minutes
        
        // Create a set of all song IDs to exclude (current, history, liked)
        const excludeIds = new Set<string>();
        if (currentSong) excludeIds.add(currentSong.id);
        history.forEach(s => excludeIds.add(s.id));
        likedSongs.forEach(s => excludeIds.add(s.id));

        // Strategy 1: Use current song to get related videos
        if (currentSong) {
          try {
            const related = await getRelatedVideos(currentSong.id);
            const filtered = related
              .filter(s => s.duration >= MIN_DURATION)
              .filter(s => !excludeIds.has(s.id)); // Exclude songs already known
            recommended = [...recommended, ...filtered];
          } catch (err) {
            if (err instanceof Error && err.message.includes('quota')) {
              console.warn('API quota exceeded');
              setRecommendedSongs([]);
              return;
            }
            console.warn('Failed to get related videos for current song:', err);
          }
        }

        // Strategy 2: Use recently played songs from history (up to 2 most recent)
        if (recommended.length < 8 && history.length > 0) {
          const recentSongs = history.slice(0, 2); // Use 2 most recent songs
          for (const song of recentSongs) {
            if (recommended.length >= 12) break; // Don't fetch more than needed
            
            try {
              const related = await getRelatedVideos(song.id);
              const filtered = related
                .filter(s => s.duration >= MIN_DURATION)
                .filter(s => !excludeIds.has(s.id)) // Exclude duplicates
                .filter(s => !recommended.some(r => r.id === s.id)); // Exclude already recommended
              recommended = [...recommended, ...filtered];
            } catch (err) {
              if (err instanceof Error && err.message.includes('quota')) {
                break; // Stop if quota exceeded
              }
              console.warn('Failed to get related videos:', err);
            }
          }
        }

        // Remove duplicates, exclude history/liked, and limit to 8 songs
        const uniqueRecommended = recommended
          .filter((song, index, self) => 
            index === self.findIndex(s => s.id === song.id)
          )
          .filter(s => !excludeIds.has(s.id)) // Final filter to exclude history/liked
          .slice(0, 8);

        // Only set if we have valid recommendations
        if (uniqueRecommended.length > 0) {
          setRecommendedSongs(uniqueRecommended);
        } else {
          setRecommendedSongs([]);
        }
      } catch (err) {
        console.error('Failed to load recommended songs:', err);
        setRecommendedSongs([]);
      }
    };
    
    loadRecommended();
  }, [currentSong, history, likedSongs]); // Will update when history changes

  // Debounced search suggestions as user types
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Increased debounce time to reduce API calls
    const timeoutId = setTimeout(async () => {
      setIsLoadingSuggestions(true);
      try {
        const songs = await searchYoutube(query);
        setSuggestions(songs.slice(0, 5)); // Show top 5 suggestions
        setShowSuggestions(true);
      } catch (err) {
        // If quota exceeded, don't show suggestions
        if (err instanceof Error && err.message.includes('quota')) {
          setSuggestions([]);
          setShowSuggestions(false);
        } else {
          setSuggestions([]);
        }
      } finally {
        setIsLoadingSuggestions(false);
      }
    }, 800); // Increased to 800ms debounce to reduce API calls

    return () => clearTimeout(timeoutId);
  }, [query]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSuggestionClick = (song: Song) => {
    setQuery(song.title);
    setShowSuggestions(false);
    handlePlay(song);
  };

  const handleQuickSearch = async (searchTerm: string) => {
    setQuery(searchTerm);
    setIsLoading(true);
    setError(null);
    try {
      const songs = await searchYoutube(searchTerm);
      setResults(songs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search for songs');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen text-gray-800 pb-24 pt-8 pl-0 md:pl-64">
      <div className="container mx-auto px-4 py-8">
        {/* Search Form - Glassmorphism */}
        <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-8">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sakura-deep/70 z-10" size={20} />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => {
                  if (suggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                placeholder="Search for a song or artist..."
                className="w-full pl-10 pr-4 py-3 bg-miko-white/30 backdrop-blur-md border border-sakura-primary/30 rounded-lg text-gray-800 placeholder-sakura-deep/50 focus:outline-none focus:ring-2 focus:ring-sakura-primary/50 focus:border-sakura-primary/50 transition-all focus:shadow-[0_0_15px_rgba(255,183,197,0.5)]"
              />
              
              {/* Search Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div
                  ref={suggestionsRef}
                  className="absolute top-full left-0 right-0 mt-2 bg-miko-white/90 backdrop-blur-md border border-sakura-primary/30 rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto"
                >
                  {isLoadingSuggestions ? (
                    <div className="p-4 text-center text-gray-700">
                      <Loader2 className="animate-spin mx-auto mb-2" size={20} />
                      <p className="text-sm">Finding songs...</p>
                    </div>
                  ) : (
                    <div className="py-2">
                      {suggestions.map((song) => (
                        <button
                          key={song.id}
                          onClick={() => handleSuggestionClick(song)}
                          className="w-full px-4 py-3 hover:bg-sakura-primary/20 transition-colors text-left flex items-center gap-3 group"
                        >
                          <img
                            src={song.thumbnailUrl}
                            alt={song.title}
                            className="w-12 h-12 rounded object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-800 font-medium truncate group-hover:text-sakura-deep">
                              {song.title}
                            </p>
                            <p className="text-sm text-gray-600 truncate">{song.artist}</p>
                          </div>
                          <Play size={16} className="text-sakura-deep opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="px-6 py-3 bg-gradient-to-r from-sakura-deep to-sakura-primary backdrop-blur-md hover:from-sakura-deep/90 hover:to-sakura-primary/90 disabled:bg-gray-400/50 disabled:cursor-not-allowed border border-sakura-primary/50 rounded-lg font-medium transition-all flex items-center gap-2 text-white shadow-[0_0_10px_rgba(255,183,197,0.4)] hover:shadow-[0_0_15px_rgba(255,183,197,0.6)] hover:ring-2 hover:ring-gold-accent/50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Searching...
                </>
              ) : (
                'Search'
              )}
            </button>
          </div>
        </form>

        {/* Quota Warning */}
        <QuotaWarning error={error} />

        {/* Error Message - Glassmorphism */}
        {error && !error.includes('quota') && (
          <div className="max-w-2xl mx-auto mb-8 p-4 bg-red-900/30 backdrop-blur-md border border-red-500/30 rounded-lg text-red-300">
            {error}
          </div>
        )}

        {/* Recommended Songs - Only show if user has listening history */}
        {!query && recommendedSongs.length > 0 && results.length === 0 && (currentSong || history.length > 0) && (
          <div className="max-w-6xl mx-auto mb-8">
            <div className="flex items-center gap-2 mb-4">
              <History className="text-sakura-deep" size={24} />
              <h2 className="text-2xl font-semibold text-gray-800">Recommended for You</h2>
              <span className="text-sm text-gray-600 ml-2">
                {currentSong ? 'Based on what you\'re playing' : 
                 history.length > 0 ? `Based on your ${history.length} recently played song${history.length > 1 ? 's' : ''}` : 
                 'Based on your liked songs'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {recommendedSongs.map((song) => (
                <div
                  key={song.id}
                  className="bg-miko-white/30 backdrop-blur-md border border-sakura-primary/20 rounded-lg overflow-hidden hover:bg-miko-white/40 hover:border-sakura-primary/40 transition-all group"
                >
                  <div className="relative">
                    <img
                      src={song.thumbnailUrl}
                      alt={song.title}
                      className="w-full aspect-video object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={() => handlePlay(song)}
                        className="bg-gradient-to-r from-sakura-deep to-sakura-primary hover:from-sakura-deep/90 hover:to-sakura-primary/90 rounded-full p-3 transition-colors shadow-[0_0_10px_rgba(255,183,197,0.5)]"
                        aria-label={`Play ${song.title}`}
                      >
                        <Play size={24} fill="white" />
                      </button>
                    </div>
                    {song.duration > 0 && (
                      <div className="absolute bottom-2 right-2 bg-miko-white/80 backdrop-blur-sm border border-sakura-primary/30 px-2 py-1 rounded text-xs text-gray-800">
                        {formatDuration(song.duration)}
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-medium text-gray-800 truncate mb-1" title={song.title}>
                      {song.title}
                    </h3>
                    <p className="text-sm text-sakura-deep truncate" title={song.artist}>
                      {song.artist}
                    </p>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handlePlay(song)}
                        className="flex-1 py-2 bg-gradient-to-r from-sakura-deep to-sakura-primary backdrop-blur-sm hover:from-sakura-deep/90 hover:to-sakura-primary/90 border border-sakura-primary/50 rounded-lg font-medium transition-all text-white flex items-center justify-center gap-2 hover:ring-2 hover:ring-gold-accent/50"
                      >
                        <Play size={16} fill="currentColor" />
                        Play
                      </button>
                      {isSignedIn && (
                        <button
                          onClick={() => toggleLike(song)}
                          className={`p-2 border rounded-lg transition-colors ${
                            likedSongs.some(s => s.id === song.id)
                              ? 'bg-pink-500/80 border-pink-400/50 text-white'
                              : 'bg-miko-white/40 border-sakura-primary/20 text-gray-700 hover:bg-miko-white/50'
                          }`}
                          aria-label={likedSongs.some(s => s.id === song.id) ? 'Unlike' : 'Like'}
                        >
                          <Heart 
                            size={16} 
                            fill={likedSongs.some(s => s.id === song.id) ? 'currentColor' : 'none'} 
                          />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Search Tags - Only show if no history and no recommendations */}
        {!query && results.length === 0 && (!currentSong && history.length === 0) && (
          <div className="max-w-2xl mx-auto mb-8">
            <p className="text-gray-700 mb-3 text-sm">Try searching for:</p>
            <div className="flex flex-wrap gap-2">
              {POPULAR_SEARCHES.map((searchTerm) => (
                <button
                  key={searchTerm}
                  onClick={() => handleQuickSearch(searchTerm)}
                  className="px-4 py-2 bg-sakura-primary/20 hover:bg-sakura-primary/30 border border-sakura-primary/30 rounded-full text-sm text-sakura-deep hover:text-sakura-primary transition-colors"
                >
                  {searchTerm}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results Grid */}
        {results.length > 0 && (
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800">Search Results</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {results.map((song) => (
                <div
                  key={song.id}
                  className="bg-miko-white/30 backdrop-blur-md border border-sakura-primary/20 rounded-lg overflow-hidden hover:bg-miko-white/40 hover:border-sakura-primary/40 transition-all group"
                >
                  <div className="relative">
                    <img
                      src={song.thumbnailUrl}
                      alt={song.title}
                      className="w-full aspect-video object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={() => handlePlay(song)}
                        className="bg-purple-600 hover:bg-purple-700 rounded-full p-3 transition-colors"
                        aria-label={`Play ${song.title}`}
                      >
                        <Play size={24} fill="white" />
                      </button>
                    </div>
                    {song.duration > 0 && (
                      <div className="absolute bottom-2 right-2 bg-miko-white/80 backdrop-blur-sm border border-sakura-primary/30 px-2 py-1 rounded text-xs text-gray-800">
                        {formatDuration(song.duration)}
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-medium text-white truncate mb-1" title={song.title}>
                      {song.title}
                    </h3>
                    <p className="text-sm text-gray-400 truncate" title={song.artist}>
                      {song.artist}
                    </p>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handlePlay(song)}
                        className="flex-1 py-2 bg-gradient-to-r from-sakura-deep to-sakura-primary backdrop-blur-sm hover:from-sakura-deep/90 hover:to-sakura-primary/90 border border-sakura-primary/50 rounded-lg font-medium transition-all text-white flex items-center justify-center gap-2 hover:ring-2 hover:ring-gold-accent/50"
                      >
                        <Play size={16} fill="currentColor" />
                        Play
                      </button>
                      {isSignedIn && (
                        <button
                          onClick={() => toggleLike(song)}
                          className={`p-2 border rounded-lg transition-colors ${
                            likedSongs.some(s => s.id === song.id)
                              ? 'bg-pink-500/80 border-pink-400/50 text-white'
                              : 'bg-miko-white/40 border-sakura-primary/20 text-gray-700 hover:bg-miko-white/50'
                          }`}
                          aria-label={likedSongs.some(s => s.id === song.id) ? 'Unlike' : 'Like'}
                        >
                          <Heart 
                            size={16} 
                            fill={likedSongs.some(s => s.id === song.id) ? 'currentColor' : 'none'} 
                          />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && results.length === 0 && !error && query && (
          <div className="text-center text-gray-700 mt-12">
            <Search size={48} className="mx-auto mb-4 opacity-50 text-sakura-deep" />
            <p className="text-lg font-medium mb-2">No music found</p>
            <p className="text-gray-600">Try a different search term or check your spelling.</p>
          </div>
        )}
      </div>
    </main>
  );
}
