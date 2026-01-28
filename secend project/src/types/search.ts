export type ConditionOperator = 'AND' | 'OR' | 'NOT' | 'NEAR' | 'LIST' | 'PATTERN';
export type ProximityDirection = 'before' | 'after' | 'both';
export type ListMode = 'any' | 'all';
export type PatternType = 'talmud-ref' | 'gematria-ref' | 'custom';
export type PositionType = 'before' | 'after' | 'anywhere';
export type TextPosition = 'start' | 'end' | 'anywhere';

export interface SmartSearchOptions {
  numberToHebrew: boolean;      // דף 20 <-> דף כ'
  wordVariations: boolean;       // singular/plural, ה prefix
  ignoreNikud: boolean;          // התעלמות מניקוד
  sofitEquivalence: boolean;     // ך=כ, ם=מ, ן=נ, ף=פ, ץ=צ
  gematriaSearch: boolean;       // חיפוש לפי ערך גימטריא
  acronymExpansion: boolean;     // הרחבת ראשי תיבות
}

export interface PositionRule {
  id: string;
  word: string;
  relativeWord: string;
  position: PositionType;
  maxDistance?: number;  // מקסימום מילים בין המילים
}

export interface TextPositionRule {
  id: string;
  word: string;
  position: TextPosition;
  withinWords?: number;  // תוך כמה מילים מההתחלה/סוף
}

export interface FilterRules {
  positionRules: PositionRule[];
  textPositionRules: TextPositionRule[];
  minWordCount?: number;
  maxWordCount?: number;
  mustContainNumbers: boolean;
  mustContainLettersOnly: boolean;
  caseSensitive: boolean;
}

export interface AdditionalPattern {
  id: string;
  patternType: PatternType;
  customPattern: string;
  logic: 'AND' | 'OR';
}

export interface SearchCondition {
  id: string;
  term: string;
  operator: ConditionOperator;
  proximityRange?: number;
  proximityDirection?: ProximityDirection;
  listWords?: string[];
  listMode?: ListMode;
  partialMatch?: boolean;  // חיפוש חלקי - מצא את המילה גם כחלק ממילה אחרת
  patternType?: PatternType;  // סוג הדפוס לחיפוש
  customPattern?: string;  // דפוס מותאם אישית (regex)
  patternLogic?: 'AND' | 'OR';  // לוגיקה של דפוס ביחס לתנאים אחרים
  additionalPatterns?: AdditionalPattern[];  // דפוסים נוספים באותו תנאי
}

export interface SearchResult {
  text: string;
  startIndex: number;
  endIndex: number;
  matchedTerms: string[];
}
