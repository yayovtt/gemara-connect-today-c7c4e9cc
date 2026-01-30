/**
 * Advanced Search Service - שירות חיפוש מתקדם
 * משלב חיפוש בשרת (PostgreSQL FTS) וחיפוש מקומי (Worker)
 */

import { supabase } from '@/integrations/supabase/client';

export interface PsakDin {
  id: string;
  title: string;
  court: string;
  year: number;
  summary: string;
  full_text?: string;
  case_number?: string;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface ServerSearchResult extends PsakDin {
  rank: number;
  headline?: string;
}

export interface SearchConfig {
  useServerSearch: boolean;  // Use PostgreSQL FTS
  useLocalWorker: boolean;   // Use Web Worker
  fuzzySearch: boolean;
  useRoots: boolean;
  useSynonyms: boolean;
  limit: number;
}

const DEFAULT_CONFIG: SearchConfig = {
  useServerSearch: true,
  useLocalWorker: true,
  fuzzySearch: true,
  useRoots: true,
  useSynonyms: true,
  limit: 100,
};

/**
 * Server-side full-text search using PostgreSQL
 */
export async function serverFullTextSearch(
  query: string,
  limit: number = 100
): Promise<ServerSearchResult[]> {
  try {
    // Try simple ILIKE search (no RPC function needed)
    return await serverSimpleSearch(query, limit);
  } catch (err) {
    console.error('Server search error:', err);
    return [];
  }
}

/**
 * Simple ILIKE search (fallback)
 */
export async function serverSimpleSearch(
  query: string,
  limit: number = 100
): Promise<ServerSearchResult[]> {
  try {
    const { data, error } = await supabase
      .from('psakei_din')
      .select('*')
      .or(`title.ilike.%${query}%,summary.ilike.%${query}%,court.ilike.%${query}%`)
      .limit(limit);

    if (error) {
      console.error('Simple search error:', error);
      return [];
    }

    // Add rank based on where match was found
    return (data || []).map((item: PsakDin) => ({
      ...item,
      rank: calculateSimpleRank(item, query),
      headline: extractHeadline(item.summary || item.full_text || '', query),
    }));
  } catch (err) {
    console.error('Server simple search error:', err);
    return [];
  }
}

/**
 * Prefix search for autocomplete
 */
export async function serverPrefixSearch(
  prefix: string,
  limit: number = 10
): Promise<ServerSearchResult[]> {
  try {
    // Direct query without RPC
    const { data, error } = await supabase
      .from('psakei_din')
      .select('id, title, court, year, summary, case_number')
      .or(`title.ilike.${prefix}%,title.ilike.%${prefix}%`)
      .limit(limit);

    if (error) {
      console.error('Prefix search error:', error);
      return [];
    }
    
    return (data || []).map((item: Partial<PsakDin>) => ({
      ...item,
      rank: item.title?.toLowerCase().startsWith(prefix.toLowerCase()) ? 10 : 5,
    })) as ServerSearchResult[];
  } catch (err) {
    console.error('Prefix search error:', err);
    return [];
  }
}

/**
 * Calculate simple rank for ILIKE results
 */
function calculateSimpleRank(item: PsakDin, query: string): number {
  const queryLower = query.toLowerCase();
  let rank = 0;

  // Title match (highest weight)
  if (item.title?.toLowerCase().includes(queryLower)) {
    rank += 10;
    if (item.title.toLowerCase().startsWith(queryLower)) {
      rank += 5;
    }
  }

  // Court match
  if (item.court?.toLowerCase().includes(queryLower)) {
    rank += 3;
  }

  // Summary match
  if (item.summary?.toLowerCase().includes(queryLower)) {
    rank += 2;
  }

  // Full text match
  if (item.full_text?.toLowerCase().includes(queryLower)) {
    rank += 1;
  }

  return rank;
}

/**
 * Extract headline with match highlighted
 */
function extractHeadline(text: string, query: string, maxLength: number = 200): string {
  if (!text) return '';
  
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  const matchIndex = textLower.indexOf(queryLower);
  
  if (matchIndex === -1) {
    return text.substring(0, maxLength) + (text.length > maxLength ? '...' : '');
  }

  // Get context around the match
  const start = Math.max(0, matchIndex - 50);
  const end = Math.min(text.length, matchIndex + query.length + 150);
  
  let headline = text.substring(start, end);
  
  if (start > 0) headline = '...' + headline;
  if (end < text.length) headline = headline + '...';

  // Highlight the match
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
  headline = headline.replace(regex, '<mark>$1</mark>');

  return headline;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Combined search - uses both server and local search
 */
export async function combinedSearch(
  query: string,
  psakim: PsakDin[],
  workerSearch: ((query: string) => Promise<any[]>) | null,
  config: Partial<SearchConfig> = {}
): Promise<{
  serverResults: ServerSearchResult[];
  localResults: any[];
  combinedResults: any[];
  stats: { serverTime: number; localTime: number; totalResults: number };
}> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const stats = { serverTime: 0, localTime: 0, totalResults: 0 };

  let serverResults: ServerSearchResult[] = [];
  let localResults: any[] = [];

  // Server search
  if (finalConfig.useServerSearch) {
    const serverStart = performance.now();
    serverResults = await serverFullTextSearch(query, finalConfig.limit);
    stats.serverTime = performance.now() - serverStart;
  }

  // Local worker search
  if (finalConfig.useLocalWorker && workerSearch) {
    const localStart = performance.now();
    try {
      localResults = await workerSearch(query);
    } catch (err) {
      console.error('Local search error:', err);
    }
    stats.localTime = performance.now() - localStart;
  }

  // Combine and deduplicate results
  const seenIds = new Set<string>();
  const combinedResults: any[] = [];

  // Add server results first (usually more relevant)
  for (const result of serverResults) {
    if (!seenIds.has(result.id)) {
      seenIds.add(result.id);
      combinedResults.push({
        ...result,
        source: 'server',
      });
    }
  }

  // Add local results that weren't in server results
  for (const result of localResults) {
    if (!seenIds.has(result.psakId)) {
      seenIds.add(result.psakId);
      combinedResults.push({
        ...result,
        source: 'local',
      });
    }
  }

  stats.totalResults = combinedResults.length;

  return {
    serverResults,
    localResults,
    combinedResults,
    stats,
  };
}

/**
 * Debounced search for real-time typing
 */
export function createDebouncedSearch(
  searchFn: (query: string) => Promise<any>,
  delay: number = 300
): (query: string) => Promise<any> {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastQuery = '';

  return (query: string): Promise<any> => {
    return new Promise((resolve) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      lastQuery = query;

      timeoutId = setTimeout(async () => {
        if (query === lastQuery) {
          const results = await searchFn(query);
          resolve(results);
        }
      }, delay);
    });
  };
}

/**
 * Cache for search results
 */
class SearchCache {
  private cache: Map<string, { results: any[]; timestamp: number }> = new Map();
  private maxAge: number = 5 * 60 * 1000; // 5 minutes
  private maxSize: number = 100;

  get(query: string): any[] | null {
    const cached = this.cache.get(query.toLowerCase());
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.maxAge) {
      this.cache.delete(query.toLowerCase());
      return null;
    }

    return cached.results;
  }

  set(query: string, results: any[]): void {
    // Evict old entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(query.toLowerCase(), {
      results,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

export const searchCache = new SearchCache();
