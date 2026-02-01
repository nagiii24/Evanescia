'use client';

import { useLikedSongs } from '@/components/hooks/useLikedSongs';
import { usePlayerStore } from '@/lib/store';
import { Play, Heart } from 'lucide-react';
import { useUser } from '@clerk/nextjs';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function LikedSongs() {
  const { likedSongs } = useLikedSongs();
  const { setSong } = usePlayerStore();
  const { isSignedIn } = useUser();

  if (!isSignedIn) {
    return (
      <main className="min-h-screen text-gray-800 pb-24 pt-8 pl-0 md:pl-64">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-4xl font-bold mb-6">Liked Songs</h1>
          <p className="text-gray-200">Please sign in to view your liked songs.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen text-gray-800 pb-24 pt-8 pl-0 md:pl-64">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-24 h-24 bg-gradient-to-br from-pink-500 to-purple-500 rounded-lg flex items-center justify-center">
            <Heart size={48} className="text-white fill-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold mb-2">Liked Songs</h1>
            <p className="text-gray-300">{likedSongs.length} songs</p>
          </div>
        </div>

        {likedSongs.length === 0 ? (
          <div className="text-center text-gray-300 mt-12">
            <Heart size={48} className="mx-auto mb-4 opacity-50" />
            <p>You haven&apos;t liked any songs yet.</p>
            <p className="text-sm text-gray-400 mt-2">Start exploring and like your favorite songs!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {likedSongs.map((song, index) => (
              <div
                key={song.id}
                className="flex items-center gap-4 p-3 bg-black/40 backdrop-blur-md border border-white/10 rounded-lg hover:bg-black/50 hover:border-white/20 transition-all group"
              >
                <span className="text-gray-400 w-8 text-sm">{index + 1}</span>
                <img
                  src={song.thumbnailUrl}
                  alt={song.title}
                  className="w-12 h-12 rounded object-cover"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{song.title}</p>
                  <p className="text-cyan-300 text-sm truncate">{song.artist}</p>
                </div>
                {song.duration > 0 && (
                  <span className="text-gray-400 text-sm">{formatDuration(song.duration)}</span>
                )}
                <button
                  onClick={() => setSong(song)}
                  className="p-2 text-cyan-400 hover:text-cyan-300 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={`Play ${song.title}`}
                >
                  <Play size={20} fill="currentColor" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
