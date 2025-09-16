// Secure TMDB API service - all calls go through server-side API routes
interface TMDBResponse<T> {
  results: T[];
  page: number;
  total_pages: number;
  total_results: number;
}

interface TMDBMovie {
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

interface TMDBShow {
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

interface Genre {
  id: number;
  name: string;
}

interface CastMember {
  id: number;
  name: string;
  character: string;
  order: number;
}

interface CrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
}

interface Keyword {
  id: number;
  name: string;
}

// Generic API call function
async function callTMDBAPI<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
  const response = await fetch('/api/tmdb', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ endpoint, params }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API request failed');
  }

  return response.json();
}

// Export all the same functions as the original tmdb.ts but using secure API calls
export const getGenres = async (): Promise<Genre[]> => {
  const [movieGenres, tvGenres] = await Promise.all([
    callTMDBAPI<{ genres: Genre[] }>('/genre/movie/list'),
    callTMDBAPI<{ genres: Genre[] }>('/genre/tv/list')
  ]);
  
  return [...movieGenres.genres, ...tvGenres.genres];
};

export const getContentByProvider = async (
  type: 'movie' | 'tv',
  providerId: number,
  page: number = 1,
  sortMethod: string = 'popularity.desc'
): Promise<TMDBMovie[] | TMDBShow[]> => {
  const params = {
    with_watch_providers: providerId,
    watch_region: 'US',
    sort_by: sortMethod,
    page: page,
    'vote_count.gte': 5,
    'vote_average.gte': 5.0
  };

  const response = await callTMDBAPI<TMDBResponse<TMDBMovie | TMDBShow>>(`/discover/${type}`, params);
  return response.results;
};

export const getProviders = async (type: 'movie' | 'tv', contentId: number): Promise<any> => {
  const response = await callTMDBAPI(`/${type}/${contentId}/watch/providers`);
  return response.results?.US || { flatrate: [], buy: [], rent: [] };
};

export const getContentRating = async (type: 'movie' | 'tv', contentId: number): Promise<string | null> => {
  try {
    const response = await callTMDBAPI(`/${type}/${contentId}/content_ratings`);
    const usRating = response.results?.find((r: any) => r.iso_3166_1 === 'US');
    return usRating?.rating || null;
  } catch (error) {
    console.error('Error fetching content rating:', error);
    return null;
  }
};

export const getContentDetails = async (content: TMDBMovie | TMDBShow): Promise<any> => {
  const type = 'title' in content ? 'movie' : 'tv';
  const response = await callTMDBAPI(`/${type}/${content.id}`);
  return response;
};

export const getCredits = async (type: 'movie' | 'tv', contentId: number): Promise<{ cast: CastMember[], crew: CrewMember[] }> => {
  const response = await callTMDBAPI(`/${type}/${contentId}/credits`);
  return response;
};

export const getKeywords = async (type: 'movie' | 'tv', contentId: number): Promise<Keyword[]> => {
  const response = await callTMDBAPI(`/${type}/${contentId}/keywords`);
  return response.keywords || response.results || [];
};

export const getTVDetails = async (contentId: number): Promise<any> => {
  const response = await callTMDBAPI(`/tv/${contentId}`);
  return response;
};

export const getTrendingContent = async (type: 'movie' | 'tv', timeWindow: 'day' | 'week' = 'week'): Promise<TMDBMovie[] | TMDBShow[]> => {
  const response = await callTMDBAPI<TMDBResponse<TMDBMovie | TMDBShow>>(`/trending/${type}/${timeWindow}`);
  return response.results;
};

// Provider mappings (these don't need to be secret)
export const providerMap: Record<string, number> = {
  'Netflix': 8,
  'Disney+': 337,
  'Hulu': 15,
  'Prime Video': 9,
  'HBO Max': 1899,
  'Apple TV+': 350
};

export const providerIdToName: Record<number, string> = Object.entries(providerMap).reduce(
  (acc, [name, id]) => ({ ...acc, [id]: name }), {}
);

export const normalizeProviderName = (name: string): string => {
  const normalized = name.toLowerCase().trim();
  const mappings: Record<string, string> = {
    'hbo max': 'HBO Max',
    'max': 'HBO Max',
    'disney plus': 'Disney+',
    'disney+': 'Disney+',
    'prime video': 'Prime Video',
    'amazon prime': 'Prime Video',
    'apple tv': 'Apple TV+',
    'apple tv+': 'Apple TV+',
    'netflix': 'Netflix',
    'hulu': 'Hulu'
  };
  
  return mappings[normalized] || name;
};

export const testProviderAvailability = async (providerId: number): Promise<boolean> => {
  try {
    const response = await callTMDBAPI('/discover/movie', {
      with_watch_providers: providerId,
      watch_region: 'US',
      page: 1,
      'vote_count.gte': 1
    });
    
    const hasContent = response.results && response.results.length > 0;
    console.log(`Provider ${providerId} (${providerIdToName[providerId] || 'Unknown'}) availability: ${hasContent ? 'Available' : 'No content'}`);
    return hasContent;
  } catch (error) {
    console.log(`Provider ${providerId} (${providerIdToName[providerId] || 'Unknown'}) test failed:`, error);
    return false;
  }
};

// Export types
export type { TMDBMovie, TMDBShow, Genre, CastMember, CrewMember, Keyword };
