import axios from 'axios';
import type { Song } from '@/types';
import { getCache, setCache } from './cache';

const YOUTUBE_API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

/**
 * Converts ISO 8601 duration format (PT1H2M10S) to seconds
 */
function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Fetches video details including duration from YouTube API
 */
async function getVideoDetails(videoIds: string[]): Promise<Map<string, number>> {
  if (!YOUTUBE_API_KEY) {
    throw new Error('YouTube API key is not configured');
  }

  try {
    const response = await axios.get(`${YOUTUBE_API_BASE}/videos`, {
      params: {
        part: 'contentDetails',
        id: videoIds.join(','),
        key: YOUTUBE_API_KEY,
      },
    });

    const durationMap = new Map<string, number>();
    
    if (response.data.items) {
      response.data.items.forEach((item: any) => {
        const videoId = item.id;
        const duration = parseDuration(item.contentDetails?.duration || 'PT0S');
        durationMap.set(videoId, duration);
      });
    }

    return durationMap;
  } catch (error) {
    console.error('Error fetching video details:', error);
    throw error;
  }
}

/**
 * Searches YouTube for videos and returns an array of Song objects
 */
export async function searchYoutube(query: string): Promise<Song[]> {
  if (!YOUTUBE_API_KEY) {
    throw new Error('YouTube API key is not configured. Please add NEXT_PUBLIC_YOUTUBE_API_KEY to your .env.local file');
  }

  // Check cache first
  const cacheKey = `search_${query.toLowerCase().trim()}`;
  const cached = getCache<Song[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Append 'audio' to query to prioritize audio tracks
    const searchQuery = `${query} audio`;
    
    // Step 1: Search for videos (Music category only)
    const searchResponse = await axios.get(`${YOUTUBE_API_BASE}/search`, {
      params: {
        part: 'snippet',
        q: searchQuery,
        type: 'video',
        videoCategoryId: '10', // Music category
        maxResults: 10,
        key: YOUTUBE_API_KEY,
      },
    });

    if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
      return [];
    }

    // Step 2: Extract video IDs and prepare initial data
    const videoIds = searchResponse.data.items.map((item: any) => item.id.videoId);
    const videoData = searchResponse.data.items.map((item: any) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      artist: item.snippet.channelTitle,
      thumbnailUrl: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url || '',
    }));

    // Step 3: Fetch durations for all videos
    const durationMap = await getVideoDetails(videoIds);

    // Step 4: Map to Song type and filter by duration (max 15 minutes)
    const MAX_DURATION = 15 * 60; // 15 minutes in seconds
    const songs: Song[] = videoData
      .map((video) => ({
        id: video.id,
        title: video.title,
        artist: video.artist,
        thumbnailUrl: video.thumbnailUrl,
        duration: durationMap.get(video.id) || 0,
      }))
      .filter((song) => song.duration > 0 && song.duration <= MAX_DURATION);

    // Cache the results
    setCache(cacheKey, songs);
    return songs;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('YouTube API Error:', error.response?.data || error.message);
      throw new Error(`Failed to search YouTube: ${error.response?.data?.error?.message || error.message}`);
    }
    throw error;
  }
}

/**
 * Gets related videos for a given video ID
 */
export async function getRelatedVideos(videoId: string): Promise<Song[]> {
  if (!YOUTUBE_API_KEY) {
    throw new Error('YouTube API key is not configured. Please add NEXT_PUBLIC_YOUTUBE_API_KEY to your .env.local file');
  }

  // Check cache first
  const cacheKey = `related_${videoId}`;
  const cached = getCache<Song[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Step 1: Search for related videos (Music category only)
    const searchResponse = await axios.get(`${YOUTUBE_API_BASE}/search`, {
      params: {
        part: 'snippet',
        relatedToVideoId: videoId,
        type: 'video',
        videoCategoryId: '10', // Music category
        maxResults: 10,
        key: YOUTUBE_API_KEY,
      },
    });

    if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
      return [];
    }

    // Step 2: Extract video IDs and prepare initial data
    const videoIds = searchResponse.data.items.map((item: any) => item.id.videoId);
    const videoData = searchResponse.data.items.map((item: any) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      artist: item.snippet.channelTitle,
      thumbnailUrl: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url || '',
    }));

    // Step 3: Fetch durations for all videos
    const durationMap = await getVideoDetails(videoIds);

    // Step 4: Map to Song type and filter by duration (max 15 minutes)
    const MAX_DURATION = 15 * 60; // 15 minutes in seconds
    const songs: Song[] = videoData
      .map((video) => ({
        id: video.id,
        title: video.title,
        artist: video.artist,
        thumbnailUrl: video.thumbnailUrl,
        duration: durationMap.get(video.id) || 0,
      }))
      .filter((song) => song.duration > 0 && song.duration <= MAX_DURATION)
      .filter((song) => song.id !== videoId); // Filter out the current video itself

    // Cache the results
    setCache(cacheKey, songs);
    return songs;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('YouTube API Error (getRelatedVideos):', error.response?.data || error.message);
      throw new Error(`Failed to get related videos: ${error.response?.data?.error?.message || error.message}`);
    }
    throw error;
  }
}

/**
 * Search for an artist and get their popular songs
 */
export async function getArtistSongs(artistName: string): Promise<Song[]> {
  if (!YOUTUBE_API_KEY) {
    throw new Error('YouTube API key is not configured');
  }

  // Check cache first
  const cacheKey = `artist_${artistName.toLowerCase().trim()}`;
  const cached = getCache<Song[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Search for artist's popular songs
    const searchQuery = `${artistName} official`;
    
    const searchResponse = await axios.get(`${YOUTUBE_API_BASE}/search`, {
      params: {
        part: 'snippet',
        q: searchQuery,
        type: 'video',
        videoCategoryId: '10', // Music category
        maxResults: 10,
        order: 'viewCount', // Get most popular videos
        key: YOUTUBE_API_KEY,
      },
    });

    if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
      return [];
    }

    const videoIds = searchResponse.data.items.map((item: any) => item.id.videoId);
    const videoData = searchResponse.data.items.map((item: any) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      artist: item.snippet.channelTitle,
      thumbnailUrl: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url || '',
    }));

    const durationMap = await getVideoDetails(videoIds);

    const MIN_DURATION = 120; // Minimum 2 minutes
    const MAX_DURATION = 15 * 60; // Maximum 15 minutes
    const songs: Song[] = videoData
      .map((video) => ({
        id: video.id,
        title: video.title,
        artist: video.artist,
        thumbnailUrl: video.thumbnailUrl,
        duration: durationMap.get(video.id) || 0,
      }))
      .filter((song) => song.duration >= MIN_DURATION && song.duration <= MAX_DURATION);

    // Cache the results
    setCache(cacheKey, songs);
    return songs;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('YouTube API Error (getArtistSongs):', error.response?.data || error.message);
      throw new Error(`Failed to get artist songs: ${error.response?.data?.error?.message || error.message}`);
    }
    throw error;
  }
}
