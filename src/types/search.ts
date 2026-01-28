// Condition operators for search
export type ConditionOperator = 
  | 'contains' 
  | 'not_contains' 
  | 'starts_with' 
  | 'ends_with' 
  | 'exact' 
  | 'regex' 
  | 'proximity' 
  | 'word_list';

// Logical operators for combining conditions
export type LogicalOperator = 'AND' | 'OR' | 'NOT';

// Smart search options for Hebrew text processing
export interface SmartSearchOptions {
  ignoreNikud: boolean;
  ignoreSofitLetters: boolean;
  sofitEquivalence?: boolean;
  searchGematria: boolean;
  expandAcronyms: boolean;
  fuzzyMatch: boolean;
  fuzzyThreshold: number;
}

// Position rule for word position matching
export interface PositionRule {
  type: 'word' | 'char';
  position: number;
  operator: 'equals' | 'not_equals' | 'greater' | 'less' | 'before' | 'after' | 'anywhere';
  value?: string;
  word?: string;
  relativeWord?: string;
  maxDistance?: number;
}

// Text position rule for section matching
export interface TextPositionRule {
  section: 'start' | 'middle' | 'end';
  percentage: number;
  word?: string;
  withinWords?: number;
  position?: 'start' | 'middle' | 'end';
}

// Filter rules for search results
export interface FilterRules {
  minWords?: number;
  maxWords?: number;
  minChars?: number;
  maxChars?: number;
  minWordCount?: number;
  maxWordCount?: number;
  mustContainNumbers?: boolean;
  mustContainLettersOnly?: boolean;
  positionRules?: PositionRule[];
  textPositionRules?: TextPositionRule[];
  caseSensitive?: boolean;
}

// Search condition definition
export interface SearchCondition {
  id: string;
  term: string;
  operator: ConditionOperator;
  logicalOperator?: LogicalOperator;
  wordListId?: string;
  proximityDistance?: number;
  smartOptions?: SmartSearchOptions;
}

// Search result item
export interface SearchResult {
  id: string;
  text: string;
  highlightedText?: string;
  position: number;
  matchedTerms?: string[];
  score?: number;
  context?: string;
}

// Default smart search options
export const DEFAULT_SMART_OPTIONS: SmartSearchOptions = {
  ignoreNikud: true,
  ignoreSofitLetters: true,
  searchGematria: false,
  expandAcronyms: false,
  fuzzyMatch: false,
  fuzzyThreshold: 0.8,
};

// Default filter rules
export const DEFAULT_FILTER_RULES: FilterRules = {
  positionRules: [],
  textPositionRules: [],
  caseSensitive: false,
};
