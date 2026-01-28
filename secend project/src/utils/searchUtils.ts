/**
 * Search Utilities - פונקציות עזר לחיפוש וניתוח טקסט
 * קובץ זה מכיל את הלוגיקה הבסיסית שניתנת לבדיקה
 */

import { 
  FilterRules, 
  PositionRule, 
  TextPositionRule, 
  SmartSearchOptions,
  SearchCondition 
} from '@/types/search';

/**
 * המרת מספרים לעברית (גימטריא)
 */
export const numberToHebrewMap: Record<number, string> = {
  1: 'א', 2: 'ב', 3: 'ג', 4: 'ד', 5: 'ה', 6: 'ו', 7: 'ז', 8: 'ח', 9: 'ט',
  10: 'י', 20: 'כ', 30: 'ל', 40: 'מ', 50: 'נ', 60: 'ס', 70: 'ע', 80: 'פ', 90: 'צ',
  100: 'ק', 200: 'ר', 300: 'ש', 400: 'ת'
};

export const hebrewToNumberMap: Record<string, number> = {
  'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9,
  'י': 10, 'כ': 20, 'ך': 20, 'ל': 30, 'מ': 40, 'ם': 40, 'נ': 50, 'ן': 50,
  'ס': 60, 'ע': 70, 'פ': 80, 'ף': 80, 'צ': 90, 'ץ': 90,
  'ק': 100, 'ר': 200, 'ש': 300, 'ת': 400
};

/**
 * המרת מספר לאותיות עבריות
 * @param num המספר להמרה
 * @returns המספר בכתיב עברי
 */
export function convertNumberToHebrew(num: number): string {
  if (num <= 0 || num > 999) return num.toString();
  
  let result = '';
  let remaining = num;
  
  // מאות
  if (remaining >= 100) {
    const hundreds = Math.floor(remaining / 100) * 100;
    result += numberToHebrewMap[hundreds] || '';
    remaining = remaining % 100;
  }
  
  // עשרות
  if (remaining >= 10) {
    // מקרים מיוחדים: 15 = ט״ו, 16 = ט״ז
    if (remaining === 15) {
      result += 'טו';
      remaining = 0;
    } else if (remaining === 16) {
      result += 'טז';
      remaining = 0;
    } else {
      const tens = Math.floor(remaining / 10) * 10;
      result += numberToHebrewMap[tens] || '';
      remaining = remaining % 10;
    }
  }
  
  // יחידות
  if (remaining > 0) {
    result += numberToHebrewMap[remaining] || '';
  }
  
  return result;
}

/**
 * חישוב ערך גימטריא של מילה
 * @param word המילה לחישוב
 * @returns ערך הגימטריא
 */
export function calculateGematria(word: string): number {
  let total = 0;
  for (const char of word) {
    total += hebrewToNumberMap[char] || 0;
  }
  return total;
}

/**
 * הסרת ניקוד מטקסט
 * @param text הטקסט עם ניקוד
 * @returns הטקסט ללא ניקוד
 */
export function removeNikud(text: string): string {
  // טווח הניקוד העברי: U+0591 עד U+05C7
  return text.replace(/[\u0591-\u05C7]/g, '');
}

/**
 * המרת אותיות סופיות לרגילות
 * @param text הטקסט להמרה
 * @returns הטקסט עם אותיות רגילות
 */
export function normalizeSofitLetters(text: string): string {
  return text
    .replace(/ך/g, 'כ')
    .replace(/ם/g, 'מ')
    .replace(/ן/g, 'נ')
    .replace(/ף/g, 'פ')
    .replace(/ץ/g, 'צ');
}

/**
 * נרמול טקסט לחיפוש
 * @param text הטקסט לנרמול
 * @param options אפשרויות חיפוש חכם
 * @returns הטקסט המנורמל
 */
export function normalizeText(text: string, options: Partial<SmartSearchOptions> = {}): string {
  let normalized = text.toLowerCase();
  
  if (options.ignoreNikud) {
    normalized = removeNikud(normalized);
  }
  
  if (options.sofitEquivalence) {
    normalized = normalizeSofitLetters(normalized);
  }
  
  return normalized;
}

/**
 * בדיקת כלל מיקום יחסי
 * @param segment הטקסט לבדיקה
 * @param rule הכלל לבדיקה
 * @returns האם הטקסט עומד בכלל
 */
export function checkPositionRule(segment: string, rule: PositionRule): boolean {
  const words = segment.toLowerCase().split(/\s+/);
  const wordIndex = words.findIndex(w => w.includes(rule.word.toLowerCase()));
  const relativeIndex = words.findIndex(w => w.includes(rule.relativeWord.toLowerCase()));
  
  if (wordIndex === -1 || relativeIndex === -1) {
    return false;
  }
  
  const distance = Math.abs(wordIndex - relativeIndex);
  const maxDist = rule.maxDistance || 10;
  
  if (distance > maxDist) {
    return false;
  }
  
  switch (rule.position) {
    case 'before':
      return wordIndex < relativeIndex;
    case 'after':
      return wordIndex > relativeIndex;
    case 'anywhere':
      return true;
    default:
      return true;
  }
}

/**
 * בדיקת כלל מיקום בשורה
 * @param segment הטקסט לבדיקה
 * @param rule הכלל לבדיקה
 * @returns האם הטקסט עומד בכלל
 */
export function checkTextPositionRule(segment: string, rule: TextPositionRule): boolean {
  const words = segment.toLowerCase().split(/\s+/).filter(w => w.trim());
  const wordLower = rule.word.toLowerCase();
  const withinWords = rule.withinWords || 3;
  
  switch (rule.position) {
    case 'start': {
      const startWords = words.slice(0, withinWords);
      return startWords.some(w => w.includes(wordLower));
    }
    case 'end': {
      const endWords = words.slice(-withinWords);
      return endWords.some(w => w.includes(wordLower));
    }
    case 'anywhere':
      return words.some(w => w.includes(wordLower));
    default:
      return true;
  }
}

/**
 * בדיקת כללי סינון על טקסט
 * @param segment הטקסט לבדיקה
 * @param rules כללי הסינון
 * @returns האם הטקסט עומד בכל הכללים
 */
export function checkFilterRules(segment: string, rules: FilterRules): boolean {
  const words = segment.toLowerCase().split(/\s+/).filter(w => w.trim());
  
  // בדיקת ספירת מילים
  if (rules.minWordCount && words.length < rules.minWordCount) {
    return false;
  }
  if (rules.maxWordCount && words.length > rules.maxWordCount) {
    return false;
  }
  
  // בדיקת מספרים
  if (rules.mustContainNumbers && !/\d/.test(segment)) {
    return false;
  }
  
  // בדיקת אותיות בלבד
  if (rules.mustContainLettersOnly && /\d/.test(segment)) {
    return false;
  }
  
  // בדיקת כללי מיקום יחסי
  for (const rule of rules.positionRules) {
    if (rule.word && rule.relativeWord) {
      if (!checkPositionRule(segment, rule)) {
        return false;
      }
    }
  }
  
  // בדיקת כללי מיקום בשורה
  for (const rule of rules.textPositionRules) {
    if (rule.word) {
      if (!checkTextPositionRule(segment, rule)) {
        return false;
      }
    }
  }
  
  return true;
}

/**
 * פיצול טקסט לקטעים
 * @param text הטקסט לפיצול
 * @returns מערך של קטעים
 */
export function splitTextToSegments(text: string): string[] {
  return text.split(/[\n]+/).filter(s => s.trim());
}

/**
 * בדיקת התאמה לתנאי חיפוש בודד
 * @param text הטקסט לבדיקה
 * @param condition תנאי החיפוש
 * @param options אפשרויות חיפוש חכם
 * @returns האם יש התאמה
 */
export function matchesCondition(
  text: string, 
  condition: SearchCondition,
  options: Partial<SmartSearchOptions> = {}
): boolean {
  if (!condition.term.trim()) return true;
  
  const normalizedText = normalizeText(text, options);
  const normalizedTerm = normalizeText(condition.term, options);
  
  return normalizedText.includes(normalizedTerm);
}

/**
 * חיפוש בטקסט עם תנאים מרובים
 * @param text הטקסט לחיפוש
 * @param conditions תנאי החיפוש
 * @param options אפשרויות חיפוש חכם
 * @returns האם הטקסט עומד בתנאים
 */
export function searchWithConditions(
  text: string,
  conditions: SearchCondition[],
  options: Partial<SmartSearchOptions> = {}
): boolean {
  if (conditions.length === 0) return true;
  
  let result = matchesCondition(text, conditions[0], options);
  
  for (let i = 1; i < conditions.length; i++) {
    const condition = conditions[i];
    const matches = matchesCondition(text, condition, options);
    
    switch (condition.operator) {
      case 'AND':
        result = result && matches;
        break;
      case 'OR':
        result = result || matches;
        break;
      case 'NOT':
        result = result && !matches;
        break;
      default:
        result = result && matches;
    }
  }
  
  return result;
}

/**
 * מציאת מילים עם אותו ערך גימטריא
 * @param targetValue ערך הגימטריא המבוקש
 * @param words מילון מילים לחיפוש
 * @returns מילים עם אותו ערך
 */
export function findWordsByGematria(targetValue: number, words: string[]): string[] {
  return words.filter(word => calculateGematria(word) === targetValue);
}

/**
 * הדגשת מילות חיפוש בטקסט
 * @param text הטקסט
 * @param searchTerms מילות החיפוש
 * @returns הטקסט עם תגיות HTML להדגשה
 */
export function highlightSearchTerms(text: string, searchTerms: string[]): string {
  let result = text;
  
  for (const term of searchTerms) {
    if (!term.trim()) continue;
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedTerm})`, 'gi');
    result = result.replace(regex, '<mark>$1</mark>');
  }
  
  return result;
}
