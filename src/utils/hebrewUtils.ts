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

const sofitToRegular: Record<string, string> = {
  'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ',
};

const regularToSofit: Record<string, string> = {
  'כ': 'ך', 'מ': 'ם', 'נ': 'ן', 'פ': 'ף', 'צ': 'ץ',
};

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

export function numberToHebrew(num: number): string {
  if (num <= 0 || num > 999) return '';
  
  let result = '';
  const hundreds = Math.floor(num / 100) * 100;
  if (hundreds > 0 && hebrewLetters[hundreds]) {
    result += hebrewLetters[hundreds];
  }
  
  const remainder = num % 100;
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

export function hebrewToNumber(str: string): number {
  let total = 0;
  for (const char of str) {
    if (letterToNumber[char]) {
      total += letterToNumber[char];
    }
  }
  return total;
}

export function removeNikud(text: string): string {
  return text.replace(/[\u0591-\u05C7]/g, '');
}

export function normalizeSofitLetters(text: string): string {
  let result = '';
  for (const char of text) {
    result += sofitToRegular[char] || char;
  }
  return result;
}

export function getSofitVariations(word: string): string[] {
  const variations: string[] = [word];
  let normalized = '';
  let withSofit = '';
  
  for (let i = 0; i < word.length; i++) {
    const char = word[i];
    const isLastChar = i === word.length - 1;
    
    if (sofitToRegular[char]) {
      normalized += sofitToRegular[char];
      withSofit += char;
    } else if (regularToSofit[char] && isLastChar) {
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

export function calculateGematria(word: string): number {
  const cleanWord = removeNikud(word);
  return hebrewToNumber(cleanWord);
}

export function getGematriaEquivalents(word: string): string[] {
  const value = calculateGematria(word);
  const equivalents: string[] = [];
  
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

export function expandAcronym(text: string): string[] {
  const expansions: string[] = [text];
  
  for (const [acronym, meanings] of Object.entries(commonAcronyms)) {
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

export function generateVariations(term: string): string[] {
  const variations: string[] = [term];
  const pageNumPattern = /(דף|עמוד|פרק|סימן|סעיף|אות)\s*(\d+)/g;
  let match;
  
  while ((match = pageNumPattern.exec(term)) !== null) {
    const prefix = match[1];
    const num = parseInt(match[2]);
    const hebrewNum = numberToHebrew(num);
    
    if (hebrewNum) {
      variations.push(term.replace(match[0], `${prefix} ${hebrewNum}`));
      variations.push(term.replace(match[0], `${prefix} ${hebrewNum}'`));
      variations.push(term.replace(match[0], `${prefix} ${hebrewNum}׳`));
    }
  }
  
  const pageHebrewPattern = /(דף|עמוד|פרק|סימן|סעיף|אות)\s*([א-ת]+)[׳'"]?/g;
  
  while ((match = pageHebrewPattern.exec(term)) !== null) {
    const prefix = match[1];
    const hebrewStr = match[2];
    const num = hebrewToNumber(hebrewStr);
    
    if (num > 0) {
      variations.push(term.replace(match[0], `${prefix} ${num}`));
    }
  }
  
  return [...new Set(variations)];
}

export function getWordVariations(word: string): string[] {
  const variations: string[] = [word];
  
  if (word.startsWith('ה')) {
    variations.push(word.substring(1));
  } else {
    variations.push('ה' + word);
  }
  
  if (word.endsWith('ים')) {
    variations.push(word.slice(0, -2));
    variations.push(word.slice(0, -2) + 'ות');
  } else if (word.endsWith('ות')) {
    variations.push(word.slice(0, -2));
    variations.push(word.slice(0, -2) + 'ים');
  } else {
    variations.push(word + 'ים');
    variations.push(word + 'ות');
  }
  
  return [...new Set(variations)];
}

export function expandSearchTerm(term: string, options: {
  includeNumberVariations?: boolean;
  includeWordVariations?: boolean;
  ignoreNikud?: boolean;
  sofitEquivalence?: boolean;
  gematriaSearch?: boolean;
  acronymExpansion?: boolean;
}): string[] {
  const allVariations: string[] = [term];
  
  if (options.ignoreNikud) {
    const withoutNikud = removeNikud(term);
    if (withoutNikud !== term) {
      allVariations.push(withoutNikud);
    }
  }
  
  if (options.includeNumberVariations) {
    const numVars = generateVariations(term);
    allVariations.push(...numVars);
  }
  
  if (options.includeWordVariations) {
    const wordVars = getWordVariations(term);
    allVariations.push(...wordVars);
  }
  
  if (options.sofitEquivalence) {
    const sofitVars = getSofitVariations(term);
    allVariations.push(...sofitVars);
  }
  
  if (options.gematriaSearch) {
    const gematriaVars = getGematriaEquivalents(term);
    allVariations.push(...gematriaVars);
  }
  
  if (options.acronymExpansion) {
    const acronymVars = expandAcronym(term);
    allVariations.push(...acronymVars);
  }
  
  return [...new Set(allVariations)];
}

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
