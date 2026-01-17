'use client';

import { useLikedSongs } from '@/components/hooks/useLikedSongs';
import { useHistory, useAddToHistory } from '@/components/hooks/useHistory';
import { usePlayerStore } from '@/lib/store';
import { useEffect } from 'react';

// This component syncs liked songs and history from Convex to the store
// It gracefully handles when Convex isn't set up yet
// Note: The hooks handle stub functions internally
export default function LikedSongsSync() {
  const { setOnHistoryAdd } = usePlayerStore();
  
  // Always call hooks - they handle stub functions internally
  useLikedSongs(); // Sync liked songs
  useHistory(); // Sync history
  const { addToHistory } = useAddToHistory();
  
  // Set up callback to save history when songs are played
  useEffect(() => {
    setOnHistoryAdd(addToHistory);
    return () => setOnHistoryAdd(undefined);
  }, [addToHistory, setOnHistoryAdd]);
  
  return null; // This component doesn't render anything
}
