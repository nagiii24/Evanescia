'use client';

import Link from 'next/link';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useUser } from '@clerk/nextjs';
import { DoorOpen } from 'lucide-react';

const MAX_LINKS = 5;

export default function EmptyRoomsNav() {
  const { isSignedIn, isLoaded } = useUser();
  const emptyRooms = useQuery(api.listeningRooms.listEmptyRooms);

  if (emptyRooms === undefined) {
    return (
      <div className="mt-3 px-4">
        <p className="text-xs text-sakura-deep/70" style={{ textShadow: '0 0 5px rgba(255, 183, 197, 0.3)' }}>
          Rooms…
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 px-4">
      <h3
        className="text-xs font-semibold text-sakura-deep uppercase tracking-wider mb-2"
        style={{ textShadow: '0 0 5px rgba(255, 183, 197, 0.5)' }}
      >
        Empty rooms
      </h3>
      {isLoaded && !isSignedIn && (
        <p className="text-[11px] text-gray-600 mb-2 leading-snug">
          Sign in to join a room. You can still browse the list.
        </p>
      )}
      {emptyRooms.length === 0 ? (
        <p className="text-xs text-gray-600">No empty rooms right now.</p>
      ) : (
        <ul className="flex flex-col gap-1 mb-2">
          {emptyRooms.slice(0, MAX_LINKS).map((r) => (
            <li key={r._id}>
              <Link
                href={`/rooms/${encodeURIComponent(r.slug)}`}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-gray-800 border border-transparent hover:border-sakura-primary/40 hover:bg-white/40 transition-all w-full"
              >
                <DoorOpen size={14} className="text-sakura-deep shrink-0 opacity-80" />
                <span className="truncate">{r.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link
        href="/rooms"
        className="text-xs font-medium text-sakura-deep hover:text-sakura-dark underline-offset-2 hover:underline"
      >
        Browse / create rooms
      </Link>
    </div>
  );
}
