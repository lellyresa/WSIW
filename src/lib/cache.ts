// Simple in-memory cache for API responses
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class APICache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes default

  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  clear(): void {
    this.cache.clear();
  }

  // Get cache statistics
  getStats() {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    
    return {
      totalEntries: entries.length,
      expiredEntries: entries.filter(([_, entry]) => now - entry.timestamp > entry.ttl).length,
      memoryUsage: JSON.stringify(Array.from(this.cache.values())).length
    };
  }
}

// Create a singleton instance
export const apiCache = new APICache();

// Cache key generators
export const generateCacheKey = (endpoint: string, params: Record<string, any> = {}): string => {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
  
  return `${endpoint}${sortedParams ? `?${sortedParams}` : ''}`;
};

// Cache TTL constants
export const CACHE_TTL = {
  CONTENT: 10 * 60 * 1000, // 10 minutes for content
  PROVIDERS: 30 * 60 * 1000, // 30 minutes for providers (change less frequently)
  GENRES: 60 * 60 * 1000, // 1 hour for genres (rarely change)
  DETAILS: 5 * 60 * 1000, // 5 minutes for content details
} as const;
