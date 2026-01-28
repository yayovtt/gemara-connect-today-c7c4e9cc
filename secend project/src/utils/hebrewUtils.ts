// Hebrew Gematria - number to letter conversion
const hebrewLetters: Record<number, string> = {
  1: 'א', 2: 'ב', 3: 'ג', 4: 'ד', 5: 'ה', 6: 'ו', 7: 'ז', 8: 'ח', 9: 'ט',
  10: 'י', 20: 'כ', 30: 'ל', 40: 'מ', 50: 'נ', 60: 'ס', 70: 'ע', 80: 'פ', 90: 'צ',
  100: 'ק', 200: 'ר', 300: 'ש', 400: 'ת',
};

const letterToNumber: Record<string, number> = {
  'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9,
  'י': 10, 'כ': 20, 'ך': 20, 'ל': 30, 'מ': 40, 'ם': 40, 'נ': 50, 'ן': 50,
  'ס': 60, 'ע': 70, 'פ': 80, 'ף': 80, 'צ': 90, 'ץ': 90,
  'ק': 100, 'ר': 200, 'ש': 300, 'ת': 400,
};

// מיפוי אותיות סופיות לרגילות
const sofitToRegular: Record<string, string> = {
  'ך': 'כ',
  'ם': 'מ',
  'ן': 'נ',
  'ף': 'פ',
  'ץ': 'צ',
};

const regularToSofit: Record<string, string> = {
  'כ': 'ך',
  'מ': 'ם',
  'נ': 'ן',
  'פ': 'ף',
  'צ': 'ץ',
};

// ראשי תיבות נפוצים
const commonAcronyms: Record<string, string[]> = {
  'רמב"ם': ['רבי משה בן מימון', 'רבינו משה בן מימון'],
  'רש"י': ['רבי שלמה יצחקי', 'רבינו שלמה יצחקי'],
  'ר"ת': ['רבינו תם', 'ראשי תיבות'],
  'ר"י': ['רבי יוחנן', 'רבינו יונה'],
  'ר"מ': ['ראש מתיבתא', 'רבי מאיר'],
  'ר"ע': ['רבי עקיבא'],
  'ר"א': ['רבי אליעזר', 'רבי אלעזר'],
  'ר"ש': ['רבי שמעון'],
  'ר"ן': ['רבינו נסים'],
  'ריטב"א': ['רבי יום טוב בן אברהם'],
  'רשב"א': ['רבי שלמה בן אדרת'],
  'רשב"ם': ['רבי שמואל בן מאיר'],
  'ראב"ע': ['רבי אברהם בן עזרא'],
  'ראב"ד': ['רבי אברהם בן דוד'],
  'מהר"ל': ['מורנו הרב רבי ליווא'],
  'הגר"א': ['הגאון רבי אליהו'],
  'חז"ל': ['חכמינו זכרונם לברכה'],
  'ז"ל': ['זכרונו לברכה', 'זיכרונו לברכה'],
  'זצ"ל': ['זכר צדיק לברכה'],
  'שליט"א': ['שיחיה לאורך ימים טובים אמן'],
  'ע"ה': ['עליו השלום', 'עליה השלום'],
  'ע"א': ['עמוד א', 'ערך א'],
  'ע"ב': ['עמוד ב', 'ערך ב'],
  'ד"ה': ['דיבור המתחיל'],
  'וכו\'': ['וכולי', 'וכו׳'],
  'ב"ה': ['ברוך השם', 'בעזרת השם', 'בית הלל'],
  'ב"ש': ['בית שמאי'],
  'או"ח': ['אורח חיים'],
  'יו"ד': ['יורה דעה'],
  'חו"מ': ['חושן משפט'],
  'אה"ע': ['אבן העזר'],
};

// Convert number to Hebrew letters (Gematria)
export function numberToHebrew(num: number): string {
  if (num <= 0 || num > 999) return '';
  
  let result = '';
  
  // Handle hundreds
  const hundreds = Math.floor(num / 100) * 100;
  if (hundreds > 0 && hebrewLetters[hundreds]) {
    result += hebrewLetters[hundreds];
  }
  
  // Handle tens and units
  const remainder = num % 100;
  
  // Special cases for 15 and 16 (טו, טז instead of יה, יו)
  if (remainder === 15) {
    result += 'טו';
  } else if (remainder === 16) {
    result += 'טז';
  } else {
    const tens = Math.floor(remainder / 10) * 10;
    const units = remainder % 10;
    
    if (tens > 0 && hebrewLetters[tens]) {
      result += hebrewLetters[tens];
    }
    if (units > 0 && hebrewLetters[units]) {
      result += hebrewLetters[units];
    }
  }
  
  return result;
}

// Convert Hebrew letters to number
export function hebrewToNumber(str: string): number {
  let total = 0;
  for (const char of str) {
    if (letterToNumber[char]) {
      total += letterToNumber[char];
    }
  }
  return total;
}

// הסרת ניקוד מטקסט
export function removeNikud(text: string): string {
  // טווח תווי הניקוד העבריים: U+0591 עד U+05C7
  return text.replace(/[\u0591-\u05C7]/g, '');
}

// נרמול אותיות סופיות (ממיר סופיות לרגילות)
export function normalizeSofitLetters(text: string): string {
  let result = '';
  for (const char of text) {
    result += sofitToRegular[char] || char;
  }
  return result;
}

// יצירת וריאציות עם אותיות סופיות
export function getSofitVariations(word: string): string[] {
  const variations: string[] = [word];
  
  // המר כל אות סופית לרגילה ולהיפך
  let normalized = '';
  let withSofit = '';
  
  for (let i = 0; i < word.length; i++) {
    const char = word[i];
    const isLastChar = i === word.length - 1;
    
    if (sofitToRegular[char]) {
      // אות סופית - הוסף גם רגילה
      normalized += sofitToRegular[char];
      withSofit += char;
    } else if (regularToSofit[char] && isLastChar) {
      // אות רגילה בסוף מילה - הוסף גם סופית
      normalized += char;
      withSofit += regularToSofit[char];
    } else {
      normalized += char;
      withSofit += char;
    }
  }
  
  if (normalized !== word) variations.push(normalized);
  if (withSofit !== word) variations.push(withSofit);
  
  return [...new Set(variations)];
}

// חישוב גימטריא של מילה
export function calculateGematria(word: string): number {
  const cleanWord = removeNikud(word);
  return hebrewToNumber(cleanWord);
}

// מציאת מילים עם אותו ערך גימטריא נפוצות
export function getGematriaEquivalents(word: string): string[] {
  const value = calculateGematria(word);
  const equivalents: string[] = [];
  
  // מילים נפוצות עם ערכי גימטריא ידועים
  const knownGematrias: Record<number, string[]> = {
    26: ['יהוה', 'כו'],
    86: ['אלהים'],
    17: ['טוב'],
    18: ['חי', 'יח'],
    13: ['אחד', 'אהבה'],
    44: ['דם', 'ילד'],
    50: ['כל', 'מי', 'ים', 'לב'],
    72: ['חסד'],
    314: ['שדי'],
    541: ['ישראל'],
    358: ['משיח', 'נחש'],
  };
  
  if (knownGematrias[value]) {
    equivalents.push(...knownGematrias[value].filter(w => w !== word));
  }
  
  return equivalents;
}

// הרחבת ראשי תיבות
export function expandAcronym(text: string): string[] {
  const expansions: string[] = [text];
  
  // חפש ראשי תיבות בטקסט
  for (const [acronym, meanings] of Object.entries(commonAcronyms)) {
    // בדוק אם הטקסט מכיל את ראש התיבות (עם או בלי גרשיים)
    const cleanAcronym = acronym.replace(/["'״׳]/g, '');
    const cleanText = text.replace(/["'״׳]/g, '');
    
    if (cleanText.includes(cleanAcronym) || text.includes(acronym)) {
      meanings.forEach(meaning => {
        expansions.push(text.replace(acronym, meaning));
        expansions.push(text.replace(cleanAcronym, meaning));
      });
    }
  }
  
  return [...new Set(expansions)];
}

// Generate all variations of a term (number <-> Hebrew letters)
export function generateVariations(term: string): string[] {
  const variations: string[] = [term];
  
  // Pattern: "דף X" or "עמוד X" where X is a number
  const pageNumPattern = /(דף|עמוד|פרק|סימן|סעיף|אות)\s*(\d+)/g;
  let match;
  
  while ((match = pageNumPattern.exec(term)) !== null) {
    const prefix = match[1];
    const num = parseInt(match[2]);
    const hebrewNum = numberToHebrew(num);
    
    if (hebrewNum) {
      // Add variation with Hebrew letters
      variations.push(term.replace(match[0], `${prefix} ${hebrewNum}`));
      variations.push(term.replace(match[0], `${prefix} ${hebrewNum}'`));
      variations.push(term.replace(match[0], `${prefix} ${hebrewNum}׳`));
    }
  }
  
  // Pattern: "דף X'" where X is Hebrew letters
  const pageHebrewPattern = /(דף|עמוד|פרק|סימן|סעיף|אות)\s*([א-ת]+)[׳'"]?/g;
  
  while ((match = pageHebrewPattern.exec(term)) !== null) {
    const prefix = match[1];
    const hebrewStr = match[2];
    const num = hebrewToNumber(hebrewStr);
    
    if (num > 0) {
      // Add variation with Arabic numerals
      variations.push(term.replace(match[0], `${prefix} ${num}`));
    }
  }
  
  return [...new Set(variations)];
}

// Common Hebrew word variations (singular/plural, with/without ה)
export function getWordVariations(word: string): string[] {
  const variations: string[] = [word];
  
  // Remove or add definite article ה
  if (word.startsWith('ה')) {
    variations.push(word.substring(1));
  } else {
    variations.push('ה' + word);
  }
  
  // Common plural endings
  if (word.endsWith('ים')) {
    variations.push(word.slice(0, -2)); // Remove ים
    variations.push(word.slice(0, -2) + 'ות'); // Change to ות
  } else if (word.endsWith('ות')) {
    variations.push(word.slice(0, -2)); // Remove ות
    variations.push(word.slice(0, -2) + 'ים'); // Change to ים
  } else {
    variations.push(word + 'ים');
    variations.push(word + 'ות');
  }
  
  return [...new Set(variations)];
}

// Expand search term with all smart variations
export function expandSearchTerm(term: string, options: {
  includeNumberVariations?: boolean;
  includeWordVariations?: boolean;
  ignoreNikud?: boolean;
  sofitEquivalence?: boolean;
  gematriaSearch?: boolean;
  acronymExpansion?: boolean;
}): string[] {
  let allVariations: string[] = [term];
  
  // הסרת ניקוד
  if (options.ignoreNikud) {
    const withoutNikud = removeNikud(term);
    if (withoutNikud !== term) {
      allVariations.push(withoutNikud);
    }
  }
  
  // המרת מספרים לאותיות עבריות
  if (options.includeNumberVariations) {
    const numVars = generateVariations(term);
    allVariations.push(...numVars);
  }
  
  // וריאציות מילים (יחיד/רבים, ה' הידיעה)
  if (options.includeWordVariations) {
    const wordVars = getWordVariations(term);
    allVariations.push(...wordVars);
  }
  
  // שקילות אותיות סופיות
  if (options.sofitEquivalence) {
    const sofitVars = getSofitVariations(term);
    allVariations.push(...sofitVars);
  }
  
  // חיפוש גימטריא
  if (options.gematriaSearch) {
    const gematriaVars = getGematriaEquivalents(term);
    allVariations.push(...gematriaVars);
  }
  
  // הרחבת ראשי תיבות
  if (options.acronymExpansion) {
    const acronymVars = expandAcronym(term);
    allVariations.push(...acronymVars);
  }
  
  return [...new Set(allVariations)];
}

// נרמול טקסט לחיפוש (מסיר ניקוד ומנרמל אותיות סופיות)
export function normalizeTextForSearch(text: string, options: {
  ignoreNikud?: boolean;
  sofitEquivalence?: boolean;
}): string {
  let result = text;
  
  if (options.ignoreNikud) {
    result = removeNikud(result);
  }
  
  if (options.sofitEquivalence) {
    result = normalizeSofitLetters(result);
  }
  
  return result;
}
