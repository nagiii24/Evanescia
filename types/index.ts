export interface Song {
  id: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  duration: number;
}

export interface PlayerState {
  isPlaying: boolean;
  currentSong: Song | null;
  queue: Song[];
  /** When true, advancing past the queue does not load YouTube “related” tracks. */
  playlistOnly: boolean;
  volume: number;
  isMinimized: boolean;
  duration: number;
  currentTime: number;
}

