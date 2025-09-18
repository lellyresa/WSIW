import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { 
  getGenres, 
  getProviders, 
  getContentRating, 
  getContentByProvider, 
  getPopularByProvider,
  getRandomContent,
  getContentByProviderAndGenre,
  getTrendingContent,
  getCredits,
  getKeywords,
  getTVDetails,
  getContentDetails,
  providerMap, 
  providerIdToName,
  normalizeProviderName,
  testProviderAvailability,
  Genre, 
  TMDBMovie, 
  TMDBShow,
  CastMember,
  CrewMember,
  Keyword
} from '@/lib/tmdb-secure';

interface ContentItem {
  id: number;
  title: string;
  type: 'movie' | 'tv';
  genre: string;
  rating: string | null;
  providers: string[];
  posterPath: string | null;
  overview: string;
  releaseDate: string;
  voteAverage: number;
  runtime?: number;
  numberOfSeasons?: number;
  numberOfEpisodes?: number;
  cast: string[];
  director?: string;
  creator?: string;
  keywords: string[];
}

// Add a new interface for content with actual providers
interface ContentWithProviders {
  actualProviders: string[];
  prefetchedRating?: string | null;
  passesRatingFilter?: boolean;
  id: number;
  title?: string;
  name?: string;
  overview: string;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  poster_path: string | null;
  genre_ids: number[];
  original_language: string;
  popularity: number;
  backdrop_path: string | null;
  adult?: boolean;
  origin_country?: string[];
}

// Error types for better error handling
enum ErrorType {
  API_FAILURE = 'API_FAILURE',
  NO_CONTENT = 'NO_CONTENT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  CONTENT_DETAILS_ERROR = 'CONTENT_DETAILS_ERROR'
}

interface AppError {
  type: ErrorType;
  message: string;
  details?: string;
}

class StreamingAppError extends Error implements AppError {
  type: ErrorType;
  details?: string;

  constructor(type: ErrorType, message: string, details?: string) {
    super(message);
    this.name = 'StreamingAppError';
    this.type = type;
    this.details = details;
  }
}

// Define streaming services with their colors
const streamingServices = [
  { name: 'Netflix', color: '#E50914' },
  { name: 'Disney+', color: '#0063e5' },
  { name: 'Hulu', color: '#1CE783' },
  { name: 'Prime Video', color: '#00A8E1' },
  { name: 'HBO Max', color: '#5822b4' },
  { name: 'Apple TV+', color: '#000000' }
];

const StreamingSlotMachine: React.FC = () => {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [selectedContentTypes, setSelectedContentTypes] = useState<('movie' | 'tv')[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedRatings, setSelectedRatings] = useState<string[]>([]);
  const [currentContent, setCurrentContent] = useState<ContentItem | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinsRemaining, setSpinsRemaining] = useState(3);
  const [buttonScale, setButtonScale] = useState(1);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [suggestedItems, setSuggestedItems] = useState<(ContentItem | null)[]>([null, null, null]);
  const [usedContentIds, setUsedContentIds] = useState<Set<number>>(new Set());
  const [currentError, setCurrentError] = useState<AppError | null>(null);
  const [loadingStates, setLoadingStates] = useState({
    fetchingContent: false,
    checkingProviders: false,
    gettingDetails: false
  });
  
  const [loadingProgress, setLoadingProgress] = useState({
    currentStep: 0,
    totalSteps: 4,
    stepName: '',
    progress: 0
  });

  // Separate maturity ratings for movies and TV
  const movieRatings: string[] = ['G', 'PG', 'PG-13', 'R', 'NC-17'];
  const tvRatings: string[] = ['TV-Y', 'TV-Y7', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA'];
  
  // Combined for backward compatibility
  const allMaturityRatings: string[] = [...movieRatings, ...tvRatings];

  useEffect(() => {
    const loadGenres = async () => {
      const genreList = await getGenres();
      setGenres(genreList);
      setSelectedGenres(genreList.map(genre => genre.id));
    };
    loadGenres();
  }, []);

  const getRandomContentType = (): 'movie' | 'tv' => {
    const randomIndex = Math.floor(Math.random() * selectedContentTypes.length);
    return selectedContentTypes[randomIndex];
  };

  // Error handling functions
  const handleError = (error: AppError) => {
    console.error(`Error [${error.type}]:`, error.message, error.details);
    setCurrentError(error);
    setErrorMessage(error.message);
    setShowErrorModal(true);
  };

  const clearError = () => {
    setShowErrorModal(false);
    setCurrentError(null);
    setErrorMessage('');
  };

  // Reset used content IDs when spins are exhausted or reset
  const resetUsedContent = () => {
    setUsedContentIds(new Set());
    setProviderUsageCount({});
    console.log("Reset used content IDs and provider usage - fresh content pool available");
  };

  // Track provider usage for better balancing
  const [providerUsageCount, setProviderUsageCount] = useState<Record<string, number>>({});

  // Select content with better provider balancing
  const selectBalancedContent = (contentList: ContentWithProviders[]): ContentWithProviders => {
    if (contentList.length === 0) {
      throw new Error("No content available for selection");
    }

    // If we only have one item, return it
    if (contentList.length === 1) {
      return contentList[0];
    }

    // Count current provider usage
    const currentUsage = { ...providerUsageCount };
    
    // Calculate weights - less used providers get higher weight
    const contentWithWeights = contentList.map(item => {
      const primaryProvider = item.actualProviders[0] || 'Unknown';
      const usageCount = currentUsage[primaryProvider] || 0;
      const weight = Math.max(1, 10 - usageCount); // Higher weight for less used providers
      
      return {
        content: item,
        weight,
        provider: primaryProvider
      };
    });

    // Weighted random selection
    const totalWeight = contentWithWeights.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const item of contentWithWeights) {
      random -= item.weight;
      if (random <= 0) {
        // Update usage count
        setProviderUsageCount(prev => ({
          ...prev,
          [item.provider]: (prev[item.provider] || 0) + 1
        }));
        
        console.log(`Selected content from ${item.provider} (usage: ${(currentUsage[item.provider] || 0) + 1})`);
        return item.content;
      }
    }

    // Fallback to random selection
    const randomIndex = Math.floor(Math.random() * contentList.length);
    const selected = contentList[randomIndex];
    const primaryProvider = selected.actualProviders[0] || 'Unknown';
    
    setProviderUsageCount(prev => ({
      ...prev,
      [primaryProvider]: (prev[primaryProvider] || 0) + 1
    }));
    
    console.log(`Fallback selection from ${primaryProvider}`);
    return selected;
  };

  const chooseContent = async (
    usedIdsSnapshot: Set<number>,
    allContent: (TMDBMovie | TMDBShow)[],
    contentWithProviders: ContentWithProviders[],
    options: { enforceRating: boolean }
  ): Promise<{
    formattedContent: ContentItem | null;
    selectedContent: TMDBMovie | TMDBShow | null;
    providersForContent: string[];
  }> => {
    const seenThisSpin = new Set<number>();
    let hasResetUsedContent = false;
    let formattedContent: ContentItem | null = null;
    let selectedContent: TMDBMovie | TMDBShow | null = null;
    let providersForContent: string[] = [];
    const enforceRating = options.enforceRating && selectedRatings.length > 0;

    for (let attempt = 0; attempt < 16 && !formattedContent; attempt++) {
      let candidate: TMDBMovie | TMDBShow | null = null;
      let candidateProviders: string[] = [];
      let ratingHint: string | null | undefined = undefined;

      if (contentWithProviders.length > 0) {
        const providerPool = contentWithProviders.filter(item => {
          if (usedIdsSnapshot.has(item.id) || seenThisSpin.has(item.id)) {
            return false;
          }

          if (enforceRating && item.passesRatingFilter === false) {
            return false;
          }

          return true;
        });

        if (providerPool.length === 0) {
          if (!hasResetUsedContent && contentWithProviders.length > 10) {
            console.log('Resetting used content due to exhausted provider matches');
            resetUsedContent();
            usedIdsSnapshot.clear();
            hasResetUsedContent = true;
            continue;
          }
        } else {
          const prioritizedPool = enforceRating
            ? providerPool
            : [...providerPool].sort((a, b) => {
                const aScore = a.passesRatingFilter === false ? 1 : 0;
                const bScore = b.passesRatingFilter === false ? 1 : 0;
                return aScore - bScore;
              });

          const selectedContentWithProviders = selectBalancedContent(prioritizedPool);
          candidate = selectedContentWithProviders as TMDBMovie | TMDBShow;
          candidateProviders = selectedContentWithProviders.actualProviders;
          ratingHint = selectedContentWithProviders.prefetchedRating;
          seenThisSpin.add(selectedContentWithProviders.id);
        }
      }

      if (!candidate) {
        const fallbackPool = allContent.filter(item => !usedIdsSnapshot.has(item.id) && !seenThisSpin.has(item.id));

        if (fallbackPool.length === 0) {
          if (!hasResetUsedContent) {
            console.log('Resetting used content due to exhausted fallback options');
            resetUsedContent();
            usedIdsSnapshot.clear();
            hasResetUsedContent = true;
            continue;
          }
          break;
        }

        const randomIndex = Math.floor(Math.random() * fallbackPool.length);
        candidate = fallbackPool[randomIndex];
        seenThisSpin.add(candidate.id);

        try {
          const providers = await getProviders(
            'title' in candidate ? 'movie' : 'tv',
            candidate.id
          );
          candidateProviders = formatProviders(providers);
        } catch (error) {
          console.error('Error fetching providers for fallback candidate:', error);
          candidateProviders = [];
        }
      }

      if (!candidate) {
        continue;
      }

      updateLoadingProgress('Finalizing recommendation...');
      console.log('Evaluating candidate:', 'title' in candidate ? candidate.title : candidate.name, '(ID:', candidate.id, ')');

      try {
        const candidateContent = await formatContentItem(candidate, candidateProviders, { ratingHint });

        if (enforceRating) {
          if (!candidateContent.rating || !selectedRatings.includes(candidateContent.rating)) {
            console.log(`Skipping candidate ${candidateContent.title} due to rating mismatch: ${candidateContent.rating}`);
            continue;
          }
        }

        formattedContent = candidateContent;
        selectedContent = candidate;
        providersForContent = candidateProviders;
      } catch (formatError) {
        console.error('Error formatting candidate content:', formatError);
        continue;
      }
    }

    return { formattedContent, selectedContent, providersForContent };
  };


  const createError = (type: ErrorType, message: string, details?: string): StreamingAppError => (
    new StreamingAppError(type, message, details)
  );

  // Enhanced loading state management
  const setLoadingState = (key: keyof typeof loadingStates, value: boolean) => {
    setLoadingStates((prev: typeof loadingStates) => ({ ...prev, [key]: value }));
  };

  const updateLoadingProgress = (stepName: string) => {
    setLoadingProgress((prev: typeof loadingProgress) => ({
      ...prev,
      stepName
    }));
  };

  const resetLoadingProgress = () => {
    setLoadingProgress({
      currentStep: 0,
      totalSteps: 4,
      stepName: '',
      progress: 0
    });
  };

  const updateLoadingMessage = (message: string) => {
    console.log(`Loading: ${message}`);
  };

  const formatProviders = (providers: any): string[] => {
    if (!providers) return [];
    
    // Only include flatrate, free, and ads providers (subscription services)
    const allProviders = [
      ...(providers.flatrate || []), 
      ...(providers.free || []), 
      ...(providers.ads || []),
      ...(providers.buy || []), // Include buy options as well
      ...(providers.rent || [])  // Include rent options as well
    ];
    
    // Extract unique provider names and normalize them
    const uniqueProviders = [...new Set(allProviders.map((p: any) => normalizeProviderName(p.provider_name)))];
    
    // Only return providers that are in our streamingOptions list
    return uniqueProviders.filter(provider => 
      streamingServices.some(s => s.name === provider)
    );
  };

  // Content fetching strategies with improved error handling
  const fetchContentWithStrategies = async (contentType: 'movie' | 'tv', providerId: number): Promise<(TMDBMovie | TMDBShow)[]> => {
    setLoadingState('fetchingContent', true);
    updateLoadingProgress('Searching for content...');
    updateLoadingMessage('Searching for content...');
    
      let allContent: (TMDBMovie | TMDBShow)[] = [];
    let lastError: Error | null = null;
      
      // Strategy 1: Try with provider and content type
    for (let attempt = 0; attempt < 3 && allContent.length < 20; attempt++) {
        try {
        const page = Math.floor(Math.random() * 5) + 1;
        console.log(`Strategy 1: Provider ${providerId}, type ${contentType}, page ${page}`);
          const newContent = await getContentByProvider(contentType, providerId, page);
          
          for (const item of newContent) {
            if (!allContent.some(c => c.id === item.id)) {
              allContent.push(item);
            }
          }
        } catch (error) {
        lastError = error as Error;
        console.error(`Strategy 1 error:`, error);
        }
      }
      
    // Strategy 2: Try alternate content type if we have multiple types selected
      if (allContent.length < 10 && selectedContentTypes.length > 1) {
        const alternateType = contentType === 'movie' ? 'tv' : 'movie';
        try {
        console.log(`Strategy 2: Alternate type ${alternateType} with provider ${providerId}`);
          const newContent = await getContentByProvider(alternateType, providerId, 1);
          
          for (const item of newContent) {
            if (!allContent.some(c => c.id === item.id)) {
              allContent.push(item);
            }
          }
        } catch (error) {
        lastError = error as Error;
        console.error(`Strategy 2 error:`, error);
        }
      }
      
      // Strategy 3: Try popular content for this provider
      if (allContent.length < 5) {
        try {
          console.log(`Strategy 3: Popular content for provider ${providerId}`);
          const popularContent = await getPopularByProvider(providerId, 1);
          
          for (const item of popularContent) {
            if (!allContent.some(c => c.id === item.id)) {
              allContent.push(item);
            }
          }
        } catch (error) {
          lastError = error as Error;
          console.error(`Strategy 3 error:`, error);
        }
      }
      
      // Strategy 4: Try random content without provider filtering
      if (allContent.length < 5) {
        try {
          console.log(`Strategy 4: Random content without provider filtering`);
          const randomContent = await getRandomContent(contentType, undefined, 1);
          
          for (const item of randomContent) {
            if (!allContent.some(c => c.id === item.id)) {
              allContent.push(item);
            }
          }
        } catch (error) {
          lastError = error as Error;
          console.error(`Strategy 4 error:`, error);
        }
      }
      
      // Strategy 5: Last resort - get trending content
      if (allContent.length < 5) {
        try {
        console.log(`Strategy 5: Trending content (last resort)`);
          const trendingContent = await getTrendingContent(contentType);
          
          for (const item of trendingContent) {
            if (!allContent.some(c => c.id === item.id)) {
              allContent.push(item);
            }
          }
        } catch (error) {
        lastError = error as Error;
        console.error(`Strategy 5 error:`, error);
      }
    }
    
    // If we still have no content and there was an error, throw a specific error
    if (allContent.length === 0 && lastError) {
      setLoadingState('fetchingContent', false);
      throw createError(
        ErrorType.API_FAILURE,
        "Unable to fetch content from the movie database. Please check your internet connection and try again.",
        lastError.message
      );
    }
    
    setLoadingState('fetchingContent', false);
    return allContent.sort(() => Math.random() - 0.5); // Shuffle for randomness
  };

  const MAX_PROVIDER_LOOKUPS = 24;
  const PROVIDER_MATCH_TARGET = 8;
  const PROVIDER_CONCURRENCY = 4;

  async function runWithConcurrency<T>(
    items: T[],
    limit: number,
    handler: (item: T, index: number) => Promise<void>
  ) {
    if (items.length === 0) {
      return;
    }

    let currentIndex = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
      (async () => {
        while (true) {
          const index = currentIndex;
          if (index >= items.length) {
            break;
          }

          currentIndex += 1;
          await handler(items[index], index);
        }
      })()
    );

    await Promise.all(workers);
  }

  // Process content to find items with matching providers
  const findContentWithMatchingProviders = async (allContent: (TMDBMovie | TMDBShow)[]): Promise<ContentWithProviders[]> => {
    setLoadingState('checkingProviders', true);
    updateLoadingProgress('Checking streaming availability...');
    updateLoadingMessage('Checking streaming availability...');
    
    const contentWithProviders: ContentWithProviders[] = [];
    const itemsToInspect = allContent.slice(0, MAX_PROVIDER_LOOKUPS);
    const seenIds = new Set<number>();
    let passingMatches = 0;

    await runWithConcurrency(itemsToInspect, PROVIDER_CONCURRENCY, async (item) => {
      if (passingMatches >= PROVIDER_MATCH_TARGET) {
        return;
      }

      const contentType: 'movie' | 'tv' = 'title' in item ? 'movie' : 'tv';

      try {
        if (seenIds.has(item.id)) {
          return;
        }

        const providers = await getProviders(contentType, item.id);
        const availableProviders = formatProviders(providers);
        const matchingProviders = availableProviders.filter(provider =>
          selectedServices.includes(provider)
        );

        if (matchingProviders.length === 0) {
          return;
        }

        let rating: string | null | undefined = undefined;
        let passesRating = true;

        if (selectedRatings.length > 0) {
          try {
            rating = await getContentRating(contentType, item.id);

            if (!rating || !selectedRatings.includes(rating)) {
              passesRating = false;
            }
          } catch (error) {
            console.log(`Error getting rating for content ${item.id}:`, error);
            passesRating = false;
          }
        }

        seenIds.add(item.id);

        contentWithProviders.push({
          ...item,
          actualProviders: matchingProviders,
          prefetchedRating: rating,
          passesRatingFilter: passesRating
        });

        if (passesRating) {
          passingMatches += 1;
        }
      } catch (error) {
        console.error('Error checking providers:', error);
      }
    });

    setLoadingState('checkingProviders', false);
    return contentWithProviders;
  };

  // Get additional content details (runtime, seasons, rating)
  const fetchAdditionalDetails = async (content: TMDBMovie | TMDBShow): Promise<{
    runtime?: number;
    numberOfSeasons?: number;
  }> => {
    setLoadingState('gettingDetails', true);
    updateLoadingProgress('Getting content details...');
    updateLoadingMessage('Getting content details...');
    
    const isMovie = 'title' in content;
    let runtime: number | undefined;
    let numberOfSeasons: number | undefined;

    try {
      const details = await getContentDetails(content);

      if (isMovie) {
        runtime = details.runtime;
      } else {
        numberOfSeasons = details.number_of_seasons;
        runtime = Array.isArray(details.episode_run_time)
          ? details.episode_run_time[0]
          : details.episode_run_time;
      }
    } catch (error) {
      console.error('Error fetching content details:', error);
    } finally {
      setLoadingState('gettingDetails', false);
    }

    return { runtime, numberOfSeasons };
  };

  // Format content item for display
  const formatContentItem = async (
    content: TMDBMovie | TMDBShow,
    providers: string[],
    options: { ratingHint?: string | null } = {}
  ): Promise<ContentItem> => {
    const isMovie = 'title' in content;
    const contentType = isMovie ? 'movie' : 'tv';
    const genreName = content.genre_ids && content.genre_ids.length > 0
      ? genres.find((g: Genre) => content.genre_ids.includes(g.id))?.name || 'Unknown'
      : 'Unknown';

    // Fetch all additional data in parallel
    const ratingPromise = options.ratingHint !== undefined
      ? Promise.resolve(options.ratingHint)
      : getContentRating(contentType, content.id);

    const [details, credits, keywords, tvDetails, contentRating] = await Promise.all([
      fetchAdditionalDetails(content),
      getCredits(contentType, content.id),
      getKeywords(contentType, content.id),
      !isMovie ? getTVDetails(content.id) : Promise.resolve(null),
      ratingPromise
    ]);

    // Extract cast names (top 3)
    const cast = credits.cast.map((actor: CastMember) => actor.name);

    // Find director (for movies) or creator (for TV shows)
    let director: string | undefined;
    let creator: string | undefined;
    
    if (isMovie) {
      const directorCrew = credits.crew.find((person: CrewMember) => person.job === 'Director');
      director = directorCrew?.name;
      } else {
      // For TV shows, use created_by from TV details
      if (tvDetails?.created_by && tvDetails.created_by.length > 0) {
        creator = tvDetails.created_by[0].name;
      }
    }

    // Extract keyword names
    const keywordNames = keywords.map((keyword: Keyword) => keyword.name);

    return {
      id: content.id,
      title: isMovie ? content.title || 'Unknown Title' : content.name || 'Unknown Title',
      type: contentType,
      genre: genreName,
      rating: contentRating,
      providers,
      posterPath: content.poster_path,
      overview: content.overview || "No description available.",
      releaseDate: isMovie ? content.release_date || 'Unknown Date' : content.first_air_date || 'Unknown Date',
      voteAverage: content.vote_average || 0,
      runtime: details.runtime,
      numberOfSeasons: details.numberOfSeasons,
      numberOfEpisodes: tvDetails?.number_of_episodes,
      cast,
      director,
      creator,
      keywords: keywordNames
    };
  };

  // Enhanced content fetching with better provider balance
  const fetchContentFromAllProviders = async (contentType: 'movie' | 'tv'): Promise<(TMDBMovie | TMDBShow)[]> => {
    setLoadingState('fetchingContent', true);
    updateLoadingProgress('Searching across all providers...');
    updateLoadingMessage('Searching across all providers...');
    
    const selectedProviderIds = selectedServices
      .map((service: string) => providerMap[service])
      .filter((id: number | undefined) => id !== undefined);
    
    if (selectedProviderIds.length === 0) {
      console.log("No valid provider IDs found, using all providers");
      selectedProviderIds.push(...Object.values(providerMap).filter((id: number | undefined) => id !== undefined));
    }
    
    let allContent: (TMDBMovie | TMDBShow)[] = [];
    const maxContentPerProvider = 25; // Increased for more variety
    const failedProviders: string[] = [];
    
    // Different sorting methods for variety
    const sortMethods = [
      'popularity.desc',
      'vote_average.desc', 
      'release_date.desc',
      'vote_count.desc',
      'revenue.desc'
    ];
    
    // Shuffle providers to ensure random order
    const shuffledProviders = [...selectedProviderIds].sort(() => Math.random() - 0.5);
    
    // Fetch content from each provider with different sorting methods
    for (const providerId of shuffledProviders) {
      try {
        console.log(`Fetching content from provider ${providerId} (${providerIdToName[providerId]})`);
        
        let providerContentCount = 0;
        // Try multiple pages and sorting methods for each provider
        for (let page = 1; page <= 5 && providerContentCount < maxContentPerProvider; page++) {
          // Use different sorting methods to get variety
          const sortMethod = sortMethods[Math.floor(Math.random() * sortMethods.length)];
          const content = await getContentByProvider(contentType, providerId, page, sortMethod);
          
          for (const item of content) {
            if (!allContent.some(c => c.id === item.id)) {
              allContent.push(item);
              providerContentCount++;
            }
          }
        }
        
        if (providerContentCount === 0) {
          failedProviders.push(providerIdToName[providerId] || `Provider ${providerId}`);
        }
      } catch (error) {
        console.error(`Error fetching from provider ${providerId}:`, error);
        failedProviders.push(providerIdToName[providerId] || `Provider ${providerId}`);
      }
    }
    
    // If we don't have enough content, try alternate content type and trending content
    if (allContent.length < 15) {
      console.log(`Only found ${allContent.length} items, trying additional sources...`);
      
      // Try trending content for more variety
      try {
        const trendingContent = await getTrendingContent(contentType, 'week');
        console.log(`Found ${trendingContent.length} trending items`);
        for (const item of trendingContent) {
          if (!allContent.some(c => c.id === item.id)) {
            allContent.push(item);
          }
        }
      } catch (error) {
        console.error('Error fetching trending content:', error);
      }
      
      // Try alternate content type if we have multiple types selected
      if (selectedContentTypes.length > 1) {
        const alternateType = contentType === 'movie' ? 'tv' : 'movie';
        console.log(`Trying alternate content type: ${alternateType}`);
        
        for (const providerId of shuffledProviders.slice(0, 3)) { // Try top 3 providers
          try {
            const content = await getContentByProvider(alternateType, providerId, 1, 'popularity.desc');
            for (const item of content) {
              if (!allContent.some(c => c.id === item.id)) {
                allContent.push(item);
              }
            }
          } catch (error) {
            console.error(`Error fetching alternate content from provider ${providerId}:`, error);
          }
        }
      }
    }
    
    // Log failed providers for debugging
    if (failedProviders.length > 0) {
      console.warn(`Failed to fetch content from: ${failedProviders.join(', ')}`);
    }
    
    // Enhanced shuffling with better randomization
    const shuffledContent = [...allContent].sort(() => Math.random() - 0.5);
    console.log(`🎬 Total content fetched: ${shuffledContent.length} items`);
    console.log(`📊 Content variety: ${new Set(shuffledContent.map(c => 'title' in c ? c.title : c.name)).size} unique titles`);
    
    setLoadingState('fetchingContent', false);
    return shuffledContent;
  };

  // Main spin button function - now much cleaner!
  const spinButton = async () => {
    console.log("🎯 SPIN BUTTON CLICKED!");
    console.log("Current state - isSpinning:", isSpinning, "spinsRemaining:", spinsRemaining);
    
    if (isSpinning || spinsRemaining <= 0) {
      console.log("❌ Button click ignored - isSpinning:", isSpinning, "spinsRemaining:", spinsRemaining);
      return;
    }

    console.log("✅ Starting spin process...");
    setIsSpinning(true);
    setButtonScale(0.9);
    setSpinsRemaining((prev: number) => prev - 1);
    resetLoadingProgress();
    setTimeout(() => setButtonScale(1), 200);

    try {
      console.log("Selected streaming services:", selectedServices);
      console.log("Selected content types:", selectedContentTypes);
      
      // Check if user has made selections
      if (selectedServices.length === 0) {
        setCurrentError({
          type: ErrorType.PROVIDER_ERROR,
          message: 'Hey stranger! 🎬 You forgot to pick a streaming service!',
          details: ''
        });
        setShowErrorModal(true);
        setIsSpinning(false);
        setSpinsRemaining((prev: number) => prev + 1);
        return;
      }
      
      if (selectedContentTypes.length === 0) {
        setCurrentError({
          type: ErrorType.PROVIDER_ERROR,
          message: 'Hold up! 🤔 You forgot to select movie or show!',
          details: ''
        });
        setShowErrorModal(true);
          setIsSpinning(false);
        setSpinsRemaining((prev: number) => prev + 1);
        return;
      }
      
      // Get random content type from selected types
      const contentType = getRandomContentType();
      
      // Fetch content from ALL selected providers, not just one
      const allContent = await fetchContentFromAllProviders(contentType);
      
      // Check if we got any content at all
      if (allContent.length === 0) {
        throw createError(
          ErrorType.NO_CONTENT,
          `No content found from your selected services: ${selectedServices.join(', ')}. Try selecting different services or content types.`,
          'All selected providers returned empty results'
        );
      }
      
      // Try to find content with matching providers
      const contentWithProviders = await findContentWithMatchingProviders(allContent);

      const usedIdsSnapshot = new Set(usedContentIds);

      let selectionResult = await chooseContent(usedIdsSnapshot, allContent, contentWithProviders, {
        enforceRating: selectedRatings.length > 0,
      });

      if ((!selectionResult.formattedContent || !selectionResult.selectedContent) && selectedRatings.length > 0) {
        console.log('No candidates satisfied the rating filter. Retrying without the rating constraint for this spin.');
        selectionResult = await chooseContent(usedIdsSnapshot, allContent, contentWithProviders, {
          enforceRating: false,
        });
      }

      const { formattedContent, selectedContent, providersForContent } = selectionResult;

      if (!formattedContent || !selectedContent) {
        throw createError(
          ErrorType.NO_CONTENT,
          'We could not find a title that matches all of your selections. Try relaxing a filter and spinning again!',
          'All candidate titles were filtered out or failed to load'
        );
      }

      console.log("🎉 SUCCESS! Selected content ID:", selectedContent.id, "Title:", 'title' in selectedContent ? selectedContent.title : selectedContent.name);
      console.log("Providers considered:", providersForContent);

      const selectedContentId = selectedContent.id;

      usedIdsSnapshot.add(selectedContentId);

      setUsedContentIds((prev: Set<number>) => {
        const updated = new Set(prev);
        updated.add(selectedContentId);
        return updated;
      });

      const finalContent = formattedContent;

      setTimeout(() => {
        setCurrentContent(finalContent);
          setSuggestedItems((prev: (ContentItem | null)[]) => {
            // Find the first empty slot (null) and place the new item there
            const newItems = [...prev];
            const firstEmptyIndex = newItems.findIndex(item => item === null || item === undefined);
            
            if (firstEmptyIndex !== -1 && firstEmptyIndex < 3) {
              // Place in the first available empty slot
              newItems[firstEmptyIndex] = finalContent;
            } else if (newItems.length < 3) {
              // If array is shorter than 3, add to the end
              newItems.push(finalContent);
            }
            
            // Ensure we always have exactly 3 slots (fill with null if needed)
            while (newItems.length < 3) {
              newItems.push(null);
            }
            
            return newItems.slice(0, 3);
          });
          setIsSpinning(false);
          resetLoadingProgress();
        }, 1500);
      
    } catch (error) {
      console.error('❌ ERROR in spinButton:', error);
      console.error('Error type:', typeof error);
      console.error('Error details:', error);

      if (error instanceof StreamingAppError) {
        console.log('Handling StreamingAppError:', error);
        handleError(error);
      } else if (error && typeof error === 'object' && 'type' in (error as Record<string, unknown>)) {
        console.log('Handling AppError-like object:', error);
        handleError(error as AppError);
      } else {
        console.log('Handling generic error:', error);
        handleError(createError(
          ErrorType.API_FAILURE,
          'An unexpected error occurred while fetching content. Please try again.',
          error instanceof Error ? error.message : 'Unknown error'
        ));
      }

      console.log('🔄 Resetting spin state after error');
      setIsSpinning(false);
      setSpinsRemaining((prev: number) => prev + 1);
    }
  };

  const toggleService = (service: string) => {
    setSelectedServices((prev: string[]) => {
      if (prev.includes(service)) {
        return prev.length > 1 ? prev.filter((s: string) => s !== service) : prev;
      }
      return [...prev, service];
    });
  };

  const toggleContentType = (type: 'movie' | 'tv') => {
    setSelectedContentTypes((prev: ('movie' | 'tv')[]) => {
      const newTypes = prev.includes(type) 
        ? (prev.length > 1 ? prev.filter((t: 'movie' | 'tv') => t !== type) : prev)
        : [...prev, type];
      
      // Clear irrelevant ratings when only one content type is selected
      if (newTypes.length === 1) {
        const irrelevantRatings = newTypes.includes('movie') ? tvRatings : movieRatings;
        setSelectedRatings((prevRatings) => 
          prevRatings.filter(rating => !irrelevantRatings.includes(rating))
        );
      }
      
      return newTypes;
    });
  };

  const toggleRating = (rating: string) => {
    setSelectedRatings((prev: string[]) => {
      if (prev.includes(rating)) {
        return prev.filter((r: string) => r !== rating);
      }
      return [...prev, rating];
    });
  };

  // Update the getServiceColor function to add white glow for Apple TV+
  const getServiceColor = (serviceName: string): string => {
    // Normalize the service name first
    const normalizedName = normalizeProviderName(serviceName);
    
    // Find the service in our streamingServices array
    const service = streamingServices.find(s => s.name === normalizedName);
    return service ? service.color : '#777';
  };

  const closeErrorModal = () => {
    clearError();
  };

  // Handle escape key for modal
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showErrorModal) {
        closeErrorModal();
      }
    };

    if (showErrorModal) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [showErrorModal]);

  // Debug function to test provider availability (accessible from browser console)
  useEffect(() => {
    (window as any).testHBO = async () => {
      console.log('Testing HBO Max provider availability...');
      const { testProviderAvailability } = await import('@/lib/tmdb');
      
      const hboIds = [1899, 384, 31]; // Max, old HBO Max, HBO
      for (const id of hboIds) {
        const available = await testProviderAvailability(id);
        console.log(`Provider ID ${id}: ${available ? 'Available' : 'Not available'}`);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white pb-24">
      {/* 80s Digital Header */}
      <div className="relative">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="text-center">
            {/* 80s Digital Logo */}
            <div className="mb-6">
              <h1 className="text-3xl md:text-4xl font-black mb-2 tracking-wider transform -skew-x-6" 
                  style={{
                    background: 'linear-gradient(45deg, #00ffff, #ff00ff, #ffff00, #00ff00)',
                    backgroundSize: '400% 400%',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    animation: 'gradientShift 3s ease-in-out infinite',
                    textShadow: '0 0 20px rgba(0, 255, 255, 0.5), 0 0 40px rgba(255, 0, 255, 0.3)',
                    fontFamily: 'monospace'
                  }}>
                WHAT SHOULD I WATCH
        </h1>
      </div>
      
            {/* 80s Digital Tagline */}
            <div className="relative">
              <p className="text-lg md:text-xl font-bold text-pink-400 tracking-wider transform skew-x-6" 
                 style={{ 
                   textShadow: '0 0 15px rgba(255, 0, 255, 0.6)',
                   fontFamily: 'monospace'
                 }}>
                Stop Searching. Start Watching.
              </p>
              {/* Digital grid overlay */}
              <div className="absolute inset-0 pointer-events-none opacity-20">
                <div className="w-full h-full" style={{
                  backgroundImage: `
                    linear-gradient(rgba(0, 255, 255, 0.1) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(0, 255, 255, 0.1) 1px, transparent 1px)
                  `,
                  backgroundSize: '20px 20px'
                }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Modern Filters Section */}
      <div className="max-w-6xl mx-auto px-6 -mt-10 relative z-10">
        <div className="grid grid-cols-12 gap-6">
           {/* Streaming Services Card */}
           <div className="col-span-12 md:col-span-6 bg-slate-800/60 backdrop-blur-xl rounded-2xl pt-7 px-7 pb-[10px] border border-purple-400/40 shadow-2xl shadow-black/20">
            
            <div className="grid grid-cols-2 gap-2.5 mb-8" role="group" aria-label="Streaming services">
            {streamingServices.map(service => (
              <button
                key={service.name}
                onClick={() => toggleService(service.name)}
                aria-pressed={selectedServices.includes(service.name)}
                className={`group relative px-4 py-3 rounded-full transition-all duration-200 border text-center focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                  selectedServices.includes(service.name) 
                    ? 'text-white'
                    : 'border-white/20 text-white/60 hover:text-white/80'
                }`}
                style={{ 
                  borderColor: selectedServices.includes(service.name) 
                    ? (service.name === 'Apple TV+' ? '#ffffff' : service.color) 
                    : 'rgba(255,255,255,0.2)',
                  backgroundColor: selectedServices.includes(service.name) 
                    ? (service.name === 'Apple TV+' ? 'rgba(139, 157, 195, 0.25)' : `${service.color}15`)
                    : 'rgba(0,0,0,0.2)'
                }}
              >
                <span className="text-sm font-semibold">
                {service.name}
                </span>
              </button>
            ))}
          </div>

          {/* Content Type Section - compact version */}
          <div>
            <div className="mt-10 mb-6">
              <div className="w-full h-px bg-gradient-to-r from-transparent via-purple-400/30 to-transparent mb-4"></div>
            </div>
        
            <div className="grid grid-cols-2 gap-2.5" role="group" aria-label="Content type">
            <button
              onClick={() => toggleContentType('movie')}
              aria-pressed={selectedContentTypes.includes('movie')}
                className={`group relative px-4 py-3 rounded-full transition-all duration-200 border text-center focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                selectedContentTypes.includes('movie') 
                    ? 'text-white'
                    : 'border-white/20 text-white/60 hover:text-white/80'
                }`}
                style={{
                  borderColor: selectedContentTypes.includes('movie') ? '#6366F1' : 'rgba(255,255,255,0.2)',
                  backgroundColor: selectedContentTypes.includes('movie') 
                    ? 'rgba(99, 102, 241, 0.15)' 
                    : 'rgba(0,0,0,0.2)'
                }}
              >
                <span className="text-sm font-semibold">
                  🎬 Movies
                </span>
            </button>
            <button
              onClick={() => toggleContentType('tv')}
              aria-pressed={selectedContentTypes.includes('tv')}
                className={`group relative px-4 py-3 rounded-full transition-all duration-200 border text-center focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                selectedContentTypes.includes('tv') 
                    ? 'text-white'
                    : 'border-white/20 text-white/60 hover:text-white/80'
                }`}
                style={{
                  borderColor: selectedContentTypes.includes('tv') ? '#06B6D4' : 'rgba(255,255,255,0.2)',
                  backgroundColor: selectedContentTypes.includes('tv') 
                    ? 'rgba(6, 182, 212, 0.15)' 
                    : 'rgba(0,0,0,0.2)'
                }}
              >
                <span className="text-sm font-semibold">
                  📺 TV Shows
                </span>
            </button>
          </div>
        </div>
        {/* Maturity Rating Section */}
        <div>
          <div className="mt-6 mb-6">
            <div className="w-full h-px bg-gradient-to-r from-transparent via-purple-400/30 to-transparent mb-4"></div>
          </div>
          
          {/* Movie Ratings */}
          <div className="mb-4">
            <div className="flex items-center mb-3">
              <div className="w-1.5 h-6 bg-gradient-to-b from-indigo-400 to-indigo-600 rounded-full mr-3"></div>
              <h3 className="text-lg font-semibold text-indigo-300">🎬 Movies</h3>
            </div>
            <div className="grid grid-cols-5 gap-2" role="group" aria-label="Movie maturity ratings">
              {movieRatings.map((rating: string) => {
                const isDisabled = selectedContentTypes.length === 1 && !selectedContentTypes.includes('movie');
                const isSelected = selectedRatings.includes(rating);
                
                return (
                  <button
                    key={rating}
                    onClick={() => !isDisabled && toggleRating(rating)}
                    disabled={isDisabled}
                    aria-pressed={isSelected}
                    className={`group relative px-3 py-2 rounded-full transition-all duration-200 border text-center focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                      isDisabled 
                        ? 'border-gray-600/30 text-gray-500 cursor-not-allowed'
                        : isSelected
                          ? 'text-white'
                          : 'border-indigo-400/40 text-indigo-200 hover:text-white hover:border-indigo-300'
                    }`}
                    style={{
                      borderColor: isDisabled 
                        ? 'rgba(75, 85, 99, 0.3)'
                        : isSelected 
                          ? '#6366F1' 
                          : 'rgba(99, 102, 241, 0.4)',
                      backgroundColor: isDisabled
                        ? 'rgba(0,0,0,0.1)'
                        : isSelected
                          ? 'rgba(99, 102, 241, 0.15)'
                          : 'rgba(0,0,0,0.2)'
                    }}
                  >
                    <span className="text-xs font-semibold">{rating}</span>
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* TV Ratings */}
          <div>
            <div className="flex items-center mb-3">
              <div className="w-1.5 h-6 bg-gradient-to-b from-cyan-400 to-cyan-600 rounded-full mr-3"></div>
              <h3 className="text-lg font-semibold text-cyan-300">📺 TV Shows</h3>
            </div>
            <div className="grid grid-cols-6 gap-2" role="group" aria-label="TV maturity ratings">
              {tvRatings.map((rating: string) => {
                const isDisabled = selectedContentTypes.length === 1 && !selectedContentTypes.includes('tv');
                const isSelected = selectedRatings.includes(rating);
                
                return (
                  <button
                    key={rating}
                    onClick={() => !isDisabled && toggleRating(rating)}
                    disabled={isDisabled}
                    aria-pressed={isSelected}
                    className={`group relative px-3 py-2 rounded-full transition-all duration-200 border text-center focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                      isDisabled 
                        ? 'border-gray-600/30 text-gray-500 cursor-not-allowed'
                        : isSelected
                          ? 'text-white'
                          : 'border-cyan-400/40 text-cyan-200 hover:text-white hover:border-cyan-300'
                    }`}
                    style={{
                      borderColor: isDisabled 
                        ? 'rgba(75, 85, 99, 0.3)'
                        : isSelected 
                          ? '#06B6D4' 
                          : 'rgba(6, 182, 212, 0.4)',
                      backgroundColor: isDisabled
                        ? 'rgba(0,0,0,0.1)'
                        : isSelected
                          ? 'rgba(6, 182, 212, 0.15)'
                          : 'rgba(0,0,0,0.2)'
                    }}
                  >
                    <span className="text-xs font-semibold">{rating}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      
         {/* Our Picks Card - always visible with placeholders */}
         <div className="col-span-12 md:col-span-6 bg-slate-800/60 backdrop-blur-xl rounded-2xl pt-7 px-7 pb-[10px] border border-purple-400/40 shadow-2xl shadow-black/20">
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[0, 1, 2].map(index => {
              const item = suggestedItems[index];
              return (
                <div key={index} className="flex flex-col">
                  {/* Poster Card */}
                  <div className="bg-slate-700/50 border border-slate-600/40 rounded-xl overflow-hidden flex flex-col h-64">
                    {item ? (
                      <>
                        {item.posterPath ? (
                          <Image
                            src={`https://image.tmdb.org/t/p/w300${item.posterPath}`}
                            alt={item.title}
                            width={300}
                            height={450}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                            <span className="text-gray-400 text-sm">No Image</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="w-full h-full bg-slate-800/20 border border-gray-400/30 flex items-center justify-center">
                        <div className="text-white/20 text-2xl">🍿</div>
                      </div>
                    )}
                  </div>
                  
      {/* Content Details */}
      {item && (
        <div className="mt-4 space-y-3">
          {/* Title */}
          <h3 className="text-lg font-bold text-white line-clamp-2 leading-tight">
            {item.title}
          </h3>
          
          {/* Streaming Providers */}
          <div className="flex gap-2">
            {item.providers && item.providers.length > 0 ? (
              item.providers.map((provider: string, providerIndex: number) => {
                const service = streamingServices.find(s => s.name === provider);
                const serviceColor = service ? service.color : '#777777';
                return (
                  <div
                    key={providerIndex}
                    className="w-4 h-4 rounded-full ring-1 ring-white/20"
                    style={{ backgroundColor: serviceColor }}
                    title={provider}
                  ></div>
                );
              })
            ) : (
              <div
                className="w-4 h-4 rounded-full ring-1 ring-white/20"
                style={{ backgroundColor: '#777777' }}
                title="Unknown provider"
              ></div>
            )}
          </div>
          
          {/* Type and Rating */}
          <div className="flex items-center gap-3">
              <span className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                item.type === 'movie' 
                  ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/40' 
                  : 'bg-cyan-600/30 text-cyan-200 border border-cyan-500/40'
              }`}>
                {item.type === 'movie' ? 'Movie' : 'TV'}
              </span>
            {item.rating && (
              <span className="px-3 py-1.5 bg-orange-600/30 text-orange-200 rounded-lg text-sm font-semibold border border-orange-500/40">
                {item.rating}
              </span>
            )}
          </div>
          
          {/* Star Rating */}
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              <span className="text-yellow-400 text-lg">★</span>
              <span className="text-white font-bold text-lg ml-1">
                {item.voteAverage ? item.voteAverage.toFixed(1) : 'N/A'}
              </span>
            </div>
          </div>
          
          {/* Genre */}
          <div className="text-gray-300 text-base font-medium">
            <span>{item.genre}</span>
          </div>
          
          {/* Runtime or Seasons */}
          <div className="text-gray-400 text-base">
            {item.type === 'movie' && item.runtime ? (
              <span>{item.runtime} min</span>
            ) : item.type === 'tv' && item.numberOfSeasons ? (
              <div>
                <div>{item.numberOfSeasons} season{item.numberOfSeasons !== 1 ? 's' : ''}</div>
                {item.numberOfEpisodes && <div>{item.numberOfEpisodes} episodes</div>}
              </div>
            ) : null}
          </div>
          
          {/* Release Date */}
          <div className="text-gray-400 text-base">
            <span>{item.releaseDate}</span>
          </div>
        </div>
      )}
                </div>
              );
            })}
                </div>
                
          {/* Natural spacing - no manual height needed */}
          </div>
        </div>
      </div>
      
      {/* MEGA SPIN BUTTON - THE STAR OF THE SHOW! */}
      <div className="max-w-6xl mx-auto px-6 mt-12 text-center">
        <div className="relative">
          {/* Main MEGA button */}
          <button
            onClick={spinButton}
            disabled={isSpinning || spinsRemaining <= 0}
            className={`group relative inline-flex items-center justify-center px-16 py-10 rounded-full font-black text-3xl transition-all duration-300 transform focus:outline-none focus:ring-4 focus:ring-purple-400 focus:ring-offset-4 focus:ring-offset-slate-900 border-4 active:scale-95 active:shadow-lg ${
              isSpinning || spinsRemaining <= 0
                ? 'bg-slate-700/60 cursor-not-allowed border-gray-600/30'
                : 'bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:via-pink-500 hover:to-indigo-500 hover:scale-110 shadow-2xl shadow-pink-500/50 hover:shadow-pink-500/80 hover:shadow-3xl border-white/30 hover:border-white/60'
            }`}
            style={{ 
              transform: `scale(${buttonScale})`,
              background: isSpinning || spinsRemaining <= 0 ? undefined : 'linear-gradient(45deg, #8B5CF6, #EC4899, #6366F1, #8B5CF6)',
              backgroundSize: '300% 300%',
              animation: isSpinning || spinsRemaining <= 0 ? 'none' : 'gradientShift 3s ease infinite'
            }}
          >
            {/* Animated background overlay */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-pulse"></div>
            
            {/* Button content */}
            <span className="relative z-10 flex items-center justify-center space-x-4">
              {isSpinning ? (
                <>
                  <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span className="text-4xl font-black tracking-wider bg-gradient-to-r from-yellow-300 to-pink-300 bg-clip-text text-transparent">
                    FINDING MAGIC...
                  </span>
                  <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                </>
              ) : (
                <span className="text-4xl font-black tracking-wider bg-gradient-to-r from-yellow-300 to-pink-300 bg-clip-text text-transparent">
                  SHOW ME WHAT TO WATCH!
                </span>
              )}
            </span>
            
          </button>
          
          {/* Floating particles effect - only when spinning */}
          {isSpinning && (
            <>
              <div className="absolute -top-6 -left-6 w-4 h-4 bg-yellow-400 rounded-full animate-ping opacity-70"></div>
              <div className="absolute -top-4 -right-8 w-3 h-3 bg-pink-400 rounded-full animate-ping opacity-70" style={{ animationDelay: '0.5s' }}></div>
              <div className="absolute -bottom-6 -left-4 w-3 h-3 bg-purple-400 rounded-full animate-ping opacity-70" style={{ animationDelay: '1s' }}></div>
              <div className="absolute -bottom-4 -right-6 w-4 h-4 bg-indigo-400 rounded-full animate-ping opacity-70" style={{ animationDelay: '1.5s' }}></div>
              <div className="absolute top-2 left-1/2 w-2 h-2 bg-cyan-400 rounded-full animate-ping opacity-60" style={{ animationDelay: '2s' }}></div>
              <div className="absolute bottom-2 right-1/2 w-2 h-2 bg-orange-400 rounded-full animate-ping opacity-60" style={{ animationDelay: '2.5s' }}></div>
            </>
          )}
        </div>

        {/* MEGA Spins Counter and Reset Button */}
        <div className="mt-8">
          {spinsRemaining > 0 ? (
            <div className="flex items-center justify-center space-x-4 text-white">
              <div className="flex space-x-2">
                {[...Array(spinsRemaining)].map((_, i) => (
                  <div key={i} className="w-4 h-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 animate-pulse shadow-lg" style={{ animationDelay: `${i * 200}ms` }}></div>
                ))}
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
                {spinsRemaining} SPIN{spinsRemaining !== 1 ? 'S' : ''} REMAINING
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-4">
              <span className="text-2xl font-bold text-red-400 animate-pulse">NO MORE SPINS LEFT!</span>
              <button
                onClick={() => {
                  setSpinsRemaining(3);
                  resetUsedContent();
                  setCurrentContent(null);
                  setSuggestedItems([null, null, null]);
                }}
                className="px-8 py-4 bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 text-white text-lg font-bold rounded-full hover:from-purple-500 hover:via-pink-500 hover:to-indigo-500 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-purple-400 focus:ring-offset-4 focus:ring-offset-slate-900 transform hover:scale-105 shadow-2xl border-2 border-white/20 hover:border-white/40"
              >
                🔄 GET FRESH SPINS!
              </button>
            </div>
          )}
        </div>
                  </div>
                  
      {/* Modern Main Content Area */}
      <div className="max-w-6xl mx-auto px-6 mt-8">
        <div className="bg-slate-800/60 backdrop-blur-xl rounded-3xl p-8 border border-purple-400/40 shadow-2xl shadow-black/20 md:ml-0">
        {/* Result Display */}
          <div className="mb-8 min-h-[320px]">
          {isSpinning ? (
              <div className="text-center py-8">
                {/* Modern Loading Animation */}
                <div className="relative mb-8">
                  <div className="w-24 h-24 mx-auto relative">
                    <div className="absolute inset-0 rounded-full border-4 border-purple-500/20"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-500 animate-spin"></div>
                    <div className="absolute inset-2 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 animate-pulse"></div>
                      </div>
                      </div>
                
                <div className="space-y-4">
                  <h3 className="text-2xl font-bold text-white">
                    {loadingProgress.stepName || "Finding something amazing..."}
                  </h3>
                  <p className="text-gray-400">
                    {loadingStates.fetchingContent && "Searching through thousands of titles..."}
                    {loadingStates.checkingProviders && "Verifying streaming availability..."}
                    {loadingStates.gettingDetails && "Gathering additional details..."}
                    {loadingProgress.currentStep === 4 && "Almost ready..."}
                  </p>
                      </div>
                    </div>
          ) : currentContent ? (
              <div className="flex gap-4">
                {/* Compact Poster */}
                <div className="flex-shrink-0">
                  {currentContent.posterPath ? (
                    <Image
                      src={`https://image.tmdb.org/t/p/w400${currentContent.posterPath}`}
                      alt={currentContent.title}
                      width={280}
                      height={420}
                      className="w-64 h-96 object-cover rounded-xl shadow-2xl"
                      priority
                      placeholder="blur"
                      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
                    />
                  ) : (
                    <div className="w-64 h-96 bg-gradient-to-br from-gray-700 to-gray-800 rounded-xl flex items-center justify-center">
                      <span className="text-gray-400 text-sm">No Image</span>
                    </div>
                  )}
                  </div>
                  
                {/* Content Details - Horizontal Layout */}
                <div className="flex-1 space-y-3">
                  {/* Title, Content Rating, and Streaming Providers */}
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-3xl font-bold text-white">{currentContent.title}</h3>
                    {currentContent.rating && (
                        <span className="px-2 py-1 bg-orange-600/80 text-white text-xs font-medium rounded-md">
                        {currentContent.rating}
                      </span>
                    )}
                      {/* Streaming Providers */}
                      {currentContent.providers && currentContent.providers.length > 0 && (
                        <div className="flex items-center gap-2 ml-5">
                          {currentContent.providers.map((provider: string, index: number) => {
                            const service = streamingServices.find(s => s.name === provider);
                            const serviceColor = service ? service.color : '#777777';
                          return (
                            <span 
                                key={index}
                                className="px-3 py-1.5 rounded-full text-xs font-medium text-white border border-white/20"
                                style={{ backgroundColor: `${serviceColor}20`, borderColor: serviceColor }}
                            >
                              {provider}
                            </span>
                          );
                        })}
                    </div>
                  )}
                </div>
                    <p className="text-gray-300 text-sm leading-relaxed">{currentContent.overview}</p>
              </div>
              
                  {/* Star Rating */}
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-400 text-lg">★</span>
                    <span className="text-white font-bold text-lg">
                      {currentContent.voteAverage ? `${currentContent.voteAverage.toFixed(1)}/10` : 'N/A'}
                    </span>
              </div>
                  
                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-purple-400 block">Type</span>
                      <span className="text-white font-medium">{currentContent.type === 'movie' ? 'Movie' : 'TV Show'}</span>
            </div>
                    <div>
                      <span className="text-purple-400 block">Genre</span>
                      <span className="text-white font-medium">{currentContent.genre}</span>
              </div>
                    <div>
                      <span className="text-purple-400 block">Release Date</span>
                      <span className="text-white font-medium">{currentContent.releaseDate}</span>
                      </div>
                    {currentContent.runtime && (
                      <div>
                        <span className="text-purple-400 block">Duration</span>
                        <span className="text-white font-medium">{currentContent.runtime} min</span>
                      </div>
                    )}
                    {currentContent.numberOfSeasons && (
                      <div>
                        <span className="text-purple-400 block">Seasons</span>
                        <span className="text-white font-medium">{currentContent.numberOfSeasons}</span>
                      </div>
                    )}
                    {currentContent.numberOfEpisodes && (
                      <div>
                        <span className="text-purple-400 block">Episodes</span>
                        <span className="text-white font-medium">{currentContent.numberOfEpisodes}</span>
            </div>
          )}
        </div>
        
                  {/* Cast and Director/Creator */}
                  {(currentContent.cast && currentContent.cast.length > 0) || (currentContent.director || currentContent.creator) ? (
                    <div>
                      <h4 className="text-sm font-semibold text-purple-400 mb-2">
                        {currentContent.cast && currentContent.cast.length > 0 && (currentContent.director || currentContent.creator) 
                          ? `Cast & ${currentContent.type === 'movie' ? 'Director' : 'Creator'}:`
                          : currentContent.cast && currentContent.cast.length > 0 
                            ? 'Cast:'
                            : `${currentContent.type === 'movie' ? 'Director' : 'Creator'}:`
                        }
                      </h4>
                      <p className="text-white text-sm">
                        {currentContent.cast && currentContent.cast.length > 0 && (currentContent.director || currentContent.creator)
                          ? `${currentContent.cast.join(', ')} • ${currentContent.director || currentContent.creator}`
                          : currentContent.cast && currentContent.cast.length > 0
                            ? currentContent.cast.join(', ')
                            : currentContent.director || currentContent.creator
                        }
                      </p>
          </div>
                  ) : null}
                  
                  {/* Keywords */}
                  {currentContent.keywords && currentContent.keywords.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-purple-400 mb-2">Keywords:</h4>
                      <div className="flex flex-wrap gap-2">
                        {currentContent.keywords.map((keyword: string, index: number) => (
                          <span 
                            key={index}
                            className="px-2 py-1 bg-slate-600/40 text-white text-xs rounded-md border border-slate-500/30"
                          >
                            {keyword}
                          </span>
                ))}
              </div>
                    </div>
                  )}
                  
              </div>
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="text-6xl mb-6">🎬</div>
              <h3 className="text-3xl font-bold text-white mb-4">Ready to find your next watch?</h3>
              <p className="text-gray-400 text-lg">Make your selections above and let's discover something amazing together.</p>
            </div>
          )}
        </div>
        </div>
      </div>

        {/* Accessible Error Modal */}
      {showErrorModal && (
         <div 
           className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50"
           onClick={closeErrorModal}
           role="dialog"
           aria-modal="true"
           aria-labelledby="error-title"
         >
           <div 
             className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-full px-8 py-4 shadow-2xl transform transition-all animate-fadeIn cursor-pointer"
             onClick={(e) => e.stopPropagation()}
           >
             <div className="flex items-center justify-center">
               <span id="error-title" className="text-white text-lg font-medium">
                 {currentError?.message || errorMessage}
               </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StreamingSlotMachine;
