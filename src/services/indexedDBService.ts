/**
 * IndexedDB Service for Pre-indexing Psakei Din
 * Professional search engine implementation with inverted index
 * 
 * Architecture:
 * 1. Inverted Index: word -> [psak_ids] for O(1) lookup
 * 2. Full Psakim Store: complete documents for context retrieval
 * 3. Metadata Store: index statistics and freshness
 */

import { PsakDin } from '@/types/psakDin';

const DB_NAME = 'psakei-din-search-v2';
const DB_VERSION = 2;
const STORE_PSAKIM = 'psakim';
const STORE_INDEX = 'searchIndex';
const STORE_META = 'metadata';

// Search index structure - inverted index pattern
export interface SearchIndex {
  wordToPsakim: Record<string, string[]>; // word -> array of psak IDs
  psakimSummary: Record<string, { title: string; court: string; year: number; summary: string }>;
  totalWords: number;
  lastUpdated: string;
  version: number;
}

export interface SearchResultWithContext {
  id: string;
  title: string;
  court: string;
  year: number;
  score: number;
  matches: Array<{
    lineBefore: string;
    matchedLine: string;
    lineAfter: string;
    highlightedLine: string;
    lineNumber: number;
  }>;
}

// ========== Text Processing Utilities ==========

// Remove Hebrew nikud (vowel marks)
function removeNikud(text: string): string {
  return text.replace(/[\u0591-\u05C7]/g, '');
}

// Normalize Hebrew sofit (final) letters to regular form
function normalizeSofit(text: string): string {
  return text
    .replace(/ך/g, 'כ')
    .replace(/ם/g, 'מ')
    .replace(/ן/g, 'נ')
    .replace(/ף/g, 'פ')
    .replace(/ץ/g, 'צ');
}

// Extract and normalize words from text
function extractWords(text: string): string[] {
  if (!text) return [];
  const normalized = normalizeSofit(removeNikud(text.toLowerCase()));
  // Split by non-Hebrew/non-alphanumeric characters, keep words with 2+ chars
  const words = normalized.split(/[^\u0590-\u05FFa-zA-Z0-9]+/).filter(w => w.length >= 2);
  return [...new Set(words)]; // Remove duplicates
}

// ========== Database Connection ==========

let dbInstance: IDBDatabase | null = null;

async function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      console.error('IndexedDB open error:', request.error);
      reject(request.error);
    };
    
    request.onsuccess = () => {
      dbInstance = request.result;
      
      // Handle connection close
      dbInstance.onclose = () => {
        dbInstance = null;
      };
      
      resolve(dbInstance);
    };
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Clear old stores if upgrading
      if (event.oldVersion > 0) {
        if (db.objectStoreNames.contains(STORE_PSAKIM)) {
          db.deleteObjectStore(STORE_PSAKIM);
        }
        if (db.objectStoreNames.contains(STORE_INDEX)) {
          db.deleteObjectStore(STORE_INDEX);
        }
        if (db.objectStoreNames.contains(STORE_META)) {
          db.deleteObjectStore(STORE_META);
        }
      }
      
      // Create stores
      db.createObjectStore(STORE_PSAKIM, { keyPath: 'id' });
      db.createObjectStore(STORE_INDEX, { keyPath: 'key' });
      db.createObjectStore(STORE_META, { keyPath: 'key' });
    };
  });
}

// ========== Index Building ==========

/**
 * Build search index from psakim array
 * Uses batched transactions for reliability
 */
export async function buildSearchIndex(
  psakim: PsakDin[],
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  console.log(`🔨 Building search index for ${psakim.length} psakim...`);
  
  const db = await openDB();
  
  // Build inverted index in memory first
  const wordToPsakim: Record<string, string[]> = {};
  const psakimSummary: Record<string, { title: string; court: string; year: number; summary: string }> = {};
  let totalWords = 0;
  
  // Step 1: Store all psakim in batches
  const BATCH_SIZE = 100;
  for (let i = 0; i < psakim.length; i += BATCH_SIZE) {
    const batch = psakim.slice(i, i + BATCH_SIZE);
    
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PSAKIM, 'readwrite');
      const store = tx.objectStore(STORE_PSAKIM);
      
      for (const psak of batch) {
        store.put(psak);
      }
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    
    if (onProgress) {
      onProgress(Math.min(i + BATCH_SIZE, psakim.length), psakim.length);
    }
  }
  
  console.log('✅ Psakim stored in IndexedDB');
  
  // Step 2: Build inverted index
  for (let i = 0; i < psakim.length; i++) {
    const psak = psakim[i];
    
    // Store summary for quick display
    psakimSummary[psak.id] = {
      title: psak.title || '',
      court: psak.court || '',
      year: psak.year || 0,
      summary: (psak.summary || '').substring(0, 500),
    };
    
    // Build searchable text - index title, summary, and portion of full text
    const textToIndex = [
      psak.title || '',
      psak.summary || '',
      (psak.full_text || '').substring(0, 15000), // Limit to prevent memory issues
    ].join(' ');
    
    const words = extractWords(textToIndex);
    totalWords += words.length;
    
    // Add to inverted index
    for (const word of words) {
      if (!wordToPsakim[word]) {
        wordToPsakim[word] = [];
      }
      if (!wordToPsakim[word].includes(psak.id)) {
        wordToPsakim[word].push(psak.id);
      }
    }
  }
  
  console.log(`✅ Inverted index built: ${Object.keys(wordToPsakim).length} unique words`);
  
  // Step 3: Store the index
  const index: SearchIndex = {
    wordToPsakim,
    psakimSummary,
    totalWords,
    lastUpdated: new Date().toISOString(),
    version: 2,
  };
  
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_INDEX, 'readwrite');
    const store = tx.objectStore(STORE_INDEX);
    store.put({ key: 'main', ...index });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  
  // Step 4: Store metadata
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readwrite');
    const store = tx.objectStore(STORE_META);
    store.put({
      key: 'indexInfo',
      psakimCount: psakim.length,
      lastUpdated: new Date().toISOString(),
      totalWords,
      uniqueWords: Object.keys(wordToPsakim).length,
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  
  console.log('✅ Search index built successfully!');
}

// ========== Index Loading ==========

/**
 * Load search index from IndexedDB
 */
export async function loadSearchIndex(): Promise<SearchIndex | null> {
  try {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_INDEX, 'readonly');
      const store = tx.objectStore(STORE_INDEX);
      const request = store.get('main');
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        if (request.result) {
          const { key, ...index } = request.result;
          resolve(index as SearchIndex);
        } else {
          resolve(null);
        }
      };
    });
  } catch (error) {
    console.error('Error loading search index:', error);
    return null;
  }
}

/**
 * Get index metadata
 */
export async function getIndexMetadata(): Promise<{ 
  psakimCount: number; 
  lastUpdated: string; 
  totalWords: number;
  uniqueWords?: number;
} | null> {
  try {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readonly');
      const store = tx.objectStore(STORE_META);
      const request = store.get('indexInfo');
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        if (request.result) {
          const { key, ...meta } = request.result;
          resolve(meta);
        } else {
          resolve(null);
        }
      };
    });
  } catch (error) {
    console.error('Error getting index metadata:', error);
    return null;
  }
}

// ========== Search Functions ==========

/**
 * Fast search using inverted index - O(1) lookup per word
 */
export async function searchWithIndex(
  query: string,
  index: SearchIndex,
  limit: number = 100
): Promise<{ id: string; title: string; court: string; year: number; summary: string; score: number }[]> {
  const queryWords = extractWords(query);
  
  if (queryWords.length === 0) {
    return [];
  }
  
  const matchingPsakimScores: Record<string, number> = {};
  
  for (const word of queryWords) {
    // Exact match - higher score
    if (index.wordToPsakim[word]) {
      for (const psakId of index.wordToPsakim[word]) {
        matchingPsakimScores[psakId] = (matchingPsakimScores[psakId] || 0) + 10;
      }
    }
    
    // Prefix match for partial words - lower score
    for (const indexWord of Object.keys(index.wordToPsakim)) {
      if (indexWord.startsWith(word) && indexWord !== word) {
        for (const psakId of index.wordToPsakim[indexWord]) {
          matchingPsakimScores[psakId] = (matchingPsakimScores[psakId] || 0) + 3;
        }
      }
    }
  }
  
  // Sort by score and return top results
  const sortedPsakim = Object.entries(matchingPsakimScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
  
  return sortedPsakim.map(([id, score]) => ({
    id,
    ...index.psakimSummary[id],
    score,
  }));
}

/**
 * Search with context - returns matching lines with before/after context
 * This is the main search function for displaying results
 */
export async function searchWithContext(
  query: string,
  index: SearchIndex,
  limit: number = 50,
  maxMatchesPerPsak: number = 3
): Promise<SearchResultWithContext[]> {
  const queryWords = extractWords(query);
  const originalQuery = query.trim();
  
  console.log('🔍 searchWithContext:', { query, queryWords, originalQuery });
  
  if (queryWords.length === 0) {
    console.log('⚠️ No query words extracted');
    return [];
  }
  
  // Step 1: Find matching psakim using inverted index
  const matchingPsakimScores: Record<string, number> = {};
  
  for (const word of queryWords) {
    if (index.wordToPsakim[word]) {
      for (const psakId of index.wordToPsakim[word]) {
        matchingPsakimScores[psakId] = (matchingPsakimScores[psakId] || 0) + 10;
      }
    }
    
    // Prefix match
    for (const indexWord of Object.keys(index.wordToPsakim)) {
      if (indexWord.startsWith(word) && indexWord !== word) {
        for (const psakId of index.wordToPsakim[indexWord]) {
          matchingPsakimScores[psakId] = (matchingPsakimScores[psakId] || 0) + 3;
        }
      }
    }
  }
  
  const matchCount = Object.keys(matchingPsakimScores).length;
  console.log(`✅ Found ${matchCount} matching psakim in index`);
  
  if (matchCount === 0) {
    return [];
  }
  
  // Step 2: Get top scoring psakim IDs
  const topPsakimIds = Object.entries(matchingPsakimScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);
  
  // Step 3: Load full psakim from DB
  const psakim = await getPsakimFromDB(topPsakimIds);
  console.log(`📄 Loaded ${psakim.length} psakim from DB`);
  
  if (psakim.length === 0) {
    console.log('⚠️ No psakim loaded from DB - returning results from summary');
    // Fallback: return results from summary data
    return topPsakimIds.slice(0, limit).map(id => ({
      id,
      title: index.psakimSummary[id]?.title || 'ללא כותרת',
      court: index.psakimSummary[id]?.court || '',
      year: index.psakimSummary[id]?.year || 0,
      score: matchingPsakimScores[id],
      matches: [{
        lineBefore: '',
        matchedLine: index.psakimSummary[id]?.summary || '',
        lineAfter: '',
        highlightedLine: highlightText(index.psakimSummary[id]?.summary || '', originalQuery),
        lineNumber: 1,
      }],
    }));
  }
  
  // Step 4: Find exact matches with context in each psak
  const results: SearchResultWithContext[] = [];
  
  for (const psak of psakim) {
    const textToSearch = [
      psak.title || '',
      psak.summary || '',
      psak.full_text || '',
    ].join('\n');
    
    const lines = textToSearch.split(/\n/).filter(l => l.trim());
    const matches: SearchResultWithContext['matches'] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const normalizedLine = normalizeSofit(removeNikud(line.toLowerCase()));
      
      // Check if line contains any query word
      const hasMatch = queryWords.some(word => normalizedLine.includes(word));
      
      if (hasMatch) {
        matches.push({
          lineBefore: i > 0 ? lines[i - 1].substring(0, 150) : '',
          matchedLine: line.substring(0, 300),
          lineAfter: i < lines.length - 1 ? lines[i + 1].substring(0, 150) : '',
          highlightedLine: highlightText(line, originalQuery).substring(0, 400),
          lineNumber: i + 1,
        });
      }
    }
    
    if (matches.length > 0) {
      results.push({
        id: psak.id,
        title: psak.title || 'ללא כותרת',
        court: psak.court || '',
        year: psak.year || 0,
        score: matchingPsakimScores[psak.id] || 0,
        matches,
      });
    }
  }
  
  console.log(`✅ searchWithContext returning ${results.length} results`);
  return results;
}

/**
 * Highlight search terms in text with HTML mark tags
 */
function highlightText(text: string, query: string): string {
  if (!text || !query) return text;
  
  const words = query.split(/\s+/).filter(w => w.length >= 2);
  let result = text;
  
  for (const word of words) {
    // Escape special regex characters
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Create case-insensitive regex
    const regex = new RegExp(`(${escaped})`, 'gi');
    result = result.replace(regex, '<mark class="bg-yellow-300 text-black px-0.5 rounded">$1</mark>');
  }
  
  return result;
}

// ========== Data Access Functions ==========

/**
 * Get ALL psakim from IndexedDB (for loading from local index)
 */
export async function getAllPsakimFromDB(): Promise<PsakDin[]> {
  try {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PSAKIM, 'readonly');
      const store = tx.objectStore(STORE_PSAKIM);
      const request = store.getAll();
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const results = request.result || [];
        console.log(`✅ Loaded ${results.length} psakim from IndexedDB`);
        resolve(results as PsakDin[]);
      };
    });
  } catch (error) {
    console.error('Error getting all psakim from DB:', error);
    return [];
  }
}

/**
 * Get single psak from IndexedDB
 */
export async function getPsakFromDB(id: string): Promise<PsakDin | null> {
  try {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PSAKIM, 'readonly');
      const store = tx.objectStore(STORE_PSAKIM);
      const request = store.get(id);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  } catch (error) {
    console.error('Error getting psak from DB:', error);
    return null;
  }
}

/**
 * Get multiple psakim from IndexedDB
 */
export async function getPsakimFromDB(ids: string[]): Promise<PsakDin[]> {
  if (ids.length === 0) return [];
  
  try {
    const db = await openDB();
    const results: PsakDin[] = [];
    
    // Use a single transaction for all reads
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PSAKIM, 'readonly');
      const store = tx.objectStore(STORE_PSAKIM);
      let completed = 0;
      
      for (const id of ids) {
        const request = store.get(id);
        
        request.onsuccess = () => {
          if (request.result) {
            results.push(request.result);
          }
          completed++;
          if (completed === ids.length) {
            resolve(results);
          }
        };
        
        request.onerror = () => {
          completed++;
          if (completed === ids.length) {
            resolve(results);
          }
        };
      }
      
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error('Error getting psakim from DB:', error);
    return [];
  }
}

// ========== Maintenance Functions ==========

/**
 * Clear all data from IndexedDB
 */
export async function clearSearchIndex(): Promise<void> {
  try {
    // Delete the entire database for clean slate
    dbInstance = null;
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => {
        console.log('✅ Search index cleared');
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error clearing search index:', error);
  }
}

/**
 * Check if index exists and is recent
 */
export async function isIndexValid(maxAgeHours: number = 24): Promise<boolean> {
  const meta = await getIndexMetadata();
  if (!meta) return false;
  
  const lastUpdated = new Date(meta.lastUpdated);
  const hoursSinceUpdate = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60);
  
  return hoursSinceUpdate < maxAgeHours && meta.psakimCount > 0;
}
