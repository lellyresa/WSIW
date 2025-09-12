// API Response Caching Utility
// Provides memory and localStorage caching with TTL support

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

interface CacheOptions {
  ttl?: number; // Default TTL in milliseconds
  useLocalStorage?: boolean; // Whether to persist to localStorage
}

class APICache {
  private memoryCache = new Map<string, CacheItem<any>>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly STORAGE_PREFIX = 'wsiw_cache_';

  /**
   * Get cached data
   */
  get<T>(key: string): T | null {
    // Try memory cache first
    const memoryItem = this.memoryCache.get(key);
    if (memoryItem && this.isValid(memoryItem)) {
      return memoryItem.data;
    }

    // Try localStorage if enabled
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(this.STORAGE_PREFIX + key);
        if (stored) {
          const item: CacheItem<T> = JSON.parse(stored);
          if (this.isValid(item)) {
            // Restore to memory cache
            this.memoryCache.set(key, item);
            return item.data;
          } else {
            // Remove expired item
            localStorage.removeItem(this.STORAGE_PREFIX + key);
          }
        }
      } catch (error) {
        console.warn('Failed to read from localStorage:', error);
      }
    }

    return null;
  }

  /**
   * Set cached data
   */
  set<T>(key: string, data: T, options: CacheOptions = {}): void {
    const ttl = options.ttl || this.DEFAULT_TTL;
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl
    };

    // Store in memory cache
    this.memoryCache.set(key, item);

    // Store in localStorage if enabled
    if (options.useLocalStorage && typeof window !== 'undefined') {
      try {
        localStorage.setItem(this.STORAGE_PREFIX + key, JSON.stringify(item));
      } catch (error) {
        console.warn('Failed to write to localStorage:', error);
      }
    }
  }

  /**
   * Check if cache item is still valid
   */
  private isValid(item: CacheItem<any>): boolean {
    return Date.now() - item.timestamp < item.ttl;
  }

  /**
   * Clear expired items from memory cache
   */
  clearExpired(): void {
    for (const [key, item] of this.memoryCache.entries()) {
      if (!this.isValid(item)) {
        this.memoryCache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.memoryCache.clear();
    if (typeof window !== 'undefined') {
      try {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith(this.STORAGE_PREFIX)) {
            localStorage.removeItem(key);
          }
        });
      } catch (error) {
        console.warn('Failed to clear localStorage:', error);
      }
    }
  }

  /**
   * Generate cache key for API requests
   */
  generateKey(endpoint: string, params: Record<string, any> = {}): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    
    return `${endpoint}${sortedParams ? `?${sortedParams}` : ''}`;
  }

  /**
   * Get cache statistics
   */
  getStats(): { memoryItems: number; localStorageItems: number } {
    let localStorageItems = 0;
    
    if (typeof window !== 'undefined') {
      try {
        const keys = Object.keys(localStorage);
        localStorageItems = keys.filter(key => key.startsWith(this.STORAGE_PREFIX)).length;
      } catch (error) {
        console.warn('Failed to count localStorage items:', error);
      }
    }

    return {
      memoryItems: this.memoryCache.size,
      localStorageItems
    };
  }
}

// Create singleton instance
export const apiCache = new APICache();

// Cache TTL constants (in milliseconds)
export const CACHE_TTL = {
  GENRES: 24 * 60 * 60 * 1000, // 24 hours - genres rarely change
  CONTENT: 30 * 60 * 1000, // 30 minutes - content changes more frequently
  PROVIDERS: 60 * 60 * 1000, // 1 hour - provider data changes occasionally
  DETAILS: 2 * 60 * 60 * 1000, // 2 hours - content details change rarely
  TRENDING: 10 * 60 * 1000, // 10 minutes - trending content changes frequently
} as const;

// Clean up expired items every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    apiCache.clearExpired();
  }, 5 * 60 * 1000);
}
