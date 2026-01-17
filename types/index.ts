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
  volume: number;
  isMinimized: boolean;
  duration: number;
  currentTime: number;
}

