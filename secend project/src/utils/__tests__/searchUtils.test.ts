/**
 * בדיקות יחידה לפונקציות חיפוש וניתוח
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import {
  convertNumberToHebrew,
  calculateGematria,
  removeNikud,
  normalizeSofitLetters,
  normalizeText,
  checkPositionRule,
  checkTextPositionRule,
  checkFilterRules,
  splitTextToSegments,
  matchesCondition,
  searchWithConditions,
  findWordsByGematria,
  highlightSearchTerms,
} from '../searchUtils';
import { FilterRules, PositionRule, TextPositionRule, SearchCondition } from '@/types/search';

describe('המרת מספרים לעברית', () => {
  it('ממיר מספר חד ספרתי', () => {
    expect(convertNumberToHebrew(1)).toBe('א');
    expect(convertNumberToHebrew(5)).toBe('ה');
    expect(convertNumberToHebrew(9)).toBe('ט');
  });

  it('ממיר מספר דו ספרתי', () => {
    expect(convertNumberToHebrew(10)).toBe('י');
    expect(convertNumberToHebrew(11)).toBe('יא');
    expect(convertNumberToHebrew(20)).toBe('כ');
    expect(convertNumberToHebrew(25)).toBe('כה');
  });

  it('מטפל במקרים מיוחדים 15 ו-16', () => {
    expect(convertNumberToHebrew(15)).toBe('טו');
    expect(convertNumberToHebrew(16)).toBe('טז');
  });

  it('ממיר מספר תלת ספרתי', () => {
    expect(convertNumberToHebrew(100)).toBe('ק');
    expect(convertNumberToHebrew(123)).toBe('קכג');
    expect(convertNumberToHebrew(400)).toBe('ת');
  });

  it('מחזיר מחרוזת למספרים מחוץ לטווח', () => {
    expect(convertNumberToHebrew(0)).toBe('0');
    expect(convertNumberToHebrew(-5)).toBe('-5');
    expect(convertNumberToHebrew(1000)).toBe('1000');
  });
});

describe('חישוב גימטריא', () => {
  it('מחשב גימטריא של מילה פשוטה', () => {
    expect(calculateGematria('אב')).toBe(3); // 1 + 2
    expect(calculateGematria('גד')).toBe(7); // 3 + 4
  });

  it('מחשב גימטריא של מילים ידועות', () => {
    expect(calculateGematria('אחד')).toBe(13); // 1 + 8 + 4
    expect(calculateGematria('אהבה')).toBe(13); // 1 + 5 + 2 + 5
  });

  it('מטפל באותיות סופיות', () => {
    expect(calculateGematria('שלום')).toBe(376); // ש=300, ל=30, ו=6, ם=40
    expect(calculateGematria('אמן')).toBe(91); // א=1, מ=40, ן=50
  });

  it('מחזיר 0 למחרוזת ריקה', () => {
    expect(calculateGematria('')).toBe(0);
  });

  it('מתעלם מתווים לא עבריים', () => {
    expect(calculateGematria('אב123')).toBe(3);
  });
});

describe('הסרת ניקוד', () => {
  it('מסיר ניקוד מטקסט', () => {
    expect(removeNikud('שָׁלוֹם')).toBe('שלום');
    expect(removeNikud('בְּרֵאשִׁית')).toBe('בראשית');
  });

  it('לא משנה טקסט ללא ניקוד', () => {
    expect(removeNikud('שלום')).toBe('שלום');
    expect(removeNikud('hello')).toBe('hello');
  });

  it('מטפל בטקסט מעורב', () => {
    expect(removeNikud('שָׁלוֹם world')).toBe('שלום world');
  });
});

describe('נרמול אותיות סופיות', () => {
  it('ממיר אותיות סופיות לרגילות', () => {
    expect(normalizeSofitLetters('ך')).toBe('כ');
    expect(normalizeSofitLetters('ם')).toBe('מ');
    expect(normalizeSofitLetters('ן')).toBe('נ');
    expect(normalizeSofitLetters('ף')).toBe('פ');
    expect(normalizeSofitLetters('ץ')).toBe('צ');
  });

  it('ממיר מילה שלמה', () => {
    expect(normalizeSofitLetters('שלום')).toBe('שלומ');
    expect(normalizeSofitLetters('אמן')).toBe('אמנ');
  });

  it('לא משנה אותיות רגילות', () => {
    expect(normalizeSofitLetters('אבג')).toBe('אבג');
  });
});

describe('נרמול טקסט', () => {
  it('ממיר לאותיות קטנות', () => {
    expect(normalizeText('Hello World')).toBe('hello world');
  });

  it('מסיר ניקוד כשמופעל', () => {
    expect(normalizeText('שָׁלוֹם', { ignoreNikud: true })).toBe('שלום');
    expect(normalizeText('שָׁלוֹם', { ignoreNikud: false })).toBe('שָׁלוֹם');
  });

  it('ממיר אותיות סופיות כשמופעל', () => {
    expect(normalizeText('שלום', { sofitEquivalence: true })).toBe('שלומ');
    expect(normalizeText('שלום', { sofitEquivalence: false })).toBe('שלום');
  });

  it('משלב מספר אפשרויות', () => {
    expect(normalizeText('שָׁלוֹם', { ignoreNikud: true, sofitEquivalence: true })).toBe('שלומ');
  });
});

describe('בדיקת כללי מיקום יחסי', () => {
  it('מזהה מילה לפני מילה אחרת', () => {
    const rule: PositionRule = {
      id: '1',
      word: 'רבי',
      relativeWord: 'אמר',
      position: 'before',
      maxDistance: 10,
    };
    expect(checkPositionRule('רבי יוחנן אמר', rule)).toBe(true);
    expect(checkPositionRule('אמר רבי יוחנן', rule)).toBe(false);
  });

  it('מזהה מילה אחרי מילה אחרת', () => {
    const rule: PositionRule = {
      id: '1',
      word: 'אמר',
      relativeWord: 'רבי',
      position: 'after',
      maxDistance: 10,
    };
    expect(checkPositionRule('רבי יוחנן אמר', rule)).toBe(true);
    expect(checkPositionRule('אמר רבי יוחנן', rule)).toBe(false);
  });

  it('בודק מרחק מקסימלי', () => {
    const rule: PositionRule = {
      id: '1',
      word: 'רבי',
      relativeWord: 'אמר',
      position: 'before',
      maxDistance: 2,
    };
    expect(checkPositionRule('רבי יוחנן אמר', rule)).toBe(true);
    expect(checkPositionRule('רבי א ב ג ד ה אמר', rule)).toBe(false);
  });

  it('מחזיר false אם מילה חסרה', () => {
    const rule: PositionRule = {
      id: '1',
      word: 'רבי',
      relativeWord: 'אמר',
      position: 'before',
      maxDistance: 10,
    };
    expect(checkPositionRule('שלום עולם', rule)).toBe(false);
  });

  it('מאפשר כל מיקום עם anywhere', () => {
    const rule: PositionRule = {
      id: '1',
      word: 'רבי',
      relativeWord: 'אמר',
      position: 'anywhere',
      maxDistance: 10,
    };
    expect(checkPositionRule('רבי אמר', rule)).toBe(true);
    expect(checkPositionRule('אמר רבי', rule)).toBe(true);
  });
});

describe('בדיקת כללי מיקום בשורה', () => {
  it('מזהה מילה בתחילת שורה', () => {
    const rule: TextPositionRule = {
      id: '1',
      word: 'רבי',
      position: 'start',
      withinWords: 3,
    };
    expect(checkTextPositionRule('רבי יוחנן אמר דבר', rule)).toBe(true);
    expect(checkTextPositionRule('אמר רבי יוחנן', rule)).toBe(true); // בתוך 3 מילים ראשונות
    expect(checkTextPositionRule('זה טקסט ארוך ואז רבי', rule)).toBe(false);
  });

  it('מזהה מילה בסוף שורה', () => {
    const rule: TextPositionRule = {
      id: '1',
      word: 'אמן',
      position: 'end',
      withinWords: 3,
    };
    expect(checkTextPositionRule('ברוך השם אמן', rule)).toBe(true);
    expect(checkTextPositionRule('אמן ברוך השם לעולם', rule)).toBe(false); // אמן בהתחלה, לא בסוף
  });

  it('מזהה מילה בכל מקום', () => {
    const rule: TextPositionRule = {
      id: '1',
      word: 'השם',
      position: 'anywhere',
    };
    expect(checkTextPositionRule('ברוך השם אמן', rule)).toBe(true);
    expect(checkTextPositionRule('אמן ברוך', rule)).toBe(false);
  });
});

describe('בדיקת כללי סינון מלאים', () => {
  const baseRules: FilterRules = {
    positionRules: [],
    textPositionRules: [],
    mustContainNumbers: false,
    mustContainLettersOnly: false,
    caseSensitive: false,
  };

  it('בודק מינימום מילים', () => {
    const rules = { ...baseRules, minWordCount: 5 };
    expect(checkFilterRules('אחת שתיים שלוש ארבע חמש', rules)).toBe(true);
    expect(checkFilterRules('אחת שתיים', rules)).toBe(false);
  });

  it('בודק מקסימום מילים', () => {
    const rules = { ...baseRules, maxWordCount: 3 };
    expect(checkFilterRules('אחת שתיים', rules)).toBe(true);
    expect(checkFilterRules('אחת שתיים שלוש ארבע חמש', rules)).toBe(false);
  });

  it('בודק חובת מספרים', () => {
    const rules = { ...baseRules, mustContainNumbers: true };
    expect(checkFilterRules('דף 20 אמר רבי', rules)).toBe(true);
    expect(checkFilterRules('אמר רבי יוחנן', rules)).toBe(false);
  });

  it('בודק אותיות בלבד', () => {
    const rules = { ...baseRules, mustContainLettersOnly: true };
    expect(checkFilterRules('אמר רבי יוחנן', rules)).toBe(true);
    expect(checkFilterRules('דף 20 אמר רבי', rules)).toBe(false);
  });

  it('משלב כללי מיקום', () => {
    const rules: FilterRules = {
      ...baseRules,
      positionRules: [{
        id: '1',
        word: 'רבי',
        relativeWord: 'אמר',
        position: 'before',
        maxDistance: 5,
      }],
    };
    expect(checkFilterRules('רבי יוחנן אמר דבר', rules)).toBe(true);
    expect(checkFilterRules('אמר רבי יוחנן', rules)).toBe(false);
  });
});

describe('פיצול טקסט לקטעים', () => {
  it('מפצל לפי שורות', () => {
    const text = 'שורה ראשונה\nשורה שנייה\nשורה שלישית';
    const segments = splitTextToSegments(text);
    expect(segments).toHaveLength(3);
    expect(segments[0]).toBe('שורה ראשונה');
    expect(segments[1]).toBe('שורה שנייה');
  });

  it('מתעלם משורות ריקות', () => {
    const text = 'שורה ראשונה\n\n\nשורה שנייה';
    const segments = splitTextToSegments(text);
    expect(segments).toHaveLength(2);
  });

  it('מחזיר מערך ריק לטקסט ריק', () => {
    expect(splitTextToSegments('')).toHaveLength(0);
    expect(splitTextToSegments('   ')).toHaveLength(0);
  });
});

describe('התאמה לתנאי חיפוש', () => {
  it('מוצא התאמה פשוטה', () => {
    const condition: SearchCondition = {
      id: '1',
      term: 'שלום',
      operator: 'AND',
    };
    expect(matchesCondition('שלום עולם', condition)).toBe(true);
    expect(matchesCondition('היי עולם', condition)).toBe(false);
  });

  it('מתעלם מניקוד כשמופעל', () => {
    const condition: SearchCondition = {
      id: '1',
      term: 'שלום',
      operator: 'AND',
    };
    expect(matchesCondition('שָׁלוֹם עולם', condition, { ignoreNikud: true })).toBe(true);
  });

  it('מחזיר true לתנאי ריק', () => {
    const condition: SearchCondition = {
      id: '1',
      term: '',
      operator: 'AND',
    };
    expect(matchesCondition('כל טקסט', condition)).toBe(true);
  });
});

describe('חיפוש עם תנאים מרובים', () => {
  it('מחבר תנאים עם AND', () => {
    const conditions: SearchCondition[] = [
      { id: '1', term: 'רבי', operator: 'AND' },
      { id: '2', term: 'אמר', operator: 'AND' },
    ];
    expect(searchWithConditions('רבי יוחנן אמר', conditions)).toBe(true);
    expect(searchWithConditions('רבי יוחנן', conditions)).toBe(false);
  });

  it('מחבר תנאים עם OR', () => {
    const conditions: SearchCondition[] = [
      { id: '1', term: 'רבי', operator: 'AND' },
      { id: '2', term: 'רב', operator: 'OR' },
    ];
    expect(searchWithConditions('רב יוחנן', conditions)).toBe(true);
    expect(searchWithConditions('רבי יוחנן', conditions)).toBe(true);
  });

  it('מחבר תנאים עם NOT', () => {
    const conditions: SearchCondition[] = [
      { id: '1', term: 'רבי', operator: 'AND' },
      { id: '2', term: 'שמעון', operator: 'NOT' },
    ];
    expect(searchWithConditions('רבי יוחנן', conditions)).toBe(true);
    expect(searchWithConditions('רבי שמעון', conditions)).toBe(false);
  });

  it('מחזיר true לרשימה ריקה', () => {
    expect(searchWithConditions('כל טקסט', [])).toBe(true);
  });
});

describe('מציאת מילים לפי גימטריא', () => {
  it('מוצא מילים עם ערך גימטריא זהה', () => {
    const words = ['אחד', 'אהבה', 'שלום', 'אב'];
    const result = findWordsByGematria(13, words);
    expect(result).toContain('אחד');
    expect(result).toContain('אהבה');
    expect(result).not.toContain('שלום');
  });

  it('מחזיר מערך ריק אם אין התאמות', () => {
    const words = ['שלום', 'עולם'];
    const result = findWordsByGematria(1, words);
    expect(result).toHaveLength(0);
  });
});

describe('הדגשת מילות חיפוש', () => {
  it('מדגיש מילה בטקסט', () => {
    const result = highlightSearchTerms('שלום עולם', ['שלום']);
    expect(result).toBe('<mark>שלום</mark> עולם');
  });

  it('מדגיש מספר מילים', () => {
    const result = highlightSearchTerms('שלום עולם יפה', ['שלום', 'יפה']);
    expect(result).toBe('<mark>שלום</mark> עולם <mark>יפה</mark>');
  });

  it('לא קורס על תווים מיוחדים', () => {
    const result = highlightSearchTerms('test (hello) world', ['(hello)']);
    expect(result).toBe('test <mark>(hello)</mark> world');
  });

  it('מתעלם ממילים ריקות', () => {
    const result = highlightSearchTerms('שלום עולם', ['', 'שלום']);
    expect(result).toBe('<mark>שלום</mark> עולם');
  });
});
