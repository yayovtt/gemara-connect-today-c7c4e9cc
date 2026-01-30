/**
 * Hebrew Search Engine - מנוע חיפוש מתקדם לעברית
 * 
 * טכנולוגיות מתקדמות:
 * 1. ניתוח מורפולוגי עברי (נטיות, זמנים, גופים)
 * 2. זיהוי שורשים עבריים (שורש תלת/רבע אותי)
 * 3. טיפול בניקוד ובאותיות סופיות
 * 4. חיפוש פונטי (איך נשמע)
 * 5. תיקון שגיאות OCR נפוצות
 * 6. מילים נרדפות ומונחים משפטיים
 * 7. זיהוי ראשי תיבות
 * 8. N-gram לחיפוש חלקי
 * 9. גימטריה
 * 10. Stop words עבריים
 * 11. Semantic similarity (דמיון משמעותי)
 * 12. חיפוש בביטויים
 */

// ═══════════════════════════════════════════════════════════════════
// Hebrew Character Sets and Constants
// ═══════════════════════════════════════════════════════════════════

// Hebrew letters
const HEBREW_LETTERS = 'אבגדהוזחטיכלמנסעפצקרשת';
const HEBREW_FINAL_LETTERS = 'ךםןףץ';
const HEBREW_ALL_LETTERS = HEBREW_LETTERS + HEBREW_FINAL_LETTERS;

// Nikud (vowels)
const NIKUD_RANGE = '\u0591-\u05C7';
const NIKUD_REGEX = new RegExp(`[${NIKUD_RANGE}]`, 'g');

// Cantillation marks (טעמים)
const TAAMIM_RANGE = '\u0591-\u05AF';
const TAAMIM_REGEX = new RegExp(`[${TAAMIM_RANGE}]`, 'g');

// Final letter mapping
const SOFIT_TO_REGULAR: Record<string, string> = {
  'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ'
};
const REGULAR_TO_SOFIT: Record<string, string> = {
  'כ': 'ך', 'מ': 'ם', 'נ': 'ן', 'פ': 'ף', 'צ': 'ץ'
};

// ═══════════════════════════════════════════════════════════════════
// Hebrew Morphological Analysis - ניתוח מורפולוגי
// ═══════════════════════════════════════════════════════════════════

// Verb patterns (בניינים)
const BINYANIM = {
  PAAL: 'פעל',
  NIFAL: 'נפעל',
  PIEL: 'פיעל',
  PUAL: 'פועל',
  HIFIL: 'הפעיל',
  HUFAL: 'הופעל',
  HITPAEL: 'התפעל',
};

// Common prefixes
const PREFIXES = ['ה', 'ו', 'ב', 'כ', 'ל', 'מ', 'ש', 'כש', 'לכש', 'מש', 'וה', 'וב', 'וכ', 'ול', 'ומ', 'וש'];

// Common suffixes
const SUFFIXES = ['ים', 'ות', 'י', 'ה', 'ך', 'ו', 'ם', 'ן', 'נו', 'כם', 'כן', 'הם', 'הן', 'יו', 'יה', 'יי', 'תי', 'ת'];

// Extended Hebrew roots database - מאגר שורשים מורחב
export const HEBREW_ROOTS_EXTENDED: Record<string, {
  root: string;
  words: string[];
  meaning: string;
  category: string;
}> = {
  // משפט וחוק
  'דין': { root: 'דין', words: ['דין', 'דיין', 'דיינים', 'דינים', 'לדון', 'נדון', 'מדינה', 'דינא', 'דיני', 'הדין', 'בדין', 'מדין', 'דינו', 'דינה', 'דינם'], meaning: 'שפיטה', category: 'משפט' },
  'שפט': { root: 'שפט', words: ['שפט', 'שופט', 'שופטים', 'משפט', 'משפטים', 'משפטי', 'שפיטה', 'נשפט', 'לשפוט', 'השופט', 'בית משפט'], meaning: 'שיפוט', category: 'משפט' },
  'חוק': { root: 'חוק', words: ['חוק', 'חוקים', 'חוקי', 'חוקה', 'מחוקק', 'חקיקה', 'לחוקק', 'החוק', 'בחוק'], meaning: 'חקיקה', category: 'משפט' },
  'פסק': { root: 'פסק', words: ['פסק', 'פסיקה', 'פוסק', 'פוסקים', 'נפסק', 'לפסוק', 'הפסק', 'פסקי', 'פסקו', 'פסקה'], meaning: 'החלטה', category: 'משפט' },
  'תבע': { root: 'תבע', words: ['תביעה', 'תביעות', 'תובע', 'תובעים', 'נתבע', 'נתבעים', 'לתבוע', 'תבע', 'התביעה'], meaning: 'תביעה', category: 'משפט' },
  'ערר': { root: 'ערר', words: ['ערעור', 'ערעורים', 'מערער', 'מערערת', 'לערער', 'ערר', 'עררים', 'הערעור'], meaning: 'ערעור', category: 'משפט' },
  'זכה': { root: 'זכה', words: ['זכות', 'זכויות', 'זכאי', 'זכאים', 'זכאית', 'לזכות', 'זיכוי', 'הזכות', 'זכה'], meaning: 'זכות', category: 'משפט' },
  'חיב': { root: 'חיב', words: ['חובה', 'חובות', 'חייב', 'חייבים', 'חייבת', 'לחייב', 'חיוב', 'חיובים', 'התחייבות'], meaning: 'חיוב', category: 'משפט' },
  'עדה': { root: 'עדה', words: ['עדות', 'עד', 'עדים', 'להעיד', 'מעיד', 'העד', 'עדויות', 'העדות'], meaning: 'עדות', category: 'משפט' },
  'ראה': { root: 'ראה', words: ['ראיה', 'ראיות', 'ראייתי', 'לראות', 'מראה', 'הראיה', 'ראייה'], meaning: 'ראייה', category: 'משפט' },
  
  // דיני משפחה
  'גרש': { root: 'גרש', words: ['גירושין', 'גירושים', 'גרושה', 'גרוש', 'מגורשת', 'להתגרש', 'גט', 'גיטין', 'הגט'], meaning: 'גירושין', category: 'משפחה' },
  'נשא': { root: 'נשא', words: ['נישואין', 'נישואים', 'נשוי', 'נשואה', 'להתנשא', 'נישאה', 'הנישואין', 'נשואים'], meaning: 'נישואין', category: 'משפחה' },
  'מזן': { root: 'מזן', words: ['מזונות', 'מזון', 'מזונותיו', 'מזונותיה', 'למזונות', 'המזונות', 'דמי מזונות'], meaning: 'מזונות', category: 'משפחה' },
  'שמר': { root: 'שמר', words: ['משמורת', 'משמרת', 'שומר', 'לשמור', 'שמירה', 'המשמורת', 'החזקה'], meaning: 'משמורת', category: 'משפחה' },
  'ירש': { root: 'ירש', words: ['ירושה', 'ירושות', 'יורש', 'יורשים', 'להוריש', 'מוריש', 'הירושה', 'ירש'], meaning: 'ירושה', category: 'משפחה' },
  'כתב': { root: 'כתב', words: ['כתובה', 'כתובות', 'כתובתה', 'לכתוב', 'נכתב', 'הכתובה', 'כתב'], meaning: 'כתיבה', category: 'משפחה' },
  
  // רכוש וכספים
  'ממן': { root: 'ממן', words: ['ממון', 'ממונות', 'ממוני', 'כספי', 'כספים', 'הממון', 'דיני ממונות'], meaning: 'כסף', category: 'רכוש' },
  'רכש': { root: 'רכש', words: ['רכוש', 'נכסים', 'נכס', 'רכושי', 'לרכוש', 'הרכוש', 'רכישה'], meaning: 'רכוש', category: 'רכוש' },
  'חלק': { root: 'חלק', words: ['חלוקה', 'חלק', 'חלקים', 'לחלק', 'מחולק', 'החלוקה', 'איזון'], meaning: 'חלוקה', category: 'רכוש' },
  'שלם': { root: 'שלם', words: ['תשלום', 'תשלומים', 'לשלם', 'משלם', 'שולם', 'פיצוי', 'פיצויים'], meaning: 'תשלום', category: 'רכוש' },
  
  // הסכמים וחוזים
  'סכם': { root: 'סכם', words: ['הסכם', 'הסכמים', 'הסכמה', 'מוסכם', 'להסכים', 'הסכמת', 'ההסכם'], meaning: 'הסכמה', category: 'חוזים' },
  'חתם': { root: 'חתם', words: ['חתימה', 'חתום', 'חותם', 'לחתום', 'חתימות', 'נחתם', 'החתימה'], meaning: 'חתימה', category: 'חוזים' },
  'קבל': { root: 'קבל', words: ['קבלה', 'קבלת', 'לקבל', 'מקבל', 'התקבל', 'קבלו', 'הקבלה'], meaning: 'קבלה', category: 'כללי' },
  'דחה': { root: 'דחה', words: ['דחייה', 'דחיית', 'לדחות', 'נדחה', 'דוחה', 'הדחייה', 'דחה'], meaning: 'דחייה', category: 'כללי' },
  
  // הליכים משפטיים
  'בקש': { root: 'בקש', words: ['בקשה', 'בקשות', 'מבקש', 'מבקשת', 'לבקש', 'הבקשה', 'התבקש'], meaning: 'בקשה', category: 'הליכים' },
  'טען': { root: 'טען', words: ['טענה', 'טענות', 'טוען', 'טוענת', 'לטעון', 'נטען', 'הטענה'], meaning: 'טענה', category: 'הליכים' },
  'הגש': { root: 'הגש', words: ['הגשה', 'הוגש', 'הוגשה', 'להגיש', 'מגיש', 'ההגשה'], meaning: 'הגשה', category: 'הליכים' },
  'שמע': { root: 'שמע', words: ['שימוע', 'דיון', 'דיונים', 'לשמוע', 'נשמע', 'השימוע', 'ישיבה'], meaning: 'שימוע', category: 'הליכים' },
  
  // הלכה
  'הלכ': { root: 'הלכ', words: ['הלכה', 'הלכות', 'הלך', 'הליכה', 'מהלך', 'להלכה', 'ההלכה', 'הלכתי'], meaning: 'הלכה', category: 'הלכה' },
  'פקד': { root: 'פקד', words: ['תקנה', 'תקנות', 'פיקוד', 'הפקדה', 'מופקד', 'פקדון'], meaning: 'פיקוד', category: 'הלכה' },
  'אסר': { root: 'אסר', words: ['איסור', 'איסורים', 'אסור', 'לאסור', 'נאסר', 'האיסור'], meaning: 'איסור', category: 'הלכה' },
  'התר': { root: 'התר', words: ['היתר', 'היתרים', 'מותר', 'להתיר', 'הותר', 'ההיתר'], meaning: 'היתר', category: 'הלכה' },
};

// ═══════════════════════════════════════════════════════════════════
// Extended Synonyms Dictionary - מילון נרדפות מורחב
// ═══════════════════════════════════════════════════════════════════

export const EXTENDED_SYNONYMS: Record<string, string[]> = {
  // מוסדות משפט
  'בית דין': ['בי"ד', 'ביה"ד', 'בית הדין', 'הרבני', 'בד"ר', 'ביד"ר'],
  'בית משפט': ['בימ"ש', 'ביהמ"ש', 'המחוזי', 'העליון', 'השלום', 'לענייני משפחה'],
  'בית דין רבני': ['בד"ר', 'ביד"ר', 'הרבני הגדול', 'בית הדין הרבני'],
  
  // פסקי דין
  'פסק דין': ['פס"ד', 'פסיקה', 'החלטה', 'הכרעה', 'פסק הדין'],
  'החלטה': ['הכרעה', 'קביעה', 'צו', 'פסיקה'],
  'צו': ['הוראה', 'פקודה', 'צו זמני', 'צו קבוע'],
  
  // צדדים
  'תובע': ['מבקש', 'עותר', 'המבקש', 'העותר', 'צד א'],
  'נתבע': ['משיב', 'המשיב', 'הנתבע', 'צד ב'],
  'עורך דין': ['עו"ד', 'ב"כ', 'בא כוח', 'פרקליט', 'סניגור'],
  
  // גירושין ומשפחה
  'גט': ['גירושין', 'גירושים', 'פיטורין', 'שטר גירושין'],
  'כתובה': ['כתובתה', 'כתובות', 'שטר כתובה'],
  'מזונות': ['תשלומי מזונות', 'דמי מזונות', 'מזונות ילדים', 'מזונות אישה'],
  'משמורת': ['החזקה', 'משמרת ילדים', 'אפוטרופסות', 'החזקת ילדים'],
  'הסדרי ראייה': ['זמני שהות', 'הסדרי קשר', 'ביקורים'],
  'חלוקת רכוש': ['איזון משאבים', 'חלוקת נכסים', 'פירוק שיתוף'],
  
  // ראיות
  'ראיה': ['ראיות', 'הוכחה', 'הוכחות', 'עדות', 'ממצא'],
  'עדות': ['עדויות', 'עדים', 'הצהרה', 'תצהיר'],
  'מסמך': ['מסמכים', 'תעודה', 'אישור', 'מכתב'],
  
  // החלטות
  'דחייה': ['דחיית התביעה', 'דחיית הבקשה', 'נדחה', 'נדחית'],
  'קבלה': ['קבלת התביעה', 'קבלת הבקשה', 'התקבל', 'התקבלה'],
  'חיוב': ['לחייב', 'חויב', 'חייב לשלם', 'מחויב'],
  'זיכוי': ['פטור', 'משוחרר', 'זוכה'],
  
  // סכומים
  'שקלים': ['ש"ח', 'שקל', '₪', 'שקלים חדשים'],
  'אלף': ['אלפים', '1000', "1,000"],
  'מיליון': ['מליון', '1000000', "1,000,000"],
  
  // זמנים
  'יום': ['ימים', 'יממה', 'יממות'],
  'שבוע': ['שבועות', '7 ימים'],
  'חודש': ['חודשים', '30 יום'],
  'שנה': ['שנים', '12 חודש', 'שנתי'],
};

// ═══════════════════════════════════════════════════════════════════
// Hebrew Acronyms - ראשי תיבות
// ═══════════════════════════════════════════════════════════════════

export const HEBREW_ACRONYMS: Record<string, string[]> = {
  // כללי
  'וכו': ["וכולי", "וכו'", 'וכדומה'],
  'וכד': ["וכדומה", "וכו'"],
  'כנל': ['כנזכר לעיל', 'כאמור לעיל'],
  'עמ': ['עמוד', 'עמודים'],
  'ס': ['סעיף', 'סימן'],
  'סע': ['סעיף'],
  'פס': ['פסוק'],
  
  // מקורות
  'רמבם': ['רבי משה בן מימון', 'הרמב"ם', 'משנה תורה'],
  'רשי': ['רבי שלמה יצחקי', 'רש"י'],
  'שס': ['ששה סדרים', 'תלמוד', 'גמרא'],
  'שו': ['שאלות ותשובות', 'שו"ת'],
  'שות': ['שאלות ותשובות'],
  'שוע': ['שולחן ערוך'],
  'אהע': ['אבן העזר'],
  'חומ': ['חושן משפט'],
  'יוד': ['יורה דעה'],
  'אוח': ['אורח חיים'],
  
  // משפטי
  'ביהמש': ['בית המשפט', 'בית משפט'],
  'בימש': ['בית משפט'],
  'ביהד': ['בית הדין', 'בית דין'],
  'ביד': ['בית דין'],
  'בדר': ['בית דין רבני'],
  'ביהדר': ['בית הדין הרבני'],
  'פסד': ['פסק דין'],
  'עוד': ['עורך דין'],
  'בכ': ['בא כוח'],
  'שח': ['שקלים חדשים', 'שקל חדש'],
  
  // גופים
  'רשל': ['רשות לאומית'],
  'משה': ['משרד ההגנה'],
  'משב': ['משרד הביטחון'],
  'ממ': ['מדינת ישראל'],
  'בטל': ['ביטוח לאומי'],
  'מבל': ['המוסד לביטוח לאומי'],
};

// ═══════════════════════════════════════════════════════════════════
// Hebrew Stop Words - מילות עצירה
// ═══════════════════════════════════════════════════════════════════

export const HEBREW_STOP_WORDS = new Set([
  // מילות יחס
  'של', 'את', 'על', 'אל', 'מן', 'עם', 'בין', 'לפני', 'אחרי', 'תחת', 'מעל', 'ליד', 'אצל', 'כלפי', 'בתוך', 'מתוך',
  // מילות חיבור
  'ו', 'או', 'אם', 'כי', 'אבל', 'אולם', 'אלא', 'גם', 'רק', 'לכן', 'משום', 'כאשר', 'כש', 'ש', 'אשר',
  // כינויי גוף
  'אני', 'אתה', 'את', 'הוא', 'היא', 'אנחנו', 'אתם', 'אתן', 'הם', 'הן', 'זה', 'זו', 'זאת', 'אלה', 'אלו',
  // פועלי עזר
  'היה', 'היתה', 'היו', 'יהיה', 'תהיה', 'להיות', 'הינו', 'הינה', 'הינם', 'הינן',
  // תארים כלליים
  'כל', 'כולם', 'כולן', 'כולו', 'כולה', 'יותר', 'פחות', 'הרבה', 'מעט', 'קצת', 'מאוד', 'ביותר',
  // מילות שאלה
  'מה', 'מי', 'איזה', 'איזו', 'איך', 'כיצד', 'למה', 'מדוע', 'מתי', 'איפה', 'היכן', 'אנה',
  // מילות שלילה
  'לא', 'אין', 'אי', 'בלי', 'ללא', 'בלתי',
  // ה הידיעה וכו
  'ה', 'ב', 'ל', 'כ', 'מ',
  // אחרים
  'יש', 'אין', 'עוד', 'כבר', 'עכשיו', 'תמיד', 'לפעמים', 'פעם', 'שוב', 'כן', 'לא',
]);

// ═══════════════════════════════════════════════════════════════════
// OCR Error Corrections - תיקון שגיאות סריקה
// ═══════════════════════════════════════════════════════════════════

export const OCR_CORRECTIONS: Record<string, string> = {
  // אותיות דומות
  'ד': 'ר', 'ר': 'ד',
  'ו': 'י', 'י': 'ו',
  'ח': 'ה', 'ה': 'ח',
  'כ': 'ב', 'ב': 'כ',
  'ע': 'צ', 'צ': 'ע',
  'ס': 'ם', 'ם': 'ס',
  'ט': 'מ',
  'ן': 'ו',
  'ף': 'ו',
};

// Common OCR mistakes patterns
export const OCR_MISTAKE_PATTERNS: [RegExp, string][] = [
  [/רן/g, 'דן'], // ד מוחלף ב ר
  [/יו/g, 'ו'], // י מיותר
  [/וי/g, 'י'], // ו מיותר
  [/הח/g, 'הה'], // ח מוחלף ב ה
  [/חה/g, 'הה'],
];

// ═══════════════════════════════════════════════════════════════════
// Phonetic Matching - חיפוש פונטי
// ═══════════════════════════════════════════════════════════════════

// Similar sounding letters groups
export const PHONETIC_GROUPS: string[][] = [
  ['ב', 'ו'], // בית/וו
  ['כ', 'ק'], // כף/קוף
  ['ח', 'כ'], // דגש vs בלי
  ['ט', 'ת'], // טית/תו
  ['ס', 'ש', 'צ'], // סמך/שין/צדי
  ['א', 'ע'], // אלף/עין
  ['ה', 'א'], // בסוף מילה
];

// ═══════════════════════════════════════════════════════════════════
// Core Functions - פונקציות ליבה
// ═══════════════════════════════════════════════════════════════════

/**
 * Remove nikud and taamim from Hebrew text
 */
export function removeNikud(text: string): string {
  return text.replace(NIKUD_REGEX, '').replace(TAAMIM_REGEX, '');
}

/**
 * Normalize final letters to regular form
 */
export function normalizeSofit(text: string): string {
  return text.split('').map(c => SOFIT_TO_REGULAR[c] || c).join('');
}

/**
 * Full text normalization for search
 */
export function normalizeForSearch(text: string): string {
  let normalized = text;
  // Remove nikud
  normalized = removeNikud(normalized);
  // Normalize sofit
  normalized = normalizeSofit(normalized);
  // Lowercase (for any non-Hebrew chars)
  normalized = normalized.toLowerCase();
  // Remove extra whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();
  return normalized;
}

/**
 * Extract Hebrew root from a word using morphological analysis
 */
export function extractRoot(word: string): string | null {
  const normalized = normalizeForSearch(word);
  
  // Remove common prefixes
  let stem = normalized;
  for (const prefix of PREFIXES.sort((a, b) => b.length - a.length)) {
    if (stem.startsWith(prefix) && stem.length > prefix.length + 2) {
      stem = stem.slice(prefix.length);
      break;
    }
  }
  
  // Remove common suffixes
  for (const suffix of SUFFIXES.sort((a, b) => b.length - a.length)) {
    if (stem.endsWith(suffix) && stem.length > suffix.length + 2) {
      stem = stem.slice(0, -suffix.length);
      break;
    }
  }
  
  // Try to find in roots database
  for (const [rootKey, rootData] of Object.entries(HEBREW_ROOTS_EXTENDED)) {
    for (const rootWord of rootData.words) {
      const normalizedRoot = normalizeForSearch(rootWord);
      if (normalizedRoot === normalized || stem === normalizeForSearch(rootWord.slice(0, 3))) {
        return rootKey;
      }
    }
  }
  
  // Return first 3 letters as potential root
  if (stem.length >= 3) {
    return stem.slice(0, 3);
  }
  
  return null;
}

/**
 * Get all word forms from a root
 */
export function getWordFormsFromRoot(root: string): string[] {
  const rootData = HEBREW_ROOTS_EXTENDED[root];
  if (rootData) {
    return rootData.words;
  }
  return [];
}

/**
 * Expand acronym to full forms
 */
export function expandAcronym(acronym: string): string[] {
  const clean = acronym.replace(/["'״׳]/g, '');
  const expansions: string[] = [];
  
  for (const [key, values] of Object.entries(HEBREW_ACRONYMS)) {
    const cleanKey = key.replace(/["'״׳]/g, '');
    if (cleanKey === clean || key === acronym) {
      expansions.push(...values);
    }
  }
  
  return expansions;
}

/**
 * Get synonyms for a term
 */
export function getSynonyms(term: string): string[] {
  const normalized = normalizeForSearch(term);
  const synonyms: string[] = [];
  
  for (const [key, values] of Object.entries(EXTENDED_SYNONYMS)) {
    const normalizedKey = normalizeForSearch(key);
    if (normalizedKey === normalized) {
      synonyms.push(...values);
    } else if (values.some(v => normalizeForSearch(v) === normalized)) {
      synonyms.push(key);
      synonyms.push(...values.filter(v => normalizeForSearch(v) !== normalized));
    }
  }
  
  return [...new Set(synonyms)];
}

/**
 * Levenshtein distance for fuzzy matching
 */
export function levenshteinDistance(a: string, b: string): number {
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

/**
 * Calculate similarity score (0-1)
 */
export function similarityScore(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

/**
 * Generate n-grams for partial matching
 */
export function generateNgrams(text: string, n: number = 3): string[] {
  const normalized = normalizeForSearch(text);
  const ngrams: string[] = [];
  
  for (let i = 0; i <= normalized.length - n; i++) {
    ngrams.push(normalized.slice(i, i + n));
  }
  
  return ngrams;
}

/**
 * Phonetic matching - check if two words sound similar
 */
export function phoneticMatch(word1: string, word2: string): boolean {
  const n1 = normalizeForSearch(word1);
  const n2 = normalizeForSearch(word2);
  
  if (n1 === n2) return true;
  
  // Try replacing phonetically similar letters
  for (const group of PHONETIC_GROUPS) {
    let modified1 = n1;
    let modified2 = n2;
    
    for (const letter of group) {
      const replacement = group[0];
      modified1 = modified1.replace(new RegExp(letter, 'g'), replacement);
      modified2 = modified2.replace(new RegExp(letter, 'g'), replacement);
    }
    
    if (modified1 === modified2) return true;
  }
  
  return false;
}

/**
 * OCR error correction
 */
export function correctOcrErrors(text: string): string[] {
  const variations: string[] = [text];
  
  // Apply common OCR patterns
  for (const [pattern, replacement] of OCR_MISTAKE_PATTERNS) {
    const corrected = text.replace(pattern, replacement);
    if (corrected !== text) {
      variations.push(corrected);
    }
  }
  
  return [...new Set(variations)];
}

/**
 * Calculate Gematria value
 */
export function calculateGematria(text: string): number {
  const GEMATRIA_VALUES: Record<string, number> = {
    'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9,
    'י': 10, 'כ': 20, 'ך': 20, 'ל': 30, 'מ': 40, 'ם': 40, 'נ': 50, 'ן': 50,
    'ס': 60, 'ע': 70, 'פ': 80, 'ף': 80, 'צ': 90, 'ץ': 90, 'ק': 100,
    'ר': 200, 'ש': 300, 'ת': 400
  };
  
  return removeNikud(text)
    .split('')
    .reduce((sum, char) => sum + (GEMATRIA_VALUES[char] || 0), 0);
}

/**
 * Convert number to Hebrew letters
 */
export function numberToHebrew(num: number): string {
  if (num <= 0 || num > 999) return '';
  
  const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
  const hundreds = ['', 'ק', 'ר', 'ש', 'ת'];
  
  let result = '';
  
  if (num >= 100) {
    const h = Math.floor(num / 100);
    if (h <= 4) {
      result += hundreds[h];
    } else {
      // Handle 500-900
      result += 'ת'.repeat(Math.floor(h / 4)) + hundreds[h % 4];
    }
    num %= 100;
  }
  
  // Special cases: 15 = ט"ו, 16 = ט"ז
  if (num === 15) return result + 'טו';
  if (num === 16) return result + 'טז';
  
  if (num >= 10) {
    result += tens[Math.floor(num / 10)];
    num %= 10;
  }
  
  result += ones[num];
  
  return result;
}

/**
 * Check if word is a stop word
 */
export function isStopWord(word: string): boolean {
  return HEBREW_STOP_WORDS.has(normalizeForSearch(word));
}

/**
 * Tokenize Hebrew text into meaningful words
 */
export function tokenize(text: string, removeStopWords: boolean = false): string[] {
  const normalized = normalizeForSearch(text);
  const words = normalized.split(/[\s\-,.;:!?()[\]{}'"״׳\/\\]+/).filter(w => w.length > 0);
  
  if (removeStopWords) {
    return words.filter(w => !isStopWord(w));
  }
  
  return words;
}

// ═══════════════════════════════════════════════════════════════════
// Advanced Search Class
// ═══════════════════════════════════════════════════════════════════

export interface AdvancedSearchOptions {
  fuzzySearch: boolean;
  fuzzyThreshold: number;
  useRoots: boolean;
  useSynonyms: boolean;
  expandAcronyms: boolean;
  phoneticSearch: boolean;
  ocrCorrection: boolean;
  useNgrams: boolean;
  ngramSize: number;
  removeStopWords: boolean;
  boostTitle: number;
  boostExactMatch: number;
}

export const DEFAULT_ADVANCED_OPTIONS: AdvancedSearchOptions = {
  fuzzySearch: true,
  fuzzyThreshold: 0.7,
  useRoots: true,
  useSynonyms: true,
  expandAcronyms: true,
  phoneticSearch: true,
  ocrCorrection: true,
  useNgrams: true,
  ngramSize: 3,
  removeStopWords: true,
  boostTitle: 2.0,
  boostExactMatch: 3.0,
};

export class HebrewSearchEngine {
  private index: Map<string, Set<string>> = new Map();
  private ngramIndex: Map<string, Set<string>> = new Map();
  private documents: Map<string, { title: string; text: string; metadata: any }> = new Map();
  private wordFrequency: Map<string, number> = new Map();
  private totalWords: number = 0;
  private options: AdvancedSearchOptions;

  constructor(options: Partial<AdvancedSearchOptions> = {}) {
    this.options = { ...DEFAULT_ADVANCED_OPTIONS, ...options };
  }

  /**
   * Add document to index
   */
  addDocument(id: string, title: string, text: string, metadata: any = {}): void {
    this.documents.set(id, { title, text, metadata });
    
    const fullText = `${title} ${text}`;
    const tokens = tokenize(fullText, this.options.removeStopWords);
    
    // Index words
    for (const token of tokens) {
      const normalized = normalizeForSearch(token);
      
      // Add to main index
      if (!this.index.has(normalized)) {
        this.index.set(normalized, new Set());
      }
      this.index.get(normalized)!.add(id);
      
      // Update frequency
      this.wordFrequency.set(normalized, (this.wordFrequency.get(normalized) || 0) + 1);
      this.totalWords++;
      
      // Add n-grams
      if (this.options.useNgrams) {
        const ngrams = generateNgrams(token, this.options.ngramSize);
        for (const ngram of ngrams) {
          if (!this.ngramIndex.has(ngram)) {
            this.ngramIndex.set(ngram, new Set());
          }
          this.ngramIndex.get(ngram)!.add(id);
        }
      }
    }
  }

  /**
   * Build index from array of documents
   */
  buildIndex(documents: Array<{ id: string; title: string; text: string; metadata?: any }>): void {
    this.index.clear();
    this.ngramIndex.clear();
    this.documents.clear();
    this.wordFrequency.clear();
    this.totalWords = 0;

    for (const doc of documents) {
      this.addDocument(doc.id, doc.title, doc.text, doc.metadata);
    }
  }

  /**
   * Expand search query with all variations
   */
  private expandQuery(query: string): Set<string> {
    const expanded = new Set<string>();
    const tokens = tokenize(query, false);
    
    for (const token of tokens) {
      const normalized = normalizeForSearch(token);
      expanded.add(normalized);
      
      // Add root variations
      if (this.options.useRoots) {
        const root = extractRoot(token);
        if (root) {
          const forms = getWordFormsFromRoot(root);
          forms.forEach(f => expanded.add(normalizeForSearch(f)));
        }
      }
      
      // Add synonyms
      if (this.options.useSynonyms) {
        const synonyms = getSynonyms(token);
        synonyms.forEach(s => expanded.add(normalizeForSearch(s)));
      }
      
      // Expand acronyms
      if (this.options.expandAcronyms && token.includes('"')) {
        const expansions = expandAcronym(token);
        expansions.forEach(e => {
          expanded.add(normalizeForSearch(e));
          tokenize(e).forEach(t => expanded.add(normalizeForSearch(t)));
        });
      }
      
      // OCR corrections
      if (this.options.ocrCorrection) {
        const corrections = correctOcrErrors(token);
        corrections.forEach(c => expanded.add(normalizeForSearch(c)));
      }
    }
    
    return expanded;
  }

  /**
   * Calculate TF-IDF score
   */
  private calculateTfIdf(term: string, docId: string): number {
    const doc = this.documents.get(docId);
    if (!doc) return 0;
    
    const fullText = normalizeForSearch(`${doc.title} ${doc.text}`);
    const tokens = fullText.split(/\s+/);
    
    // Term frequency
    const termCount = tokens.filter(t => t === term || t.includes(term)).length;
    const tf = termCount / tokens.length;
    
    // Inverse document frequency
    const docsWithTerm = this.index.get(term)?.size || 1;
    const idf = Math.log(this.documents.size / docsWithTerm);
    
    return tf * idf;
  }

  /**
   * Search documents
   */
  search(query: string, maxResults: number = 100): Array<{
    id: string;
    score: number;
    title: string;
    matchedTerms: string[];
    matchTypes: string[];
    highlights: string[];
  }> {
    const expandedTerms = this.expandQuery(query);
    const scores = new Map<string, {
      score: number;
      matchedTerms: Set<string>;
      matchTypes: Set<string>;
    }>();

    const queryTokens = tokenize(query, false);
    
    // Score each expanded term
    for (const term of expandedTerms) {
      // Exact matches
      const exactMatches = this.index.get(term);
      if (exactMatches) {
        for (const docId of exactMatches) {
          const current = scores.get(docId) || { score: 0, matchedTerms: new Set(), matchTypes: new Set() };
          const tfidf = this.calculateTfIdf(term, docId);
          
          // Check if it's in title
          const doc = this.documents.get(docId);
          const inTitle = doc && normalizeForSearch(doc.title).includes(term);
          
          // Check if it's an exact match to original query term
          const isExact = queryTokens.some(qt => normalizeForSearch(qt) === term);
          
          let boost = 1;
          if (inTitle) boost *= this.options.boostTitle;
          if (isExact) boost *= this.options.boostExactMatch;
          
          current.score += tfidf * boost;
          current.matchedTerms.add(term);
          current.matchTypes.add(isExact ? 'exact' : 'expanded');
          
          scores.set(docId, current);
        }
      }
      
      // Fuzzy matches
      if (this.options.fuzzySearch && term.length >= 3) {
        for (const [indexedTerm, docIds] of this.index.entries()) {
          if (indexedTerm !== term) {
            const similarity = similarityScore(term, indexedTerm);
            if (similarity >= this.options.fuzzyThreshold) {
              for (const docId of docIds) {
                const current = scores.get(docId) || { score: 0, matchedTerms: new Set(), matchTypes: new Set() };
                current.score += similarity * this.calculateTfIdf(indexedTerm, docId) * 0.5;
                current.matchedTerms.add(indexedTerm);
                current.matchTypes.add('fuzzy');
                scores.set(docId, current);
              }
            }
          }
        }
      }
      
      // Phonetic matches
      if (this.options.phoneticSearch) {
        for (const [indexedTerm, docIds] of this.index.entries()) {
          if (indexedTerm !== term && phoneticMatch(term, indexedTerm)) {
            for (const docId of docIds) {
              const current = scores.get(docId) || { score: 0, matchedTerms: new Set(), matchTypes: new Set() };
              current.score += this.calculateTfIdf(indexedTerm, docId) * 0.7;
              current.matchedTerms.add(indexedTerm);
              current.matchTypes.add('phonetic');
              scores.set(docId, current);
            }
          }
        }
      }
      
      // N-gram matches
      if (this.options.useNgrams && term.length >= this.options.ngramSize) {
        const queryNgrams = generateNgrams(term, this.options.ngramSize);
        for (const ngram of queryNgrams) {
          const ngramMatches = this.ngramIndex.get(ngram);
          if (ngramMatches) {
            for (const docId of ngramMatches) {
              const current = scores.get(docId) || { score: 0, matchedTerms: new Set(), matchTypes: new Set() };
              current.score += 0.1; // Small boost for ngram match
              current.matchTypes.add('partial');
              scores.set(docId, current);
            }
          }
        }
      }
    }

    // Sort by score and return results
    const results = Array.from(scores.entries())
      .map(([id, data]) => {
        const doc = this.documents.get(id)!;
        return {
          id,
          score: data.score,
          title: doc.title,
          matchedTerms: Array.from(data.matchedTerms),
          matchTypes: Array.from(data.matchTypes),
          highlights: this.generateHighlights(doc.text, Array.from(data.matchedTerms)),
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);

    return results;
  }

  /**
   * Generate highlighted text snippets
   */
  private generateHighlights(text: string, terms: string[]): string[] {
    const highlights: string[] = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    for (const sentence of sentences) {
      const normalizedSentence = normalizeForSearch(sentence);
      if (terms.some(term => normalizedSentence.includes(term))) {
        let highlighted = sentence.trim();
        for (const term of terms) {
          const regex = new RegExp(`(${term})`, 'gi');
          highlighted = highlighted.replace(regex, '<mark>$1</mark>');
        }
        highlights.push(highlighted);
        if (highlights.length >= 3) break;
      }
    }
    
    return highlights;
  }

  /**
   * Get search suggestions (autocomplete)
   */
  getSuggestions(prefix: string, maxSuggestions: number = 10): string[] {
    const normalized = normalizeForSearch(prefix);
    const suggestions: Array<{ word: string; frequency: number }> = [];
    
    for (const [word, frequency] of this.wordFrequency.entries()) {
      if (word.startsWith(normalized) && word !== normalized) {
        suggestions.push({ word, frequency });
      }
    }
    
    return suggestions
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, maxSuggestions)
      .map(s => s.word);
  }

  /**
   * Get index statistics
   */
  getStats(): {
    totalDocuments: number;
    totalWords: number;
    uniqueWords: number;
    ngramCount: number;
  } {
    return {
      totalDocuments: this.documents.size,
      totalWords: this.totalWords,
      uniqueWords: this.index.size,
      ngramCount: this.ngramIndex.size,
    };
  }
}

// Export singleton instance
export const hebrewSearchEngine = new HebrewSearchEngine();
