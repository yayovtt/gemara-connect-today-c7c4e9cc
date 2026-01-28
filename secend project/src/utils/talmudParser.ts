// Talmud reference patterns and utilities

export interface TalmudReference {
  tractate: string;
  daf: number;
  amud: 'א' | 'ב';
  originalText: string;
  startIndex: number;
  endIndex: number;
}

// ============================================
// מסד נתונים של כל מסכתות הש"ס הבבלי
// עם מספר הדפים המקסימלי בכל מסכת
// ============================================
interface TractateInfo {
  name: string;           // שם המסכת בעברית
  nameEnglish: string;    // שם באנגלית
  maxDaf: number;         // מספר הדף האחרון
  seder: string;          // הסדר
  variants: string[];     // וריאציות כתיב
}

const TRACTATES_DATA: TractateInfo[] = [
  // סדר זרעים
  { name: 'ברכות', nameEnglish: 'Berakhot', maxDaf: 64, seder: 'זרעים', variants: ['ברכות', 'ברכ\'', 'ברכ׳', 'מס\' ברכות', 'מסכת ברכות'] },
  
  // סדר מועד
  { name: 'שבת', nameEnglish: 'Shabbat', maxDaf: 157, seder: 'מועד', variants: ['שבת', 'שב\'', 'שב׳', 'מס\' שבת', 'מסכת שבת'] },
  { name: 'עירובין', nameEnglish: 'Eruvin', maxDaf: 105, seder: 'מועד', variants: ['עירובין', 'עירוב\'', 'עירוב׳', 'ערובין', 'עירו\'', 'עירו׳'] },
  { name: 'פסחים', nameEnglish: 'Pesachim', maxDaf: 121, seder: 'מועד', variants: ['פסחים', 'פסח\'', 'פסח׳', 'פסחי\'', 'פסחי׳'] },
  { name: 'שקלים', nameEnglish: 'Shekalim', maxDaf: 22, seder: 'מועד', variants: ['שקלים', 'שקל\'', 'שקל׳', 'שקלי\'', 'שקלי׳'] },
  { name: 'יומא', nameEnglish: 'Yoma', maxDaf: 88, seder: 'מועד', variants: ['יומא', 'יומ\'', 'יומ׳'] },
  { name: 'סוכה', nameEnglish: 'Sukkah', maxDaf: 56, seder: 'מועד', variants: ['סוכה', 'סוכ\'', 'סוכ׳'] },
  { name: 'ביצה', nameEnglish: 'Beitzah', maxDaf: 40, seder: 'מועד', variants: ['ביצה', 'ביצ\'', 'ביצ׳'] },
  { name: 'ראש השנה', nameEnglish: 'Rosh Hashanah', maxDaf: 35, seder: 'מועד', variants: ['ראש השנה', 'ר"ה', 'ר״ה', 'רה"ש', 'רה״ש', 'ר\'\'ה', 'ראש-השנה'] },
  { name: 'תענית', nameEnglish: 'Taanit', maxDaf: 31, seder: 'מועד', variants: ['תענית', 'תענ\'', 'תענ׳', 'תעני\'', 'תעני׳'] },
  { name: 'מגילה', nameEnglish: 'Megillah', maxDaf: 32, seder: 'מועד', variants: ['מגילה', 'מגיל\'', 'מגיל׳', 'מגי\'', 'מגי׳'] },
  { name: 'מועד קטן', nameEnglish: 'Moed Katan', maxDaf: 29, seder: 'מועד', variants: ['מועד קטן', 'מו"ק', 'מו״ק', 'מ"ק', 'מ״ק', 'מוע"ק', 'מוע״ק'] },
  { name: 'חגיגה', nameEnglish: 'Chagigah', maxDaf: 27, seder: 'מועד', variants: ['חגיגה', 'חגיג\'', 'חגיג׳', 'חגי\'', 'חגי׳'] },
  
  // סדר נשים
  { name: 'יבמות', nameEnglish: 'Yevamot', maxDaf: 122, seder: 'נשים', variants: ['יבמות', 'יבמ\'', 'יבמ׳', 'יבמו\'', 'יבמו׳'] },
  { name: 'כתובות', nameEnglish: 'Ketubot', maxDaf: 112, seder: 'נשים', variants: ['כתובות', 'כתוב\'', 'כתוב׳', 'כתובו\'', 'כתובו׳'] },
  { name: 'נדרים', nameEnglish: 'Nedarim', maxDaf: 91, seder: 'נשים', variants: ['נדרים', 'נדר\'', 'נדר׳', 'נדרי\'', 'נדרי׳'] },
  { name: 'נזיר', nameEnglish: 'Nazir', maxDaf: 66, seder: 'נשים', variants: ['נזיר', 'נזי\'', 'נזי׳'] },
  { name: 'סוטה', nameEnglish: 'Sotah', maxDaf: 49, seder: 'נשים', variants: ['סוטה', 'סוט\'', 'סוט׳'] },
  { name: 'גיטין', nameEnglish: 'Gittin', maxDaf: 90, seder: 'נשים', variants: ['גיטין', 'גיט\'', 'גיט׳', 'גיטי\'', 'גיטי׳'] },
  { name: 'קידושין', nameEnglish: 'Kiddushin', maxDaf: 82, seder: 'נשים', variants: ['קידושין', 'קידוש\'', 'קידוש׳', 'קיד\'', 'קיד׳', 'קידושי\'', 'קידושי׳'] },
  
  // סדר נזיקין
  { name: 'בבא קמא', nameEnglish: 'Bava Kamma', maxDaf: 119, seder: 'נזיקין', variants: ['בבא קמא', 'ב"ק', 'ב״ק', 'בב"ק', 'בב״ק', 'ב\'\'ק', 'בבא-קמא'] },
  { name: 'בבא מציעא', nameEnglish: 'Bava Metzia', maxDaf: 119, seder: 'נזיקין', variants: ['בבא מציעא', 'ב"מ', 'ב״מ', 'בב"מ', 'בב״מ', 'ב\'\'מ', 'בבא-מציעא'] },
  { name: 'בבא בתרא', nameEnglish: 'Bava Batra', maxDaf: 176, seder: 'נזיקין', variants: ['בבא בתרא', 'ב"ב', 'ב״ב', 'בב"ב', 'בב״ב', 'ב\'\'ב', 'בבא-בתרא'] },
  { name: 'סנהדרין', nameEnglish: 'Sanhedrin', maxDaf: 113, seder: 'נזיקין', variants: ['סנהדרין', 'סנהד\'', 'סנהד׳', 'סנה\'', 'סנה׳', 'סנהדרי\'', 'סנהדרי׳'] },
  { name: 'מכות', nameEnglish: 'Makkot', maxDaf: 24, seder: 'נזיקין', variants: ['מכות', 'מכו\'', 'מכו׳'] },
  { name: 'שבועות', nameEnglish: 'Shevuot', maxDaf: 49, seder: 'נזיקין', variants: ['שבועות', 'שבוע\'', 'שבוע׳', 'שבועו\'', 'שבועו׳'] },
  { name: 'עבודה זרה', nameEnglish: 'Avodah Zarah', maxDaf: 76, seder: 'נזיקין', variants: ['עבודה זרה', 'ע"ז', 'ע״ז', 'עבו"ז', 'עבו״ז', 'ע\'\'ז', 'עבודה-זרה'] },
  { name: 'הוריות', nameEnglish: 'Horayot', maxDaf: 14, seder: 'נזיקין', variants: ['הוריות', 'הורי\'', 'הורי׳', 'הוריו\'', 'הוריו׳'] },
  
  // סדר קדשים
  { name: 'זבחים', nameEnglish: 'Zevachim', maxDaf: 120, seder: 'קדשים', variants: ['זבחים', 'זבח\'', 'זבח׳', 'זבחי\'', 'זבחי׳'] },
  { name: 'מנחות', nameEnglish: 'Menachot', maxDaf: 110, seder: 'קדשים', variants: ['מנחות', 'מנח\'', 'מנח׳', 'מנחו\'', 'מנחו׳'] },
  { name: 'חולין', nameEnglish: 'Chullin', maxDaf: 142, seder: 'קדשים', variants: ['חולין', 'חול\'', 'חול׳', 'חולי\'', 'חולי׳'] },
  { name: 'בכורות', nameEnglish: 'Bekhorot', maxDaf: 61, seder: 'קדשים', variants: ['בכורות', 'בכור\'', 'בכור׳', 'בכורו\'', 'בכורו׳'] },
  { name: 'ערכין', nameEnglish: 'Arachin', maxDaf: 34, seder: 'קדשים', variants: ['ערכין', 'ערכ\'', 'ערכ׳', 'ערכי\'', 'ערכי׳'] },
  { name: 'תמורה', nameEnglish: 'Temurah', maxDaf: 34, seder: 'קדשים', variants: ['תמורה', 'תמור\'', 'תמור׳'] },
  { name: 'כריתות', nameEnglish: 'Keritot', maxDaf: 28, seder: 'קדשים', variants: ['כריתות', 'כריתו\'', 'כריתו׳', 'כרית\'', 'כרית׳'] },
  { name: 'מעילה', nameEnglish: 'Meilah', maxDaf: 22, seder: 'קדשים', variants: ['מעילה', 'מעיל\'', 'מעיל׳'] },
  { name: 'תמיד', nameEnglish: 'Tamid', maxDaf: 33, seder: 'קדשים', variants: ['תמיד', 'תמי\'', 'תמי׳'] },
  
  // סדר טהרות
  { name: 'נדה', nameEnglish: 'Niddah', maxDaf: 73, seder: 'טהרות', variants: ['נדה', 'נד\'', 'נד׳'] },
];

// יצירת מפות גישה מהירה
const TRACTATE_BY_NAME: Map<string, TractateInfo> = new Map();
const TRACTATE_BY_VARIANT: Map<string, TractateInfo> = new Map();

// אתחול המפות
for (const tractate of TRACTATES_DATA) {
  TRACTATE_BY_NAME.set(tractate.name, tractate);
  for (const variant of tractate.variants) {
    TRACTATE_BY_VARIANT.set(variant, tractate);
  }
}

// ============================================
// המרת אותיות עבריות למספרים
// ============================================
const HEBREW_NUMERALS: Record<string, number> = {
  'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9,
  'י': 10, 'כ': 20, 'ך': 20, 'ל': 30, 'מ': 40, 'ם': 40, 'נ': 50, 'ן': 50,
  'ס': 60, 'ע': 70, 'פ': 80, 'ף': 80, 'צ': 90, 'ץ': 90, 'ק': 100,
  'ר': 200, 'ש': 300, 'ת': 400,
};

// המרת מספר עברי לערבי
export function hebrewToNumber(hebrew: string): number {
  // נקה גרשיים וסימנים
  const cleaned = hebrew.replace(/['"״׳\s]/g, '');
  
  // אם זה מספר ערבי - החזר אותו ישירות
  if (/^\d+$/.test(cleaned)) {
    return parseInt(cleaned, 10);
  }
  
  let total = 0;
  for (const char of cleaned) {
    if (HEBREW_NUMERALS[char]) {
      total += HEBREW_NUMERALS[char];
    }
  }
  return total;
}

// בדיקה אם הערך הוא מספר (עברי או ערבי) והחזרת הערך המספרי
export function parseNumber(value: string): number | null {
  const cleaned = value.replace(/['"״׳\s]/g, '').trim();
  
  if (!cleaned) return null;
  
  // מספר ערבי (73, 4, 120...)
  if (/^\d+$/.test(cleaned)) {
    return parseInt(cleaned, 10);
  }
  
  // מספר עברי (עג, ד, קכ...)
  if (/^[א-ת]+$/.test(cleaned)) {
    const num = hebrewToNumber(cleaned);
    return num > 0 ? num : null;
  }
  
  // מספר עברי עם גרשיים (ע"ג, ל"ב...)
  const hebrewWithQuotes = value.replace(/\s/g, '');
  if (/^[א-ת]+["״׳'][א-ת]*$/.test(hebrewWithQuotes)) {
    return hebrewToNumber(hebrewWithQuotes);
  }
  
  return null;
}

// בדיקת התאמה בין מספר עברי לערבי
// לדוגמה: 73 == עג, 4 == ד
export function numbersMatch(num1: string | number, num2: string | number): boolean {
  const n1 = typeof num1 === 'number' ? num1 : parseNumber(String(num1));
  const n2 = typeof num2 === 'number' ? num2 : parseNumber(String(num2));
  
  if (n1 === null || n2 === null) return false;
  return n1 === n2;
}

// המרה אוטומטית - מקבל כל פורמט ומחזיר מספר
export function normalizeToNumber(value: string | number): number | null {
  if (typeof value === 'number') return value;
  return parseNumber(value);
}

// בניית regex לזיהוי מסכתות
function buildTractatePattern(): string {
  const allVariants: string[] = [];
  for (const tractate of TRACTATES_DATA) {
    allVariants.push(...tractate.variants);
  }
  // מיון לפי אורך יורד כדי לתפוס קודם את הארוכים
  allVariants.sort((a, b) => b.length - a.length);
  return allVariants.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
}

// בדיקה שהמילה היא מילה שלמה ולא חלק ממילה אחרת
function isWholeWord(text: string, startIndex: number, endIndex: number): boolean {
  // בדיקת התו לפני ההתאמה
  if (startIndex > 0) {
    const charBefore = text[startIndex - 1];
    // אם התו לפני הוא אות עברית - זה לא מילה שלמה
    if (/[\u0590-\u05FF]/.test(charBefore)) {
      return false;
    }
  }
  
  // בדיקת התו אחרי ההתאמה
  if (endIndex < text.length) {
    const charAfter = text[endIndex];
    // אם התו אחרי הוא אות עברית - זה לא מילה שלמה
    if (/[\u0590-\u05FF]/.test(charAfter)) {
      return false;
    }
  }
  
  return true;
}

// נורמליזציה של שם מסכת לשם הסטנדרטי
export function normalizeTractate(variant: string): string {
  const cleaned = variant.trim();
  const tractate = TRACTATE_BY_VARIANT.get(cleaned);
  if (tractate) {
    return tractate.name;
  }
  
  // חיפוש חלקי
  for (const [key, info] of TRACTATE_BY_VARIANT) {
    if (cleaned.includes(key) || key.includes(cleaned)) {
      return info.name;
    }
  }
  
  return cleaned;
}

// קבלת מידע על מסכת
export function getTractateInfo(name: string): TractateInfo | undefined {
  return TRACTATE_BY_NAME.get(name) || TRACTATE_BY_VARIANT.get(name);
}

// וולידציה של מספר דף - בודק שהדף קיים במסכת
// תומך גם במספרים ערביים (73) וגם עבריים (עג)
export function isValidDaf(tractate: string, daf: number | string): boolean {
  // המרה למספר אם צריך
  const dafNum = typeof daf === 'number' ? daf : normalizeToNumber(daf);
  
  if (dafNum === null || isNaN(dafNum)) {
    return false;
  }
  
  const info = getTractateInfo(tractate);
  if (!info) {
    // מסכת לא מוכרת - נאפשר דפים עד 200 כברירת מחדל
    return dafNum >= 2 && dafNum <= 200;
  }
  // הדף הראשון במסכתות התלמוד הוא דף ב (2)
  return dafNum >= 2 && dafNum <= info.maxDaf;
}

// וולידציה של עמוד - יכול להיות רק א או ב
export function isValidAmud(amud: string): amud is 'א' | 'ב' {
  return amud === 'א' || amud === 'ב';
}

// קבלת כל המסכתות הזמינות
export function getAllTractates(): TractateInfo[] {
  return [...TRACTATES_DATA];
}

// קבלת מסכתות לפי סדר
export function getTractatesBySeder(seder: string): TractateInfo[] {
  return TRACTATES_DATA.filter(t => t.seder === seder);
}

// הוספת וריאציה חדשה למסכת קיימת
export function addTractateVariant(tractate: string, variant: string): boolean {
  const info = TRACTATE_BY_NAME.get(tractate);
  if (info && !info.variants.includes(variant)) {
    info.variants.push(variant);
    TRACTATE_BY_VARIANT.set(variant, info);
    return true;
  }
  return false;
}

// זיהוי מראי מקומות בטקסט
export function findTalmudReferences(text: string): TalmudReference[] {
  const references: TalmudReference[] = [];
  const tractatePattern = buildTractatePattern();
  
  // תבניות לזיהוי מראי מקומות
  const patterns = [
    // תבנית 1: מסכת + דף + עמוד מפורש
    new RegExp(
      `(${tractatePattern})\\s*(?:דף|ד[׳'])?\\s*([א-ת]+"?[א-ת]*|[א-ת][׳']?|\\d+)\\s*(?:עמוד|עמ[׳']?)?\\s*(?:ע["\u0022״׳']?)?([אב])`,
      'g'
    ),
    
    // תבנית 2: מסכת + מספר + נקודתיים (= עמוד ב)
    new RegExp(
      `(${tractatePattern})\\s*(?:דף|ד[׳'])?\\s*([א-ת]+"?[א-ת]*|[א-ת][׳']?|\\d+):(?![א-ת])`,
      'g'
    ),
    
    // תבנית 3: מסכת + מספר + נקודה (= עמוד א)
    new RegExp(
      `(${tractatePattern})\\s*(?:דף|ד[׳'])?\\s*([א-ת]+"?[א-ת]*|[א-ת][׳']?|\\d+)\\.(?![א-ת\\d])`,
      'g'
    ),
    
    // תבנית 4: מסכת + מספר:א/ב
    new RegExp(
      `(${tractatePattern})\\s*([א-ת]+"?[א-ת]*|\\d+):([אב])`,
      'g'
    ),
    
    // תבנית 5: מסכת + דף בלבד (ברירת מחדל: עמוד א)
    new RegExp(
      `(${tractatePattern})\\s*(?:דף|ד[׳'])?\\s*([א-ת]+"[א-ת]*|[א-ת][׳']|\\d+)(?![א-ת:])`,
      'g'
    ),
  ];

  const seenPositions = new Set<string>();

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const startIdx = match.index;
      const endIdx = match.index + match[0].length;
      
      // בדיקה שזו מילה שלמה
      if (!isWholeWord(text, startIdx, endIdx)) {
        continue;
      }
      
      const posKey = `${startIdx}-${match[0].length}`;
      if (seenPositions.has(posKey)) continue;
      seenPositions.add(posKey);

      const tractateVariant = match[1];
      const dafStr = match[2];
      let amudStr = match[3] || '';

      // זיהוי עמוד מתוך הטקסט המקורי
      const originalMatch = match[0];
      if (!amudStr) {
        if (originalMatch.includes(':') && !originalMatch.match(/:[אב]/)) {
          amudStr = 'ב';
        } else if (originalMatch.includes('.')) {
          amudStr = 'א';
        } else {
          amudStr = 'א';
        }
      }

      // המרת דף למספר
      let dafNum: number;
      if (/^\d+$/.test(dafStr)) {
        dafNum = parseInt(dafStr, 10);
      } else {
        dafNum = hebrewToNumber(dafStr);
      }

      const tractate = normalizeTractate(tractateVariant);
      
      // ===== וולידציה =====
      // בדיקה שהעמוד תקין (רק א או ב)
      const amud = amudStr === 'ב' ? 'ב' : 'א';
      if (!isValidAmud(amud)) {
        continue;
      }
      
      // בדיקה שהדף קיים במסכת
      if (!isValidDaf(tractate, dafNum)) {
        continue;
      }

      references.push({
        tractate,
        daf: dafNum,
        amud,
        originalText: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }
  }

  // מיון לפי מיקום בטקסט
  references.sort((a, b) => a.startIndex - b.startIndex);

  // הסרת כפילויות חופפות
  const unique: TalmudReference[] = [];
  for (const ref of references) {
    const overlaps = unique.some(
      u => (ref.startIndex >= u.startIndex && ref.startIndex < u.endIndex) ||
           (ref.endIndex > u.startIndex && ref.endIndex <= u.endIndex)
    );
    if (!overlaps) {
      unique.push(ref);
    }
  }

  return unique;
}

// פורמט תצוגה של מראה מקום
export function formatReference(ref: TalmudReference): string {
  return `${ref.tractate} ${ref.daf}${ref.amud}`;
}

// המרת מספר לאותיות עבריות
export function numberToHebrew(num: number): string {
  if (num <= 0 || num > 999) return num.toString();
  
  const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
  const hundreds = ['', 'ק', 'ר', 'ש', 'ת'];
  
  let result = '';
  let n = num;
  
  // מאות
  if (n >= 100) {
    const h = Math.floor(n / 100);
    if (h <= 4) {
      result += hundreds[h];
    } else {
      result += 'ת' + hundreds[h - 4];
    }
    n %= 100;
  }
  
  // עשרות ואחדות
  if (n === 15) {
    result += 'טו';
  } else if (n === 16) {
    result += 'טז';
  } else {
    if (n >= 10) {
      result += tens[Math.floor(n / 10)];
      n %= 10;
    }
    if (n > 0) {
      result += ones[n];
    }
  }
  
  return result;
}

// קבלת כל וריאציות המסכתות
export function getTractateVariants(): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const tractate of TRACTATES_DATA) {
    result[tractate.name] = [...tractate.variants];
  }
  return result;
}
