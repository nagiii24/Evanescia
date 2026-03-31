'use client';

import { usePlayerStore } from '@/lib/store';
import { ChevronUp, ChevronDown, X, Play } from 'lucide-react';

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function QueuePanel({ onClose }: { onClose: () => void }) {
  const queue = usePlayerStore((s) => s.queue);
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue);
  const moveInQueue = usePlayerStore((s) => s.moveInQueue);
  const playFromQueue = usePlayerStore((s) => s.playFromQueue);

  return (
    <div className="absolute right-0 bottom-14 w-80 max-h-[60vh] bg-miko-white/95 backdrop-blur-md border border-sakura-primary/20 rounded-lg shadow-xl z-50 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-sakura-primary/20">
        <h3 className="text-sm font-semibold text-gray-800">
          Up Next · {queue.length} {queue.length === 1 ? 'song' : 'songs'}
        </h3>
        <button
          onClick={onClose}
          className="p-1 text-gray-500 hover:text-gray-800 transition-colors"
          aria-label="Close queue"
        >
          <X size={16} />
        </button>
      </div>

      {queue.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-gray-500">
          Queue is empty
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto divide-y divide-sakura-primary/10">
          {queue.map((song, index) => (
            <li
              key={`${song.id}-${index}`}
              className="flex items-center gap-2 px-3 py-2 hover:bg-sakura-primary/5 group"
            >
              <span className="text-xs text-gray-400 w-5 text-right shrink-0">
                {index + 1}
              </span>

              <img
                src={song.thumbnailUrl}
                alt=""
                className="w-9 h-9 rounded object-cover shrink-0 border border-sakura-primary/20"
              />

              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 truncate leading-tight">
                  {song.title}
                </p>
                <p className="text-xs text-gray-500 truncate leading-tight">
                  {song.artist} · {formatDuration(song.duration)}
                </p>
              </div>

              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  onClick={() => playFromQueue(index)}
                  className="p-1 text-gray-400 hover:text-sakura-deep transition-colors"
                  aria-label="Play now"
                  title="Play now"
                >
                  <Play size={14} fill="currentColor" />
                </button>
                <button
                  onClick={() => moveInQueue(index, index - 1)}
                  disabled={index === 0}
                  className="p-1 text-gray-400 hover:text-sakura-deep disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                  aria-label="Move up"
                  title="Move up"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  onClick={() => moveInQueue(index, index + 1)}
                  disabled={index === queue.length - 1}
                  className="p-1 text-gray-400 hover:text-sakura-deep disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                  aria-label="Move down"
                  title="Move down"
                >
                  <ChevronDown size={14} />
                </button>
                <button
                  onClick={() => removeFromQueue(index)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  aria-label="Remove from queue"
                  title="Remove"
                >
                  <X size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
