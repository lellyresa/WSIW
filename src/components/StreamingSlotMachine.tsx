import React, { useState, useEffect, memo, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import PerformanceStats from './PerformanceStats';
import { 
  getGenres, 
  getRandomContent, 
  getProviders, 
  getContentRating, 
  getContentByProvider, 
  getContentByProviderAndGenre,
  getPopularByProvider,
  getTrendingContent,
  providerMap, 
  providerIdToName,
  normalizeProviderName,
  Genre, 
  TMDBMovie, 
  TMDBShow 
} from '@/lib/tmdb';

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
}

// Add a new interface for content with actual providers
interface ContentWithProviders extends TMDBMovie, TMDBShow {
  actualProviders: string[];
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

// Define streaming services with their colors
const streamingServices = [
  { name: 'Netflix', color: '#E50914' },
  { name: 'Disney+', color: '#0063e5' },
  { name: 'Hulu', color: '#1CE783' },
  { name: 'Prime Video', color: '#00A8E1' },
  { name: 'HBO Max', color: '#5822b4' },
  { name: 'Apple TV+', color: '#000000' }
];

const StreamingSlotMachine = () => {
  const { startApiTimer, endApiTimer, getMemoryUsage } = usePerformanceMonitor('StreamingSlotMachine');
  
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [selectedContentTypes, setSelectedContentTypes] = useState<('movie' | 'tv')[]>(['movie', 'tv']);
  const [selectedServices, setSelectedServices] = useState<string[]>(streamingServices.map(s => s.name));
  const [currentContent, setCurrentContent] = useState<ContentItem | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinsRemaining, setSpinsRemaining] = useState(3);
  const [buttonScale, setButtonScale] = useState(1);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentError, setCurrentError] = useState<AppError | null>(null);
  const [loadingStates, setLoadingStates] = useState({
    fetchingContent: false,
    checkingProviders: false,
    gettingDetails: false
  });
  const [showPerformanceStats, setShowPerformanceStats] = useState(false);

  useEffect(() => {
    const loadGenres = async () => {
      startApiTimer();
      const genreList = await getGenres();
      endApiTimer('Load Genres');
      setGenres(genreList);
      setSelectedGenres(genreList.map(genre => genre.id));
    };
    loadGenres();
  }, [startApiTimer, endApiTimer]);

  const getRandomContentType = useCallback((): 'movie' | 'tv' => {
    const randomIndex = Math.floor(Math.random() * selectedContentTypes.length);
    return selectedContentTypes[randomIndex];
  }, [selectedContentTypes]);

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

  const createError = (type: ErrorType, message: string, details?: string): AppError => ({
    type,
    message,
    details
  });

  // Loading state management
  const setLoadingState = (key: keyof typeof loadingStates, value: boolean) => {
    setLoadingStates(prev => ({ ...prev, [key]: value }));
  };

  const updateLoadingMessage = (message: string) => {
    // This could be used to show more specific loading messages
    console.log(`Loading: ${message}`);
  };

  const formatProviders = useCallback((providers: any): string[] => {
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
  }, []);

  // Content fetching strategies with improved error handling
  const fetchContentWithStrategies = async (contentType: 'movie' | 'tv', providerId: number): Promise<(TMDBMovie | TMDBShow)[]> => {
    setLoadingState('fetchingContent', true);
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
        const trendingContent = await getTrendingContent(1);
        
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

  // Process content to find items with matching providers
  const findContentWithMatchingProviders = async (allContent: (TMDBMovie | TMDBShow)[]): Promise<ContentWithProviders[]> => {
    setLoadingState('checkingProviders', true);
    updateLoadingMessage('Checking streaming availability...');
    
    const contentWithProviders: ContentWithProviders[] = [];
    
    for (let i = 0; i < Math.min(allContent.length, 20) && contentWithProviders.length < 5; i++) {
      const item = allContent[i];
      
      try {
        const providers = await getProviders(
          'title' in item ? 'movie' : 'tv', 
          item.id
        );
        
        const availableProviders = formatProviders(providers);
        const matchingProviders = availableProviders.filter(provider => 
          selectedServices.includes(provider)
        );
        
        if (matchingProviders.length > 0) {
          contentWithProviders.push({
            ...item,
            actualProviders: matchingProviders
          });
        }
      } catch (error) {
        console.error('Error checking providers:', error);
      }
    }
    
    setLoadingState('checkingProviders', false);
    return contentWithProviders;
  };

  // Get additional content details (runtime, seasons, rating)
  const getContentDetails = async (content: TMDBMovie | TMDBShow): Promise<{
    runtime?: number;
    numberOfSeasons?: number;
    rating: string | null;
  }> => {
    setLoadingState('gettingDetails', true);
    updateLoadingMessage('Getting content details...');
    
    const isMovie = 'title' in content;
    let runtime: number | undefined;
    let numberOfSeasons: number | undefined;
    let rating: string | null = null;

    try {
      // Get runtime and seasons
      if (isMovie) {
        const movieDetails = await fetch(
          `https://api.themoviedb.org/3/movie/${content.id}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}`
        ).then(res => res.json());
        runtime = movieDetails.runtime;
      } else {
        const tvDetails = await fetch(
          `https://api.themoviedb.org/3/tv/${content.id}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}`
        ).then(res => res.json());
        numberOfSeasons = tvDetails.number_of_seasons;
        runtime = tvDetails.episode_run_time?.[0];
      }

      // Get content rating
      rating = await getContentRating(isMovie ? 'movie' : 'tv', content.id);
    } catch (error) {
      console.error('Error fetching content details:', error);
    } finally {
      setLoadingState('gettingDetails', false);
    }

    return { runtime, numberOfSeasons, rating };
  };

  // Format content item for display
  const formatContentItem = async (content: TMDBMovie | TMDBShow, providers: string[]): Promise<ContentItem> => {
    const isMovie = 'title' in content;
    const genreName = content.genre_ids && content.genre_ids.length > 0
      ? genres.find(g => content.genre_ids.includes(g.id))?.name || 'Unknown'
      : 'Unknown';

    const details = await getContentDetails(content);

    return {
      id: content.id,
      title: isMovie ? content.title || 'Unknown Title' : content.name || 'Unknown Title',
      type: isMovie ? 'movie' : 'tv',
      genre: genreName,
      rating: details.rating,
      providers,
      posterPath: content.poster_path,
      overview: content.overview || "No description available.",
      releaseDate: isMovie ? content.release_date || 'Unknown Date' : content.first_air_date || 'Unknown Date',
      voteAverage: content.vote_average || 0,
      runtime: details.runtime,
      numberOfSeasons: details.numberOfSeasons
    };
  };

  // Main spin button function - now much cleaner!
  const spinButton = async () => {
    if (isSpinning || spinsRemaining <= 0) return;

    setIsSpinning(true);
    setButtonScale(0.9);
    setSpinsRemaining(prev => prev - 1);
    setTimeout(() => setButtonScale(1), 200);

    try {
      console.log("Selected streaming services:", selectedServices);
      console.log("Selected content types:", selectedContentTypes);
      
      // Ensure we have services selected
      const servicesToUse = selectedServices.length === 0 
        ? streamingServices.map(s => s.name) 
        : selectedServices;
      
      if (selectedServices.length === 0) {
        setSelectedServices(servicesToUse);
      }
      
      // Get random content type and provider
      const contentType = getRandomContentType();
      const selectedProviderIds = servicesToUse
        .map(service => providerMap[service])
        .filter(id => id !== undefined);
      
      if (selectedProviderIds.length === 0) {
        console.log("No valid provider IDs found, using all providers");
        selectedProviderIds.push(...Object.values(providerMap).filter(id => id !== undefined));
      }
      
      const randomProviderIndex = Math.floor(Math.random() * selectedProviderIds.length);
      const providerId = selectedProviderIds[randomProviderIndex];
      
      // Fetch content using multiple strategies
      const allContent = await fetchContentWithStrategies(contentType, providerId);
      
      // Try to find content with matching providers
      const contentWithProviders = await findContentWithMatchingProviders(allContent);
      
      let selectedContent: TMDBMovie | TMDBShow;
      let finalProviders: string[];
      
      if (contentWithProviders.length > 0) {
        // Use content with matching providers
        const randomIndex = Math.floor(Math.random() * contentWithProviders.length);
        selectedContent = contentWithProviders[randomIndex];
        finalProviders = (selectedContent as ContentWithProviders).actualProviders;
      } else {
        // Fallback to any content with actual providers
        const randomIndex = Math.floor(Math.random() * allContent.length);
        selectedContent = allContent[randomIndex];
        
        try {
          const providers = await getProviders(
            'title' in selectedContent ? 'movie' : 'tv', 
            selectedContent.id
          );
          finalProviders = formatProviders(providers);
        } catch (error) {
          console.error('Error fetching providers:', error);
          finalProviders = [];
        }
      }
      
      // Format and display the content
      const formattedContent = await formatContentItem(selectedContent, finalProviders);
      
      setTimeout(() => {
        setCurrentContent(formattedContent);
        setIsSpinning(false);
      }, 1500);
      
    } catch (error) {
      console.error('Error fetching content:', error);
      
      // Handle different types of errors
      if (error instanceof Error && 'type' in error) {
        handleError(error as AppError);
      } else {
        handleError(createError(
          ErrorType.API_FAILURE,
          'An unexpected error occurred while fetching content. Please try again.',
          error instanceof Error ? error.message : 'Unknown error'
        ));
      }
      
      setIsSpinning(false);
      setSpinsRemaining(prev => prev + 1);
    }
  };

  const toggleService = (service: string) => {
    setSelectedServices(prev => {
      if (prev.includes(service)) {
        return prev.length > 1 ? prev.filter(s => s !== service) : prev;
      }
      return [...prev, service];
    });
  };

  const toggleContentType = (type: 'movie' | 'tv') => {
    setSelectedContentTypes(prev => {
      if (prev.includes(type)) {
        return prev.length > 1 ? prev.filter(t => t !== type) : prev;
      }
      return [...prev, type];
    });
  };

  // Update the getServiceColor function to add white glow for Apple TV+
  const getServiceColor = useCallback((serviceName: string): string => {
    // Normalize the service name first
    const normalizedName = normalizeProviderName(serviceName);
    
    // Find the service in our streamingServices array
    const service = streamingServices.find(s => s.name === normalizedName);
    return service ? service.color : '#777';
  }, []);

  const closeErrorModal = useCallback(() => {
    clearError();
  }, []);

  // Memoized streaming service buttons
  const StreamingServiceButtons = memo(() => (
    <div className="mb-6 sm:mb-8">
      <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
        Streaming Services
      </h2>
      <div className="flex flex-wrap gap-2 sm:gap-3">
        {streamingServices.map(service => (
          <button
            key={service.name}
            onClick={() => toggleService(service.name)}
            className={`px-3 py-2 sm:px-5 sm:py-2 rounded-full transition-all duration-300 transform hover:scale-105 active:scale-95 text-sm sm:text-base ${
              selectedServices.includes(service.name) 
                ? 'opacity-100 font-bold shadow-lg' 
                : 'opacity-50 hover:opacity-70'
            }`}
            style={{ 
              backgroundColor: selectedServices.includes(service.name) 
                ? service.color 
                : '#2D3748',
              boxShadow: selectedServices.includes(service.name) 
                ? `0 0 15px ${service.color}80` 
                : 'none'
            }}
          >
            {service.name}
          </button>
        ))}
      </div>
    </div>
  ));

  // Memoized content type buttons
  const ContentTypeButtons = memo(() => (
    <div className="mb-4">
      <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
        Content Type
      </h2>
      <div className="flex flex-wrap gap-2 sm:gap-3">
        <button
          onClick={() => toggleContentType('movie')}
          className={`px-4 py-2 sm:px-5 sm:py-2 rounded-full transition-all duration-300 transform hover:scale-105 active:scale-95 text-sm sm:text-base ${
            selectedContentTypes.includes('movie') 
              ? 'bg-gradient-to-r from-indigo-500 to-purple-600 opacity-100 shadow-lg' 
              : 'bg-gray-700 opacity-70 hover:opacity-90'
          }`}
        >
          Movies
        </button>
        <button
          onClick={() => toggleContentType('tv')}
          className={`px-4 py-2 sm:px-5 sm:py-2 rounded-full transition-all duration-300 transform hover:scale-105 active:scale-95 text-sm sm:text-base ${
            selectedContentTypes.includes('tv') 
              ? 'bg-gradient-to-r from-indigo-500 to-purple-600 opacity-100 shadow-lg' 
              : 'bg-gray-700 opacity-70 hover:opacity-90'
          }`}
        >
          TV Shows
        </button>
      </div>
    </div>
  ));

  return (
    <div className="flex flex-col items-center min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white px-4 py-6 sm:p-6">
      {/* Header with glow effect */}
      <div className="text-center mb-6 sm:mb-10 relative">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
          What Should I Watch?
        </h1>
        <div className="absolute -inset-1 bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 rounded-lg blur opacity-20 -z-10"></div>
        <p className="text-lg sm:text-xl text-gray-300">We pick, you binge. Easy.</p>
      </div>
      
      {/* Filters Section with Card Style */}
      <div className="w-full max-w-4xl mb-6 sm:mb-10 bg-gray-800 bg-opacity-50 backdrop-blur-sm rounded-xl p-4 sm:p-6 shadow-xl border border-gray-700">
        <StreamingServiceButtons />
        <ContentTypeButtons />
      </div>
      
      {/* Slot Machine with enhanced styling */}
      <div className="relative w-full max-w-2xl bg-gray-800 bg-opacity-70 backdrop-blur-sm rounded-xl p-4 sm:p-6 md:p-8 flex flex-col items-center shadow-2xl border border-gray-700">
        {/* Result Display */}
        <div className="w-full bg-gray-900 rounded-xl mb-6 sm:mb-8 overflow-hidden shadow-inner">
          {isSpinning ? (
            <div className="h-64 sm:h-80 md:h-96 flex items-center justify-center">
              <div className="flex flex-col items-center px-4">
                <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-t-2 border-b-2 border-purple-500 mb-4"></div>
                <div className="text-lg sm:text-xl md:text-2xl text-purple-400 animate-pulse mb-2 text-center">
                  {loadingStates.fetchingContent && "Searching for content..."}
                  {loadingStates.checkingProviders && "Checking streaming availability..."}
                  {loadingStates.gettingDetails && "Getting content details..."}
                  {!loadingStates.fetchingContent && !loadingStates.checkingProviders && !loadingStates.gettingDetails && "Finding something amazing..."}
                </div>
                <div className="text-xs sm:text-sm text-gray-400 text-center">
                  {loadingStates.fetchingContent && "This may take a moment..."}
                  {loadingStates.checkingProviders && "Verifying where you can watch..."}
                  {loadingStates.gettingDetails && "Gathering additional info..."}
                </div>
              </div>
            </div>
          ) : currentContent ? (
            <div className="w-full">
              <div className="flex flex-col md:flex-row">
                {/* Left Column - Poster */}
                <div className="w-full md:w-2/5 bg-gray-900">
                  {currentContent.posterPath ? (
                    <div className="relative w-full h-64 sm:h-80 md:h-[600px] rounded-tl-xl md:rounded-bl-xl overflow-hidden">
                      <Image
                        src={`https://image.tmdb.org/t/p/w500${currentContent.posterPath}`}
                        alt={currentContent.title}
                        fill
                        className="object-cover object-top"
                        sizes="(max-width: 768px) 100vw, 50vw"
                        priority={false}
                        placeholder="blur"
                        blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
                      />
                    </div>
                  ) : (
                    <div className="w-full h-64 sm:h-80 md:h-[600px] bg-gray-900 flex items-center justify-center rounded-tl-xl md:rounded-bl-xl">
                      <span className="text-gray-500 text-sm sm:text-base">No image available</span>
                    </div>
                  )}
                </div>
                
                {/* Right Column - Content Details */}
                <div className="w-full md:w-3/5 p-4 sm:p-6 bg-gray-900">
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-3 text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-300">
                    {currentContent.title}
                  </h1>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="px-2 py-1 sm:px-3 sm:py-1 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full text-xs sm:text-sm font-medium">
                      {currentContent.type === 'tv' ? 'TV Show' : 'Movie'}
                    </span>
                    <span className="px-2 py-1 sm:px-3 sm:py-1 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-full text-xs sm:text-sm font-medium">
                      {currentContent.genre}
                    </span>
                    {currentContent.rating && (
                      <span className="px-2 py-1 sm:px-3 sm:py-1 bg-gradient-to-r from-yellow-600 to-amber-600 rounded-full text-xs sm:text-sm font-medium">
                        {currentContent.rating}
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 text-gray-300 mb-4 text-sm sm:text-base">
                    {currentContent.releaseDate && (
                      <div className="flex items-center">
                        <span className="mr-2">📅</span>
                        <span>{new Date(currentContent.releaseDate).toLocaleDateString()}</span>
                      </div>
                    )}
                    {currentContent.runtime && (
                      <div className="flex items-center">
                        <span className="mr-2">⏱️</span>
                        <span>{currentContent.runtime} min</span>
                      </div>
                    )}
                    {currentContent.numberOfSeasons && (
                      <div className="flex items-center">
                        <span className="mr-2">🎬</span>
                        <span>{currentContent.numberOfSeasons} {currentContent.numberOfSeasons === 1 ? 'Season' : 'Seasons'}</span>
                      </div>
                    )}
                    <div className="flex items-center">
                      <span className="mr-2">⭐</span>
                      <span>{currentContent.voteAverage.toFixed(1)}/10</span>
                    </div>
                  </div>
                  
                  {currentContent.providers.length > 0 && (
                    <div className="mb-4 sm:mb-6">
                      <p className="text-xs sm:text-sm text-gray-400 mb-2">Available on:</p>
                      <div className="flex flex-wrap gap-1 sm:gap-2">
                        {currentContent.providers.map(provider => {
                          const serviceColor = getServiceColor(provider);
                          const isAppleTV = provider === 'Apple TV+';
                          return (
                            <span 
                              key={provider} 
                              className="px-2 py-1 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-medium"
                              style={{ 
                                backgroundColor: serviceColor,
                                boxShadow: isAppleTV 
                                  ? '0 0 10px rgba(255, 255, 255, 0.8)' 
                                  : `0 0 10px ${serviceColor}80`
                              }}
                            >
                              {provider}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Synopsis */}
              <div className="p-4 sm:p-6 pt-4 bg-gray-900 border-t border-gray-700 rounded-b-xl">
                <p className="text-sm sm:text-base text-gray-300 leading-relaxed">{currentContent.overview || "No description available."}</p>
              </div>
            </div>
          ) : (
            <div className="h-96 flex items-center justify-center bg-gray-900">
              <div className="text-2xl text-gray-400 text-center px-4 max-w-md">
                You spent the last 3 hours just watching autoplay previews, didn't you.
              </div>
            </div>
          )}
        </div>
        
        {/* Big Spin Button with enhanced styling */}
        <button
          onClick={spinButton}
          disabled={isSpinning || spinsRemaining <= 0}
          className={`w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 rounded-full shadow-lg 
                     flex items-center justify-center transform transition-all duration-300
                     ${(isSpinning || spinsRemaining <= 0) ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:scale-105 active:scale-95'}`}
          style={{ 
            background: 'linear-gradient(135deg, #ff4d4d 0%, #f9333f 100%)',
            boxShadow: '0 0 30px rgba(255, 77, 77, 0.7), 0 0 60px rgba(255, 77, 77, 0.4), inset 0 0 15px rgba(255, 255, 255, 0.3)',
            transform: `scale(${buttonScale})`,
          }}
        >
          <div className="flex flex-col items-center">
            <span className="text-3xl sm:text-4xl md:text-6xl font-extrabold text-white mb-1 drop-shadow-lg" style={{ fontFamily: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif' }}>SPIN</span>
            <span className="text-xs sm:text-sm text-white opacity-90 text-center px-2" style={{ fontFamily: 'Verdana, Geneva, sans-serif' }}>Find your next binge!</span>
          </div>
        </button>

        {/* Spins Counter with enhanced styling */}
        <div className="mt-4 sm:mt-6 text-gray-300">
          {spinsRemaining > 0 ? (
            <div className="flex items-center justify-center">
              <div className="flex space-x-1">
                {[...Array(spinsRemaining)].map((_, i) => (
                  <div key={i} className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-red-500 animate-pulse" style={{ animationDelay: `${i * 200}ms` }}></div>
                ))}
              </div>
              <span className="ml-2 sm:ml-3 font-medium text-sm sm:text-base">{spinsRemaining} spin{spinsRemaining !== 1 ? 's' : ''} remaining</span>
            </div>
          ) : (
            <span className="text-red-500 font-bold text-sm sm:text-base">No more spins left!</span>
          )}
        </div>
      </div>

      {/* Error Modal with enhanced styling */}
      {showErrorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-4 sm:p-6 max-w-md w-full border border-gray-700 shadow-2xl transform transition-all animate-fadeIn">
            <div className="mb-4 text-center">
              <svg className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-200 text-base sm:text-lg mb-2">{errorMessage}</p>
              {currentError?.details && (
                <p className="text-gray-400 text-xs sm:text-sm">
                  <strong>Details:</strong> {currentError.details}
                </p>
              )}
              {currentError?.type && (
                <p className="text-gray-500 text-xs mt-2">
                  Error Type: {currentError.type}
                </p>
              )}
            </div>
            <div className="flex justify-center">
              <button 
                onClick={closeErrorModal}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-full hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105 active:scale-95 text-sm sm:text-base"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Performance Stats Toggle (Development Only) */}
      {process.env.NODE_ENV === 'development' && (
        <button
          onClick={() => setShowPerformanceStats(!showPerformanceStats)}
          className="fixed top-2 right-2 sm:top-4 sm:right-4 bg-gray-800 bg-opacity-50 backdrop-blur-sm rounded-full p-2 text-xs text-gray-400 hover:text-white transition-colors z-50"
          title="Toggle Performance Stats"
        >
          ⚡
        </button>
      )}

      <PerformanceStats isVisible={showPerformanceStats} />
    </div>
  );
};

export default StreamingSlotMachine;