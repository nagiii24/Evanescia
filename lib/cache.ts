/**
 * Simple cache utility to reduce YouTube API quota usage
 * Uses localStorage to cache search results and artist data
 */

const CACHE_PREFIX = 'hungify_cache_';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

interface CacheItem<T> {
  data: T;
  timestamp: number;
}

/**
 * Get cached data
 */
export function getCache<T>(key: string): T | null {
  try {
    const cached = localStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!cached) return null;

    const item: CacheItem<T> = JSON.parse(cached);
    const now = Date.now();

    // Check if cache is expired
    if (now - item.timestamp > CACHE_EXPIRY) {
      localStorage.removeItem(`${CACHE_PREFIX}${key}`);
      return null;
    }

    return item.data;
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
}

/**
 * Set cache data
 */
export function setCache<T>(key: string, data: T): void {
  try {
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(item));
  } catch (error) {
    console.error('Cache set error:', error);
    // If storage is full, clear old cache
    clearOldCache();
  }
}

/**
 * Clear expired cache entries
 */
function clearOldCache(): void {
  try {
    const keys = Object.keys(localStorage);
    const now = Date.now();
    
    keys.forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        try {
          const item = JSON.parse(localStorage.getItem(key) || '{}');
          if (now - item.timestamp > CACHE_EXPIRY) {
            localStorage.removeItem(key);
          }
        } catch {
          localStorage.removeItem(key);
        }
      }
    });
  } catch (error) {
    console.error('Cache clear error:', error);
  }
}

/**
 * Clear all cache
 */
export function clearCache(): void {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('Cache clear all error:', error);
  }
}
