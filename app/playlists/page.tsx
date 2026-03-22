'use client';

import { useMemo, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { ListMusic, Play } from 'lucide-react';
import { usePlaylists, usePlaylistSongs } from '@/components/hooks/usePlaylists';
import { usePlayerStore } from '@/lib/store';
import type { Song } from '@/types';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function PlaylistsPage() {
  const { isSignedIn, isLoaded } = useUser();
  const { playlists, createPlaylist } = usePlaylists();
  const { playPlaylistFrom } = usePlayerStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const { songs, isLoading } = usePlaylistSongs(selectedId);

  const sortedPlaylists = useMemo(() => {
    if (!Array.isArray(playlists)) return [];
    return [...playlists].sort((a: { createdAt?: number }, b: { createdAt?: number }) => {
      const ta = a.createdAt ?? 0;
      const tb = b.createdAt ?? 0;
      return tb - ta;
    });
  }, [playlists]);

  const selectedPlaylist = sortedPlaylists.find(
    (p: { id?: string; _id?: string }) => String(p.id ?? p._id) === String(selectedId),
  );

  const onCreate = async () => {
    if (!createPlaylist || !newName.trim()) return;
    setCreating(true);
    try {
      const id = await createPlaylist(newName.trim(), '');
      setNewName('');
      if (id) setSelectedId(String(id));
    } finally {
      setCreating(false);
    }
  };

  if (!isLoaded) {
    return (
      <main className="min-h-screen text-gray-800 pb-24 pt-8 pl-0 md:pl-64">
        <div className="container mx-auto px-4 py-8">
          <p className="text-gray-200">Loading…</p>
        </div>
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="min-h-screen text-gray-800 pb-24 pt-8 pl-0 md:pl-64">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-4xl font-bold mb-6">Playlists</h1>
          <p className="text-gray-200">Sign in to view and manage your playlists.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen text-gray-800 pb-24 pt-8 pl-0 md:pl-64">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="lg:w-80 shrink-0">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-cyan-600 to-pink-500 rounded-lg flex items-center justify-center">
                <ListMusic size={32} className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Playlists</h1>
                <p className="text-gray-300 text-sm">{sortedPlaylists.length} saved</p>
              </div>
            </div>

            <div className="flex gap-2 mb-4">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New playlist name"
                className="flex-1 px-3 py-2 text-sm rounded-lg bg-black/40 border border-white/15 text-white placeholder:text-gray-500"
                onKeyDown={(e) => e.key === 'Enter' && onCreate()}
              />
              <button
                type="button"
                onClick={onCreate}
                disabled={!createPlaylist || creating || !newName.trim()}
                className="px-3 py-2 text-sm rounded-lg bg-cyan-600 text-white disabled:opacity-40"
              >
                {creating ? '…' : 'Add'}
              </button>
            </div>

            {sortedPlaylists.length === 0 ? (
              <p className="text-gray-400 text-sm">No playlists yet. Create one here or from the player bar.</p>
            ) : (
              <ul className="space-y-1">
                {sortedPlaylists.map((p: { id?: string; _id?: string; name: string }) => {
                  const id = String(p.id ?? p._id);
                  const active = selectedId === id;
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(id)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          active
                            ? 'bg-cyan-900/50 text-white border border-cyan-500/40'
                            : 'bg-black/30 text-gray-200 border border-transparent hover:bg-black/45 hover:border-white/10'
                        }`}
                      >
                        {p.name}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex-1 min-w-0">
            {!selectedId ? (
              <div className="text-center text-gray-400 mt-16">
                <ListMusic size={48} className="mx-auto mb-4 opacity-40" />
                <p>Select a playlist to see its songs.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h2 className="text-2xl font-semibold text-white truncate min-w-0 flex-1">
                    {selectedPlaylist?.name ?? 'Playlist'}
                  </h2>
                  {!isLoading && songs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => playPlaylistFrom(songs, 0)}
                      className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-500 transition-colors"
                    >
                      <Play size={18} fill="currentColor" />
                      Play all
                    </button>
                  )}
                </div>
                <p className="text-gray-400 text-sm mb-6">
                  {isLoading ? 'Loading…' : `${songs.length} song${songs.length === 1 ? '' : 's'}`}
                </p>

                {!isLoading && songs.length === 0 ? (
                  <p className="text-gray-400">This playlist is empty. Add tracks from the player (+).</p>
                ) : (
                  <div className="space-y-2">
                    {songs.map((song: Song & { addedAt?: number }, index: number) => (
                      <div
                        key={`${song.id}-${song.addedAt ?? index}`}
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
                          type="button"
                          onClick={() => playPlaylistFrom(songs, index)}
                          className="p-2 text-cyan-400 hover:text-cyan-300 opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label={`Play ${song.title}`}
                        >
                          <Play size={20} fill="currentColor" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
