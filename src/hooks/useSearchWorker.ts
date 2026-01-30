/**
 * useSearchWorker - Hook לשימוש ב-Search Worker
 * מנהל את ה-Worker, בניית אינדקס, וחיפוש
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// Types
export interface PsakDin {
  id: string;
  title: string;
  court: string;
  year: number;
  summary: string;
  full_text?: string;
  case_number?: string;
  tags?: string[];
}

export interface SearchOptions {
  fuzzySearch: boolean;
  useRoots: boolean;
  useSynonyms: boolean;
  removeNikud: boolean;
  matchSofitLetters: boolean;
  maxFuzzyDistance: number;
}

export interface SearchResult {
  psakId: string;
  psakTitle: string;
  psakCourt: string;
  psakYear: number;
  text: string;
  lineNumber: number;
  score: number;
  matchedTerms: string[];
  contextBefore?: string;
  contextAfter?: string;
  matchType: 'exact' | 'fuzzy' | 'root' | 'synonym';
}

export interface IndexStats {
  wordCount: number;
  psakimCount: number;
  totalWords: number;
  buildTime: number;
}

export interface SearchStats {
  searchTime: number;
  totalResults: number;
}

const DEFAULT_SEARCH_OPTIONS: SearchOptions = {
  fuzzySearch: true,
  useRoots: true,
  useSynonyms: true,
  removeNikud: true,
  matchSofitLetters: true,
  maxFuzzyDistance: 2,
};

export function useSearchWorker() {
  const workerRef = useRef<Worker | null>(null);
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [indexStats, setIndexStats] = useState<IndexStats | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchStats, setSearchStats] = useState<SearchStats | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Callbacks for async operations
  const searchResolveRef = useRef<((results: SearchResult[]) => void) | null>(null);
  const suggestionsResolveRef = useRef<((suggestions: string[]) => void) | null>(null);

  // Initialize worker
  useEffect(() => {
    try {
      workerRef.current = new Worker(
        new URL('../workers/searchWorker.ts', import.meta.url),
        { type: 'module' }
      );

      workerRef.current.onmessage = (event: MessageEvent) => {
        const { type, payload } = event.data;

        switch (type) {
          case 'INDEX_BUILT':
            setIndexStats(payload as IndexStats);
            setIsIndexing(false);
            setIsWorkerReady(true);
            break;

          case 'SEARCH_RESULTS':
            setResults(payload.results);
            setSearchStats({
              searchTime: payload.searchTime,
              totalResults: payload.totalResults,
            });
            setIsSearching(false);
            if (searchResolveRef.current) {
              searchResolveRef.current(payload.results);
              searchResolveRef.current = null;
            }
            break;

          case 'SUGGESTIONS':
            setSuggestions(payload.suggestions);
            if (suggestionsResolveRef.current) {
              suggestionsResolveRef.current(payload.suggestions);
              suggestionsResolveRef.current = null;
            }
            break;

          case 'INDEX_CLEARED':
            setIndexStats(null);
            setIsWorkerReady(false);
            break;
        }
      };

      workerRef.current.onerror = (err) => {
        console.error('Worker error:', err);
        setError(`Worker error: ${err.message}`);
      };
    } catch (err) {
      console.error('Failed to create worker:', err);
      setError('Failed to create search worker');
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  // Build index
  const buildIndex = useCallback((psakim: PsakDin[]) => {
    if (!workerRef.current) {
      setError('Worker not initialized');
      return;
    }

    setIsIndexing(true);
    setError(null);
    workerRef.current.postMessage({
      type: 'BUILD_INDEX',
      payload: { psakim },
    });
  }, []);

  // Search
  const search = useCallback(
    (query: string, options: Partial<SearchOptions> = {}): Promise<SearchResult[]> => {
      return new Promise((resolve, reject) => {
        if (!workerRef.current) {
          reject(new Error('Worker not initialized'));
          return;
        }

        if (!isWorkerReady) {
          reject(new Error('Index not built yet'));
          return;
        }

        setIsSearching(true);
        setError(null);
        searchResolveRef.current = resolve;

        workerRef.current.postMessage({
          type: 'SEARCH',
          payload: {
            query,
            options: { ...DEFAULT_SEARCH_OPTIONS, ...options },
          },
        });
      });
    },
    [isWorkerReady]
  );

  // Get suggestions
  const getSuggestions = useCallback(
    (prefix: string): Promise<string[]> => {
      return new Promise((resolve) => {
        if (!workerRef.current || !isWorkerReady) {
          resolve([]);
          return;
        }

        suggestionsResolveRef.current = resolve;
        workerRef.current.postMessage({
          type: 'GET_SUGGESTIONS',
          payload: { prefix },
        });
      });
    },
    [isWorkerReady]
  );

  // Clear index
  const clearIndex = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'CLEAR_INDEX' });
    }
  }, []);

  return {
    // State
    isWorkerReady,
    isIndexing,
    isSearching,
    indexStats,
    results,
    searchStats,
    suggestions,
    error,

    // Actions
    buildIndex,
    search,
    getSuggestions,
    clearIndex,
  };
}

export default useSearchWorker;
