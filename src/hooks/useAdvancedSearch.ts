import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  containsAnyWord, 
  containsAllWords,
  proximitySearch,
  RangeType,
  getExcerpt,
  NormalizationOptions,
  DEFAULT_NORMALIZATION
} from '@/lib/textSearchUtils';
import { expandNumbersInQuery } from '@/lib/hebrewNumbers';

export interface DocumentData {
  id: string;
  title: string;
  strippedText: string;
  court?: string;
  year?: number;
  case_number?: string;
}

export interface SearchResult {
  document: DocumentData;
  matchedPrimaryWords: string[];
  matchedProximityWords?: string[];
  excerpt: string;
  proximityContext?: string;
}

export interface SearchOptions {
  primaryWords: string[];
  logic: 'OR' | 'AND';
  useProximity: boolean;
  proximityWords: string[];
  range: number;
  rangeType: RangeType;
  normalization: NormalizationOptions;
}

export interface CacheStats {
  total_documents: number;
  cached_documents: number;
  last_cache_update: string | null;
}

export function useAdvancedSearch() {
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCacheReady, setIsCacheReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isBuildingCache, setIsBuildingCache] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Get cache statistics
  const fetchCacheStats = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('search_cache_stats')
        .select('*')
        .single();
      
      if (error) throw error;
      setCacheStats(data as CacheStats);
      return data as CacheStats;
    } catch (err) {
      console.error('Error fetching cache stats:', err);
      return null;
    }
  }, []);

  // Build cache incrementally via edge function
  const buildCache = useCallback(async () => {
    if (isBuildingCache) return;
    
    setIsBuildingCache(true);
    setError(null);
    
    try {
      let offset = 0;
      const batchSize = 200;
      let totalProcessed = 0;
      
      // Get initial stats
      const initialStats = await fetchCacheStats();
      const totalDocs = initialStats?.total_documents || 0;
      const alreadyCached = initialStats?.cached_documents || 0;
      
      if (alreadyCached >= totalDocs) {
        setIsBuildingCache(false);
        return;
      }

      while (true) {
        const { data, error } = await supabase.functions.invoke('build-search-cache', {
          body: { batchSize, offset }
        });

        if (error) throw error;
        
        totalProcessed += data.processed || 0;
        const stats = data.stats as CacheStats;
        setCacheStats(stats);
        
        if (stats) {
          const progress = Math.round((stats.cached_documents / stats.total_documents) * 100);
          setLoadingProgress(progress);
        }

        if (data.processed === 0 || data.message === 'Cache is complete') {
          break;
        }

        offset += batchSize;
      }
    } catch (err) {
      console.error('Error building cache:', err);
      setError(err instanceof Error ? err.message : 'שגיאה בבניית המטמון');
    } finally {
      setIsBuildingCache(false);
    }
  }, [isBuildingCache, fetchCacheStats]);

  // Load documents from cloud cache
  const loadDocuments = useCallback(async () => {
    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);
    setDocuments([]);

    try {
      // First check cache stats
      const stats = await fetchCacheStats();
      setCacheStats(stats);
      
      const totalDocs = stats?.total_documents || 0;
      const cachedDocs = stats?.cached_documents || 0;

      // If cache is not complete, build it in background
      if (cachedDocs < totalDocs) {
        // Start building cache in background
        buildCache();
      }

      // Load from cache in batches
      const pageSize = 1000;
      const allDocuments: DocumentData[] = [];
      let page = 0;
      
      // First, get total count from cache
      const { count } = await supabase
        .from('document_search_cache')
        .select('*', { count: 'exact', head: true });

      const totalCached = count || 0;
      
      if (totalCached === 0) {
        // No cache yet, wait for build
        setLoadingProgress(0);
        setIsLoading(false);
        return [];
      }

      const pages = Math.ceil(totalCached / pageSize);

      while (page < pages) {
        // Check if aborted
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error('Cancelled');
        }

        const { data, error: fetchError } = await supabase
          .from('document_search_cache')
          .select(`
            psak_din_id,
            stripped_text,
            psakei_din!inner (
              id,
              title,
              court,
              year,
              case_number
            )
          `)
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (fetchError) throw fetchError;

        if (data) {
          const processedDocs = data.map((item: any) => ({
            id: item.psakei_din.id,
            title: item.psakei_din.title,
            court: item.psakei_din.court,
            year: item.psakei_din.year,
            case_number: item.psakei_din.case_number,
            strippedText: item.stripped_text
          }));
          allDocuments.push(...processedDocs);
        }

        setLoadingProgress(Math.round(((page + 1) / pages) * 100));
        page++;
      }

      setDocuments(allDocuments);
      setIsCacheReady(true);
      return allDocuments;
    } catch (err) {
      if (err instanceof Error && err.message === 'Cancelled') {
        return [];
      }
      const message = err instanceof Error ? err.message : 'שגיאה בטעינת המסמכים';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchCacheStats, buildCache]);

  // Initialize on mount
  useEffect(() => {
    loadDocuments();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadDocuments]);

  // Perform search with debounce
  const search = useCallback((options: SearchOptions) => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const { primaryWords, logic, useProximity, proximityWords, range, rangeType, normalization } = options;

    // Validate input
    if (primaryWords.length === 0) {
      setResults([]);
      return;
    }

    // Expand primary words with Hebrew number variants if enabled
    let expandedPrimaryWords = primaryWords;
    let expandedProximityWords = proximityWords;
    
    if (normalization.expandHebrewNumbers) {
      expandedPrimaryWords = primaryWords.flatMap(word => expandNumbersInQuery(word));
      expandedProximityWords = proximityWords.flatMap(word => expandNumbersInQuery(word));
    }

    // Debounce search
    searchTimeoutRef.current = setTimeout(() => {
      setIsSearching(true);

      // Use requestAnimationFrame to avoid blocking UI
      requestAnimationFrame(() => {
        const searchResults: SearchResult[] = [];

        for (const doc of documents) {
          const text = doc.strippedText;
          if (!text) continue;

          // Check primary words match with normalization (using expanded words)
          const primaryMatch = logic === 'OR' 
            ? containsAnyWord(text, expandedPrimaryWords, normalization)
            : containsAllWords(text, expandedPrimaryWords, normalization);

          if (!primaryMatch) continue;

          // Find which primary words matched
          const matchedPrimaryWords = primaryWords.filter(w => 
            containsAnyWord(text, [w], normalization)
          );

          // If proximity is enabled, check proximity condition
          if (useProximity && expandedProximityWords.length > 0) {
            const proximityResult = proximitySearch(
              text,
              expandedPrimaryWords,
              expandedProximityWords,
              range,
              rangeType,
              normalization
            );

            if (!proximityResult.found) continue;

            // Find which proximity words matched
            const matchedProximityWords = proximityWords.filter(w =>
              containsAnyWord(text, normalization.expandHebrewNumbers ? expandNumbersInQuery(w) : [w], normalization)
            );

            searchResults.push({
              document: doc,
              matchedPrimaryWords,
              matchedProximityWords,
              excerpt: getExcerpt(text, matchedPrimaryWords[0] || '', 150, normalization),
              proximityContext: proximityResult.context
            });
          } else {
            // No proximity, just add the result
            searchResults.push({
              document: doc,
              matchedPrimaryWords,
              excerpt: getExcerpt(text, matchedPrimaryWords[0] || '', 150, normalization)
            });
          }
        }

        setResults(searchResults);
        setIsSearching(false);
      });
    }, 300); // 300ms debounce
  }, [documents]);

  // Clear search
  const clearSearch = useCallback(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    setResults([]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return {
    documents,
    documentsCount: documents.length,
    isLoading,
    isCacheReady,
    loadingProgress,
    cacheStats,
    isBuildingCache,
    error,
    results,
    isSearching,
    search,
    clearSearch,
    reloadDocuments: loadDocuments,
    buildCache,
    refreshStats: fetchCacheStats
  };
}
