// Cached TMDB API wrapper
// Provides caching layer over the existing TMDB functions

import { apiCache, CACHE_TTL } from './cache';
import {
  getGenres as originalGetGenres,
  getRandomContent as originalGetRandomContent,
  getProviders as originalGetProviders,
  getContentRating as originalGetContentRating,
  getContentByProvider as originalGetContentByProvider,
  getContentByProviderAndGenre as originalGetContentByProviderAndGenre,
  getPopularByProvider as originalGetPopularByProvider,
  getTrendingContent as originalGetTrendingContent,
  Genre,
  TMDBMovie,
  TMDBShow
} from './tmdb';

/**
 * Cached version of getGenres
 * Genres rarely change, so we cache for 24 hours
 */
export const getGenres = async (): Promise<Genre[]> => {
  const cacheKey = apiCache.generateKey('genres');
  
  // Try to get from cache first
  const cached = apiCache.get<Genre[]>(cacheKey);
  if (cached) {
    console.log('📦 Cache HIT: Genres');
    return cached;
  }

  console.log('🌐 Cache MISS: Genres - fetching from API');
  const data = await originalGetGenres();
  
  // Cache the result
  apiCache.set(cacheKey, data, {
    ttl: CACHE_TTL.GENRES,
    useLocalStorage: true
  });
  
  return data;
};

/**
 * Cached version of getRandomContent
 * Content changes frequently, so we cache for 30 minutes
 */
export const getRandomContent = async (
  type: 'movie' | 'tv',
  genreId?: number,
  page?: number
): Promise<TMDBMovie[] | TMDBShow[]> => {
  const cacheKey = apiCache.generateKey('random-content', { type, genreId, page });
  
  const cached = apiCache.get<TMDBMovie[] | TMDBShow[]>(cacheKey);
  if (cached) {
    console.log('📦 Cache HIT: Random content');
    return cached;
  }

  console.log('🌐 Cache MISS: Random content - fetching from API');
  const data = await originalGetRandomContent(type, genreId, page);
  
  apiCache.set(cacheKey, data, {
    ttl: CACHE_TTL.CONTENT,
    useLocalStorage: true
  });
  
  return data;
};

/**
 * Cached version of getProviders
 * Provider data changes occasionally, so we cache for 1 hour
 */
export const getProviders = async (type: 'movie' | 'tv', id: number) => {
  const cacheKey = apiCache.generateKey('providers', { type, id });
  
  const cached = apiCache.get(cacheKey);
  if (cached) {
    console.log('📦 Cache HIT: Providers');
    return cached;
  }

  console.log('🌐 Cache MISS: Providers - fetching from API');
  const data = await originalGetProviders(type, id);
  
  apiCache.set(cacheKey, data, {
    ttl: CACHE_TTL.PROVIDERS,
    useLocalStorage: true
  });
  
  return data;
};

/**
 * Cached version of getContentRating
 * Content ratings rarely change, so we cache for 2 hours
 */
export const getContentRating = async (type: 'movie' | 'tv', id: number) => {
  const cacheKey = apiCache.generateKey('content-rating', { type, id });
  
  const cached = apiCache.get<string | null>(cacheKey);
  if (cached !== null) {
    console.log('📦 Cache HIT: Content rating');
    return cached;
  }

  console.log('🌐 Cache MISS: Content rating - fetching from API');
  const data = await originalGetContentRating(type, id);
  
  apiCache.set(cacheKey, data, {
    ttl: CACHE_TTL.DETAILS,
    useLocalStorage: true
  });
  
  return data;
};

/**
 * Cached version of getContentByProvider
 * Content by provider changes frequently, so we cache for 30 minutes
 */
export const getContentByProvider = async (
  type: 'movie' | 'tv',
  providerId: number,
  page: number = 1
): Promise<TMDBMovie[] | TMDBShow[]> => {
  const cacheKey = apiCache.generateKey('content-by-provider', { type, providerId, page });
  
  const cached = apiCache.get<TMDBMovie[] | TMDBShow[]>(cacheKey);
  if (cached) {
    console.log('📦 Cache HIT: Content by provider');
    return cached;
  }

  console.log('🌐 Cache MISS: Content by provider - fetching from API');
  const data = await originalGetContentByProvider(type, providerId, page);
  
  apiCache.set(cacheKey, data, {
    ttl: CACHE_TTL.CONTENT,
    useLocalStorage: true
  });
  
  return data;
};

/**
 * Cached version of getContentByProviderAndGenre
 */
export const getContentByProviderAndGenre = async (
  type: 'movie' | 'tv',
  providerId: number,
  genreId?: number,
  page: number = 1
): Promise<TMDBMovie[] | TMDBShow[]> => {
  const cacheKey = apiCache.generateKey('content-by-provider-genre', { type, providerId, genreId, page });
  
  const cached = apiCache.get<TMDBMovie[] | TMDBShow[]>(cacheKey);
  if (cached) {
    console.log('📦 Cache HIT: Content by provider and genre');
    return cached;
  }

  console.log('🌐 Cache MISS: Content by provider and genre - fetching from API');
  const data = await originalGetContentByProviderAndGenre(type, providerId, genreId, page);
  
  apiCache.set(cacheKey, data, {
    ttl: CACHE_TTL.CONTENT,
    useLocalStorage: true
  });
  
  return data;
};

/**
 * Cached version of getPopularByProvider
 */
export const getPopularByProvider = async (
  providerId: number,
  page: number = 1
): Promise<(TMDBMovie | TMDBShow)[]> => {
  const cacheKey = apiCache.generateKey('popular-by-provider', { providerId, page });
  
  const cached = apiCache.get<(TMDBMovie | TMDBShow)[]>(cacheKey);
  if (cached) {
    console.log('📦 Cache HIT: Popular by provider');
    return cached;
  }

  console.log('🌐 Cache MISS: Popular by provider - fetching from API');
  const data = await originalGetPopularByProvider(providerId, page);
  
  apiCache.set(cacheKey, data, {
    ttl: CACHE_TTL.CONTENT,
    useLocalStorage: true
  });
  
  return data;
};

/**
 * Cached version of getTrendingContent
 * Trending content changes frequently, so we cache for only 10 minutes
 */
export const getTrendingContent = async (
  page: number = 1
): Promise<(TMDBMovie | TMDBShow)[]> => {
  const cacheKey = apiCache.generateKey('trending-content', { page });
  
  const cached = apiCache.get<(TMDBMovie | TMDBShow)[]>(cacheKey);
  if (cached) {
    console.log('📦 Cache HIT: Trending content');
    return cached;
  }

  console.log('🌐 Cache MISS: Trending content - fetching from API');
  const data = await originalGetTrendingContent(page);
  
  apiCache.set(cacheKey, data, {
    ttl: CACHE_TTL.TRENDING,
    useLocalStorage: true
  });
  
  return data;
};

/**
 * Cache management utilities
 */
export const cacheUtils = {
  /**
   * Clear all cache
   */
  clearAll: () => {
    apiCache.clear();
    console.log('🗑️ All cache cleared');
  },

  /**
   * Get cache statistics
   */
  getStats: () => {
    const stats = apiCache.getStats();
    console.log('📊 Cache Stats:', stats);
    return stats;
  },

  /**
   * Clear expired items
   */
  clearExpired: () => {
    apiCache.clearExpired();
    console.log('🧹 Expired cache items cleared');
  }
};
