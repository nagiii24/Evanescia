'use client';

import { useState, useEffect } from 'react';
import { getArtistSongs } from '@/lib/youtube';
import { usePlayerStore } from '@/lib/store';
import type { Song } from '@/types';
import { Play, Mic2, Music, TrendingUp, Loader2, X, Heart } from 'lucide-react';
import { useLikeSong } from '@/components/hooks/useLikedSongs';

interface Artist {
  name: string;
  category: 'artist' | 'band' | 'influencer';
  description: string;
  emoji: string;
}

// Popular artists, bands, and influencers
const POPULAR_ARTISTS: Artist[] = [
  // Top Artists
  { name: 'Taylor Swift', category: 'artist', description: 'Pop Superstar', emoji: '🎤' },
  { name: 'The Weeknd', category: 'artist', description: 'R&B & Pop', emoji: '🎵' },
  { name: 'Drake', category: 'artist', description: 'Hip-Hop Icon', emoji: '🎧' },
  { name: 'Ariana Grande', category: 'artist', description: 'Pop Sensation', emoji: '💫' },
  { name: 'Ed Sheeran', category: 'artist', description: 'Singer-Songwriter', emoji: '🎸' },
  { name: 'Billie Eilish', category: 'artist', description: 'Alternative Pop', emoji: '🌙' },
  { name: 'Bad Bunny', category: 'artist', description: 'Reggaeton Star', emoji: '🔥' },
  { name: 'Olivia Rodrigo', category: 'artist', description: 'Pop Rock', emoji: '⭐' },
  
  // Bands
  { name: 'Coldplay', category: 'band', description: 'Alternative Rock', emoji: '🎸' },
  { name: 'Imagine Dragons', category: 'band', description: 'Rock Pop', emoji: '🎸' },
  { name: 'Maroon 5', category: 'band', description: 'Pop Rock', emoji: '🎸' },
  { name: 'Twenty One Pilots', category: 'band', description: 'Alternative', emoji: '🎸' },
  { name: 'Linkin Park', category: 'band', description: 'Rock', emoji: '🎸' },
  { name: 'Radiohead', category: 'band', description: 'Alternative Rock', emoji: '🎸' },
  
  // Influencers/Producers
  { name: 'Alan Walker', category: 'influencer', description: 'EDM Producer', emoji: '⚡' },
  { name: 'Marshmello', category: 'influencer', description: 'EDM Producer', emoji: '⚡' },
  { name: 'Avicii', category: 'influencer', description: 'EDM Legend', emoji: '⚡' },
  { name: 'Martin Garrix', category: 'influencer', description: 'EDM Producer', emoji: '⚡' },
  { name: 'Skrillex', category: 'influencer', description: 'Dubstep Pioneer', emoji: '⚡' },
];

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function ExplorePage() {
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [artistSongs, setArtistSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setSong = usePlayerStore((state) => state.setSong);
  const { toggleLike, isSignedIn } = useLikeSong();
  const likedSongs = usePlayerStore((state) => state.likedSongs);

  const handleArtistClick = async (artist: Artist) => {
    setSelectedArtist(artist);
    setIsLoading(true);
    setError(null);
    setArtistSongs([]);

    try {
      const songs = await getArtistSongs(artist.name);
      setArtistSongs(songs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load artist songs');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlay = (song: Song) => {
    setSong(song);
  };

  const closeArtistView = () => {
    setSelectedArtist(null);
    setArtistSongs([]);
    setError(null);
  };

  // Group artists by category
  const artistsByCategory = {
    artist: POPULAR_ARTISTS.filter(a => a.category === 'artist'),
    band: POPULAR_ARTISTS.filter(a => a.category === 'band'),
    influencer: POPULAR_ARTISTS.filter(a => a.category === 'influencer'),
  };

  return (
    <main className="min-h-screen text-gray-800 pb-24 pt-8 pl-0 md:pl-64">
      <div className="container mx-auto px-4 py-8">
        {!selectedArtist ? (
          <>
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Explore
              </h1>
              <p className="text-gray-300">Discover top artists, bands, and influencers</p>
            </div>

            {/* Top Artists Section */}
            <section className="mb-12">
              <div className="flex items-center gap-2 mb-4">
                <Mic2 className="text-cyan-400" size={24} />
                <h2 className="text-2xl font-semibold text-white">Top Artists</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {artistsByCategory.artist.map((artist) => (
                  <button
                    key={artist.name}
                    onClick={() => handleArtistClick(artist)}
                    className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-4 hover:bg-black/50 hover:border-cyan-400/50 transition-all group text-left"
                  >
                    <div className="text-4xl mb-2">{artist.emoji}</div>
                    <h3 className="font-medium text-white mb-1 truncate group-hover:text-cyan-300 transition-colors">
                      {artist.name}
                    </h3>
                    <p className="text-xs text-gray-400 truncate">{artist.description}</p>
                  </button>
                ))}
              </div>
            </section>

            {/* Bands Section */}
            <section className="mb-12">
              <div className="flex items-center gap-2 mb-4">
                <Music className="text-purple-400" size={24} />
                <h2 className="text-2xl font-semibold text-white">Popular Bands</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {artistsByCategory.band.map((band) => (
                  <button
                    key={band.name}
                    onClick={() => handleArtistClick(band)}
                    className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-4 hover:bg-black/50 hover:border-purple-400/50 transition-all group text-left"
                  >
                    <div className="text-4xl mb-2">{band.emoji}</div>
                    <h3 className="font-medium text-white mb-1 truncate group-hover:text-purple-300 transition-colors">
                      {band.name}
                    </h3>
                    <p className="text-xs text-gray-400 truncate">{band.description}</p>
                  </button>
                ))}
              </div>
            </section>

            {/* Influencers Section */}
            <section className="mb-12">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="text-pink-400" size={24} />
                <h2 className="text-2xl font-semibold text-white">Music Influencers</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {artistsByCategory.influencer.map((influencer) => (
                  <button
                    key={influencer.name}
                    onClick={() => handleArtistClick(influencer)}
                    className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-4 hover:bg-black/50 hover:border-pink-400/50 transition-all group text-left"
                  >
                    <div className="text-4xl mb-2">{influencer.emoji}</div>
                    <h3 className="font-medium text-white mb-1 truncate group-hover:text-pink-300 transition-colors">
                      {influencer.name}
                    </h3>
                    <p className="text-xs text-gray-400 truncate">{influencer.description}</p>
                  </button>
                ))}
              </div>
            </section>
          </>
        ) : (
          /* Artist Detail View */
          <div>
            {/* Header with Back Button */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <button
                  onClick={closeArtistView}
                  className="p-2 hover:bg-black/50 rounded-lg transition-colors"
                  aria-label="Back"
                >
                  <X size={24} />
                </button>
                <div>
                  <h1 className="text-4xl font-bold mb-1">{selectedArtist.name}</h1>
                  <p className="text-gray-300">{selectedArtist.description}</p>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-900/30 backdrop-blur-md border border-red-500/30 rounded-lg text-red-300">
                {error}
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="text-center py-12">
                <Loader2 className="animate-spin mx-auto mb-4 text-cyan-400" size={48} />
                <p className="text-gray-300">Loading {selectedArtist.name}'s music...</p>
              </div>
            )}

            {/* Artist Songs */}
            {!isLoading && artistSongs.length > 0 && (
              <div>
                <h2 className="text-2xl font-semibold mb-4 text-white">Popular Songs</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {artistSongs.map((song) => (
                    <div
                      key={song.id}
                      className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg overflow-hidden hover:bg-black/50 hover:border-white/20 transition-all group"
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
                            className="bg-cyan-600 hover:bg-cyan-700 rounded-full p-3 transition-colors"
                            aria-label={`Play ${song.title}`}
                          >
                            <Play size={24} fill="white" />
                          </button>
                        </div>
                        {song.duration > 0 && (
                          <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm border border-white/10 px-2 py-1 rounded text-xs text-white">
                            {formatDuration(song.duration)}
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className="font-medium text-white truncate mb-1" title={song.title}>
                          {song.title}
                        </h3>
                        <p className="text-sm text-cyan-300 truncate" title={song.artist}>
                          {song.artist}
                        </p>
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => handlePlay(song)}
                            className="flex-1 py-2 bg-cyan-600/80 backdrop-blur-sm hover:bg-cyan-700/80 border border-cyan-400/50 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
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
                                  : 'bg-black/40 border-white/10 text-gray-300 hover:bg-black/50'
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
            {!isLoading && artistSongs.length === 0 && !error && (
              <div className="text-center py-12">
                <Music size={48} className="mx-auto mb-4 opacity-50 text-gray-400" />
                <p className="text-gray-300">No songs found for {selectedArtist.name}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
