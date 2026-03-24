'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { DoorOpen, Loader2, Plus, Users } from 'lucide-react';
import { useConvexUserLinkState } from '@/lib/useConvexUserQueryReady';

export default function RoomsPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();
  const { getToken } = useAuth();
  const { isLoading: convexAuthLoading, isAuthenticated: convexAuthenticated } = useConvexAuth();
  const link = useConvexUserLinkState();
  const directory = useQuery(api.listeningRooms.listRoomsDirectory);
  const createRoom = useMutation(api.listeningRooms.createRoom);
  const joinRoom = useMutation(api.listeningRooms.joinRoom);

  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [joiningSlug, setJoiningSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clerkConvexTokenHint, setClerkConvexTokenHint] = useState<string | null>(null);

  /** Convex sets isAuthenticated only after the backend accepts Clerk’s JWT — separate from “signed in” in Clerk. */
  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setClerkConvexTokenHint(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken({ template: 'convex' });
        if (cancelled) return;
        if (!token) {
          setClerkConvexTokenHint(
            'Clerk did not return a Convex JWT. In Clerk Dashboard create a JWT template named exactly "convex" (see Clerk → JWT Templates, or Convex + Clerk setup guide).',
          );
        } else {
          setClerkConvexTokenHint(null);
        }
      } catch (e) {
        if (!cancelled) {
          setClerkConvexTokenHint(
            e instanceof Error ? e.message : 'Could not fetch Convex JWT from Clerk.',
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken]);

  const canMutate = link.ready;

  const onCreate = async () => {
    if (!canMutate || !newName.trim()) return;
    setError(null);
    setCreating(true);
    try {
      const { slug } = await createRoom({ name: newName.trim() });
      setNewName('');
      await joinRoom({ slug });
      router.push(`/rooms/${encodeURIComponent(slug)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create room');
    } finally {
      setCreating(false);
    }
  };

  const onJoin = async (slug: string) => {
    if (!canMutate) return;
    setError(null);
    setJoiningSlug(slug);
    try {
      await joinRoom({ slug });
      router.push(`/rooms/${encodeURIComponent(slug)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join room');
    } finally {
      setJoiningSlug(null);
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

  return (
    <main className="min-h-screen text-gray-800 pb-24 pt-8 pl-0 md:pl-64">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <h1
          className="text-4xl font-bold mb-2 text-gray-900"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          Listening rooms
        </h1>
        <p className="text-gray-700 mb-8">
          Join an empty room or create your own. Playback is yours alone—pick a playlist or search for music.
        </p>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-950/30 border border-red-400/40 text-red-200 text-sm">
            {error}
          </div>
        )}

        {!isSignedIn ? (
          <p className="text-gray-200 mb-8">Sign in to create or join a room.</p>
        ) : (
          <section className="mb-10 p-4 rounded-xl bg-black/30 border border-white/10 backdrop-blur-md">
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Plus size={20} className="text-cyan-400" />
              Create room
            </h2>
            <div className="flex flex-wrap gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Room name"
                disabled={!canMutate || creating}
                className="flex-1 min-w-[200px] px-3 py-2 text-sm rounded-lg bg-black/40 border border-white/15 text-white placeholder:text-gray-500"
                onKeyDown={(e) => e.key === 'Enter' && onCreate()}
              />
              <button
                type="button"
                onClick={onCreate}
                disabled={!canMutate || creating || !newName.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm font-medium disabled:opacity-40"
              >
                {creating ? <Loader2 size={18} className="animate-spin" /> : null}
                Create &amp; enter
              </button>
            </div>
            {!link.ready && link.signedIn && (
              <div className="mt-3 text-xs text-gray-300 space-y-2">
                {convexAuthLoading ? (
                  <p>Waiting for Convex to accept your session…</p>
                ) : (
                  <p>
                    You are signed in with Clerk, but Convex has not authenticated this browser yet.
                  </p>
                )}
                {clerkConvexTokenHint && (
                  <p className="text-amber-200/90 border border-amber-400/30 rounded-md p-2 bg-black/30">
                    {clerkConvexTokenHint}
                  </p>
                )}
                {!clerkConvexTokenHint && !convexAuthLoading && !convexAuthenticated && (
                  <p className="text-gray-400">
                    If this persists, open Convex → Settings → Environment and set{' '}
                    <code className="text-gray-200">CLERK_JWT_ISSUER_DOMAIN</code> to your Clerk Frontend API
                    URL with <strong>no trailing space</strong>, matching{' '}
                    <code className="text-gray-200">auth.config.ts</code> <code className="text-gray-200">applicationID</code>{' '}
                    to JWT <code className="text-gray-200">aud</code> (usually{' '}
                    <code className="text-gray-200">convex</code>).
                  </p>
                )}
              </div>
            )}
          </section>
        )}

        {directory === undefined ? (
          <p className="text-gray-400">Loading rooms…</p>
        ) : (
          <>
            <p className="text-gray-500 text-xs mb-5 max-w-prose leading-relaxed">
              <strong className="text-gray-400">Empty</strong> means no one is in that room right now.
              You stay in a room while you browse the site; use <strong className="text-gray-400">Leave room</strong> on
              the room page when you are done, or open a different room to switch.
            </p>
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <DoorOpen className="text-cyan-400" size={22} />
                Empty rooms
              </h2>
              {directory.empty.length === 0 ? (
                <p className="text-gray-400">No empty rooms yet. Create one above.</p>
              ) : (
                <ul className="space-y-2">
                  {directory.empty.map((r) => (
                    <li
                      key={r._id}
                      className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-black/35 border border-white/10"
                    >
                      <span className="flex-1 font-medium text-white min-w-0 truncate">{r.name}</span>
                      {isSignedIn && canMutate ? (
                        <button
                          type="button"
                          onClick={() => onJoin(r.slug)}
                          disabled={joiningSlug === r.slug}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-600/90 text-white text-sm disabled:opacity-50"
                        >
                          {joiningSlug === r.slug ? <Loader2 size={16} className="animate-spin" /> : null}
                          Join
                        </button>
                      ) : null}
                      <Link
                        href={`/rooms/${encodeURIComponent(r.slug)}`}
                        className="text-sm text-cyan-300 hover:text-cyan-200"
                      >
                        Open
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Users className="text-pink-400" size={22} />
                Rooms with listeners
              </h2>
              {directory.occupied.length === 0 ? (
                <p className="text-gray-400">Nobody is in a room right now.</p>
              ) : (
                <ul className="space-y-2">
                  {directory.occupied.map((r) => (
                    <li
                      key={r._id}
                      className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-black/35 border border-white/10"
                    >
                      <span className="flex-1 font-medium text-white min-w-0 truncate">{r.name}</span>
                      <span className="text-sm text-gray-400">{r.occupantCount} listening</span>
                      <Link
                        href={`/rooms/${encodeURIComponent(r.slug)}`}
                        className="text-sm text-cyan-300 hover:text-cyan-200"
                      >
                        Open
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
