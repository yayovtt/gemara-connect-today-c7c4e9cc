/**
 * Converts a number to Hebrew letters (Gematria)
 * Examples: 1 -> א, 2 -> ב, 10 -> י, 15 -> ט"ו
 */
export function toHebrewNumeral(num: number): string {
  if (num <= 0 || num > 9999) return String(num);

  const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
  const hundreds = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק'];
  const thousands = ['', 'א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ז׳', 'ח׳', 'ט׳'];

  let result = '';
  
  // Thousands
  const thousandsDigit = Math.floor(num / 1000);
  if (thousandsDigit > 0) {
    result += thousands[thousandsDigit];
    num %= 1000;
  }

  // Hundreds
  const hundredsDigit = Math.floor(num / 100);
  if (hundredsDigit > 0) {
    result += hundreds[hundredsDigit];
    num %= 100;
  }

  // Special cases for 15 and 16 (ט"ו, ט"ז instead of יה, יו which spell God's name)
  if (num === 15) {
    result += 'ט״ו';
  } else if (num === 16) {
    result += 'ט״ז';
  } else {
    // Tens
    const tensDigit = Math.floor(num / 10);
    if (tensDigit > 0) {
      result += tens[tensDigit];
      num %= 10;
    }

    // Ones
    if (num > 0) {
      result += ones[num];
    }
  }

  // Add gershayim (") for multi-letter numbers or geresh (') for single letter
  if (result.length > 1 && !result.includes('״') && !result.includes('׳')) {
    result = result.slice(0, -1) + '״' + result.slice(-1);
  } else if (result.length === 1) {
    result += '׳';
  }

  return result;
}

/**
 * Converts Hebrew numeral back to a number
 * Examples: "ב" -> 2, "כג" -> 23, "ט״ו" -> 15
 */
export function fromHebrewNumeral(hebrewNum: string): number | null {
  if (!hebrewNum) return null;

  // Remove gershayim and geresh
  const cleaned = hebrewNum.replace(/[״׳]/g, '').trim();
  
  const onesMap: Record<string, number> = {
    'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5,
    'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9
  };
  
  const tensMap: Record<string, number> = {
    'י': 10, 'כ': 20, 'ל': 30, 'מ': 40, 'נ': 50,
    'ס': 60, 'ע': 70, 'פ': 80, 'צ': 90
  };
  
  const hundredsMap: Record<string, number> = {
    'ק': 100, 'ר': 200, 'ש': 300, 'ת': 400,
    'תק': 500, 'תר': 600, 'תש': 700, 'תת': 800, 'תתק': 900
  };

  let total = 0;
  let i = 0;

  // Check for hundreds
  if (cleaned.length >= 2) {
    const twoChar = cleaned.substring(i, i + 2);
    if (hundredsMap[twoChar]) {
      total += hundredsMap[twoChar];
      i += 2;
    } else if (hundredsMap[cleaned[i]]) {
      total += hundredsMap[cleaned[i]];
      i++;
    }
  } else if (hundredsMap[cleaned[i]]) {
    total += hundredsMap[cleaned[i]];
    i++;
  }

  // Check for tens
  if (i < cleaned.length && tensMap[cleaned[i]]) {
    total += tensMap[cleaned[i]];
    i++;
  }

  // Check for ones
  if (i < cleaned.length && onesMap[cleaned[i]]) {
    total += onesMap[cleaned[i]];
  }

  return total > 0 ? total : null;
}

/**
 * Hebrew number words mapping
 */
const HEBREW_UNITS: Record<string, number> = {
  'אחת': 1, 'אחד': 1, 'שתיים': 2, 'שניים': 2, 'שתים': 2, 'שנים': 2,
  'שלוש': 3, 'שלושה': 3, 'ארבע': 4, 'ארבעה': 4,
  'חמש': 5, 'חמישה': 5, 'שש': 6, 'שישה': 6,
  'שבע': 7, 'שבעה': 7, 'שמונה': 8, 'תשע': 9, 'תשעה': 9,
  'עשר': 10, 'עשרה': 10
};

const HEBREW_TENS: Record<string, number> = {
  'עשרים': 20, 'שלושים': 30, 'ארבעים': 40, 'חמישים': 50,
  'שישים': 60, 'שבעים': 70, 'שמונים': 80, 'תשעים': 90
};

const HEBREW_HUNDREDS: Record<string, number> = {
  'מאה': 100, 'מאתיים': 200, 'שלוש מאות': 300, 'ארבע מאות': 400,
  'חמש מאות': 500, 'שש מאות': 600, 'שבע מאות': 700,
  'שמונה מאות': 800, 'תשע מאות': 900
};

const TEEN_NUMBERS: Record<string, number> = {
  'אחת עשרה': 11, 'אחד עשר': 11,
  'שתים עשרה': 12, 'שנים עשר': 12,
  'שלוש עשרה': 13, 'שלושה עשר': 13,
  'ארבע עשרה': 14, 'ארבעה עשר': 14,
  'חמש עשרה': 15, 'חמישה עשר': 15,
  'שש עשרה': 16, 'שישה עשר': 16,
  'שבע עשרה': 17, 'שבעה עשר': 17,
  'שמונה עשרה': 18, 'שמונה עשר': 18,
  'תשע עשרה': 19, 'תשעה עשר': 19
};

/**
 * Convert spelled-out Hebrew number words to numeric value
 * Examples: "מאה ואחת עשרה" -> 111, "תשעים" -> 90, "עשרים וחמש" -> 25
 */
export function fromHebrewWords(text: string): number | null {
  if (!text) return null;
  
  // Clean text
  const cleaned = text.trim().replace(/\s+/g, ' ');
  
  // Check for teens first (must be before units check)
  for (const [word, value] of Object.entries(TEEN_NUMBERS)) {
    if (cleaned.includes(word)) {
      // If it's just the teen number
      if (cleaned === word) return value;
      
      // Check for hundreds + teen
      for (const [hundredWord, hundredValue] of Object.entries(HEBREW_HUNDREDS)) {
        if (cleaned.includes(hundredWord)) {
          return hundredValue + value;
        }
      }
      return value;
    }
  }
  
  let total = 0;
  let remaining = cleaned;
  
  // Check hundreds
  for (const [word, value] of Object.entries(HEBREW_HUNDREDS)) {
    if (remaining.includes(word)) {
      total += value;
      remaining = remaining.replace(word, '').trim();
      break;
    }
  }
  
  // Check tens
  for (const [word, value] of Object.entries(HEBREW_TENS)) {
    if (remaining.includes(word)) {
      total += value;
      remaining = remaining.replace(word, '').trim();
      break;
    }
  }
  
  // Check units (handle ו prefix)
  remaining = remaining.replace(/^ו/, '').trim();
  for (const [word, value] of Object.entries(HEBREW_UNITS)) {
    if (remaining.includes(word)) {
      total += value;
      break;
    }
  }
  
  return total > 0 ? total : null;
}

/**
 * Convert number to spelled-out Hebrew words
 * Examples: 111 -> "מאה ואחת עשרה", 90 -> "תשעים", 25 -> "עשרים וחמש"
 */
export function toHebrewWords(num: number): string | null {
  if (num <= 0 || num > 999) return null;
  
  const unitsF = ['', 'אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע'];
  const tensWords = ['', 'עשר', 'עשרים', 'שלושים', 'ארבעים', 'חמישים', 'שישים', 'שבעים', 'שמונים', 'תשעים'];
  const teensF = ['עשר', 'אחת עשרה', 'שתים עשרה', 'שלוש עשרה', 'ארבע עשרה', 'חמש עשרה', 
                  'שש עשרה', 'שבע עשרה', 'שמונה עשרה', 'תשע עשרה'];
  const hundredsWords = ['', 'מאה', 'מאתיים', 'שלוש מאות', 'ארבע מאות', 'חמש מאות', 
                         'שש מאות', 'שבע מאות', 'שמונה מאות', 'תשע מאות'];
  
  const parts: string[] = [];
  
  const h = Math.floor(num / 100);
  if (h > 0) {
    parts.push(hundredsWords[h]);
    num %= 100;
  }
  
  if (num >= 10 && num < 20) {
    parts.push(teensF[num - 10]);
  } else {
    const t = Math.floor(num / 10);
    const u = num % 10;
    
    if (t > 0) {
      parts.push(tensWords[t]);
    }
    
    if (u > 0) {
      if (parts.length > 0) {
        parts.push('ו' + unitsF[u]);
      } else {
        parts.push(unitsF[u]);
      }
    }
  }
  
  return parts.join(' ') || null;
}

/**
 * Find all numbers in text and return all equivalent forms
 * Used for search normalization
 */
export function findNumberVariants(text: string): Map<string, string[]> {
  const variants = new Map<string, string[]>();
  
  // Find Arabic numerals
  const arabicMatches = text.match(/\b\d+\b/g) || [];
  for (const match of arabicMatches) {
    const num = parseInt(match, 10);
    if (num > 0 && num <= 999) {
      const hebrew = toHebrewNumeral(num);
      const words = toHebrewWords(num);
      const allForms = [match, hebrew];
      if (words) allForms.push(words);
      variants.set(match, allForms);
    }
  }
  
  // Find Hebrew gematria (letters with geresh/gershayim)
  const gematriaPattern = /[א-ת]+[״׳]/g;
  const gematriaMatches = text.match(gematriaPattern) || [];
  for (const match of gematriaMatches) {
    const num = fromHebrewNumeral(match);
    if (num && num > 0 && num <= 999) {
      const arabic = String(num);
      const words = toHebrewWords(num);
      const allForms = [match, arabic, toHebrewNumeral(num)];
      if (words) allForms.push(words);
      variants.set(match, allForms);
    }
  }
  
  // Find Hebrew word numbers (more complex patterns)
  for (const [word, value] of Object.entries({ ...HEBREW_TENS, ...HEBREW_HUNDREDS })) {
    if (text.includes(word)) {
      const arabic = String(value);
      const hebrew = toHebrewNumeral(value);
      variants.set(word, [word, arabic, hebrew]);
    }
  }
  
  return variants;
}

/**
 * Expand search query to include all number variants
 * Returns array of equivalent search terms
 */
export function expandNumbersInQuery(query: string): string[] {
  const results: string[] = [query];
  
  // Check if query contains a number
  const arabicMatch = query.match(/\b(\d+)\b/);
  if (arabicMatch) {
    const num = parseInt(arabicMatch[1], 10);
    if (num > 0 && num <= 999) {
      // Add gematria variant
      results.push(query.replace(arabicMatch[1], toHebrewNumeral(num)));
      // Add word variant
      const words = toHebrewWords(num);
      if (words) {
        results.push(query.replace(arabicMatch[1], words));
      }
    }
  }
  
  // Check for gematria
  const gematriaMatch = query.match(/([א-ת]+[״׳])/);
  if (gematriaMatch) {
    const num = fromHebrewNumeral(gematriaMatch[1]);
    if (num && num > 0 && num <= 999) {
      results.push(query.replace(gematriaMatch[1], String(num)));
      const words = toHebrewWords(num);
      if (words) {
        results.push(query.replace(gematriaMatch[1], words));
      }
    }
  }
  
  // Check for Hebrew word numbers
  for (const [word, value] of Object.entries({ ...HEBREW_TENS, ...HEBREW_HUNDREDS, ...TEEN_NUMBERS })) {
    if (query.includes(word)) {
      results.push(query.replace(word, String(value)));
      results.push(query.replace(word, toHebrewNumeral(value)));
    }
  }
  
  return [...new Set(results)]; // Remove duplicates
}

/**
 * Converts daf format to Hebrew
 * Examples: "2a" -> "ב ע\"א", "10b" -> "י ע\"ב"
 */
export function toDafFormat(dafNumber: number, side: 'a' | 'b' = 'a'): string {
  const hebrewNum = toHebrewNumeral(dafNumber);
  const sideText = side === 'a' ? 'ע״א' : 'ע״ב';
  return `${hebrewNum} ${sideText}`;
}
