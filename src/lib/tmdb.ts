import axios from 'axios';

const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
const TMDB_ACCESS_TOKEN = process.env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN;
const BASE_URL = 'https://api.themoviedb.org/3';

const tmdbApi = axios.create({
  baseURL: BASE_URL,
  headers: {
    Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

export interface TMDBShow {
  id: number;
  name: string;
  overview: string;
  first_air_date: string;
  vote_average: number;
  poster_path: string | null;
  genre_ids: number[];
  origin_country: string[];
  original_language: string;
  popularity: number;
  backdrop_path: string | null;
}

export interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  release_date: string;
  vote_average: number;
  poster_path: string | null;
  genre_ids: number[];
  original_language: string;
  popularity: number;
  backdrop_path: string | null;
  adult: boolean;
}

export interface Genre {
  id: number;
  name: string;
}

export const getGenres = async (): Promise<Genre[]> => {
  const [movieGenres, tvGenres] = await Promise.all([
    tmdbApi.get('/genre/movie/list'),
    tmdbApi.get('/genre/tv/list'),
  ]);
  
  const uniqueGenres = new Map<number, Genre>();
  [...movieGenres.data.genres, ...tvGenres.data.genres].forEach((genre: Genre) => {
    uniqueGenres.set(genre.id, genre);
  });
  
  return Array.from(uniqueGenres.values());
};

export const getRandomContent = async (
  type: 'movie' | 'tv',
  genreId?: number,
  page?: number
): Promise<TMDBMovie[] | TMDBShow[]> => {
  const params: any = {
    sort_by: 'popularity.desc',
    include_adult: false,
    page: page || Math.floor(Math.random() * 10) + 1,
    'vote_count.gte': 50, // Lower the threshold to get more results
  };

  if (genreId) {
    params.with_genres = genreId;
  }

  const response = await tmdbApi.get(`/discover/${type}`, { params });
  return response.data.results;
};

// Map provider names to TMDB provider IDs
export const providerMap: Record<string, number> = {
  'Netflix': 8,
  'Disney+': 337,
  'Hulu': 15,
  'Prime Video': 9,
  'HBO Max': 384,
  'Apple TV+': 350
};

// Reverse mapping from ID to name
export const providerIdToName: Record<number, string> = Object.entries(providerMap).reduce(
  (acc, [name, id]) => ({ ...acc, [id]: name }), {}
);

// Get content directly by provider ID
export const getContentByProvider = async (
  type: 'movie' | 'tv',
  providerId: number,
  page: number = 1
): Promise<TMDBMovie[] | TMDBShow[]> => {
  try {
    const params: any = {
      with_watch_providers: providerId,
      watch_region: 'US',
      sort_by: 'popularity.desc',
      page: page,
      'vote_count.gte': 20
    };
    
    const response = await tmdbApi.get(`/discover/${type}`, { params });
    return response.data.results;
  } catch (error) {
    console.error(`Error fetching content for provider ${providerId}:`, error);
    return [];
  }
};

// Enhanced provider fetching with better error handling
export const getProviders = async (type: 'movie' | 'tv', id: number) => {
  try {
    const response = await tmdbApi.get(`/${type}/${id}/watch/providers`);
    // Check if we have US results
    if (response.data.results && response.data.results.US) {
      return response.data.results.US;
    }
    return null;
  } catch (error) {
    console.error('Error fetching providers:', error);
    return null;
  }
};

export const getContentRating = async (type: 'movie' | 'tv', id: number) => {
  try {
    if (type === 'tv') {
      const response = await tmdbApi.get(`/tv/${id}/content_ratings`);
      const usRating = response.data.results.find((r: any) => r.iso_3166_1 === 'US');
      return usRating ? usRating.rating : null;
    } else {
      const response = await tmdbApi.get(`/movie/${id}/release_dates`);
      const usRelease = response.data.results.find((r: any) => r.iso_3166_1 === 'US');
      return usRelease ? usRelease.release_dates[0]?.certification : null;
    }
  } catch (error) {
    console.error('Error fetching content rating:', error);
    return null;
  }
};

// Get content by provider AND genre
export const getContentByProviderAndGenre = async (
  type: 'movie' | 'tv',
  providerId: number,
  genreId?: number,
  page: number = 1
): Promise<TMDBMovie[] | TMDBShow[]> => {
  try {
    const params: any = {
      with_watch_providers: providerId,
      watch_region: 'US',
      sort_by: 'popularity.desc',
      page: page,
      'vote_count.gte': 20
    };
    
    // Add genre filter if provided
    if (genreId) {
      params.with_genres = genreId;
    }
    
    const response = await tmdbApi.get(`/discover/${type}`, { params });
    return response.data.results;
  } catch (error) {
    console.error(`Error fetching content for provider ${providerId} and genre ${genreId}:`, error);
    return [];
  }
};

// Get popular content by provider (fallback method)
export const getPopularByProvider = async (
  providerId: number,
  page: number = 1
): Promise<(TMDBMovie | TMDBShow)[]> => {
  try {
    // Try to get popular movies
    const movieParams = {
      with_watch_providers: providerId,
      watch_region: 'US',
      sort_by: 'popularity.desc',
      page: page
    };
    
    const movieResponse = await tmdbApi.get('/discover/movie', { params: movieParams });
    const movies = movieResponse.data.results;
    
    // Try to get popular TV shows
    const tvParams = {
      with_watch_providers: providerId,
      watch_region: 'US',
      sort_by: 'popularity.desc',
      page: page
    };
    
    const tvResponse = await tmdbApi.get('/discover/tv', { params: tvParams });
    const shows = tvResponse.data.results;
    
    // Combine and return
    return [...movies, ...shows];
  } catch (error) {
    console.error(`Error fetching popular content for provider ${providerId}:`, error);
    return [];
  }
};

// Add a function to get trending content as a last resort
export const getTrendingContent = async (
  page: number = 1
): Promise<(TMDBMovie | TMDBShow)[]> => {
  try {
    // Get trending movies and TV shows for the week
    const response = await tmdbApi.get('/trending/all/week', {
      params: {
        page: page
      }
    });
    return response.data.results;
  } catch (error) {
    console.error('Error fetching trending content:', error);
    return [];
  }
};

// Add a function to normalize provider names
export const normalizeProviderName = (providerName: string): string => {
  // Map of common provider name variations
  const providerNameMap: Record<string, string> = {
    'Amazon Prime Video': 'Prime Video',
    'Amazon Video': 'Prime Video',
    'Amazon': 'Prime Video',
    'Amazon Prime': 'Prime Video',
    'Netflix Basic': 'Netflix',
    'Netflix Premium': 'Netflix',
    'Netflix Standard': 'Netflix',
    'Disney Plus': 'Disney+',
    'Disney+': 'Disney+',
    'Hulu': 'Hulu',
    'HBO Max': 'HBO Max',
    'HBO': 'HBO Max',
    'Max': 'HBO Max',
    'Apple TV Plus': 'Apple TV+',
    'Apple TV+': 'Apple TV+',
    'Apple TV': 'Apple TV+'
  };

  return providerNameMap[providerName] || providerName;
}; 