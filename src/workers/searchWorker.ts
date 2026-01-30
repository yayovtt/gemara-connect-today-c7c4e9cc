/**
 * Search Worker - Web Worker לחיפוש מהיר ב-thread נפרד
 * מאפשר חיפוש בלי לחסום את ה-UI
 */

// Types
interface PsakDin {
  id: string;
  title: string;
  court: string;
  year: number;
  summary: string;
  full_text?: string;
  case_number?: string;
  tags?: string[];
}

interface SearchOptions {
  fuzzySearch: boolean;
  useRoots: boolean;
  useSynonyms: boolean;
  removeNikud: boolean;
  matchSofitLetters: boolean;
  maxFuzzyDistance: number;
}

interface SearchResult {
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

interface SearchIndex {
  wordToPsakim: Map<string, Set<string>>;
  psakimData: Map<string, PsakDin>;
  wordFrequency: Map<string, number>;
  totalWords: number;
}

// Hebrew character utilities
const NIKUD_REGEX = /[\u0591-\u05C7]/g;
const SOFIT_MAP: Record<string, string> = {
  'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ'
};

// Common Hebrew roots (שורשים)
const HEBREW_ROOTS: Record<string, string[]> = {
  'הלכ': ['הלכה', 'הלכות', 'הלך', 'הליכה', 'מהלך', 'להלכה'],
  'דין': ['דין', 'דיין', 'דיינים', 'דינים', 'לדין', 'בדין', 'מדין'],
  'פסק': ['פסק', 'פסיקה', 'פוסק', 'פוסקים', 'נפסק', 'לפסוק'],
  'חוק': ['חוק', 'חוקים', 'חוקי', 'מחוקק', 'חקיקה'],
  'משפט': ['משפט', 'משפטים', 'משפטי', 'שופט', 'שופטים'],
  'זכות': ['זכות', 'זכויות', 'זכאי', 'זכאים', 'לזכות'],
  'חובה': ['חובה', 'חובות', 'חייב', 'חייבים', 'לחייב'],
  'תביע': ['תביעה', 'תביעות', 'תובע', 'תובעים', 'לתבוע'],
  'ערער': ['ערעור', 'ערעורים', 'מערער', 'לערער', 'ערער'],
  'גירוש': ['גירושין', 'גירושים', 'מגורשת', 'גרושה', 'גרוש'],
  'נישוא': ['נישואין', 'נישואים', 'נשואה', 'נשוי', 'להתנשא'],
  'ממון': ['ממון', 'ממונות', 'ממוני', 'כספי', 'כספים'],
  'ירוש': ['ירושה', 'ירושות', 'יורש', 'יורשים', 'להוריש'],
  'מזונ': ['מזונות', 'מזון', 'מזונותיו', 'מזונותיה'],
  'משמור': ['משמורת', 'משמרת', 'לשמור', 'שומר'],
  'רכוש': ['רכוש', 'נכסים', 'נכס', 'רכושי'],
  'הסכמ': ['הסכם', 'הסכמים', 'הסכמה', 'מוסכם', 'להסכים'],
  'חתימ': ['חתימה', 'חתום', 'חותם', 'לחתום', 'חתימות'],
  'עדות': ['עדות', 'עד', 'עדים', 'להעיד', 'מעיד'],
  'ראיה': ['ראיה', 'ראיות', 'ראייתי', 'הוכחה', 'הוכחות'],
};

// Synonyms dictionary (מילים נרדפות)
const SYNONYMS: Record<string, string[]> = {
  'בית דין': ['בי"ד', 'ביה"ד', 'בית הדין', 'הרבני'],
  'בי"ד': ['בית דין', 'ביה"ד', 'בית הדין'],
  'פסק דין': ['פס"ד', 'פסיקה', 'החלטה'],
  'פס"ד': ['פסק דין', 'פסיקה', 'החלטה'],
  'תובע': ['מבקש', 'עותר'],
  'נתבע': ['משיב', 'המשיב'],
  'גט': ['גירושין', 'גירושים', 'פיטורין'],
  'כתובה': ['כתובתה', 'כתובות'],
  'חלוקת רכוש': ['איזון משאבים', 'חלוקת נכסים'],
  'מזונות': ['תשלומי מזונות', 'דמי מזונות'],
  'משמורת': ['החזקה', 'משמרת ילדים'],
  'הסכם גירושין': ['הסכם פירוד', 'הסכם גירושים'],
  'נאמנות': ['אמינות', 'מהימנות'],
  'עדות': ['עדויות', 'הוכחה'],
  'סעד': ['סעדים', 'תרופה', 'פיצוי'],
  'דחייה': ['דחיית התביעה', 'דחיית הבקשה'],
  'קבלה': ['קבלת התביעה', 'קבלת הבקשה'],
};

// Global search index
let searchIndex: SearchIndex | null = null;

// Helper functions
function removeNikud(text: string): string {
  return text.replace(NIKUD_REGEX, '');
}

function normalizeSofit(text: string): string {
  return text.split('').map(c => SOFIT_MAP[c] || c).join('');
}

function normalizeText(text: string, options: Partial<SearchOptions> = {}): string {
  let normalized = text;
  if (options.removeNikud !== false) {
    normalized = removeNikud(normalized);
  }
  if (options.matchSofitLetters !== false) {
    normalized = normalizeSofit(normalized);
  }
  return normalized.toLowerCase();
}

// Levenshtein distance for fuzzy search
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Find root of Hebrew word
function findRoot(word: string): string | null {
  const normalized = normalizeText(word);
  for (const [root, words] of Object.entries(HEBREW_ROOTS)) {
    for (const w of words) {
      if (normalizeText(w) === normalized || normalized.includes(normalizeText(w))) {
        return root;
      }
    }
  }
  return null;
}

// Get all words from a root
function getWordsFromRoot(root: string): string[] {
  return HEBREW_ROOTS[root] || [];
}

// Get synonyms for a word/phrase
function getSynonyms(term: string): string[] {
  const normalized = normalizeText(term);
  for (const [key, synonyms] of Object.entries(SYNONYMS)) {
    if (normalizeText(key) === normalized) {
      return synonyms;
    }
    if (synonyms.some(s => normalizeText(s) === normalized)) {
      return [key, ...synonyms.filter(s => normalizeText(s) !== normalized)];
    }
  }
  return [];
}

// Build search index
function buildIndex(psakim: PsakDin[]): SearchIndex {
  const wordToPsakim = new Map<string, Set<string>>();
  const psakimData = new Map<string, PsakDin>();
  const wordFrequency = new Map<string, number>();
  let totalWords = 0;

  for (const psak of psakim) {
    psakimData.set(psak.id, psak);
    
    // Get all text to index
    const textToIndex = [
      psak.title,
      psak.summary,
      psak.full_text || '',
      psak.court,
      psak.case_number || '',
      ...(psak.tags || [])
    ].join(' ');

    // Tokenize and index
    const words = normalizeText(textToIndex).split(/\s+/).filter(w => w.length > 1);
    
    for (const word of words) {
      totalWords++;
      
      // Add to word frequency
      wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
      
      // Add to word -> psakim mapping
      if (!wordToPsakim.has(word)) {
        wordToPsakim.set(word, new Set());
      }
      wordToPsakim.get(word)!.add(psak.id);
    }
  }

  return { wordToPsakim, psakimData, wordFrequency, totalWords };
}

// Calculate TF-IDF score
function calculateTfIdf(term: string, psakId: string, index: SearchIndex): number {
  const psak = index.psakimData.get(psakId);
  if (!psak) return 0;

  const text = normalizeText([psak.title, psak.summary, psak.full_text || ''].join(' '));
  const words = text.split(/\s+/);
  
  // Term frequency
  const termCount = words.filter(w => w === term || w.includes(term)).length;
  const tf = termCount / words.length;

  // Inverse document frequency
  const docsWithTerm = index.wordToPsakim.get(term)?.size || 1;
  const totalDocs = index.psakimData.size;
  const idf = Math.log(totalDocs / docsWithTerm);

  return tf * idf;
}

// Search function
function search(
  query: string,
  options: SearchOptions
): SearchResult[] {
  if (!searchIndex) {
    return [];
  }

  const results: SearchResult[] = [];
  const normalizedQuery = normalizeText(query, options);
  const queryTerms = normalizedQuery.split(/\s+/).filter(t => t.length > 1);
  
  // Expand query with roots and synonyms
  const expandedTerms = new Set<string>(queryTerms);
  
  if (options.useRoots) {
    for (const term of queryTerms) {
      const root = findRoot(term);
      if (root) {
        for (const word of getWordsFromRoot(root)) {
          expandedTerms.add(normalizeText(word));
        }
      }
    }
  }

  if (options.useSynonyms) {
    for (const term of queryTerms) {
      const synonyms = getSynonyms(term);
      for (const syn of synonyms) {
        expandedTerms.add(normalizeText(syn));
      }
    }
  }

  // Find matching psakim
  const psakimScores = new Map<string, { score: number; matchedTerms: string[]; matchType: 'exact' | 'fuzzy' | 'root' | 'synonym' }>();

  for (const term of expandedTerms) {
    // Exact match
    const exactMatches = searchIndex.wordToPsakim.get(term);
    if (exactMatches) {
      for (const psakId of exactMatches) {
        const current = psakimScores.get(psakId) || { score: 0, matchedTerms: [], matchType: 'exact' as const };
        current.score += calculateTfIdf(term, psakId, searchIndex) * 10; // Boost exact matches
        if (!current.matchedTerms.includes(term)) {
          current.matchedTerms.push(term);
        }
        psakimScores.set(psakId, current);
      }
    }

    // Fuzzy match
    if (options.fuzzySearch && term.length >= 3) {
      for (const [word, psakIds] of searchIndex.wordToPsakim.entries()) {
        if (word.length >= 3 && !expandedTerms.has(word)) {
          const distance = levenshteinDistance(term, word);
          if (distance <= options.maxFuzzyDistance && distance > 0) {
            for (const psakId of psakIds) {
              const current = psakimScores.get(psakId) || { score: 0, matchedTerms: [], matchType: 'fuzzy' as const };
              current.score += calculateTfIdf(word, psakId, searchIndex) * (1 - distance / options.maxFuzzyDistance);
              if (!current.matchedTerms.includes(word)) {
                current.matchedTerms.push(word);
              }
              if (current.matchType === 'exact') {
                // Keep exact match type
              } else {
                current.matchType = 'fuzzy';
              }
              psakimScores.set(psakId, current);
            }
          }
        }
      }
    }
  }

  // Build results with context - return ALL matching lines per psak
  for (const [psakId, scoreData] of psakimScores.entries()) {
    const psak = searchIndex.psakimData.get(psakId);
    if (!psak) continue;

    const text = psak.full_text || psak.summary;
    const lines = text.split('\n').filter(l => l.trim());

    // Boost score based on where match was found
    let baseScore = scoreData.score;
    const normalizedTitle = normalizeText(psak.title, options);
    for (const term of scoreData.matchedTerms) {
      if (normalizedTitle.includes(term)) {
        baseScore *= 2; // Double score for title matches
      }
    }

    // Find ALL matching lines (not just the best one)
    let foundMatches = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const normalizedLine = normalizeText(line, options);
      
      // Check if this line contains any of the matched terms
      const hasMatch = scoreData.matchedTerms.some(term => normalizedLine.includes(term));

      if (hasMatch) {
        foundMatches = true;
        results.push({
          psakId: psak.id,
          psakTitle: psak.title,
          psakCourt: psak.court,
          psakYear: psak.year,
          text: line.substring(0, 300),
          lineNumber: i + 1,
          score: baseScore,
          matchedTerms: scoreData.matchedTerms,
          contextBefore: i > 0 ? lines[i - 1].substring(0, 150) : undefined,
          contextAfter: i < lines.length - 1 ? lines[i + 1].substring(0, 150) : undefined,
          matchType: scoreData.matchType,
        });
      }
    }

    // If no lines matched (edge case), add at least one result with summary
    if (!foundMatches) {
      results.push({
        psakId: psak.id,
        psakTitle: psak.title,
        psakCourt: psak.court,
        psakYear: psak.year,
        text: text.substring(0, 200),
        lineNumber: 1,
        score: baseScore,
        matchedTerms: scoreData.matchedTerms,
        contextBefore: undefined,
        contextAfter: lines.length > 1 ? lines[1].substring(0, 150) : undefined,
        matchType: scoreData.matchType,
      });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results;
}

// Message handler
self.onmessage = (event: MessageEvent) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'BUILD_INDEX': {
      const { psakim } = payload as { psakim: PsakDin[] };
      const startTime = performance.now();
      searchIndex = buildIndex(psakim);
      const endTime = performance.now();
      
      self.postMessage({
        type: 'INDEX_BUILT',
        payload: {
          wordCount: searchIndex.wordToPsakim.size,
          psakimCount: searchIndex.psakimData.size,
          totalWords: searchIndex.totalWords,
          buildTime: endTime - startTime,
        },
      });
      break;
    }

    case 'SEARCH': {
      const { query, options } = payload as { query: string; options: SearchOptions };
      const startTime = performance.now();
      const results = search(query, options);
      const endTime = performance.now();

      self.postMessage({
        type: 'SEARCH_RESULTS',
        payload: {
          results,
          searchTime: endTime - startTime,
          totalResults: results.length,
        },
      });
      break;
    }

    // NEW: Streaming search - sends results in batches as they're found
    case 'SEARCH_STREAMING': {
      const { psakim, query, options, batchSize = 50 } = payload as { 
        psakim: PsakDin[]; 
        query: string; 
        options: SearchOptions;
        batchSize?: number;
      };
      
      const startTime = performance.now();
      const normalizedQuery = normalizeText(query, options);
      const queryTerms = normalizedQuery.split(/\s+/).filter(t => t.length > 1);
      
      // Expand query with roots and synonyms
      const expandedTerms = new Set<string>(queryTerms);
      
      if (options.useRoots) {
        for (const term of queryTerms) {
          const root = findRoot(term);
          if (root) {
            for (const word of getWordsFromRoot(root)) {
              expandedTerms.add(normalizeText(word));
            }
          }
        }
      }

      if (options.useSynonyms) {
        for (const term of queryTerms) {
          const synonyms = getSynonyms(term);
          for (const syn of synonyms) {
            expandedTerms.add(normalizeText(syn));
          }
        }
      }
      
      let batchResults: SearchResult[] = [];
      let totalFound = 0;
      let processed = 0;
      
      // Process psakim in batches
      for (let i = 0; i < psakim.length; i++) {
        const psak = psakim[i];
        const text = psak.full_text || psak.summary || '';
        const normalizedText = normalizeText(text, options);
        const normalizedTitle = normalizeText(psak.title, options);
        
        // Check if any term matches
        const matchedTerms: string[] = [];
        let matchType: 'exact' | 'fuzzy' | 'root' | 'synonym' = 'exact';
        
        for (const term of expandedTerms) {
          if (normalizedText.includes(term) || normalizedTitle.includes(term)) {
            matchedTerms.push(term);
          } else if (options.fuzzySearch && term.length >= 3) {
            // Fuzzy match on words
            const words = normalizedText.split(/\s+/);
            for (const word of words) {
              if (word.length >= 3 && levenshteinDistance(term, word) <= options.maxFuzzyDistance) {
                matchedTerms.push(word);
                matchType = 'fuzzy';
                break;
              }
            }
          }
        }
        
        if (matchedTerms.length > 0) {
          // Find ALL matching lines (not just the best one)
          const lines = text.split('\n').filter(l => l.trim());
          
          // Calculate base score
          let baseScore = matchedTerms.length;
          if (normalizedTitle.includes(matchedTerms[0])) {
            baseScore *= 2; // Boost title matches
          }
          
          let foundMatches = false;
          for (let j = 0; j < lines.length; j++) {
            const line = lines[j];
            const normalizedLine = normalizeText(line, options);
            
            // Check if this line contains any of the matched terms
            const hasMatch = matchedTerms.some(term => normalizedLine.includes(term));

            if (hasMatch) {
              foundMatches = true;
              batchResults.push({
                psakId: psak.id,
                psakTitle: psak.title,
                psakCourt: psak.court,
                psakYear: psak.year,
                text: line.substring(0, 300),
                lineNumber: j + 1,
                score: baseScore,
                matchedTerms,
                contextBefore: j > 0 ? lines[j - 1].substring(0, 150) : undefined,
                contextAfter: j < lines.length - 1 ? lines[j + 1].substring(0, 150) : undefined,
                matchType,
              });
              
              totalFound++;
            }
          }

          // If no lines matched (edge case), add at least one result
          if (!foundMatches) {
            batchResults.push({
              psakId: psak.id,
              psakTitle: psak.title,
              psakCourt: psak.court,
              psakYear: psak.year,
              text: text.substring(0, 200),
              lineNumber: 1,
              score: baseScore,
              matchedTerms,
              contextBefore: undefined,
              contextAfter: lines.length > 1 ? lines[1].substring(0, 150) : undefined,
              matchType,
            });
            
            totalFound++;
          }
        }
        
        processed++;
        
        // Send batch when ready
        if (batchResults.length >= batchSize || i === psakim.length - 1) {
          // Sort batch by score
          batchResults.sort((a, b) => b.score - a.score);
          
          self.postMessage({
            type: 'SEARCH_BATCH',
            payload: {
              results: batchResults,
              processed,
              total: psakim.length,
              percentage: Math.round((processed / psakim.length) * 100),
              isFinal: i === psakim.length - 1,
            },
          });
          
          batchResults = [];
        }
      }
      
      const endTime = performance.now();
      
      // Send final summary
      self.postMessage({
        type: 'SEARCH_COMPLETE',
        payload: {
          totalFound,
          searchTime: endTime - startTime,
          processed: psakim.length,
        },
      });
      break;
    }

    case 'GET_SUGGESTIONS': {
      const { prefix } = payload as { prefix: string };
      if (!searchIndex || prefix.length < 2) {
        self.postMessage({ type: 'SUGGESTIONS', payload: { suggestions: [] } });
        break;
      }

      const normalizedPrefix = normalizeText(prefix);
      const suggestions: string[] = [];

      for (const word of searchIndex.wordToPsakim.keys()) {
        if (word.startsWith(normalizedPrefix) && suggestions.length < 10) {
          suggestions.push(word);
        }
      }

      // Sort by frequency
      suggestions.sort((a, b) => {
        const freqA = searchIndex!.wordFrequency.get(a) || 0;
        const freqB = searchIndex!.wordFrequency.get(b) || 0;
        return freqB - freqA;
      });

      self.postMessage({ type: 'SUGGESTIONS', payload: { suggestions } });
      break;
    }

    case 'CLEAR_INDEX': {
      searchIndex = null;
      self.postMessage({ type: 'INDEX_CLEARED' });
      break;
    }
  }
};

export {};
