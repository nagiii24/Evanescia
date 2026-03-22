'use client';

import { ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { useAuth } from '@clerk/nextjs';
import { ReactNode } from 'react';

// Create Convex client - use a dummy URL if not configured to avoid errors
const convexUrl = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_CONVEX_URL 
  ? process.env.NEXT_PUBLIC_CONVEX_URL 
  : 'https://placeholder.convex.cloud'; // Dummy URL - won't be used if hooks pass undefined

const convex = new ConvexReactClient(convexUrl);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
