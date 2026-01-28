/**
 * Utility functions for advanced text search
 */

// Strip HTML tags from text
export function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// Parse words from textarea (one word per line)
export function parseWordList(text: string): string[] {
  if (!text) return [];
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

// Check if text contains a word (case-insensitive for Hebrew)
export function containsWord(
  text: string, 
  word: string, 
  normalization?: NormalizationOptions
): boolean {
  if (!text || !word) return false;
  const opts = normalization || DEFAULT_NORMALIZATION;
  const normalizedText = normalizeHebrewText(text.toLowerCase(), opts);
  const normalizedWord = normalizeHebrewText(word.toLowerCase(), opts);
  return normalizedText.includes(normalizedWord);
}

// Check if text contains any word from list
export function containsAnyWord(
  text: string, 
  words: string[], 
  normalization?: NormalizationOptions
): boolean {
  return words.some(word => containsWord(text, word, normalization));
}

// Check if text contains all words from list
export function containsAllWords(
  text: string, 
  words: string[], 
  normalization?: NormalizationOptions
): boolean {
  return words.every(word => containsWord(text, word, normalization));
}

// Range type for proximity search
export type RangeType = 'lines' | 'characters' | 'words';

// Normalization options for Hebrew text
export interface NormalizationOptions {
  removeNikud: boolean;           // Remove Hebrew vowels (nikud)
  removeQuotes: boolean;          // Remove quotes and geresh marks
  removePunctuation: boolean;     // Remove punctuation marks
  removeDashes: boolean;          // Remove dashes
  normalizeFinalLetters: boolean; // Normalize final letters (ם→מ, ך→כ, etc.)
  expandHebrewNumbers: boolean;   // Expand Hebrew number variants (צ׳ ⟷ 90 ⟷ תשעים)
}

export const DEFAULT_NORMALIZATION: NormalizationOptions = {
  removeNikud: true,
  removeQuotes: true,
  removePunctuation: false,
  removeDashes: false,
  normalizeFinalLetters: false,
  expandHebrewNumbers: true, // On by default
};

// Normalize Hebrew text based on options
export function normalizeHebrewText(text: string, options: NormalizationOptions): string {
  let result = text;
  
  if (options.removeNikud) {
    // Remove Hebrew nikud (vowel points) - Unicode range: \u0591-\u05C7
    result = result.replace(/[\u0591-\u05C7]/g, '');
  }
  
  if (options.removeQuotes) {
    // Remove various quote characters including Hebrew geresh/gershayim
    result = result.replace(/["'״׳`´''""«»]/g, '');
  }
  
  if (options.removePunctuation) {
    // Remove punctuation marks
    result = result.replace(/[.,;:!?()[\]{}]/g, '');
  }
  
  if (options.removeDashes) {
    // Remove various dash types
    result = result.replace(/[-–—־]/g, '');
  }
  
  if (options.normalizeFinalLetters) {
    // Convert final letters to regular form
    result = result
      .replace(/ם/g, 'מ')
      .replace(/ן/g, 'נ')
      .replace(/ץ/g, 'צ')
      .replace(/ף/g, 'פ')
      .replace(/ך/g, 'כ');
  }
  
  return result;
}

// Get position of word in text
function getWordPosition(
  text: string, 
  word: string, 
  normalization?: NormalizationOptions
): number {
  const opts = normalization || DEFAULT_NORMALIZATION;
  const normalizedText = normalizeHebrewText(text.toLowerCase(), opts);
  const normalizedWord = normalizeHebrewText(word.toLowerCase(), opts);
  return normalizedText.indexOf(normalizedWord);
}

// Get all positions of word in text
function getAllWordPositions(
  text: string, 
  word: string,
  normalization?: NormalizationOptions
): number[] {
  const positions: number[] = [];
  const opts = normalization || DEFAULT_NORMALIZATION;
  const normalizedText = normalizeHebrewText(text.toLowerCase(), opts);
  const normalizedWord = normalizeHebrewText(word.toLowerCase(), opts);
  let pos = 0;
  
  while (pos < normalizedText.length) {
    const index = normalizedText.indexOf(normalizedWord, pos);
    if (index === -1) break;
    positions.push(index);
    pos = index + 1;
  }
  
  return positions;
}

// Split text into lines
function splitIntoLines(text: string): string[] {
  return text.split(/\r?\n/);
}

// Split text into words
function splitIntoWords(text: string): string[] {
  return text.split(/\s+/).filter(w => w.length > 0);
}

// Find line number for character position
function getLineNumber(text: string, charPos: number): number {
  const textBefore = text.substring(0, charPos);
  return textBefore.split(/\r?\n/).length - 1;
}

// Find word index for character position
function getWordIndex(text: string, charPos: number): number {
  const textBefore = text.substring(0, charPos);
  return splitIntoWords(textBefore).length - 1;
}

export interface ProximityMatch {
  found: boolean;
  primaryWord?: string;
  proximityWord?: string;
  primaryPosition?: number;
  proximityPosition?: number;
  context?: string;
}

/**
 * Advanced proximity search
 * Finds if any primary word is within range of any proximity word
 */
export function proximitySearch(
  text: string,
  primaryWords: string[],
  proximityWords: string[],
  range: number,
  rangeType: RangeType,
  normalization?: NormalizationOptions
): ProximityMatch {
  if (!text || primaryWords.length === 0 || proximityWords.length === 0) {
    return { found: false };
  }
  
  const opts = normalization || DEFAULT_NORMALIZATION;

  const strippedText = stripHtml(text);
  
  for (const primaryWord of primaryWords) {
    const primaryPositions = getAllWordPositions(strippedText, primaryWord, opts);
    
    for (const primaryPos of primaryPositions) {
      for (const proximityWord of proximityWords) {
        const proximityPositions = getAllWordPositions(strippedText, proximityWord, opts);
        
        for (const proximityPos of proximityPositions) {
          const isInRange = checkProximity(
            strippedText,
            primaryPos,
            proximityPos,
            range,
            rangeType
          );
          
          if (isInRange) {
            // Extract context around the match
            const contextStart = Math.max(0, Math.min(primaryPos, proximityPos) - 50);
            const contextEnd = Math.min(strippedText.length, Math.max(primaryPos, proximityPos) + 50);
            const context = strippedText.substring(contextStart, contextEnd);
            
            return {
              found: true,
              primaryWord,
              proximityWord,
              primaryPosition: primaryPos,
              proximityPosition: proximityPos,
              context: '...' + context + '...'
            };
          }
        }
      }
    }
  }
  
  return { found: false };
}

// Check if two positions are within range based on range type
function checkProximity(
  text: string,
  pos1: number,
  pos2: number,
  range: number,
  rangeType: RangeType
): boolean {
  switch (rangeType) {
    case 'characters':
      return Math.abs(pos1 - pos2) <= range;
    
    case 'lines': {
      const line1 = getLineNumber(text, pos1);
      const line2 = getLineNumber(text, pos2);
      return Math.abs(line1 - line2) <= range;
    }
    
    case 'words': {
      const wordIndex1 = getWordIndex(text, pos1);
      const wordIndex2 = getWordIndex(text, pos2);
      return Math.abs(wordIndex1 - wordIndex2) <= range;
    }
    
    default:
      return false;
  }
}

// Highlight words in text
export function highlightWords(text: string, words: string[]): string {
  if (!text || words.length === 0) return text;
  
  let result = text;
  for (const word of words) {
    if (!word) continue;
    const regex = new RegExp(`(${escapeRegex(word)})`, 'gi');
    result = result.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">$1</mark>');
  }
  return result;
}

// Escape special regex characters
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Get excerpt around matched word
export function getExcerpt(
  text: string, 
  word: string, 
  contextLength: number = 100,
  normalization?: NormalizationOptions
): string {
  const strippedText = stripHtml(text);
  const pos = getWordPosition(strippedText, word, normalization);
  
  if (pos === -1) {
    return strippedText.substring(0, contextLength * 2) + '...';
  }
  
  const start = Math.max(0, pos - contextLength);
  const end = Math.min(strippedText.length, pos + word.length + contextLength);
  
  let excerpt = strippedText.substring(start, end);
  if (start > 0) excerpt = '...' + excerpt;
  if (end < strippedText.length) excerpt = excerpt + '...';
  
  return excerpt;
}
