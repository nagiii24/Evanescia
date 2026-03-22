'use client';

import { useUser } from '@clerk/nextjs';
import { useConvexAuth } from 'convex/react';
import { useMemo } from 'react';

export type ConvexUserLinkState = {
  /** Clerk loaded, user signed in, Convex has validated a JWT */
  ready: boolean;
  clerkLoaded: boolean;
  signedIn: boolean;
  convexAuthLoading: boolean;
  convexAuthenticated: boolean;
};

/**
 * Clerk + Convex auth progress. Use `ready` to skip user-scoped Convex calls until safe.
 */
export function useConvexUserLinkState(): ConvexUserLinkState {
  const { isSignedIn, isLoaded: clerkLoaded } = useUser();
  const { isLoading: convexAuthLoading, isAuthenticated } = useConvexAuth();

  return useMemo(
    () => ({
      ready:
        clerkLoaded &&
        !!isSignedIn &&
        !convexAuthLoading &&
        isAuthenticated,
      clerkLoaded,
      signedIn: !!isSignedIn,
      convexAuthLoading,
      convexAuthenticated: isAuthenticated,
    }),
    [clerkLoaded, isSignedIn, convexAuthLoading, isAuthenticated],
  );
}

export function useConvexUserQueryReady(): boolean {
  return useConvexUserLinkState().ready;
}
