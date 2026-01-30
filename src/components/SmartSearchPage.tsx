import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  Search, 
  Upload, 
  FileText, 
  Plus, 
  X, 
  Sparkles,
  History,
  Download,
  Share2,
  FlaskConical,
  Copy,
  Trash2,
  ArrowLeftRight,
  MapPin,
  Settings2,
  BookOpen,
  RefreshCw,
  Check,
  AlertCircle,
  Link,
  Clock,
  RotateCcw,
  Database,
  Loader2,
  ChevronDown,
  List,
  AlignJustify,
  Edit,
  Pencil,
  Zap,
  Brain,
  HardDrive,
  Gauge,
  CheckSquare,
  Square,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import mammoth from 'mammoth';
import * as pdfjs from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { useSearchWorker } from '@/hooks/useSearchWorker';
import { serverFullTextSearch, searchCache, createDebouncedSearch } from '@/services/advancedSearchService';
import {
  buildSearchIndex,
  loadSearchIndex,
  searchWithIndex,
  searchWithContext,
  getIndexMetadata,
  clearSearchIndex,
  isIndexValid,
  type SearchIndex,
  type SearchResultWithContext,
} from '@/services/indexedDBService';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

// Psak Din type from Supabase
interface PsakDin {
  id: string;
  title: string;
  court: string;
  year: number;
  case_number: string | null;
  summary: string;
  full_text: string | null;
  tags: string[] | null;
  source_url: string | null;
  created_at: string;
}

// Types
interface SmartSearchOptions {
  numbersToLetters: boolean;      // מספרים ↔ אותיות
  wordVariations: boolean;         // וריאציות מילים
  ignoreNikud: boolean;           // התעלמות מניקוד
  sofitEquivalence: boolean;      // אותיות סופיות
  gematriaSearch: boolean;        // חיפוש גימטריא
  acronymExpansion: boolean;      // ראשי תיבות
  // Additional properties used in search
  removeNikud?: boolean;
  matchSofitLetters?: boolean;
  matchGematria?: boolean;
  expandAcronyms?: boolean;
  caseInsensitive?: boolean;
  wordBoundary?: boolean;
}

// Pattern presets for common searches
const PATTERN_PRESETS = {
  'talmud-ref': {
    name: 'מראה מקום תלמודי',
    description: 'דף ועמוד (כז,א / קכא,ב)',
    pattern: '[א-ת]{1,3}[,. ]?[אב]',
  },
  'talmud-full': {
    name: 'מראה מקום מלא',
    description: 'מסכת + דף + עמוד',
    pattern: '(מסכת\\s+)?[א-ת]+\\s+[א-ת]{1,3}[,.]?\\s?[אב]',
  },
  'masechet-name': {
    name: 'שם מסכת',
    description: 'כל שמות המסכתות',
    pattern: '(ברכות|שבת|עירובין|פסחים|שקלים|יומא|סוכה|ביצה|ראש השנה|תענית|מגילה|מועד קטן|חגיגה|יבמות|כתובות|נדרים|נזיר|סוטה|גיטין|קידושין|בבא קמא|בבא מציעא|בבא בתרא|סנהדרין|מכות|שבועות|עבודה זרה|הוריות|זבחים|מנחות|חולין|בכורות|ערכין|תמורה|כריתות|מעילה|תמיד|נדה|ב"ק|ב"מ|ב"ב|ר"ה|ע"ז|מו"ק)',
  },
  'sefer-ref': {
    name: 'ספר פרק פסוק',
    description: 'מראה מקום מקראי',
    pattern: '[א-ת]+\\s+[א-ת]{1,2}[,\\s]+[א-ת]{1,2}',
  },
  'daf-amud': {
    name: 'דף ועמוד בלבד',
    description: 'רק דף ועמוד',
    pattern: 'דף\\s+[א-ת]{1,3}\\s*(עמוד\\s+)?[אב]',
  },
  'brackets-ref': {
    name: 'הפניה בסוגריים',
    description: 'מראה מקום בסוגריים',
    pattern: '\\([^)]*[א-ת]{1,3}[,\\s]?[אב][^)]*\\)',
  },
  'custom': {
    name: 'התאמה אישית',
    description: 'הזן ביטוי רגולרי',
    pattern: '',
  },
} as const;

type PatternType = keyof typeof PATTERN_PRESETS;

interface SearchCondition {
  id: string;
  term: string;
  operator: 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'exact' | 'regex' | 'near' | 'list' | 'pattern';
  searchInWord: boolean;          // חפש גם כחלק ממילה
  smartOptions: SmartSearchOptions;
  logicalOperator?: 'AND' | 'OR' | 'NOT';
  // NEAR search options
  nearWord?: string;              // המילה לחפש בקרבת
  nearDistance?: number;          // מרחק מקסימלי במילים
  // LIST search options
  listWords?: string[];           // רשימת מילים לחיפוש
  listMode?: 'any' | 'all';       // any = אחד מהרשימה, all = כולם
  // PATTERN search options
  patternType?: PatternType;      // סוג הדפוס
  customPattern?: string;         // דפוס מותאם אישית
}

interface PositionRule {
  id: string;
  type: 'relative' | 'line_position';
  word1?: string;
  word2?: string;
  maxDistance?: number;
  position?: 'start' | 'middle' | 'end';
  withinWords?: number;
}

interface FilterRule {
  minWordsPerLine?: number;
  maxWordsPerLine?: number;
  mustContainNumbers?: boolean;
  lettersOnly?: boolean;
  minLineLength?: number;
  maxLineLength?: number;
  mustContain?: string;
  mustNotContain?: string;
}

interface SearchTemplate {
  id: string;
  name: string;
  description: string;
  conditions: SearchCondition[];
  filterRules: FilterRule;
  positionRules: PositionRule[];
}

interface SearchResult {
  id: string;
  text: string;
  lineNumber: number;
  matchedTerms: string[];
  score: number;
  highlights: { start: number; end: number }[];
  // Context lines around the match
  contextBefore?: string;
  contextAfter?: string;
  // HTML highlighted text (with <mark> tags)
  highlightedText?: string;
  // Source info for psakei din
  sourceType: 'psak' | 'custom';
  psakId?: string;
  psakTitle?: string;
  psakCourt?: string;
  psakYear?: number;
}

// Helper function to highlight text with matched terms
const highlightText = (text: string, terms: string[]): React.ReactNode => {
  if (!terms || terms.length === 0) return text;
  
  // Create regex pattern for all terms
  const escapedTerms = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(${escapedTerms.join('|')})`, 'gi');
  
  const parts = text.split(pattern);
  
  return parts.map((part, i) => {
    const isMatch = terms.some(term => part.toLowerCase() === term.toLowerCase());
    if (isMatch) {
      return (
        <mark key={i} className="bg-[#b8860b]/30 text-[#1e3a5f] font-bold px-0.5 rounded">
          {part}
        </mark>
      );
    }
    return part;
  });
};

// Default values
const DEFAULT_SMART_OPTIONS: SmartSearchOptions = {
  numbersToLetters: true,
  wordVariations: true,
  ignoreNikud: true,
  sofitEquivalence: true,
  gematriaSearch: false,
  acronymExpansion: false,
  // Additional defaults
  removeNikud: true,
  matchSofitLetters: true,
  matchGematria: false,
  expandAcronyms: false,
  caseInsensitive: true,
  wordBoundary: false,
};

// localStorage keys for persisting settings
const STORAGE_KEYS = {
  ADVANCED_SEARCH_OPTIONS: 'smartSearch_advancedOptions',
  SMART_OPTIONS: 'smartSearch_smartOptions',
  RESULTS_DISPLAY_MODE: 'smartSearch_resultsDisplayMode',
  USE_STREAMING_SEARCH: 'smartSearch_useStreamingSearch',
};

// Helper to load from localStorage with fallback
function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return { ...fallback, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.warn('Failed to load from localStorage:', key, e);
  }
  return fallback;
}

// Helper to save to localStorage
function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('Failed to save to localStorage:', key, e);
  }
}

// Hebrew utilities
const HEBREW_NUMBERS: Record<string, number> = {
  'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9,
  'י': 10, 'כ': 20, 'ך': 20, 'ל': 30, 'מ': 40, 'ם': 40, 'נ': 50, 'ן': 50,
  'ס': 60, 'ע': 70, 'פ': 80, 'ף': 80, 'צ': 90, 'ץ': 90,
  'ק': 100, 'ר': 200, 'ש': 300, 'ת': 400,
};

// List of all masechtos for pattern matching
const MASECHTOS = [
  'ברכות', 'שבת', 'עירובין', 'פסחים', 'שקלים', 'יומא', 'סוכה', 'ביצה',
  'ראש השנה', 'תענית', 'מגילה', 'מועד קטן', 'חגיגה', 'יבמות', 'כתובות',
  'נדרים', 'נזיר', 'סוטה', 'גיטין', 'קידושין', 'בבא קמא', 'בבא מציעא',
  'בבא בתרא', 'סנהדרין', 'מכות', 'שבועות', 'עבודה זרה', 'הוריות', 'זבחים',
  'מנחות', 'חולין', 'בכורות', 'ערכין', 'תמורה', 'כריתות', 'מעילה', 'תמיד', 'נדה'
];

// Common abbreviations for masechtos
const MASECHET_ABBREVS: Record<string, string> = {
  'ב"ק': 'בבא קמא', 'ב"מ': 'בבא מציעא', 'ב"ב': 'בבא בתרא',
  'ר"ה': 'ראש השנה', 'ע"ז': 'עבודה זרה', 'מו"ק': 'מועד קטן',
  'בק': 'בבא קמא', 'במ': 'בבא מציעא', 'בב': 'בבא בתרא',
};

const SOFIT_MAP: Record<string, string> = {
  'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ',
  'כ': 'ך', 'מ': 'ם', 'נ': 'ן', 'פ': 'ף', 'צ': 'ץ',
};

const COMMON_ACRONYMS: Record<string, string[]> = {
  'רמב"ם': ['רבי משה בן מימון', 'רבינו משה בן מימון'],
  'רש"י': ['רבי שלמה יצחקי'],
  'ר"ת': ['רבינו תם', 'ראשי תיבות'],
  'ר"י': ['רבי יוחנן', 'רבינו יונה'],
  'ר"ע': ['רבי עקיבא'],
  'ר"א': ['רבי אליעזר', 'רבי אלעזר'],
  'חז"ל': ['חכמינו זכרונם לברכה'],
  'ז"ל': ['זכרונו לברכה'],
  'ע"ה': ['עליו השלום'],
  'ע"א': ['עמוד א'],
  'ע"ב': ['עמוד ב'],
  'ד"ה': ['דיבור המתחיל'],
  'ב"ה': ['ברוך השם', 'בעזרת השם'],
};

// Remove nikud from text
function removeNikud(text: string): string {
  return text.replace(/[\u0591-\u05C7]/g, '');
}

// Normalize sofit letters
function normalizeSofit(text: string): string {
  return text.split('').map(c => SOFIT_MAP[c] || c).join('');
}

// Calculate gematria
function calculateGematria(text: string): number {
  return text.split('').reduce((sum, char) => sum + (HEBREW_NUMBERS[char] || 0), 0);
}

// Number to Hebrew letters
function numberToHebrew(num: number): string {
  if (num <= 0 || num > 999) return String(num);
  
  let result = '';
  const hundreds = Math.floor(num / 100);
  const tens = Math.floor((num % 100) / 10);
  const ones = num % 10;
  
  const hundredsLetters = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק'];
  const tensLetters = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
  const onesLetters = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  
  result = hundredsLetters[hundreds] + tensLetters[tens] + onesLetters[ones];
  
  // Handle special cases (15 = טו, 16 = טז)
  result = result.replace('יה', 'טו').replace('יו', 'טז');
  
  return result;
}

// Pre-built templates with real configurations
const PRESET_TEMPLATES: SearchTemplate[] = [
  {
    id: 'halacha-basic',
    name: 'חיפוש הלכתי בסיסי',
    description: 'חיפוש פסקי הלכה עם אותיות סופיות וניקוד',
    conditions: [{
      id: '1',
      term: '',
      operator: 'contains',
      searchInWord: true,
      smartOptions: { ...DEFAULT_SMART_OPTIONS, ignoreNikud: true, sofitEquivalence: true },
    }],
    filterRules: {},
    positionRules: [],
  },
  {
    id: 'gematria',
    name: 'חיפוש גימטריא',
    description: 'מוצא מילים עם ערך גימטריא זהה',
    conditions: [{
      id: '1',
      term: '',
      operator: 'contains',
      searchInWord: false,
      smartOptions: { ...DEFAULT_SMART_OPTIONS, gematriaSearch: true },
    }],
    filterRules: {},
    positionRules: [],
  },
  {
    id: 'acronyms',
    name: 'ראשי תיבות',
    description: 'מרחיב קיצורים וראשי תיבות נפוצים',
    conditions: [{
      id: '1',
      term: '',
      operator: 'contains',
      searchInWord: false,
      smartOptions: { ...DEFAULT_SMART_OPTIONS, acronymExpansion: true },
    }],
    filterRules: {},
    positionRules: [],
  },
  {
    id: 'proximity',
    name: 'קרבת מילים',
    description: 'מוצא מילים בקרבה זו לזו',
    conditions: [{
      id: '1',
      term: '',
      operator: 'contains',
      searchInWord: true,
      smartOptions: DEFAULT_SMART_OPTIONS,
    }],
    filterRules: {},
    positionRules: [{ id: '1', type: 'relative', maxDistance: 5 }],
  },
  {
    id: 'sentence-start',
    name: 'תחילת משפט',
    description: 'מוצא מילים בתחילת משפטים',
    conditions: [{
      id: '1',
      term: '',
      operator: 'contains',
      searchInWord: false,
      smartOptions: DEFAULT_SMART_OPTIONS,
    }],
    filterRules: {},
    positionRules: [{ id: '1', type: 'line_position', position: 'start', withinWords: 3 }],
  },
  {
    id: 'numbers',
    name: 'מספרים עבריים',
    description: 'דף כ׳ = דף 20',
    conditions: [{
      id: '1',
      term: '',
      operator: 'contains',
      searchInWord: true,
      smartOptions: { ...DEFAULT_SMART_OPTIONS, numbersToLetters: true },
    }],
    filterRules: {},
    positionRules: [],
  },
  {
    id: 'variations',
    name: 'וריאציות מילים',
    description: 'יחיד/רבים, עם/בלי ה׳ הידיעה',
    conditions: [{
      id: '1',
      term: '',
      operator: 'contains',
      searchInWord: true,
      smartOptions: { ...DEFAULT_SMART_OPTIONS, wordVariations: true },
    }],
    filterRules: {},
    positionRules: [],
  },
  {
    id: 'exact-phrase',
    name: 'ביטוי מדויק',
    description: 'חיפוש ביטוי מדויק',
    conditions: [{
      id: '1',
      term: '',
      operator: 'exact',
      searchInWord: false,
      smartOptions: { ...DEFAULT_SMART_OPTIONS, ignoreNikud: false, sofitEquivalence: false },
    }],
    filterRules: {},
    positionRules: [],
  },
  {
    id: 'exclusion',
    name: 'חיפוש עם הדרה',
    description: 'מכיל X אבל לא Y',
    conditions: [
      {
        id: '1',
        term: '',
        operator: 'contains',
        searchInWord: true,
        smartOptions: DEFAULT_SMART_OPTIONS,
      },
      {
        id: '2',
        term: '',
        operator: 'not_contains',
        searchInWord: true,
        smartOptions: DEFAULT_SMART_OPTIONS,
        logicalOperator: 'AND',
      }
    ],
    filterRules: {},
    positionRules: [],
  },
  {
    id: 'talmud-style',
    name: 'סגנון תלמודי',
    description: 'חיפוש מותאם לסגנון הגמרא',
    conditions: [{
      id: '1',
      term: '',
      operator: 'contains',
      searchInWord: true,
      smartOptions: { 
        numbersToLetters: true,
        wordVariations: true,
        ignoreNikud: true,
        sofitEquivalence: true,
        gematriaSearch: false,
        acronymExpansion: true,
      },
    }],
    filterRules: {},
    positionRules: [],
  },
];

export function SmartSearchPage() {
  // Text state
  const [inputText, setInputText] = useState('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);

  // Search conditions
  const [conditions, setConditions] = useState<SearchCondition[]>([]);
  const [activeTab, setActiveTab] = useState('search');

  // Filter rules
  const [filterRules, setFilterRules] = useState<FilterRule>({});
  const [positionRules, setPositionRules] = useState<PositionRule[]>([]);

  // Results
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Templates
  const [savedTemplates, setSavedTemplates] = useState<SearchTemplate[]>(() => {
    try {
      const saved = localStorage.getItem('smart-search-templates');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showTemplates, setShowTemplates] = useState(false);

  // History
  const [searchHistory, setSearchHistory] = useState<{ id: string; query: string; timestamp: Date; resultsCount: number; conditions: SearchCondition[] }[]>(() => {
    try {
      const saved = localStorage.getItem('smart-search-history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Dialogs
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  // Psakei Din from Supabase
  const [psakeiDin, setPsakeiDin] = useState<PsakDin[]>([]);
  const [isLoadingPsakim, setIsLoadingPsakim] = useState(false);
  const [selectedPsakim, setSelectedPsakim] = useState<string[]>([]);
  const [psakimSearchTerm, setPsakimSearchTerm] = useState('');
  
  // Search scope - 'all' searches all psakim, 'selected' only selected, 'custom' only input text
  const [searchScope, setSearchScope] = useState<'all' | 'selected' | 'custom'>('all');
  const [includeInputText, setIncludeInputText] = useState(true);
  
  // Global smart search options - load from localStorage
  const [globalSmartOptions, setGlobalSmartOptions] = useState<SmartSearchOptions>(() => 
    loadFromStorage(STORAGE_KEYS.SMART_OPTIONS, DEFAULT_SMART_OPTIONS)
  );

  // Validation results
  const [validationResults, setValidationResults] = useState<{ rule: string; passed: boolean; message: string }[]>([]);

  // Data Quality Dialog
  const [showDataQualityDialog, setShowDataQualityDialog] = useState(false);
  const [dataQualityResults, setDataQualityResults] = useState<{
    duplicates: { id1: string; id2: string; title1: string; title2: string; similarity: number }[];
    lowQuality: { id: string; title: string; issues: string[] }[];
    isChecking: boolean;
  }>({ duplicates: [], lowQuality: [], isChecking: false });

  // View Psak Din Dialog
  const [viewPsakDialog, setViewPsakDialog] = useState<{
    open: boolean;
    psak: PsakDin | null;
    searchTerms: string[];
  }>({ open: false, psak: null, searchTerms: [] });

  // Results Display Mode - load from localStorage
  const [resultsDisplayMode, setResultsDisplayMode] = useState<'compact' | 'detailed' | 'list'>(() => 
    loadFromStorage(STORAGE_KEYS.RESULTS_DISPLAY_MODE, 'compact') as 'compact' | 'detailed' | 'list'
  );

  // Edit Dialog State
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    psak: PsakDin | null;
    newTitle: string;
  }>({ open: false, psak: null, newTitle: '' });
  
  // Deleting state
  const [isDeletingPsakim, setIsDeletingPsakim] = useState(false);
  
  // Search limit and progress
  const [searchLimit, setSearchLimit] = useState<number | 'all'>('all');
  const [searchProgress, setSearchProgress] = useState<{
    current: number;
    total: number;
    percentage: number;
    isActive: boolean;
  }>({ current: 0, total: 0, percentage: 0, isActive: false });

  // IndexedDB Pre-indexing state
  const [localIndex, setLocalIndex] = useState<SearchIndex | null>(null);
  const [indexMeta, setIndexMeta] = useState<{ psakimCount: number; lastUpdated: string; totalWords: number } | null>(null);
  const [isIndexBuilding, setIsIndexBuilding] = useState(false);
  const [indexBuildProgress, setIndexBuildProgress] = useState({ current: 0, total: 0 });
  
  // Streaming search state - load from localStorage
  const [useStreamingSearch, setUseStreamingSearch] = useState(() => 
    loadFromStorage(STORAGE_KEYS.USE_STREAMING_SEARCH, true)
  );
  const [streamingResults, setStreamingResults] = useState<SearchResult[]>([]);
  const searchWorkerRef = useRef<Worker | null>(null);

  // Default values for advanced search options
  const DEFAULT_ADVANCED_OPTIONS = {
    useWorker: true,       // Use Web Worker for search
    useServerFTS: true,    // Use server Full-Text Search
    fuzzySearch: true,     // Find similar words
    useRoots: true,        // Use Hebrew roots (שורשים)
    useSynonyms: true,     // Use synonyms (מילים נרדפות)
    useCache: true,        // Cache results
    // New advanced Hebrew options
    expandAcronyms: true,  // Expand acronyms (ראשי תיבות)
    phoneticSearch: true,  // Phonetic matching (חיפוש פונטי)
    ocrCorrection: true,   // OCR error correction
    useNgrams: true,       // N-gram partial matching
    removeStopWords: true, // Remove stop words
    fuzzyThreshold: 0.7,   // Fuzzy match threshold (0-1)
    boostTitle: 2.0,       // Title match boost
    boostExactMatch: 3.0,  // Exact match boost
    useLocalIndex: true,   // Use IndexedDB pre-indexing for instant search
  };

  // Advanced search options - load from localStorage
  const [advancedSearchOptions, setAdvancedSearchOptions] = useState(() => 
    loadFromStorage(STORAGE_KEYS.ADVANCED_SEARCH_OPTIONS, DEFAULT_ADVANCED_OPTIONS)
  );

  // Search Worker hook
  const {
    isWorkerReady,
    isIndexing,
    indexStats,
    buildIndex,
    search: workerSearch,
    getSuggestions,
  } = useSearchWorker();

  // Build search index when psakim are loaded
  useEffect(() => {
    if (psakeiDin.length > 0 && advancedSearchOptions.useWorker) {
      buildIndex(psakeiDin as any);
    }
  }, [psakeiDin, advancedSearchOptions.useWorker, buildIndex]);

  // Save settings to localStorage when they change
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.ADVANCED_SEARCH_OPTIONS, advancedSearchOptions);
  }, [advancedSearchOptions]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.SMART_OPTIONS, globalSmartOptions);
  }, [globalSmartOptions]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.RESULTS_DISPLAY_MODE, resultsDisplayMode);
  }, [resultsDisplayMode]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.USE_STREAMING_SEARCH, useStreamingSearch);
  }, [useStreamingSearch]);

  // Open psak din for viewing
  const openPsakForViewing = useCallback((psakId: string, searchTerms: string[]) => {
    const psak = psakeiDin.find(p => p.id === psakId);
    if (psak) {
      setViewPsakDialog({ open: true, psak, searchTerms });
    }
  }, [psakeiDin]);

  // Open edit dialog for a psak
  const openEditDialog = useCallback((psak: PsakDin) => {
    setEditDialog({ open: true, psak, newTitle: psak.title });
  }, []);

  // Save edited title
  const saveEditedTitle = useCallback(async () => {
    if (!editDialog.psak || !editDialog.newTitle.trim()) return;
    
    try {
      const { error } = await supabase
        .from('psakei_din')
        .update({ title: editDialog.newTitle.trim() })
        .eq('id', editDialog.psak.id);
      
      if (error) throw error;
      
      // Update local state
      setPsakeiDin(prev => prev.map(p => 
        p.id === editDialog.psak!.id 
          ? { ...p, title: editDialog.newTitle.trim() }
          : p
      ));
      
      toast({
        title: 'הכותרת עודכנה',
        description: 'פסק הדין עודכן בהצלחה',
      });
      
      setEditDialog({ open: false, psak: null, newTitle: '' });
    } catch (error) {
      console.error('Error updating title:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לעדכן את הכותרת',
        variant: 'destructive',
      });
    }
  }, [editDialog]);

  // Delete single psak
  const deletePsak = useCallback(async (psakId: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק פסק דין זה?')) return;
    
    try {
      const { error } = await supabase
        .from('psakei_din')
        .delete()
        .eq('id', psakId);
      
      if (error) throw error;
      
      setPsakeiDin(prev => prev.filter(p => p.id !== psakId));
      setSelectedPsakim(prev => prev.filter(id => id !== psakId));
      
      toast({
        title: 'נמחק',
        description: 'פסק הדין נמחק בהצלחה',
      });
    } catch (error) {
      console.error('Error deleting psak:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן למחוק את פסק הדין',
        variant: 'destructive',
      });
    }
  }, []);

  // Delete selected psakim
  const deleteSelectedPsakim = useCallback(async () => {
    if (selectedPsakim.length === 0) return;
    if (!confirm(`האם אתה בטוח שברצונך למחוק ${selectedPsakim.length} פסקי דין?`)) return;
    
    setIsDeletingPsakim(true);
    
    try {
      const { error } = await supabase
        .from('psakei_din')
        .delete()
        .in('id', selectedPsakim);
      
      if (error) throw error;
      
      setPsakeiDin(prev => prev.filter(p => !selectedPsakim.includes(p.id)));
      
      toast({
        title: 'נמחקו בהצלחה',
        description: `${selectedPsakim.length} פסקי דין נמחקו`,
      });
      
      setSelectedPsakim([]);
    } catch (error) {
      console.error('Error deleting psakim:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן למחוק את פסקי הדין',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingPsakim(false);
    }
  }, [selectedPsakim]);

  // Check for duplicates and low quality psakim
  const runDataQualityCheck = useCallback(async () => {
    setDataQualityResults(prev => ({ ...prev, isChecking: true }));
    
    const duplicates: typeof dataQualityResults.duplicates = [];
    const lowQuality: typeof dataQualityResults.lowQuality = [];
    
    // Helper to calculate text similarity (simple Jaccard)
    const calculateSimilarity = (text1: string, text2: string): number => {
      const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
      const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 2));
      const intersection = [...words1].filter(w => words2.has(w)).length;
      const union = new Set([...words1, ...words2]).size;
      return union > 0 ? intersection / union : 0;
    };
    
    // Check for duplicates
    for (let i = 0; i < psakeiDin.length; i++) {
      for (let j = i + 1; j < psakeiDin.length; j++) {
        const p1 = psakeiDin[i];
        const p2 = psakeiDin[j];
        
        // Check title similarity
        const titleSimilarity = calculateSimilarity(p1.title, p2.title);
        
        // Check content similarity (if available)
        const text1 = p1.full_text || p1.summary;
        const text2 = p2.full_text || p2.summary;
        const contentSimilarity = calculateSimilarity(text1, text2);
        
        // If high similarity, flag as potential duplicate
        const avgSimilarity = (titleSimilarity * 0.4 + contentSimilarity * 0.6);
        if (avgSimilarity > 0.7 || titleSimilarity > 0.9) {
          duplicates.push({
            id1: p1.id,
            id2: p2.id,
            title1: p1.title,
            title2: p2.title,
            similarity: Math.round(avgSimilarity * 100),
          });
        }
      }
    }
    
    // Check for low quality psakim
    for (const psak of psakeiDin) {
      const issues: string[] = [];
      const text = psak.full_text || psak.summary;
      
      // Check for missing or very short content
      if (!text || text.trim().length === 0) {
        issues.push('אין תוכן');
      } else {
        const lines = text.split('\n').filter(l => l.trim());
        const chars = text.replace(/\s/g, '').length;
        const words = text.split(/\s+/).filter(w => w.length > 0).length;
        
        if (chars < 50) {
          issues.push(`תוכן קצר מאוד (${chars} תווים)`);
        }
        if (lines.length < 3) {
          issues.push(`מעט שורות (${lines.length} שורות)`);
        }
        if (words < 20) {
          issues.push(`מעט מילים (${words} מילים)`);
        }
        
        // Check for suspicious content
        const hebrewRatio = (text.match(/[\u0590-\u05FF]/g)?.length || 0) / text.length;
        if (hebrewRatio < 0.3 && text.length > 20) {
          issues.push('מעט תוכן בעברית');
        }
        
        // Check for repeated characters (possible OCR error)
        if (/(.)\1{10,}/.test(text)) {
          issues.push('תווים חוזרים (בעיית OCR אפשרית)');
        }
      }
      
      // Check for missing metadata
      if (!psak.title || psak.title.trim().length < 3) {
        issues.push('כותרת חסרה או קצרה');
      }
      if (!psak.court || psak.court.trim().length === 0) {
        issues.push('לא צוין בית משפט');
      }
      if (!psak.year || psak.year < 1900 || psak.year > new Date().getFullYear() + 1) {
        issues.push('שנה לא תקינה');
      }
      
      if (issues.length > 0) {
        lowQuality.push({
          id: psak.id,
          title: psak.title || '(ללא כותרת)',
          issues,
        });
      }
    }
    
    setDataQualityResults({
      duplicates,
      lowQuality,
      isChecking: false,
    });
    
    toast({
      title: 'בדיקת איכות הושלמה',
      description: `נמצאו ${duplicates.length} כפילויות אפשריות ו-${lowQuality.length} פסקים בעייתיים`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [psakeiDin]);

  // Load psakei din from Supabase - load all psakim with cursor-based pagination
  const loadPsakeiDin = useCallback(async () => {
    setIsLoadingPsakim(true);
    try {
      // First get total count
      const { count: totalCount, error: countError } = await supabase
        .from('psakei_din')
        .select('*', { count: 'exact', head: true });
      
      if (countError) {
        console.error('Count error:', countError);
        throw new Error(countError.message);
      }
      
      const total = totalCount || 0;
      
      // For small datasets, load all at once
      if (total <= 1000) {
        const { data, error } = await supabase
          .from('psakei_din')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1000);
        
        if (error) throw new Error(error.message);
        setPsakeiDin((data as PsakDin[]) || []);
        toast({
          title: 'נטענו פסקי דין',
          description: `${data?.length || 0} פסקי דין`,
        });
        return;
      }
      
      // For larger datasets, use cursor-based pagination with created_at
      const PAGE_SIZE = 500;
      const allPsakim: PsakDin[] = [];
      let lastCreatedAt: string | null = null;
      let hasMore = true;
      
      while (hasMore) {
        let query = supabase
          .from('psakei_din')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(PAGE_SIZE);
        
        if (lastCreatedAt) {
          query = query.lt('created_at', lastCreatedAt);
        }
        
        const { data, error } = await query;
        
        if (error) {
          console.error('Supabase error:', error);
          // If we already have some data, use it
          if (allPsakim.length > 0) {
            console.log('Partial load - got', allPsakim.length, 'psakim');
            break;
          }
          throw new Error(error.message);
        }
        
        if (data && data.length > 0) {
          allPsakim.push(...(data as PsakDin[]));
          lastCreatedAt = data[data.length - 1].created_at;
          
          // Update progress
          toast({
            title: 'טוען פסקי דין...',
            description: `${allPsakim.length} / ${total}`,
          });
          
          hasMore = data.length === PAGE_SIZE;
        } else {
          hasMore = false;
        }
      }
      
      setPsakeiDin(allPsakim);
      toast({
        title: 'נטענו פסקי דין',
        description: `${allPsakim.length} פסקי דין`,
      });
    } catch (error: unknown) {
      console.error('Error loading psakei din:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({
        title: 'שגיאה בטעינת פסקי דין',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoadingPsakim(false);
    }
  }, []);
  
  // Search psakei din directly on Supabase (server-side search)
  const searchPsakeiDinOnServer = useCallback(async (searchTerm: string): Promise<PsakDin[]> => {
    if (!searchTerm.trim()) return [];
    
    try {
      // Use textSearch or simple ilike for search - no limit for full results
      const { data, error } = await supabase
        .from('psakei_din')
        .select('*')
        .or(`title.ilike.%${searchTerm}%,summary.ilike.%${searchTerm}%,court.ilike.%${searchTerm}%`);
      
      if (error) {
        console.error('Search error:', error);
        // Fallback: try searching only in title
        const { data: fallbackData } = await supabase
          .from('psakei_din')
          .select('*')
          .ilike('title', `%${searchTerm}%`);
        return fallbackData || [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Server search error:', error);
      return [];
    }
  }, []);

  // Advanced server-side search with pattern/regex support using RPC
  const searchPsakeiDinAdvanced = useCallback(async (
    conditions: SearchCondition[],
    limit: number = 500
  ): Promise<PsakDin[]> => {
    try {
      // Check if we have a pattern condition - use RPC for regex
      const patternCondition = conditions.find(c => c.operator === 'pattern');
      const containsCondition = conditions.find(c => c.operator === 'contains' && c.term);
      const listCondition = conditions.find(c => c.operator === 'list' && c.listWords && c.listWords.length > 0);
      
      // Get the pattern to search
      let searchPattern: string | null = null;
      let searchText: string | null = null;
      
      if (patternCondition && patternCondition.patternType) {
        searchPattern = patternCondition.patternType !== 'custom'
          ? PATTERN_PRESETS[patternCondition.patternType]?.pattern || null
          : patternCondition.customPattern || null;
      }
      
      if (containsCondition && containsCondition.term) {
        searchText = containsCondition.term;
      }
      
      // If we have list condition, convert to regex pattern
      if (listCondition && listCondition.listWords && listCondition.listWords.length > 0) {
        const listPattern = listCondition.listWords.join('|');
        searchPattern = searchPattern ? `(${searchPattern})|(${listPattern})` : listPattern;
      }
      
      // Use RPC function for server-side regex search
      const { data, error } = await supabase.rpc('search_psakei_din_advanced', {
        search_pattern: searchPattern,
        search_text: searchText,
        result_limit: limit
      });
      
      if (error) {
        console.error('RPC search error:', error);
        // Fallback to regular query
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('psakei_din')
          .select('id, title, court, year, case_number, summary, created_at')
          .limit(limit);
        
        if (fallbackError) throw fallbackError;
        return (fallbackData as PsakDin[]) || [];
      }
      
      // Map RPC results to PsakDin format
      return (data || []).map((item: { id: string; title: string; court: string; year: number; case_number: string; summary: string; matched_text?: string; match_count?: number }) => ({
        id: item.id,
        title: item.title,
        court: item.court,
        year: item.year,
        case_number: item.case_number,
        summary: item.summary,
        // Add matched info for highlighting
        _matchedText: item.matched_text,
        _matchCount: item.match_count
      })) as PsakDin[];
      
    } catch (error) {
      console.error('Advanced server search error:', error);
      return [];
    }
  }, []);

  // Import selected psakim to text area
  const importSelectedPsakim = useCallback(() => {
    const selected = psakeiDin.filter(p => selectedPsakim.includes(p.id));
    if (selected.length === 0) {
      toast({ title: 'לא נבחרו פסקי דין', variant: 'destructive' });
      return;
    }

    const textsToAdd = selected.map(p => {
      const header = `=== ${p.title} ===\nבית דין: ${p.court} | שנה: ${p.year}${p.case_number ? ` | תיק: ${p.case_number}` : ''}\n\n`;
      const body = p.full_text || p.summary;
      return header + body;
    }).join('\n\n---\n\n');

    setInputText(prev => prev ? prev + '\n\n---\n\n' + textsToAdd : textsToAdd);
    setSelectedPsakim([]);
    setActiveTab('search'); // Switch to search tab after adding
    toast({
      title: 'נוספו פסקי דין',
      description: `${selected.length} פסקי דין נוספו לטקסט`,
    });
  }, [psakeiDin, selectedPsakim]);

  // ===== IndexedDB Pre-indexing Functions =====
  
  // Load local index on mount
  useEffect(() => {
    const loadLocalIndex = async () => {
      try {
        const valid = await isIndexValid(24); // Valid for 24 hours
        if (valid) {
          const index = await loadSearchIndex();
          const meta = await getIndexMetadata();
          if (index && meta) {
            setLocalIndex(index);
            setIndexMeta(meta);
            console.log('✅ Loaded local search index:', meta);
          }
        }
      } catch (error) {
        console.error('Error loading local index:', error);
      }
    };
    loadLocalIndex();
  }, []);

  // Build local index from psakim
  const buildLocalIndex = useCallback(async () => {
    if (psakeiDin.length === 0) {
      toast({ title: 'אין פסקי דין לאינדוקס', variant: 'destructive' });
      return;
    }

    setIsIndexBuilding(true);
    setIndexBuildProgress({ current: 0, total: psakeiDin.length });

    try {
      toast({
        title: 'בונה אינדקס חיפוש מקומי...',
        description: `מעבד ${psakeiDin.length} פסקי דין`,
      });

      await buildSearchIndex(psakeiDin, (current, total) => {
        setIndexBuildProgress({ current, total });
      });

      // Reload the index
      const index = await loadSearchIndex();
      const meta = await getIndexMetadata();
      if (index && meta) {
        setLocalIndex(index);
        setIndexMeta(meta);
      }

      toast({
        title: '✅ האינדקס נבנה בהצלחה!',
        description: `${psakeiDin.length} פסקים מוכנים לחיפוש מיידי`,
      });
    } catch (error) {
      console.error('Error building local index:', error);
      toast({
        title: 'שגיאה בבניית האינדקס',
        description: String(error),
        variant: 'destructive',
      });
    } finally {
      setIsIndexBuilding(false);
    }
  }, [psakeiDin]);

  // Clear local index
  const clearLocalIndex = useCallback(async () => {
    try {
      await clearSearchIndex();
      setLocalIndex(null);
      setIndexMeta(null);
      toast({ title: 'האינדקס נמחק' });
    } catch (error) {
      console.error('Error clearing index:', error);
    }
  }, []);

  // Instant search using local index - with context!
  const instantSearch = useCallback(async (query: string): Promise<SearchResult[]> => {
    if (!localIndex || !query.trim()) return [];

    // Use the new searchWithContext for better results
    const contextResults = await searchWithContext(query, localIndex, 100, 3);
    
    // Convert to SearchResult format - one result per match with context
    const searchResults: SearchResult[] = [];
    
    for (const psak of contextResults) {
      for (const match of psak.matches) {
        searchResults.push({
          id: crypto.randomUUID(),
          text: match.matchedLine,
          lineNumber: match.lineNumber,
          matchedTerms: [query],
          score: psak.score,
          highlights: [],
          sourceType: 'psak' as const,
          psakId: psak.id,
          psakTitle: psak.title,
          psakCourt: psak.court,
          psakYear: psak.year,
          // Add context
          contextBefore: match.lineBefore,
          contextAfter: match.lineAfter,
          highlightedText: match.highlightedLine,
        });
      }
    }
    
    return searchResults;
  }, [localIndex]);

  // ===== Streaming Search with Web Worker =====
  
  // Initialize streaming search worker
  useEffect(() => {
    if (typeof Worker !== 'undefined') {
      searchWorkerRef.current = new Worker(
        new URL('../workers/searchWorker.ts', import.meta.url),
        { type: 'module' }
      );

      searchWorkerRef.current.onmessage = (e) => {
        const { type, payload } = e.data;
        
        if (type === 'SEARCH_BATCH') {
          // Add new batch results to streaming results
          setStreamingResults(prev => [...prev, ...payload.results.map((r: { psakId: string; psakTitle: string; psakCourt: string; psakYear: number; text: string; lineNumber: number; score: number; matchedTerms: string[]; contextBefore?: string; contextAfter?: string }) => ({
            id: crypto.randomUUID(),
            text: r.text,
            lineNumber: r.lineNumber,
            matchedTerms: r.matchedTerms,
            score: r.score,
            highlights: [],
            sourceType: 'psak' as const,
            psakId: r.psakId,
            psakTitle: r.psakTitle,
            psakCourt: r.psakCourt,
            psakYear: r.psakYear,
            contextBefore: r.contextBefore,
            contextAfter: r.contextAfter,
          }))]);
          
          // Update progress
          setSearchProgress({
            current: payload.processed,
            total: payload.total,
            percentage: payload.percentage,
            isActive: !payload.isFinal,
          });
        }
        
        if (type === 'SEARCH_COMPLETE') {
          setIsSearching(false);
          setSearchProgress({ current: 0, total: 0, percentage: 0, isActive: false });
          
          toast({
            title: 'החיפוש הושלם',
            description: `נמצאו ${payload.totalFound} תוצאות ב-${Math.round(payload.searchTime)}ms`,
          });
        }
      };
    }

    return () => {
      searchWorkerRef.current?.terminate();
    };
  }, []);

  // Perform streaming search
  const performStreamingSearch = useCallback(async (psakimList: PsakDin[], queryTerms: string[]) => {
    if (!searchWorkerRef.current || psakimList.length === 0) return;
    
    setStreamingResults([]); // Clear previous results
    setResults([]); // Clear main results
    setIsSearching(true);
    setSearchProgress({ current: 0, total: psakimList.length, percentage: 0, isActive: true });
    
    // Send to worker for streaming search
    searchWorkerRef.current.postMessage({
      type: 'SEARCH_STREAMING',
      payload: {
        psakim: psakimList,
        query: queryTerms.join(' '),
        options: {
          fuzzySearch: advancedSearchOptions.fuzzySearch,
          useRoots: advancedSearchOptions.useRoots,
          useSynonyms: advancedSearchOptions.useSynonyms,
          removeNikud: true,
          matchSofitLetters: true,
          maxFuzzyDistance: 2,
        },
        batchSize: 50,
      },
    });
  }, [advancedSearchOptions]);

  // Update main results from streaming results when search completes
  useEffect(() => {
    if (!searchProgress.isActive && streamingResults.length > 0) {
      // Sort by score and set as main results
      const sorted = [...streamingResults].sort((a, b) => b.score - a.score);
      setResults(sorted);
    }
  }, [searchProgress.isActive, streamingResults]);

  // Filter psakim by search term
  const filteredPsakim = psakimSearchTerm
    ? psakeiDin.filter(p =>
        p.title.includes(psakimSearchTerm) ||
        p.court.includes(psakimSearchTerm) ||
        p.summary.includes(psakimSearchTerm) ||
        (p.case_number && p.case_number.includes(psakimSearchTerm))
      )
    : psakeiDin;

  // Auto-load psakei din on mount
  useEffect(() => {
    loadPsakeiDin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem('smart-search-history', JSON.stringify(searchHistory));
  }, [searchHistory]);

  // Save templates to localStorage
  useEffect(() => {
    localStorage.setItem('smart-search-templates', JSON.stringify(savedTemplates));
  }, [savedTemplates]);

  // File upload handler
  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsProcessingFile(true);
    setProcessingProgress(0);
    let fullText = inputText;

    try {
      for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
        const file = files[fileIndex];
        const extension = file.name.split('.').pop()?.toLowerCase();
        setProcessingStatus(`מעבד ${file.name}...`);

        if (extension === 'txt') {
          const text = await file.text();
          fullText += (fullText ? '\n\n--- ' + file.name + ' ---\n\n' : '') + text;
        } else if (extension === 'docx' || extension === 'doc') {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          fullText += (fullText ? '\n\n--- ' + file.name + ' ---\n\n' : '') + result.value;
        } else if (extension === 'pdf') {
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
          let pdfText = '';
          
          for (let i = 1; i <= pdf.numPages; i++) {
            setProcessingProgress(((fileIndex / files.length) + (i / pdf.numPages / files.length)) * 100);
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
              .filter((item): item is TextItem => 'str' in item)
              .map((item) => item.str)
              .join(' ');
            pdfText += pageText + '\n\n';
          }
          fullText += (fullText ? '\n\n--- ' + file.name + ' ---\n\n' : '') + pdfText;
        } else if (extension === 'html' || extension === 'htm') {
          const text = await file.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(text, 'text/html');
          const htmlText = doc.body?.textContent || '';
          fullText += (fullText ? '\n\n--- ' + file.name + ' ---\n\n' : '') + htmlText;
        }

        setProcessingProgress(((fileIndex + 1) / files.length) * 100);
      }

      setInputText(fullText);
      toast({
        title: 'הצלחה',
        description: `${files.length} קבצים נטענו בהצלחה`,
      });
    } catch (error) {
      console.error('Error processing files:', error);
      toast({
        title: 'שגיאה',
        description: 'אירעה שגיאה בעיבוד הקבצים',
        variant: 'destructive',
      });
    } finally {
      setIsProcessingFile(false);
      setProcessingProgress(0);
      setProcessingStatus('');
    }
  }, [inputText]);

  // Export results
  const exportResults = useCallback((format: 'txt' | 'csv' | 'json') => {
    if (results.length === 0) {
      toast({ title: 'אין תוצאות', description: 'אין תוצאות לייצוא', variant: 'destructive' });
      return;
    }

    let content = '';
    let filename = `search-results-${new Date().toISOString().slice(0, 10)}`;
    let mimeType = 'text/plain';

    switch (format) {
      case 'txt':
        content = results.map((r, i) => `${i + 1}. [שורה ${r.lineNumber}]\n${r.text}\nמילים שנמצאו: ${r.matchedTerms.join(', ')}\n`).join('\n---\n\n');
        filename += '.txt';
        break;
      case 'csv':
        content = 'שורה,טקסט,מילים שנמצאו,ציון\n' + 
          results.map(r => `${r.lineNumber},"${r.text.split('"').join('""')}","${r.matchedTerms.join(', ')}",${r.score}`).join('\n');
        filename += '.csv';
        mimeType = 'text/csv';
        break;
      case 'json':
        content = JSON.stringify(results, null, 2);
        filename += '.json';
        mimeType = 'application/json';
        break;
    }

    const blob = new Blob(['\ufeff' + content], { type: mimeType + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    toast({ title: 'ייצוא הושלם', description: `הקובץ ${filename} הורד בהצלחה` });
    setShowExportDialog(false);
  }, [results]);

  // Generate share URL
  const generateShareUrl = useCallback(() => {
    const shareData = {
      conditions,
      filterRules,
      positionRules,
    };
    const encoded = btoa(encodeURIComponent(JSON.stringify(shareData)));
    const url = `${window.location.origin}${window.location.pathname}?search=${encoded}`;
    setShareUrl(url);
    setShowShareDialog(true);
  }, [conditions, filterRules, positionRules]);

  // Copy share URL
  const copyShareUrl = useCallback(() => {
    navigator.clipboard.writeText(shareUrl);
    toast({ title: 'הועתק', description: 'הקישור הועתק ללוח' });
  }, [shareUrl]);

  // Load from history
  const loadFromHistory = useCallback((item: typeof searchHistory[0]) => {
    setConditions(item.conditions);
    setShowHistoryDialog(false);
    toast({ title: 'נטען', description: `החיפוש "${item.query}" נטען` });
  }, []);

  // Clear history
  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    localStorage.removeItem('smart-search-history');
    toast({ title: 'נמחק', description: 'ההיסטוריה נמחקה' });
  }, []);

  // Add new condition
  const addCondition = useCallback(() => {
    const newCondition: SearchCondition = {
      id: crypto.randomUUID(),
      term: '',
      operator: 'contains',
      searchInWord: true,
      smartOptions: { ...DEFAULT_SMART_OPTIONS },
      logicalOperator: conditions.length > 0 ? 'AND' : undefined,
    };
    setConditions(prev => [...prev, newCondition]);
  }, [conditions.length]);

  // Update condition
  const updateCondition = useCallback((id: string, updates: Partial<SearchCondition>) => {
    setConditions(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  // Remove condition
  const removeCondition = useCallback((id: string) => {
    setConditions(prev => {
      const newConditions = prev.filter(c => c.id !== id);
      if (newConditions.length > 0 && newConditions[0].logicalOperator) {
        newConditions[0] = { ...newConditions[0], logicalOperator: undefined };
      }
      return newConditions;
    });
  }, []);

  // Add position rule
  const addPositionRule = useCallback((type: 'relative' | 'line_position') => {
    const newRule: PositionRule = {
      id: crypto.randomUUID(),
      type,
      maxDistance: type === 'relative' ? 5 : undefined,
      position: type === 'line_position' ? 'start' : undefined,
      withinWords: type === 'line_position' ? 3 : undefined,
    };
    setPositionRules(prev => [...prev, newRule]);
  }, []);

  // Remove position rule
  const removePositionRule = useCallback((id: string) => {
    setPositionRules(prev => prev.filter(r => r.id !== id));
  }, []);

  // Perform search
  const performSearch = useCallback(async () => {
    // Check if we have any valid search conditions
    const hasPatternCondition = conditions.some(c => c.operator === 'pattern');
    const hasTermCondition = conditions.some(c => c.term && c.term.trim().length > 0);
    const hasListCondition = conditions.some(c => c.operator === 'list' && c.listWords && c.listWords.length > 0);
    const hasNearCondition = conditions.some(c => c.operator === 'near' && (c.term || c.nearWord));
    
    const hasValidCondition = hasPatternCondition || hasTermCondition || hasListCondition || hasNearCondition;
    
    if (conditions.length === 0 && !inputText.trim()) {
      toast({
        title: 'שגיאה',
        description: 'יש להזין לפחות תנאי חיפוש אחד',
        variant: 'destructive',
      });
      return;
    }
    
    // If conditions exist but none have actual search criteria
    if (conditions.length > 0 && !hasValidCondition) {
      toast({
        title: 'שגיאה', 
        description: 'יש למלא לפחות תנאי חיפוש אחד (מילה, דפוס, או רשימה)',
        variant: 'destructive',
      });
      return;
    }

    // Check if we have content to search
    const hasPsakim = psakeiDin.length > 0;
    const hasCustomText = inputText.trim().length > 0;
    
    if (searchScope === 'custom' && !hasCustomText) {
      toast({
        title: 'שגיאה',
        description: 'יש להזין טקסט לחיפוש בטקסט מותאם',
        variant: 'destructive',
      });
      return;
    }
    
    // For 'all' scope, we can search on server even if no psakim loaded locally
    if (searchScope === 'selected' && !hasPsakim) {
      toast({
        title: 'שגיאה',
        description: 'אין פסקי דין נבחרים. טען פסקי דין או בחר "כל הפסקים"',
        variant: 'destructive',
      });
      return;
    }

    setIsSearching(true);
    
    try {
      // Get search terms from conditions
      const conditionTerms = conditions
        .filter(c => c.term && c.term.trim())
        .map(c => c.term.trim());
      
      // Extract words from pattern conditions (like masechet names)
      const patternTerms: string[] = [];
      for (const c of conditions) {
        if (c.operator === 'pattern' && c.patternType) {
          const preset = PATTERN_PRESETS[c.patternType];
          if (preset && preset.pattern) {
            // Extract Hebrew words from patterns like "(ברכות|שבת|עירובין|...)"
            const hebrewWords = preset.pattern.match(/[\u0590-\u05FF"]+/g);
            if (hebrewWords) {
              // Filter out short words (likely regex chars) and add valid words
              for (const word of hebrewWords) {
                if (word.length >= 2 && !patternTerms.includes(word)) {
                  patternTerms.push(word);
                }
              }
            }
          }
          // Also check custom pattern
          if (c.customPattern) {
            const customWords = c.customPattern.match(/[\u0590-\u05FF"]+/g);
            if (customWords) {
              for (const word of customWords) {
                if (word.length >= 2 && !patternTerms.includes(word)) {
                  patternTerms.push(word);
                }
              }
            }
          }
        }
      }
      
      // Combine condition terms with inputText and pattern terms
      const searchTerms: string[] = [...conditionTerms, ...patternTerms];
      if (inputText.trim() && !searchTerms.includes(inputText.trim())) {
        searchTerms.push(inputText.trim());
      }
      
      console.log('🔍 Search started:', { 
        localIndex: !!localIndex, 
        useLocalIndex: advancedSearchOptions.useLocalIndex,
        hasTermCondition,
        searchTerms,
        patternTerms,
        inputText: inputText.trim(),
        conditions: conditions.map(c => ({ term: c.term, operator: c.operator, patternType: c.patternType })),
      });

      // If no search terms at all, show error
      if (searchTerms.length === 0) {
        toast({
          title: 'אנא הזן מילת חיפוש',
          description: 'יש להקליד מילה בשדה החיפוש או להוסיף תנאי עם מילת חיפוש',
          variant: 'destructive',
        });
        setIsSearching(false);
        return;
      }

      // ====== OPTION 1: Instant search using local IndexedDB index ======
      if (advancedSearchOptions.useLocalIndex && localIndex && searchTerms.length > 0) {
        console.log('⚡ Using instant search with local index');
        
        toast({
          title: '⚡ חיפוש מיידי...',
          description: 'משתמש באינדקס מקומי',
        });
        
        const instantResults = await instantSearch(searchTerms.join(' '));
        console.log('⚡ Instant search results:', instantResults.length);
        
        if (instantResults.length > 0) {
          setResults(instantResults);
          
          // Add to history
          setSearchHistory(prev => [{
            id: crypto.randomUUID(),
            query: searchTerms.join(', '),
            timestamp: new Date(),
            resultsCount: instantResults.length,
            conditions: [...conditions],
          }, ...prev.slice(0, 49)]);
          
          toast({
            title: '⚡ חיפוש מיידי הושלם!',
            description: `נמצאו ${instantResults.length} תוצאות`,
          });
          
          setIsSearching(false);
          return;
        } else {
          console.log('⚠️ No results from instant search, falling back...');
        }
      }

      // ====== OPTION 2: Streaming search with Web Worker ======
      if (useStreamingSearch && searchScope === 'all' && searchTerms.length > 0) {
        console.log('🔄 Using streaming search');
        
        // Get psakim to search
        let psakimList: PsakDin[] = [];
        
        if (psakeiDin.length > 0) {
          psakimList = psakeiDin;
        } else {
          // Load from server with limit
          const searchLimitNum = searchLimit === 'all' ? 1000 : Math.min(searchLimit, 1000);
          toast({
            title: 'טוען פסקי דין...',
            description: `טוען עד ${searchLimitNum} פסקים לחיפוש`,
          });
          
          const { data } = await supabase
            .from('psakei_din')
            .select('id, title, court, year, case_number, summary, full_text')
            .order('created_at', { ascending: false })
            .limit(searchLimitNum);
          
          psakimList = (data as PsakDin[]) || [];
        }
        
        if (psakimList.length > 0) {
          performStreamingSearch(psakimList, searchTerms);
          return; // Streaming handles its own completion
        }
      }

      // ====== OPTION 3: Regular batch search (fallback) ======
      console.log('📋 Using regular batch search');
      const searchResults: SearchResult[] = [];
      
      // Helper to generate search variations
      const generateVariations = (term: string, smartOptions: SmartSearchOptions): string[] => {
        const variations: string[] = [term];
        
        // Remove nikud if enabled
        if (smartOptions.removeNikud) {
          variations.push(removeNikud(term));
        }
        
        // Normalize sofit letters
        if (smartOptions.matchSofitLetters) {
          variations.push(...variations.map(v => normalizeSofit(v)));
        }
        
        // Gematria variations
        if (smartOptions.matchGematria) {
          const gematria = calculateGematria(term);
          if (gematria > 0 && gematria <= 1000) {
            const hebrewNum = numberToHebrew(gematria);
            if (hebrewNum) variations.push(hebrewNum);
          }
        }
        
        // Acronym expansion
        if (smartOptions.expandAcronyms && term.includes('"')) {
          const acronym = term.split('"').join('');
          if (COMMON_ACRONYMS[acronym]) {
            variations.push(...COMMON_ACRONYMS[acronym]);
          }
        }
        
        // Case insensitive - add lowercase variations
        if (smartOptions.caseInsensitive) {
          variations.push(...variations.map(v => v.toLowerCase()));
        }
        
        return [...new Set(variations)]; // Remove duplicates
      };
      
      // Search function for a single text with source info
      const searchInText = (
        text: string, 
        sourceType: 'psak' | 'custom',
        psakInfo?: { id: string; title: string; court: string; year: number }
      ) => {
        // Split text into segments - by sentences (.), newlines, or fixed chunks
        // First try splitting by newlines, then by sentences if lines are too long
        let segments: string[] = text.split('\n').filter(line => line.trim());
        
        // If we have very long "lines" (no proper line breaks), split by sentences
        const needsSentenceSplit = segments.some(s => s.length > 300);
        if (needsSentenceSplit) {
          segments = [];
          for (const paragraph of text.split('\n').filter(p => p.trim())) {
            if (paragraph.length > 300) {
              // Split by sentence endings (. ? !)
              const sentences = paragraph.split(/(?<=[.?!])\s+/).filter(s => s.trim());
              segments.push(...sentences);
            } else {
              segments.push(paragraph);
            }
          }
        }
        
        // If still too long, chunk into ~150 char segments
        const finalSegments: string[] = [];
        for (const seg of segments) {
          if (seg.length > 200) {
            // Split into chunks at word boundaries
            const words = seg.split(/\s+/);
            let chunk = '';
            for (const word of words) {
              if (chunk.length + word.length > 150 && chunk) {
                finalSegments.push(chunk.trim());
                chunk = word;
              } else {
                chunk += (chunk ? ' ' : '') + word;
              }
            }
            if (chunk.trim()) finalSegments.push(chunk.trim());
          } else {
            finalSegments.push(seg);
          }
        }
        
        const lines = finalSegments.length > 0 ? finalSegments : segments;
        
        lines.forEach((line, index) => {
          let matches: boolean | undefined = undefined;
          const matchedTerms: string[] = [];
          
          for (const condition of conditions) {
            // Skip empty conditions, but allow pattern/list/near without term
            const needsTerm = !['near', 'list', 'pattern'].includes(condition.operator);
            if (needsTerm && !condition.term) continue;
            
            const smartOpts = condition.smartOptions || DEFAULT_SMART_OPTIONS;
            const variations = needsTerm ? generateVariations(condition.term, smartOpts) : [condition.term || ''];
            let lineText = line;
            
            // Apply text normalization
            if (smartOpts.removeNikud) {
              lineText = removeNikud(lineText);
            }
            if (smartOpts.matchSofitLetters) {
              lineText = normalizeSofit(lineText);
            }
            if (smartOpts.caseInsensitive) {
              lineText = lineText.toLowerCase();
            }
            
            let found = false;
            for (const searchTerm of variations) {
              const termToSearch = smartOpts.caseInsensitive ? searchTerm.toLowerCase() : searchTerm;
              
              // Escape special regex characters
              const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              
              switch (condition.operator) {
                case 'contains':
                  if (smartOpts.wordBoundary) {
                    const regex = new RegExp(`\\b${escapeRegex(termToSearch)}\\b`, smartOpts.caseInsensitive ? 'i' : '');
                    found = regex.test(lineText);
                  } else {
                    found = lineText.includes(termToSearch);
                  }
                  break;
                case 'not_contains':
                  found = !lineText.includes(termToSearch);
                  break;
                case 'starts_with':
                  found = lineText.trimStart().startsWith(termToSearch);
                  break;
                case 'ends_with':
                  found = lineText.trimEnd().endsWith(termToSearch);
                  break;
                case 'exact':
                  found = lineText.trim() === termToSearch.trim();
                  break;
                case 'regex':
                  try {
                    found = new RegExp(condition.term, smartOpts.caseInsensitive ? 'i' : '').test(line);
                  } catch {
                    found = false;
                  }
                  break;
                // NEAR - search for two words within N words of each other
                case 'near':
                  if (condition.nearWord && condition.nearDistance) {
                    const words = lineText.split(/\s+/);
                    const word1Index = words.findIndex(w => w.includes(termToSearch));
                    const word2Index = words.findIndex(w => w.includes(condition.nearWord!));
                    if (word1Index !== -1 && word2Index !== -1) {
                      found = Math.abs(word1Index - word2Index) <= condition.nearDistance;
                    }
                  }
                  break;
                // LIST - search for any/all words from a list
                case 'list':
                  if (condition.listWords && condition.listWords.length > 0) {
                    const listMatches = condition.listWords.filter(word => {
                      const wordToSearch = smartOpts.caseInsensitive ? word.toLowerCase() : word;
                      return lineText.includes(wordToSearch);
                    });
                    if (condition.listMode === 'all') {
                      found = listMatches.length === condition.listWords.length;
                    } else {
                      // 'any' mode - at least one word found
                      found = listMatches.length > 0;
                    }
                    if (found) {
                      matchedTerms.push(...listMatches);
                    }
                  }
                  break;
                // PATTERN - search by regex pattern
                case 'pattern':
                  try {
                    let patternToUse = '';
                    if (condition.patternType && condition.patternType !== 'custom') {
                      patternToUse = PATTERN_PRESETS[condition.patternType].pattern;
                    } else if (condition.customPattern) {
                      patternToUse = condition.customPattern;
                    }
                    if (patternToUse) {
                      const patternRegex = new RegExp(patternToUse, smartOpts.caseInsensitive ? 'gi' : 'g');
                      const patternMatches = line.match(patternRegex);
                      found = patternMatches !== null && patternMatches.length > 0;
                      if (found && patternMatches) {
                        matchedTerms.push(...patternMatches);
                      }
                    }
                  } catch {
                    found = false;
                  }
                  break;
              }
              
              if (found) break;
            }
            
            if (found && condition.operator !== 'not_contains') {
              matchedTerms.push(condition.term);
            }
            
            if (!condition.logicalOperator || condition.logicalOperator === 'AND') {
              matches = matches === undefined ? found : matches && found;
            } else if (condition.logicalOperator === 'OR') {
              matches = matches || found;
            } else if (condition.logicalOperator === 'NOT') {
              matches = matches && !found;
            }
          }
          
          // Apply filter rules
          if (matches && filterRules.minLineLength && line.length < filterRules.minLineLength) {
            matches = false;
          }
          if (matches && filterRules.maxLineLength && line.length > filterRules.maxLineLength) {
            matches = false;
          }
          if (matches && filterRules.mustContain && !line.includes(filterRules.mustContain)) {
            matches = false;
          }
          if (matches && filterRules.mustNotContain && line.includes(filterRules.mustNotContain)) {
            matches = false;
          }
          
          // Add result if matches (allow empty matchedTerms for not_contains)
          if (matches === true) {
            // Generate highlights
            const highlights: { start: number; end: number; term: string }[] = [];
            for (const term of matchedTerms) {
              let pos = 0;
              while ((pos = line.indexOf(term, pos)) !== -1) {
                highlights.push({ start: pos, end: pos + term.length, term });
                pos += term.length;
              }
            }
            
            // Get context lines (1 line before and 1 line after)
            const contextBefore = index > 0 ? lines[index - 1] : undefined;
            const contextAfter = index < lines.length - 1 ? lines[index + 1] : undefined;
            
            searchResults.push({
              id: crypto.randomUUID(),
              text: line,
              lineNumber: index + 1,
              matchedTerms: matchedTerms.length > 0 ? matchedTerms : conditions.map(c => c.term).filter(Boolean),
              score: matchedTerms.length > 0 ? matchedTerms.length / conditions.length : 1,
              highlights,
              contextBefore,
              contextAfter,
              sourceType,
              psakId: psakInfo?.id,
              psakTitle: psakInfo?.title,
              psakCourt: psakInfo?.court,
              psakYear: psakInfo?.year,
            });
          }
        });
      };
      
      // Determine which psakim to search
      let psakimToSearch: PsakDin[] = [];
      
      // For 'all' scope, search on server if we have a simple search term
      if (searchScope === 'all' && conditions.length === 1 && conditions[0].operator === 'contains' && conditions[0].term) {
        // Use server-side search for all psakim (more efficient)
        toast({
          title: 'מחפש בכל הפסקים...',
          description: 'חיפוש בשרת',
        });
        const serverResults = await searchPsakeiDinOnServer(conditions[0].term);
        psakimToSearch = serverResults;
      } else if (searchScope === 'all') {
        // For complex searches, use server-side search with limit to prevent memory issues
        const searchLimitNum = searchLimit === 'all' ? 500 : Math.min(searchLimit, 500);
        
        toast({
          title: 'מחפש בשרת...',
          description: `מוגבל ל-${searchLimitNum} תוצאות למניעת עומס`,
        });
        
        // Try to use server-side search first
        const serverResults = await searchPsakeiDinAdvanced(conditions, searchLimitNum);
        
        if (serverResults.length > 0) {
          psakimToSearch = serverResults;
        } else if (psakeiDin.length > 0) {
          // Fallback to local psakim if already loaded
          psakimToSearch = psakeiDin.slice(0, searchLimitNum);
        } else {
          // Load limited psakim from server
          toast({
            title: 'טוען פסקי דין...',
            description: `טוען עד ${searchLimitNum} פסקים`,
          });
          
          const { data, error } = await supabase
            .from('psakei_din')
            .select('id, title, court, year, case_number, summary, created_at')
            .order('created_at', { ascending: false })
            .limit(searchLimitNum);
          
          if (error) {
            toast({
              title: 'שגיאה בטעינת פסקים',
              description: error.message,
              variant: 'destructive',
            });
            return;
          }
          
          psakimToSearch = (data as PsakDin[]) || [];
          toast({
            title: 'נטענו פסקי דין',
            description: `${psakimToSearch.length} פסקי דין`,
          });
        }
      } else if (searchScope === 'selected' && selectedPsakim.length > 0) {
        psakimToSearch = psakeiDin.filter(p => selectedPsakim.includes(p.id));
      }
      
      // Apply search limit
      const limitedPsakim = searchLimit === 'all' 
        ? psakimToSearch 
        : psakimToSearch.slice(0, searchLimit);
      
      const totalToSearch = limitedPsakim.length;
      setSearchProgress({ current: 0, total: totalToSearch, percentage: 0, isActive: true });
      
      // Parallel batch processing for faster search
      const BATCH_SIZE = 50; // Process 50 psakim at a time
      const batches: PsakDin[][] = [];
      for (let i = 0; i < limitedPsakim.length; i += BATCH_SIZE) {
        batches.push(limitedPsakim.slice(i, i + BATCH_SIZE));
      }
      
      let processedCount = 0;
      
      // Process batches with parallel execution within each batch
      for (const batch of batches) {
        // Use Promise.all for parallel processing within batch
        await Promise.all(batch.map(async (psak) => {
          const textToSearch = psak.full_text || psak.summary;
          if (textToSearch) {
            searchInText(textToSearch, 'psak', {
              id: psak.id,
              title: psak.title,
              court: psak.court,
              year: psak.year,
            });
          }
        }));
        
        processedCount += batch.length;
        const percentage = Math.round((processedCount / totalToSearch) * 100);
        setSearchProgress({ 
          current: processedCount, 
          total: totalToSearch, 
          percentage, 
          isActive: true 
        });
        
        // Small yield to keep UI responsive
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      
      // Search in custom text if enabled
      if (includeInputText && inputText.trim()) {
        searchInText(inputText, 'custom');
      }
      
      // Apply position rules
      let filteredResults = searchResults;
      for (const rule of positionRules) {
        if (rule.type === 'relative' && rule.word1 && rule.word2 && rule.maxDistance) {
          filteredResults = filteredResults.filter(result => {
            const words = result.text.split(/\s+/);
            const pos1 = words.findIndex(w => w.includes(rule.word1!));
            const pos2 = words.findIndex(w => w.includes(rule.word2!));
            if (pos1 === -1 || pos2 === -1) return false;
            return Math.abs(pos1 - pos2) <= rule.maxDistance!;
          });
        } else if (rule.type === 'line_position' && rule.position && rule.withinWords) {
          filteredResults = filteredResults.filter(result => {
            const words = result.text.split(/\s+/);
            const matchedWord = result.matchedTerms[0];
            const wordIndex = words.findIndex(w => w.includes(matchedWord));
            if (wordIndex === -1) return true;
            
            if (rule.position === 'start') {
              return wordIndex < rule.withinWords;
            } else if (rule.position === 'end') {
              return wordIndex >= words.length - rule.withinWords;
            } else if (rule.position === 'middle') {
              return wordIndex >= rule.withinWords && wordIndex < words.length - rule.withinWords;
            }
            return true;
          });
        }
      }
      
      setResults(filteredResults);
      
      // Add to history
      setSearchHistory(prev => [{
        id: crypto.randomUUID(),
        query: conditions.map(c => c.term).filter(Boolean).join(', '),
        timestamp: new Date(),
        resultsCount: filteredResults.length,
        conditions: [...conditions],
      }, ...prev.slice(0, 49)]);
      
      toast({
        title: 'החיפוש הושלם',
        description: `נמצאו ${filteredResults.length} תוצאות${totalToSearch > 0 ? ` ב-${totalToSearch} פסקי דין` : ''}${searchLimit !== 'all' ? ` (מוגבל ל-${searchLimit})` : ''}`,
      });
    } catch (error) {
      toast({
        title: 'שגיאה',
        description: 'אירעה שגיאה בחיפוש',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
      setSearchProgress({ current: 0, total: 0, percentage: 0, isActive: false });
    }
  }, [inputText, conditions, filterRules, positionRules, psakeiDin, searchScope, selectedPsakim, includeInputText, searchPsakeiDinOnServer, searchPsakeiDinAdvanced, searchLimit]);

  // Run validation
  const runValidation = useCallback(() => {
    const results: { rule: string; passed: boolean; message: string }[] = [];
    
    // Validate conditions
    conditions.forEach((condition, index) => {
      if (!condition.term) {
        results.push({
          rule: `תנאי ${index + 1}`,
          passed: false,
          message: 'לא הוגדר מונח חיפוש',
        });
      } else {
        results.push({
          rule: `תנאי ${index + 1}: "${condition.term}"`,
          passed: true,
          message: 'תקין',
        });
      }
    });
    
    // Validate position rules
    positionRules.forEach((rule, index) => {
      if (rule.type === 'relative' && (!rule.word1 || !rule.word2)) {
        results.push({
          rule: `כלל מיקום ${index + 1}`,
          passed: false,
          message: 'חסרות מילים להשוואה',
        });
      } else {
        results.push({
          rule: `כלל מיקום ${index + 1}`,
          passed: true,
          message: 'תקין',
        });
      }
    });
    
    setValidationResults(results);
  }, [conditions, positionRules]);

  // Load template
  const loadTemplate = useCallback((template: SearchTemplate) => {
    setConditions(template.conditions.length > 0 ? template.conditions : [{
      id: crypto.randomUUID(),
      term: '',
      operator: 'contains',
      searchInWord: true,
      smartOptions: { ...DEFAULT_SMART_OPTIONS },
    }]);
    setFilterRules(template.filterRules);
    setPositionRules(template.positionRules);
    setShowTemplates(false);
    toast({
      title: 'תבנית נטענה',
      description: template.name,
    });
  }, []);

  // Character count
  const charCount = inputText.length;
  const wordCount = inputText.trim() ? inputText.trim().split(/\s+/).length : 0;
  const lineCount = inputText.trim() ? inputText.trim().split('\n').length : 0;

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-white p-4 md:p-6" dir="rtl">
        <div className="max-w-full mx-auto space-y-4">
          
          {/* Database Count Card */}
          <Card className="border-2 border-[#b8860b]/30 bg-gradient-to-r from-[#b8860b]/5 to-[#1e3a5f]/5 shadow-sm">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-[#b8860b]/10">
                    <Database className="w-6 h-6 text-[#b8860b]" />
                  </div>
                  <div>
                    <p className="text-sm text-[#1e3a5f]/60">סה"כ פסקי דין במאגר</p>
                    <p className="text-3xl font-bold text-[#1e3a5f]">
                      {isLoadingPsakim ? (
                        <Loader2 className="w-6 h-6 animate-spin text-[#b8860b]" />
                      ) : (
                        psakeiDin.length.toLocaleString('he-IL')
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className="bg-white text-[#1e3a5f] border border-[#b8860b]">
                    💾 נתונים מקומיים
                  </Badge>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={loadPsakeiDin} 
                    disabled={isLoadingPsakim}
                    className="border-[#b8860b] text-[#1e3a5f] hover:bg-[#b8860b]/10 gap-2"
                  >
                    {isLoadingPsakim ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    עדכן
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Compact Header */}
          <div className="flex items-center justify-between bg-white border border-[#b8860b] rounded-lg p-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white">
                <Search className="h-5 w-5 text-[#b8860b]" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#1e3a5f]">חיפוש חכם בפסקי דין</h1>
              </div>
            </div>
          </div>

          {/* Main Search Area - Full Width */}
          <Card className="border border-[#b8860b] shadow-lg bg-white">
            <CardContent className="p-6">
              {/* Search Input - Large and Clear */}
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-6 w-6 text-[#b8860b]" />
                    <Input
                      placeholder="הקלד כאן את מילות החיפוש (או השתמש בבנאי למטה)..."
                      className="pr-12 h-14 text-lg border border-[#b8860b] focus:border-[#b8860b] bg-white text-[#1e3a5f] placeholder:text-[#1e3a5f]/40 rounded-lg"
                      value={conditions[0]?.term || ''}
                      onChange={(e) => {
                        if (conditions.length === 0) {
                          addCondition();
                        }
                        if (conditions[0]) {
                          updateCondition(conditions[0].id, { term: e.target.value });
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (conditions[0]?.term || conditions.some(c => c.operator === 'pattern'))) {
                          performSearch();
                        }
                      }}
                    />
                    {/* Clear button for main search input */}
                    {conditions[0]?.term && (
                      <button
                        onClick={() => {
                          if (conditions[0]) {
                            updateCondition(conditions[0].id, { term: '' });
                          }
                        }}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                  <Button 
                    size="lg"
                    onClick={performSearch}
                    disabled={isSearching || (conditions.length === 0 && !inputText)}
                    className="h-14 px-8 bg-[#b8860b] hover:bg-[#996d00] text-white font-bold text-lg shadow-md"
                  >
                    {isSearching ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <Search className="h-5 w-5 ml-2" />
                        חפש
                      </>
                    )}
                  </Button>
                </div>

                {/* Search Scope Selection */}
                <div className="flex items-center gap-4 p-3 bg-white rounded-lg border border-[#b8860b]">
                  <span className="text-sm font-bold text-[#1e3a5f]">חפש ב:</span>
                  <div className="flex gap-2">
                    <Button
                      variant={searchScope === 'all' ? 'default' : 'outline'}
                      size="sm"
                      className={cn(
                        "gap-2",
                        searchScope === 'all' 
                          ? "bg-[#b8860b] hover:bg-[#996d00] text-white" 
                          : "border-[#b8860b] text-[#1e3a5f] hover:bg-white"
                      )}
                      onClick={() => setSearchScope('all')}
                    >
                      <Database className="h-4 w-4" />
                      כל הפסקים ({psakeiDin.length})
                    </Button>
                    <Button
                      variant={searchScope === 'selected' ? 'default' : 'outline'}
                      size="sm"
                      className={cn(
                        "gap-2",
                        searchScope === 'selected' 
                          ? "bg-[#b8860b] hover:bg-[#996d00] text-white" 
                          : "border-[#b8860b] text-[#1e3a5f] hover:bg-white"
                      )}
                      onClick={() => setSearchScope('selected')}
                      disabled={selectedPsakim.length === 0}
                    >
                      <Check className="h-4 w-4" />
                      נבחרים ({selectedPsakim.length})
                    </Button>
                  </div>
                  
                  {/* Search Limit Selector */}
                  <Separator orientation="vertical" className="h-6 mx-2" />
                  <span className="text-sm font-bold text-[#1e3a5f]">הגבל ל:</span>
                  <div className="flex gap-1 flex-wrap">
                    {[100, 500, 1000, 2000, 5000, 'all' as const].map((limit) => (
                      <Button
                        key={limit}
                        variant={searchLimit === limit ? 'default' : 'outline'}
                        size="sm"
                        className={cn(
                          "min-w-[60px] text-xs",
                          searchLimit === limit 
                            ? "bg-[#1e3a5f] hover:bg-[#2a4a7f] text-white" 
                            : "border-[#1e3a5f]/30 text-[#1e3a5f] hover:bg-[#1e3a5f]/10"
                        )}
                        onClick={() => setSearchLimit(limit)}
                      >
                        {limit === 'all' ? 'הכל' : limit}
                      </Button>
                    ))}
                  </div>
                  
                  {/* Quick Stats */}
                  <div className="mr-auto flex items-center gap-3 text-xs text-[#1e3a5f]/60">
                    {results.length > 0 && (
                      <Badge className="bg-white text-[#1e3a5f] border border-[#b8860b]">
                        {results.length} תוצאות נמצאו
                      </Badge>
                    )}
                  </div>
                </div>
                
                {/* Search Progress Indicator */}
                {searchProgress.isActive && (
                  <div className="p-3 bg-white rounded-lg border border-[#b8860b]">
                    <div className="flex items-center gap-3 mb-2">
                      <Loader2 className="h-4 w-4 animate-spin text-[#b8860b]" />
                      <span className="text-sm font-bold text-[#1e3a5f]">
                        מחפש... {searchProgress.current}/{searchProgress.total} פסקי דין ({searchProgress.percentage}%)
                      </span>
                    </div>
                    <Progress value={searchProgress.percentage} className="h-2" />
                  </div>
                )}

                {/* Advanced Search Options - Collapsible */}
                <Collapsible defaultOpen={false}>
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200 cursor-pointer hover:from-purple-100 hover:to-blue-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <Brain className="h-5 w-5 text-purple-600" />
                        <span className="text-sm font-bold text-purple-800">חיפוש חכם - אפשרויות מתקדמות</span>
                        <div className="flex items-center gap-2">
                          {isWorkerReady && (
                            <Badge className="bg-green-100 text-green-700 text-xs">
                              <Zap className="h-3 w-3 mr-1" />
                              אינדקס פעיל
                            </Badge>
                          )}
                          {isIndexing && (
                            <Badge className="bg-yellow-100 text-yellow-700 text-xs">
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              בונה אינדקס...
                            </Badge>
                          )}
                          {indexStats && (
                            <span className="text-xs text-purple-600">
                              {indexStats.wordCount.toLocaleString()} מילים | {indexStats.psakimCount} פסקים
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronDown className="h-4 w-4 text-purple-600 transition-transform duration-200" />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 p-4 bg-white rounded-lg border border-purple-200">
                      {/* Select All / Deselect All Buttons */}
                      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-purple-100">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1 border-green-300 text-green-700 hover:bg-green-50"
                          onClick={() => setAdvancedSearchOptions(prev => ({
                            ...prev,
                            useWorker: true,
                            useServerFTS: true,
                            fuzzySearch: true,
                            useRoots: true,
                            useSynonyms: true,
                            useCache: true,
                            expandAcronyms: true,
                            phoneticSearch: true,
                            ocrCorrection: true,
                            useNgrams: true,
                            removeStopWords: true,
                            useLocalIndex: true,
                          }))}
                        >
                          <CheckSquare className="h-3 w-3" />
                          בחר הכל
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1 border-red-300 text-red-700 hover:bg-red-50"
                          onClick={() => setAdvancedSearchOptions(prev => ({
                            ...prev,
                            useWorker: false,
                            useServerFTS: false,
                            fuzzySearch: false,
                            useRoots: false,
                            useSynonyms: false,
                            useCache: false,
                            expandAcronyms: false,
                            phoneticSearch: false,
                            ocrCorrection: false,
                            useNgrams: false,
                            removeStopWords: false,
                            useLocalIndex: false,
                          }))}
                        >
                          <Square className="h-3 w-3" />
                          בטל הכל
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {/* Worker Search */}
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="useWorker"
                            checked={advancedSearchOptions.useWorker}
                            onCheckedChange={(checked) => 
                              setAdvancedSearchOptions(prev => ({ ...prev, useWorker: !!checked }))
                            }
                          />
                          <Label htmlFor="useWorker" className="text-sm cursor-pointer">
                            <Zap className="h-3 w-3 inline mr-1 text-yellow-500" />
                            חיפוש מקבילי (Worker)
                          </Label>
                        </div>
                        
                        {/* Server FTS */}
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="useServerFTS"
                            checked={advancedSearchOptions.useServerFTS}
                            onCheckedChange={(checked) => 
                              setAdvancedSearchOptions(prev => ({ ...prev, useServerFTS: !!checked }))
                            }
                          />
                          <Label htmlFor="useServerFTS" className="text-sm cursor-pointer">
                            <Database className="h-3 w-3 inline mr-1 text-blue-500" />
                            חיפוש בשרת (FTS)
                          </Label>
                        </div>
                        
                        {/* Fuzzy Search */}
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="fuzzySearch"
                            checked={advancedSearchOptions.fuzzySearch}
                            onCheckedChange={(checked) => 
                              setAdvancedSearchOptions(prev => ({ ...prev, fuzzySearch: !!checked }))
                            }
                          />
                          <Label htmlFor="fuzzySearch" className="text-sm cursor-pointer">
                            <Sparkles className="h-3 w-3 inline mr-1 text-purple-500" />
                            חיפוש מטושטש (Fuzzy)
                          </Label>
                        </div>
                        
                        {/* Hebrew Roots */}
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="useRoots"
                            checked={advancedSearchOptions.useRoots}
                            onCheckedChange={(checked) => 
                              setAdvancedSearchOptions(prev => ({ ...prev, useRoots: !!checked }))
                            }
                          />
                          <Label htmlFor="useRoots" className="text-sm cursor-pointer">
                            <span className="font-hebrew text-xs mr-1">שרש</span>
                            חיפוש לפי שורש עברי
                          </Label>
                        </div>
                        
                        {/* Synonyms */}
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="useSynonyms"
                            checked={advancedSearchOptions.useSynonyms}
                            onCheckedChange={(checked) => 
                              setAdvancedSearchOptions(prev => ({ ...prev, useSynonyms: !!checked }))
                            }
                          />
                          <Label htmlFor="useSynonyms" className="text-sm cursor-pointer">
                            <ArrowLeftRight className="h-3 w-3 inline mr-1 text-green-500" />
                            מילים נרדפות
                          </Label>
                        </div>
                        
                        {/* Cache */}
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="useCache"
                            checked={advancedSearchOptions.useCache}
                            onCheckedChange={(checked) => 
                              setAdvancedSearchOptions(prev => ({ ...prev, useCache: !!checked }))
                            }
                          />
                          <Label htmlFor="useCache" className="text-sm cursor-pointer">
                            <Clock className="h-3 w-3 inline mr-1 text-orange-500" />
                            שמור בזיכרון (Cache)
                          </Label>
                        </div>
                        
                        {/* Expand Acronyms */}
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="expandAcronyms"
                            checked={advancedSearchOptions.expandAcronyms}
                            onCheckedChange={(checked) => 
                              setAdvancedSearchOptions(prev => ({ ...prev, expandAcronyms: !!checked }))
                            }
                          />
                          <Label htmlFor="expandAcronyms" className="text-sm cursor-pointer">
                            <span className="font-bold text-xs mr-1">ר"ת</span>
                            הרחבת ראשי תיבות
                          </Label>
                        </div>
                        
                        {/* Phonetic Search */}
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="phoneticSearch"
                            checked={advancedSearchOptions.phoneticSearch}
                            onCheckedChange={(checked) => 
                              setAdvancedSearchOptions(prev => ({ ...prev, phoneticSearch: !!checked }))
                            }
                          />
                          <Label htmlFor="phoneticSearch" className="text-sm cursor-pointer">
                            🔊 חיפוש פונטי (לפי צליל)
                          </Label>
                        </div>
                        
                        {/* OCR Correction */}
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="ocrCorrection"
                            checked={advancedSearchOptions.ocrCorrection}
                            onCheckedChange={(checked) => 
                              setAdvancedSearchOptions(prev => ({ ...prev, ocrCorrection: !!checked }))
                            }
                          />
                          <Label htmlFor="ocrCorrection" className="text-sm cursor-pointer">
                            📄 תיקון שגיאות סריקה (OCR)
                          </Label>
                        </div>
                        
                        {/* N-grams */}
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="useNgrams"
                            checked={advancedSearchOptions.useNgrams}
                            onCheckedChange={(checked) => 
                              setAdvancedSearchOptions(prev => ({ ...prev, useNgrams: !!checked }))
                            }
                          />
                          <Label htmlFor="useNgrams" className="text-sm cursor-pointer">
                            🔤 חיפוש חלקי (N-gram)
                          </Label>
                        </div>
                        
                        {/* Stop Words */}
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="removeStopWords"
                            checked={advancedSearchOptions.removeStopWords}
                            onCheckedChange={(checked) => 
                              setAdvancedSearchOptions(prev => ({ ...prev, removeStopWords: !!checked }))
                            }
                          />
                          <Label htmlFor="removeStopWords" className="text-sm cursor-pointer">
                            🚫 התעלם ממילות קישור
                          </Label>
                        </div>
                      </div>
                      
                      {/* Advanced Sliders */}
                      <div className="mt-4 pt-4 border-t border-purple-100 grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Fuzzy Threshold */}
                        <div className="space-y-2">
                          <Label className="text-xs text-purple-700">
                            רגישות חיפוש מטושטש: {(advancedSearchOptions.fuzzyThreshold * 100).toFixed(0)}%
                          </Label>
                          <input
                            type="range"
                            min="50"
                            max="100"
                            value={advancedSearchOptions.fuzzyThreshold * 100}
                            onChange={(e) => setAdvancedSearchOptions(prev => ({
                              ...prev,
                              fuzzyThreshold: parseInt(e.target.value) / 100
                            }))}
                            className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                        
                        {/* Title Boost */}
                        <div className="space-y-2">
                          <Label className="text-xs text-purple-700">
                            הגברת התאמה בכותרת: x{advancedSearchOptions.boostTitle.toFixed(1)}
                          </Label>
                          <input
                            type="range"
                            min="10"
                            max="50"
                            value={advancedSearchOptions.boostTitle * 10}
                            onChange={(e) => setAdvancedSearchOptions(prev => ({
                              ...prev,
                              boostTitle: parseInt(e.target.value) / 10
                            }))}
                            className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                        
                        {/* Exact Match Boost */}
                        <div className="space-y-2">
                          <Label className="text-xs text-purple-700">
                            הגברת התאמה מדויקת: x{advancedSearchOptions.boostExactMatch.toFixed(1)}
                          </Label>
                          <input
                            type="range"
                            min="10"
                            max="50"
                            value={advancedSearchOptions.boostExactMatch * 10}
                            onChange={(e) => setAdvancedSearchOptions(prev => ({
                              ...prev,
                              boostExactMatch: parseInt(e.target.value) / 10
                            }))}
                            className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                      </div>
                      
                      {/* Index Status */}
                      {indexStats && (
                        <div className="mt-4 pt-4 border-t border-purple-100">
                          <div className="flex items-center gap-4 text-xs text-purple-600">
                            <span>
                              <strong>אינדקס:</strong> {indexStats.wordCount.toLocaleString()} מילים ייחודיות
                            </span>
                            <span>
                              <strong>פסקים:</strong> {indexStats.psakimCount}
                            </span>
                            <span>
                              <strong>סה"כ מילים:</strong> {indexStats.totalWords.toLocaleString()}
                            </span>
                            <span>
                              <strong>זמן בנייה:</strong> {indexStats.buildTime.toFixed(0)}ms
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Local IndexedDB Pre-indexing Section */}
                      <div className="mt-4 pt-4 border-t border-purple-100">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <HardDrive className="h-4 w-4 text-indigo-600" />
                            <span className="text-sm font-bold text-indigo-800">אינדקס מקומי (חיפוש מיידי)</span>
                            {localIndex && (
                              <Badge className="bg-green-100 text-green-700 text-xs">
                                <Check className="h-3 w-3 mr-1" />
                                מוכן
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="useLocalIndex"
                              checked={advancedSearchOptions.useLocalIndex}
                              onCheckedChange={(checked) => 
                                setAdvancedSearchOptions(prev => ({ ...prev, useLocalIndex: !!checked }))
                              }
                            />
                            <Label htmlFor="useLocalIndex" className="text-xs cursor-pointer">
                              השתמש באינדקס מקומי
                            </Label>
                          </div>
                        </div>
                        
                        {indexMeta && (
                          <div className="mb-3 p-2 bg-indigo-50 rounded text-xs text-indigo-700">
                            <div className="flex items-center justify-between">
                              <span>{indexMeta.psakimCount.toLocaleString()} פסקים | {indexMeta.totalWords.toLocaleString()} מילים</span>
                              <span>עדכון אחרון: {new Date(indexMeta.lastUpdated).toLocaleString('he-IL')}</span>
                            </div>
                          </div>
                        )}
                        
                        {isIndexBuilding && (
                          <div className="mb-3 p-2 bg-yellow-50 rounded border border-yellow-200">
                            <div className="flex items-center gap-2 mb-2">
                              <Loader2 className="h-4 w-4 animate-spin text-yellow-600" />
                              <span className="text-sm text-yellow-800">
                                בונה אינדקס... {indexBuildProgress.current}/{indexBuildProgress.total}
                              </span>
                            </div>
                            <Progress 
                              value={(indexBuildProgress.current / Math.max(indexBuildProgress.total, 1)) * 100} 
                              className="h-2" 
                            />
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={buildLocalIndex}
                            disabled={isIndexBuilding || psakeiDin.length === 0}
                            className="border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                          >
                            {isIndexBuilding ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Gauge className="h-4 w-4 mr-2" />
                            )}
                            {localIndex ? 'עדכן אינדקס' : 'בנה אינדקס מקומי'}
                          </Button>
                          
                          {localIndex && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={clearLocalIndex}
                              className="text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              מחק אינדקס
                            </Button>
                          )}
                          
                          <div className="flex items-center gap-2 mr-4">
                            <Checkbox
                              id="useStreamingSearch"
                              checked={useStreamingSearch}
                              onCheckedChange={(checked) => setUseStreamingSearch(!!checked)}
                            />
                            <Label htmlFor="useStreamingSearch" className="text-xs cursor-pointer">
                              <RefreshCw className="h-3 w-3 inline mr-1 text-blue-500" />
                              הצג תוצאות בזמן אמת (Streaming)
                            </Label>
                          </div>
                        </div>
                        
                        <p className="mt-2 text-xs text-gray-500">
                          💡 האינדקס המקומי מאפשר חיפוש מיידי ללא המתנה. נשמר בדפדפן ופעיל גם אופליין.
                        </p>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Query Builder - Collapsible */}
                <Collapsible defaultOpen={false} className="mt-4">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-[#b8860b] cursor-pointer hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <Search className="h-5 w-5 text-[#b8860b]" />
                        <span className="text-sm font-bold text-[#1e3a5f]">בנאי שאילתות חיפוש</span>
                        <span className="text-xs text-[#1e3a5f]/60">בנה חיפוש מתקדם עם תנאים מרובים</span>
                      </div>
                      <ChevronDown className="h-4 w-4 text-[#1e3a5f] transition-transform duration-200" />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-3 p-4 bg-white rounded-lg border border-[#b8860b]">
                      {/* Condition Cards */}
                      <div className="flex gap-2 mb-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowTemplates(!showTemplates)}
                          className="border-[#b8860b] text-[#1e3a5f] hover:bg-gray-50"
                        >
                          <BookOpen className="h-4 w-4 ml-1" />
                          תבניות
                        </Button>
                        <Button
                          size="sm"
                          onClick={addCondition}
                          className="bg-[#b8860b] hover:bg-[#996d00] text-white"
                        >
                          <Plus className="h-4 w-4 ml-1" />
                          הוסף תנאי
                        </Button>
                      </div>

                      {/* Conditions List */}
                      <ScrollArea className="max-h-[300px]">
                        <div className="space-y-3">
                          {conditions.map((condition, index) => (
                            <ConditionCard
                              key={condition.id}
                              condition={condition}
                              index={index}
                              onUpdate={(updates) => updateCondition(condition.id, updates)}
                              onRemove={() => removeCondition(condition.id)}
                              showLogicalOperator={index > 0}
                            />
                          ))}
                        </div>
                      </ScrollArea>

                      {conditions.length === 0 && (
                        <div className="text-center py-6 text-[#1e3a5f]/60">
                          <Search className="h-10 w-10 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">לחץ "הוסף תנאי" להתחיל לבנות חיפוש</p>
                        </div>
                      )}
                      
                      {/* Search Actions - BIG SEARCH BUTTON */}
                      {conditions.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-[#b8860b]/30">
                          <div className="flex flex-wrap gap-3 items-center justify-between">
                            {/* Search Info */}
                            <div className="text-sm text-[#1e3a5f]/70">
                              <span className="font-bold">{conditions.length}</span> תנאים הוגדרו | 
                              יחפש ב-<span className="font-bold">{psakeiDin.length.toLocaleString()}</span> פסקי דין
                            </div>
                            
                            {/* Action Buttons */}
                            <div className="flex gap-2">
                              {/* Clear All Button */}
                              <Button
                                variant="outline"
                                size="lg"
                                onClick={() => {
                                  setConditions([]);
                                  setResults([]);
                                }}
                                className="border-red-300 text-red-600 hover:bg-red-50 gap-2"
                              >
                                <X className="h-5 w-5" />
                                נקה הכל
                              </Button>
                              
                              {/* BIG SEARCH BUTTON */}
                              <Button 
                                size="lg"
                                onClick={performSearch}
                                disabled={isSearching || conditions.length === 0}
                                className="h-14 px-10 bg-[#b8860b] hover:bg-[#996d00] text-white font-bold text-lg shadow-lg gap-3"
                              >
                                {isSearching ? (
                                  <>
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                    מחפש...
                                  </>
                                ) : (
                                  <>
                                    <Search className="h-6 w-6" />
                                    🔍 חפש בכל הפסקים ({psakeiDin.length})
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Smart Search Options - Collapsible - Moved here */}
                <Collapsible defaultOpen={false} className="mt-4">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-[#b8860b] cursor-pointer hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <Sparkles className="h-5 w-5 text-[#b8860b]" />
                        <span className="text-sm font-bold text-[#1e3a5f]">חיפוש חכם - אפשרויות מתקדמות</span>
                      </div>
                      <ChevronDown className="h-4 w-4 text-[#1e3a5f] transition-transform duration-200" />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-3 p-4 bg-white rounded-lg border border-[#b8860b]">
                      {/* Select All / Deselect All Buttons */}
                      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#b8860b]/30">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1 border-green-300 text-green-700 hover:bg-green-50"
                          onClick={() => setGlobalSmartOptions(prev => ({
                            ...prev,
                            numbersToLetters: true,
                            wordVariations: true,
                            ignoreNikud: true,
                            sofitEquivalence: true,
                            gematriaSearch: true,
                            acronymExpansion: true,
                            removeNikud: true,
                            matchSofitLetters: true,
                            matchGematria: true,
                            expandAcronyms: true,
                            caseInsensitive: true,
                            wordBoundary: true,
                          }))}
                        >
                          <CheckSquare className="h-3 w-3" />
                          בחר הכל
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1 border-red-300 text-red-700 hover:bg-red-50"
                          onClick={() => setGlobalSmartOptions(prev => ({
                            ...prev,
                            numbersToLetters: false,
                            wordVariations: false,
                            ignoreNikud: false,
                            sofitEquivalence: false,
                            gematriaSearch: false,
                            acronymExpansion: false,
                            removeNikud: false,
                            matchSofitLetters: false,
                            matchGematria: false,
                            expandAcronyms: false,
                            caseInsensitive: false,
                            wordBoundary: false,
                          }))}
                        >
                          <Square className="h-3 w-3" />
                          בטל הכל
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {/* מספרים ↔ אותיות */}
                        <div className="flex items-start gap-3 p-3 rounded-lg border border-[#b8860b]/50 bg-white hover:border-[#b8860b] transition-all">
                          <Checkbox
                            id="smart-numbersToLetters"
                            checked={globalSmartOptions.numbersToLetters}
                            onCheckedChange={(checked) => setGlobalSmartOptions(prev => ({ ...prev, numbersToLetters: !!checked }))}
                            className="mt-0.5 border-[#b8860b] data-[state=checked]:bg-[#b8860b]"
                          />
                          <div className="flex-1">
                            <Label htmlFor="smart-numbersToLetters" className="text-sm font-bold text-[#1e3a5f] cursor-pointer block">
                              מספרים ↔ אותיות
                            </Label>
                            <p className="text-xs text-[#1e3a5f]/60 mt-0.5">דף 20 ימצא גם דף כ׳</p>
                          </div>
                        </div>

                        {/* וריאציות מילים */}
                        <div className="flex items-start gap-3 p-3 rounded-lg border border-[#b8860b]/50 bg-white hover:border-[#b8860b] transition-all">
                          <Checkbox
                            id="smart-wordVariations"
                            checked={globalSmartOptions.wordVariations}
                            onCheckedChange={(checked) => setGlobalSmartOptions(prev => ({ ...prev, wordVariations: !!checked }))}
                            className="mt-0.5 border-[#b8860b] data-[state=checked]:bg-[#b8860b]"
                          />
                          <div className="flex-1">
                            <Label htmlFor="smart-wordVariations" className="text-sm font-bold text-[#1e3a5f] cursor-pointer block">
                              וריאציות מילים
                            </Label>
                            <p className="text-xs text-[#1e3a5f]/60 mt-0.5">יחיד/רבים, עם/בלי ה׳</p>
                          </div>
                        </div>

                        {/* התעלמות מניקוד */}
                        <div className="flex items-start gap-3 p-3 rounded-lg border border-[#b8860b]/50 bg-white hover:border-[#b8860b] transition-all">
                          <Checkbox
                            id="smart-ignoreNikud"
                            checked={globalSmartOptions.ignoreNikud}
                            onCheckedChange={(checked) => setGlobalSmartOptions(prev => ({ ...prev, ignoreNikud: !!checked }))}
                            className="mt-0.5 border-[#b8860b] data-[state=checked]:bg-[#b8860b]"
                          />
                          <div className="flex-1">
                            <Label htmlFor="smart-ignoreNikud" className="text-sm font-bold text-[#1e3a5f] cursor-pointer block">
                              התעלמות מניקוד
                            </Label>
                            <p className="text-xs text-[#1e3a5f]/60 mt-0.5">מתעלם מסימני ניקוד בחיפוש</p>
                          </div>
                        </div>

                        {/* אותיות סופיות */}
                        <div className="flex items-start gap-3 p-3 rounded-lg border border-[#b8860b]/50 bg-white hover:border-[#b8860b] transition-all">
                          <Checkbox
                            id="smart-sofitEquivalence"
                            checked={globalSmartOptions.sofitEquivalence}
                            onCheckedChange={(checked) => setGlobalSmartOptions(prev => ({ ...prev, sofitEquivalence: !!checked }))}
                            className="mt-0.5 border-[#b8860b] data-[state=checked]:bg-[#b8860b]"
                          />
                          <div className="flex-1">
                            <Label htmlFor="smart-sofitEquivalence" className="text-sm font-bold text-[#1e3a5f] cursor-pointer block">
                              אותיות סופיות
                            </Label>
                            <p className="text-xs text-[#1e3a5f]/60 mt-0.5">ך=כ, ם=מ, ן=נ, ף=פ, ץ=צ</p>
                          </div>
                        </div>

                        {/* חיפוש גימטריא */}
                        <div className="flex items-start gap-3 p-3 rounded-lg border border-[#b8860b]/50 bg-white hover:border-[#b8860b] transition-all">
                          <Checkbox
                            id="smart-gematriaSearch"
                            checked={globalSmartOptions.gematriaSearch}
                            onCheckedChange={(checked) => setGlobalSmartOptions(prev => ({ ...prev, gematriaSearch: !!checked }))}
                            className="mt-0.5 border-[#b8860b] data-[state=checked]:bg-[#b8860b]"
                          />
                          <div className="flex-1">
                            <Label htmlFor="smart-gematriaSearch" className="text-sm font-bold text-[#1e3a5f] cursor-pointer block">
                              חיפוש גימטריא
                            </Label>
                            <p className="text-xs text-[#1e3a5f]/60 mt-0.5">מוצא מילים עם אותו ערך מספרי</p>
                          </div>
                        </div>

                        {/* ראשי תיבות */}
                        <div className="flex items-start gap-3 p-3 rounded-lg border border-[#b8860b]/50 bg-white hover:border-[#b8860b] transition-all">
                          <Checkbox
                            id="smart-acronymExpansion"
                            checked={globalSmartOptions.acronymExpansion}
                            onCheckedChange={(checked) => setGlobalSmartOptions(prev => ({ ...prev, acronymExpansion: !!checked }))}
                            className="mt-0.5 border-[#b8860b] data-[state=checked]:bg-[#b8860b]"
                          />
                          <div className="flex-1">
                            <Label htmlFor="smart-acronymExpansion" className="text-sm font-bold text-[#1e3a5f] cursor-pointer block">
                              ראשי תיבות
                            </Label>
                            <p className="text-xs text-[#1e3a5f]/60 mt-0.5">מרחיב קיצורים נפוצים</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Text Input Area - For Custom Text Search */}
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-bold text-[#1e3a5f]">
                      הכנס טקסט מותאם לחיפוש (אופציונלי)
                    </Label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 border-[#b8860b] text-[#1e3a5f] hover:bg-white"
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = '.txt,.doc,.docx,.pdf';
                          input.onchange = (e: any) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (e) => {
                                const text = e.target?.result as string;
                                setInputText(prev => prev ? prev + '\n\n' + text : text);
                              };
                              reader.readAsText(file);
                            }
                          };
                          input.click();
                        }}
                      >
                        <Upload className="h-4 w-4" />
                        העלה קובץ
                      </Button>
                      {inputText && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setInputText('')}
                          className="text-red-600 hover:bg-red-50"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <Textarea
                    placeholder="הדבק או הקלד טקסט לחיפוש... ניתן גם להעלות קובץ"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    className="min-h-[120px] border border-[#b8860b] focus:border-[#b8860b] bg-white text-[#1e3a5f] placeholder:text-[#1e3a5f]/40 rounded-lg resize-y"
                    dir="rtl"
                  />
                  {inputText && (
                    <div className="flex items-center gap-4 text-xs text-[#1e3a5f]/60">
                      <span>{inputText.length.toLocaleString()} תווים</span>
                      <span>|</span>
                      <span>{inputText.trim().split(/\s+/).length.toLocaleString()} מילים</span>
                      <span>|</span>
                      <span>{inputText.trim().split('\n').length.toLocaleString()} שורות</span>
                      <Checkbox
                        id="include-input"
                        checked={includeInputText}
                        onCheckedChange={(checked) => setIncludeInputText(!!checked)}
                        className="mr-auto"
                      />
                      <Label htmlFor="include-input" className="text-sm cursor-pointer">
                        חפש גם בטקסט המותאם
                      </Label>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results Section - Full Width */}
          {results.length > 0 && (
            <Card className="border border-[#b8860b] shadow-lg bg-white">
              <CardHeader className="pb-3 bg-white border-b border-[#b8860b]/30">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-lg flex items-center gap-2 text-[#1e3a5f]">
                    <Check className="h-5 w-5 text-green-600" />
                    תוצאות חיפוש
                  </CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="bg-white text-[#1e3a5f] border border-[#b8860b]">{results.length} תוצאות</Badge>
                    <Badge variant="outline" className="border-[#b8860b] text-[#1e3a5f]">
                      {results.filter(r => r.sourceType === 'psak').length} מפסקי דין
                    </Badge>
                    
                    {/* Selection Actions - Always show select all button */}
                    <Separator orientation="vertical" className="h-6 mx-1" />
                    {selectedPsakim.length > 0 && (
                      <Badge className="bg-[#1e3a5f] text-white">
                        {selectedPsakim.length} נבחרו
                      </Badge>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Select all unique psakim from results
                        const uniquePsakIds = [...new Set(results.filter(r => r.psakId).map(r => r.psakId!))];
                        setSelectedPsakim(uniquePsakIds);
                      }}
                      className="h-7 text-xs gap-1 border-[#b8860b] text-[#1e3a5f]"
                    >
                      <Check className="h-3 w-3" />
                      בחר הכל ({[...new Set(results.filter(r => r.psakId).map(r => r.psakId!))].length})
                    </Button>
                    {selectedPsakim.length > 0 && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedPsakim([])}
                          className="h-7 text-xs gap-1 border-[#b8860b] text-[#1e3a5f]"
                        >
                          <X className="h-3 w-3" />
                          בטל בחירה
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={deleteSelectedPsakim}
                          disabled={isDeletingPsakim}
                          className="h-7 text-xs gap-1"
                        >
                          {isDeletingPsakim ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                          מחק נבחרים
                        </Button>
                      </>
                    )}
                    
                    {/* Display Mode Buttons */}
                    <div className="flex items-center border border-[#b8860b] rounded-lg overflow-hidden">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn("h-8 px-3 rounded-none", resultsDisplayMode === 'compact' && "bg-[#b8860b] text-white hover:bg-[#996d00]")}
                        onClick={() => setResultsDisplayMode('compact')}
                        title="תצוגה מקוצרת"
                      >
                        <AlignJustify className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn("h-8 px-3 rounded-none border-x border-[#b8860b]", resultsDisplayMode === 'detailed' && "bg-[#b8860b] text-white hover:bg-[#996d00]")}
                        onClick={() => setResultsDisplayMode('detailed')}
                        title="תצוגה מפורטת"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn("h-8 px-3 rounded-none", resultsDisplayMode === 'list' && "bg-[#b8860b] text-white hover:bg-[#996d00]")}
                        onClick={() => setResultsDisplayMode('list')}
                        title="תצוגת רשימה"
                      >
                        <List className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-1 border-[#b8860b] text-[#1e3a5f] hover:bg-white" 
                      onClick={() => setShowExportDialog(true)}
                    >
                      <Download className="h-4 w-4" />
                      ייצא
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 bg-white">
                <div className="max-h-[500px] overflow-y-auto space-y-3">
                  {results.map((result) => (
                    <div
                      key={result.id}
                      className="p-4 bg-white border border-[#b8860b] rounded-lg shadow-sm hover:shadow-md transition-all hover:border-[#b8860b]"
                    >
                      {/* Source Info */}
                      {result.sourceType === 'psak' && result.psakTitle && (
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#b8860b]/50 text-xs">
                          {/* Checkbox for selection */}
                          <Checkbox
                            checked={result.psakId ? selectedPsakim.includes(result.psakId) : false}
                            onCheckedChange={() => {
                              if (result.psakId) {
                                setSelectedPsakim(prev =>
                                  prev.includes(result.psakId!)
                                    ? prev.filter(id => id !== result.psakId)
                                    : [...prev, result.psakId!]
                                );
                              }
                            }}
                            className="border-[#b8860b]"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Database className="h-3 w-3 text-[#b8860b]" />
                          <span className="font-bold text-[#1e3a5f]">{result.psakTitle}</span>
                          <Badge className="bg-white text-[#1e3a5f] text-xs">{result.psakCourt}</Badge>
                          <span className="text-[#1e3a5f]/60">{result.psakYear}</span>
                          <Badge variant="outline" className="border-[#b8860b] text-[#1e3a5f]">שורה {result.lineNumber}</Badge>
                          
                          {/* Edit & Delete Buttons */}
                          <div className="mr-auto flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                const psak = psakeiDin.find(p => p.id === result.psakId);
                                if (psak) openEditDialog(psak);
                              }}
                              className="h-6 w-6 p-0 text-[#1e3a5f] hover:bg-[#b8860b]/20"
                              title="ערוך כותרת"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (result.psakId) deletePsak(result.psakId);
                              }}
                              className="h-6 w-6 p-0 text-red-600 hover:bg-red-100"
                              title="מחק"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      {/* Result Content */}
                      <div className="space-y-2 text-[#1e3a5f]" dir="rtl">
                        {resultsDisplayMode === 'list' && (
                          <p className="bg-white p-3 rounded-lg border-r-4 border-[#b8860b] truncate text-sm">
                            {result.highlightedText ? (
                              <span dangerouslySetInnerHTML={{ __html: result.highlightedText }} />
                            ) : (
                              highlightText(result.text, result.matchedTerms)
                            )}
                          </p>
                        )}
                        
                        {resultsDisplayMode === 'compact' && (
                          <>
                            {result.contextBefore && (
                              <p className="text-[#1e3a5f]/50 border-r-2 border-[#b8860b]/30 pr-3 text-xs italic bg-gray-50/50 py-1 rounded">
                                ...{result.contextBefore}
                              </p>
                            )}
                            <p className="bg-white p-3 rounded-lg border-r-4 border-[#b8860b] text-sm shadow-sm">
                              {result.highlightedText ? (
                                <span dangerouslySetInnerHTML={{ __html: result.highlightedText }} />
                              ) : (
                                highlightText(result.text, result.matchedTerms)
                              )}
                            </p>
                            {result.contextAfter && (
                              <p className="text-[#1e3a5f]/50 border-r-2 border-[#b8860b]/30 pr-3 text-xs italic bg-gray-50/50 py-1 rounded">
                                {result.contextAfter}...
                              </p>
                            )}
                          </>
                        )}
                        
                        {resultsDisplayMode === 'detailed' && (
                          <div className="space-y-2">
                            {result.contextBefore && (
                              <p className="text-[#1e3a5f]/60 border-r-2 border-[#b8860b]/30 pr-3 text-sm bg-gray-50/50 py-2 rounded italic">
                                <span className="text-[#b8860b] text-xs ml-2">↑ שורה קודמת:</span>
                                {result.contextBefore}
                              </p>
                            )}
                            <p className="bg-white p-4 rounded-lg border-r-4 border-[#b8860b] font-medium shadow-sm">
                              {result.highlightedText ? (
                                <span dangerouslySetInnerHTML={{ __html: result.highlightedText }} />
                              ) : (
                                highlightText(result.text, result.matchedTerms)
                              )}
                            </p>
                            {result.contextAfter && (
                              <p className="text-[#1e3a5f]/60 border-r-2 border-[#b8860b]/30 pr-3 text-sm bg-gray-50/50 py-2 rounded italic">
                                <span className="text-[#b8860b] text-xs ml-2">↓ שורה הבאה:</span>
                                {result.contextAfter}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* View Full Psak Button */}
                      {result.sourceType === 'psak' && result.psakId && (
                        <div className="flex justify-end mt-3 pt-2 border-t border-[#b8860b]/30">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 border-[#b8860b] text-[#1e3a5f] hover:bg-white"
                            onClick={() => openPsakForViewing(result.psakId!, result.matchedTerms)}
                          >
                            <BookOpen className="h-4 w-4" />
                            קרא פסק מלא
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabs for Additional Features - Below Results */}
          <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
            <TabsList className="w-full grid grid-cols-4 h-12 bg-white border border-[#b8860b] shadow-sm">
              <TabsTrigger value="psakim" className="gap-2 text-sm font-bold text-[#1e3a5f] data-[state=active]:bg-[#b8860b] data-[state=active]:text-white">
                <Database className="h-4 w-4" />
                פסקי דין
              </TabsTrigger>
              <TabsTrigger value="search" className="gap-2 text-sm font-bold text-[#1e3a5f] data-[state=active]:bg-[#b8860b] data-[state=active]:text-white">
                <Settings2 className="h-4 w-4" />
                חיפוש מתקדם
              </TabsTrigger>
              <TabsTrigger value="templates" className="gap-2 text-sm font-bold text-[#1e3a5f] data-[state=active]:bg-[#b8860b] data-[state=active]:text-white">
                <BookOpen className="h-4 w-4" />
                תבניות
              </TabsTrigger>
              <TabsTrigger value="testing" className="gap-2 text-sm font-bold text-[#1e3a5f] data-[state=active]:bg-[#b8860b] data-[state=active]:text-white">
                <FlaskConical className="h-4 w-4" />
                בדיקות
              </TabsTrigger>
            </TabsList>

            {/* Psakei Din Tab */}
            <TabsContent value="psakim" className="space-y-4 mt-4 p-4 bg-white border border-[#b8860b] rounded-lg">
              {/* Info Banner */}
              <div className="p-4 bg-white border border-[#b8860b]/50 rounded-lg">
                <div className="flex items-start gap-3">
                  <Database className="h-6 w-6 text-[#b8860b] mt-0.5" />
                  <div>
                    <h3 className="font-bold text-[#1e3a5f]">חיפוש גלובלי בכל פסקי הדין</h3>
                    <p className="text-sm text-[#1e3a5f]/70 mt-1">
                      כברירת מחדל, החיפוש יבוצע בכל {psakeiDin.length} פסקי הדין במערכת.
                      ניתן לסנן ולבחור פסקים ספציפיים אם רוצים לצמצם את החיפוש.
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Button 
                        size="sm" 
                        onClick={() => {
                          setSearchScope('all');
                          setActiveTab('search');
                        }}
                        className="gap-2 bg-[#b8860b] hover:bg-[#996d00] text-white"
                      >
                        <Search className="h-4 w-4" />
                        חפש בכל הפסקים
                      </Button>
                      {selectedPsakim.length > 0 && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            setSearchScope('selected');
                            setActiveTab('search');
                          }}
                          className="gap-2 border-[#b8860b] text-[#1e3a5f]"
                        >
                          <Check className="h-4 w-4" />
                          חפש ב-{selectedPsakim.length} נבחרים
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <Card className="border border-[#b8860b]/50">
                <CardHeader className="pb-3" dir="rtl">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl flex items-center gap-2 text-[#1e3a5f] font-bold">
                        <Database className="h-5 w-5 text-[#b8860b]" />
                        סינון פסקי דין (אופציונלי)
                      </CardTitle>
                      <p className="text-sm text-[#1e3a5f]/60 mt-1">
                        בחר פסקים ספציפיים אם רוצים לצמצם את החיפוש
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="text-lg px-3 py-1 bg-white text-[#1e3a5f] border border-[#b8860b]">
                        {psakeiDin.length} פסקי דין
                      </Badge>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={loadPsakeiDin} 
                        disabled={isLoadingPsakim}
                        className="gap-2 border-[#b8860b] text-[#1e3a5f]"
                      >
                        {isLoadingPsakim ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        רענן
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Search and Actions */}
                  <div className="flex flex-wrap gap-4 items-center" dir="rtl">
                    <div className="flex-1 min-w-[250px]">
                      <Input
                        placeholder="חפש לפי כותרת, בית דין, מספר תיק..."
                        value={psakimSearchTerm}
                        onChange={(e) => setPsakimSearchTerm(e.target.value)}
                        className="text-right border-[#b8860b] text-[#1e3a5f]"
                        dir="rtl"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedPsakim(filteredPsakim.map(p => p.id))}
                        disabled={filteredPsakim.length === 0}
                        className="border-[#b8860b] text-[#1e3a5f]"
                      >
                        <Check className="h-4 w-4 ml-1" />
                        בחר הכל
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedPsakim([])}
                        disabled={selectedPsakim.length === 0}
                        className="border-[#b8860b] text-[#1e3a5f]"
                      >
                        <X className="h-4 w-4 ml-1" />
                        בטל בחירה
                      </Button>
                      {/* Delete Selected Button */}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={deleteSelectedPsakim}
                        disabled={selectedPsakim.length === 0 || isDeletingPsakim}
                        className="gap-1"
                      >
                        {isDeletingPsakim ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        מחק נבחרים ({selectedPsakim.length})
                      </Button>
                    </div>
                  </div>

                  {/* Selection info */}
                  {selectedPsakim.length > 0 && (
                    <div className="flex items-center justify-between p-3 bg-white border border-[#b8860b] rounded-lg" dir="rtl">
                      <span className="text-[#1e3a5f] font-bold">
                        נבחרו {selectedPsakim.length} פסקי דין לסינון
                      </span>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline"
                          onClick={() => {
                            setSearchScope('selected');
                            setActiveTab('search');
                          }}
                          className="gap-2 border-[#b8860b] text-[#1e3a5f]"
                        >
                          <Search className="h-4 w-4" />
                          חפש בנבחרים
                        </Button>
                        <Button 
                          onClick={importSelectedPsakim}
                          className="gap-2 bg-[#b8860b] hover:bg-[#996d00] text-white"
                        >
                          <Plus className="h-4 w-4" />
                          הוסף לטקסט
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Psakim List */}
                  <ScrollArea className="h-[500px] border border-[#b8860b]/50 rounded-lg" dir="rtl">
                    {isLoadingPsakim ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-[#b8860b]" />
                        <span className="mr-3 text-[#1e3a5f]/60">טוען פסקי דין...</span>
                      </div>
                    ) : filteredPsakim.length > 0 ? (
                      <div className="divide-y divide-[#b8860b]/20">
                        {filteredPsakim.map((psak) => (
                          <div
                            key={psak.id}
                            className={cn(
                              "p-4 cursor-pointer transition-all hover:bg-gray-50 text-right",
                              selectedPsakim.includes(psak.id) && "bg-white border-r-4 border-r-[#b8860b]"
                            )}
                            onClick={() => {
                              setSelectedPsakim(prev =>
                                prev.includes(psak.id)
                                  ? prev.filter(id => id !== psak.id)
                                  : [...prev, psak.id]
                              );
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                setSelectedPsakim(prev =>
                                  prev.includes(psak.id)
                                    ? prev.filter(id => id !== psak.id)
                                    : [...prev, psak.id]
                                );
                              }
                            }}
                            role="checkbox"
                            aria-checked={selectedPsakim.includes(psak.id)}
                            tabIndex={0}
                          >
                            <div className="flex items-start gap-3 flex-row-reverse">
                              <Checkbox
                                checked={selectedPsakim.includes(psak.id)}
                                onCheckedChange={() => {
                                  setSelectedPsakim(prev =>
                                    prev.includes(psak.id)
                                      ? prev.filter(id => id !== psak.id)
                                      : [...prev, psak.id]
                                  );
                                }}
                                className="mt-1 border-[#b8860b]"
                              />
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <h4 className="font-bold text-lg text-[#1e3a5f]">{psak.title}</h4>
                                  <div className="flex items-center gap-2">
                                    {/* Edit Button */}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openEditDialog(psak);
                                      }}
                                      className="h-8 w-8 p-0 text-[#1e3a5f] hover:bg-[#b8860b]/20"
                                      title="ערוך כותרת"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    {/* Delete Button */}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deletePsak(psak.id);
                                      }}
                                      className="h-8 w-8 p-0 text-red-600 hover:bg-red-100"
                                      title="מחק"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                    {psak.full_text && (
                                      <Badge variant="outline" className="bg-white text-[#1e3a5f] border-[#b8860b]">
                                        טקסט מלא
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-sm text-[#1e3a5f]/70">
                                  <Badge className="bg-white text-[#1e3a5f] border border-[#b8860b]">{psak.court}</Badge>
                                  <span>שנת {psak.year}</span>
                                  {psak.case_number && (
                                    <span>תיק: {psak.case_number}</span>
                                  )}
                                </div>
                                <p className="text-sm text-[#1e3a5f]/60 line-clamp-2">
                                  {psak.summary}
                                </p>
                                {psak.tags && psak.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {psak.tags.slice(0, 6).map((tag, i) => (
                                      <Badge key={`${psak.id}-tag-${i}`} variant="outline" className="text-xs border-[#b8860b]/50 text-[#1e3a5f]">
                                        {tag}
                                      </Badge>
                                    ))}
                                    {psak.tags.length > 6 && (
                                      <Badge variant="outline" className="text-xs border-[#b8860b]/50 text-[#1e3a5f]">
                                        +{psak.tags.length - 6}
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : psakeiDin.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Database className="h-16 w-16 text-muted-foreground/50 mb-4" />
                        <h3 className="text-lg font-medium mb-2">אין פסקי דין במערכת</h3>
                        <p className="text-muted-foreground mb-4">לחץ על "רענן" כדי לטעון פסקי דין</p>
                        <Button onClick={loadPsakeiDin} className="gap-2">
                          <RefreshCw className="h-4 w-4" />
                          טען פסקי דין
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Search className="h-16 w-16 text-muted-foreground/50 mb-4" />
                        <h3 className="text-lg font-medium mb-2">לא נמצאו תוצאות</h3>
                        <p className="text-muted-foreground">נסה לחפש במונח אחר</p>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Templates Tab */}
            <TabsContent value="templates" className="space-y-4 mt-4 p-4 bg-white border border-[#b8860b] rounded-lg">
              <Card className="border border-[#b8860b]/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-[#b8860b]" />
                      תבניות חיפוש מוכנות
                    </CardTitle>
                    <Badge className="bg-white text-[#1e3a5f] hover:bg-gray-50">
                      {PRESET_TEMPLATES.length} תבניות לחיפוש מהיר
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {PRESET_TEMPLATES.map((template) => (
                      <Tooltip key={template.id}>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            className="h-auto p-4 flex flex-col items-start gap-2 border-[#b8860b] hover:bg-white hover:border-[#b8860b]"
                            onClick={() => {
                              loadTemplate(template);
                              setActiveTab('search');
                            }}
                          >
                            <span className="font-semibold">{template.name}</span>
                            <span className="text-xs text-muted-foreground text-right">
                              {template.description}
                            </span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{template.description}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Search Tab - Advanced Options */}
            <TabsContent value="search" className="space-y-4 mt-4 p-4 bg-white border border-[#b8860b] rounded-lg">
          
          {/* Advanced Options - Collapsible */}
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full gap-2">
                <Settings2 className="h-4 w-4" />
                אפשרויות חיפוש מתקדמות
                <ChevronDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-4">
          {/* Search Scope Card */}
          <Card className="border-2 border-muted">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Database className="h-5 w-5" />
                היקף החיפוש
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button
                  variant={searchScope === 'all' ? 'default' : 'outline'}
                  className="gap-2"
                  onClick={() => {
                    setSearchScope('all');
                    if (psakeiDin.length === 0) loadPsakeiDin();
                  }}
                >
                  <Database className="h-4 w-4" />
                  כל פסקי הדין ({psakeiDin.length})
                </Button>
                <Button
                  variant={searchScope === 'selected' ? 'default' : 'outline'}
                  className="gap-2"
                  onClick={() => setSearchScope('selected')}
                  disabled={selectedPsakim.length === 0}
                >
                  <Check className="h-4 w-4" />
                  פסקים נבחרים ({selectedPsakim.length})
                </Button>
                <Button
                  variant={searchScope === 'custom' ? 'default' : 'outline'}
                  className="gap-2"
                  onClick={() => setSearchScope('custom')}
                >
                  <FileText className="h-4 w-4" />
                  טקסט מותאם בלבד
                </Button>
              </div>
              
              {searchScope !== 'custom' && (
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Checkbox
                    id="includeInputText"
                    checked={includeInputText}
                    onCheckedChange={(checked) => setIncludeInputText(!!checked)}
                  />
                  <Label htmlFor="includeInputText" className="text-sm">
                    כלול גם טקסט מותאם בחיפוש
                  </Label>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Right Column - Custom Text Input (optional) */}
            <div className="space-y-4">
              <Card className={cn("border-2", searchScope === 'custom' ? "border-primary" : "border-muted")}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      טקסט מותאם {searchScope !== 'custom' && '(אופציונלי)'}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{charCount} תווים</Badge>
                      <Badge variant="outline">{wordCount} מילים</Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {searchScope === 'custom' 
                      ? 'הזן או העלה טקסט לחיפוש'
                      : 'הוסף טקסט נוסף לחיפוש (אופציונלי)'}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="gap-2" asChild>
                      <label>
                        <Upload className="h-4 w-4" />
                        העלה קבצים
                        <input
                          ref={multiFileInputRef}
                          type="file"
                          className="hidden"
                          accept=".txt,.pdf,.docx,.doc,.html,.htm"
                          multiple
                          onChange={(e) => handleFileUpload(e.target.files)}
                        />
                      </label>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="gap-2 border-[#b8860b] text-[#1e3a5f] hover:bg-white"
                      onClick={() => setActiveTab('psakim')}
                    >
                      <Database className="h-4 w-4" />
                      בחר פסקי דין
                    </Button>
                  </div>

                  {isProcessingFile && (
                    <div className="space-y-2">
                      <Progress value={processingProgress} />
                      <p className="text-sm text-center text-muted-foreground">{processingStatus || 'מעבד קובץ...'}</p>
                    </div>
                  )}

                  <Textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="הזן טקסט להתחלה או בחר פסקי דין מהטאב השמאלי"
                    className="min-h-[300px] text-base leading-relaxed text-right"
                  />

                  {inputText && (
                    <div className="flex justify-start gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigator.clipboard.writeText(inputText)}
                      >
                        <Copy className="h-4 w-4 ml-1" />
                        העתק
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setInputText('')}
                      >
                        <Trash2 className="h-4 w-4 ml-1" />
                        נקה
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Left Column - Search Builder */}
            <div className="space-y-4">
                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button variant="outline" className="gap-2" onClick={() => setShowExportDialog(true)}>
                      <Download className="h-4 w-4" />
                      ייצא תוצאות
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={generateShareUrl}>
                      <Share2 className="h-4 w-4" />
                      שתף חיפוש
                    </Button>
                  </div>

                  {/* Search Condition Builder */}
                  <Card className="border-2">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">בנאי שאילתות חיפוש</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          בנה חיפוש מתקדם עם תנאים מרובים
                        </p>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Condition Cards */}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowTemplates(!showTemplates)}
                        >
                          <BookOpen className="h-4 w-4 ml-1" />
                          תבניות
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={addCondition}
                        >
                          <Plus className="h-4 w-4 ml-1" />
                          הוסף תנאי
                        </Button>
                      </div>

                      {/* Conditions List */}
                      <ScrollArea className="max-h-[400px]">
                        <div className="space-y-3">
                          {conditions.map((condition, index) => (
                            <ConditionCard
                              key={condition.id}
                              condition={condition}
                              index={index}
                              onUpdate={(updates) => updateCondition(condition.id, updates)}
                              onRemove={() => removeCondition(condition.id)}
                              showLogicalOperator={index > 0}
                            />
                          ))}
                        </div>
                      </ScrollArea>

                      {conditions.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                          <p>לחץ "הוסף תנאי" להתחיל לבנות חיפוש</p>
                        </div>
                      )}

                      <Separator />

                      {/* Smart Search Options */}
                      <div className="space-y-3">
                        <h4 className="font-medium flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-[#b8860b]" />
                          חיפוש חכם
                        </h4>
                        <SmartSearchOptionsPanel />
                      </div>

                      <Separator />

                      {/* Position & Filter Rules */}
                      <div className="space-y-3">
                        <h4 className="font-medium flex items-center gap-2">
                          <Settings2 className="h-4 w-4" />
                          כללי מיקום וסינון
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addPositionRule('relative')}
                          >
                            <ArrowLeftRight className="h-4 w-4 mr-1" />
                            כלל מיקום יחסי
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addPositionRule('line_position')}
                          >
                            <MapPin className="h-4 w-4 mr-1" />
                            מיקום בשורה
                          </Button>
                          <Button variant="outline" size="sm">
                            <Settings2 className="h-4 w-4 mr-1" />
                            הגדרות נוספות
                          </Button>
                        </div>

                        {/* Filter Rules */}
                        <div className="grid grid-cols-2 gap-3 mt-3">
                          <div className="flex items-center gap-2">
                            <Label className="text-sm whitespace-nowrap">מינימום מילים בשורה</Label>
                            <Input
                              type="number"
                              className="w-20 h-8"
                              value={filterRules.minWordsPerLine || ''}
                              onChange={(e) => setFilterRules(prev => ({
                                ...prev,
                                minWordsPerLine: e.target.value ? Number.parseInt(e.target.value, 10) : undefined
                              }))}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Label className="text-sm whitespace-nowrap">מקסימום מילים בשורה</Label>
                            <Input
                              type="number"
                              className="w-20 h-8"
                              value={filterRules.maxWordsPerLine || ''}
                              onChange={(e) => setFilterRules(prev => ({
                                ...prev,
                                maxWordsPerLine: e.target.value ? Number.parseInt(e.target.value, 10) : undefined
                              }))}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="mustContainNumbers"
                              checked={filterRules.mustContainNumbers || false}
                              onCheckedChange={(checked) => setFilterRules(prev => ({
                                ...prev,
                                mustContainNumbers: !!checked
                              }))}
                            />
                            <Label htmlFor="mustContainNumbers" className="text-sm">חייב להכיל מספרים</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="lettersOnly"
                              checked={filterRules.lettersOnly || false}
                              onCheckedChange={(checked) => setFilterRules(prev => ({
                                ...prev,
                                lettersOnly: !!checked
                              }))}
                            />
                            <Label htmlFor="lettersOnly" className="text-sm">אותיות בלבד (ללא מספרים)</Label>
                          </div>
                        </div>

                        {/* Position Rules List */}
                        {positionRules.map((rule) => (
                          <PositionRuleCard
                            key={rule.id}
                            rule={rule}
                            onUpdate={(updates) => {
                              setPositionRules(prev => prev.map(r => 
                                r.id === rule.id ? { ...r, ...updates } : r
                              ));
                            }}
                            onRemove={() => removePositionRule(rule.id)}
                          />
                        ))}

                        {positionRules.length === 0 && (
                          <div className="text-center py-4 text-muted-foreground border rounded-lg bg-muted/50">
                            <p className="text-sm">לא הוגדרו כללים</p>
                            <p className="text-xs">לחץ על אחד הכפתורים למעלה להוספת כלל</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
              </div>
            </div>
            </CollapsibleContent>
          </Collapsible>
            </TabsContent>

            {/* Testing Tab */}
            <TabsContent value="testing" className="space-y-4 mt-4 p-4 bg-white border border-[#b8860b] rounded-lg">
              {/* Validation System */}
              <Card className="border-2">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FlaskConical className="h-5 w-5" />
                      מערכת וידוא ובדיקה
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      בדיקה אוטומטית של כל הכללים והפונקציות
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button onClick={runValidation} className="w-full">
                    <FlaskConical className="h-4 w-4 ml-2" />
                    הפעל בדיקות
                  </Button>

                  {validationResults.length > 0 ? (
                    <ScrollArea className="max-h-[300px]">
                      <div className="space-y-2">
                        {validationResults.map((result, index) => (
                          <div
                            key={index}
                            className={cn(
                              "p-3 border rounded-lg flex items-center gap-3",
                              result.passed ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                            )}
                          >
                            {result.passed ? (
                              <Check className="h-5 w-5 text-green-600" />
                            ) : (
                              <AlertCircle className="h-5 w-5 text-red-600" />
                            )}
                            <div>
                              <p className="font-medium text-sm">{result.rule}</p>
                              <p className="text-xs text-muted-foreground">{result.message}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FlaskConical className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <h3 className="font-medium">אין כללים לבדיקה</h3>
                      <p className="text-sm">הוסף כללי סינון כדי להפעיל את מערכת הוידוא</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-4 pt-4">
            <Button variant="outline" onClick={() => setShowHistoryDialog(true)} className="gap-2">
              <Clock className="h-4 w-4" />
              היסטוריה ({searchHistory.length})
            </Button>
            <Button variant="outline" onClick={generateShareUrl} className="gap-2" disabled={conditions.length === 0}>
              <Link className="h-4 w-4" />
              שתף חיפוש
            </Button>
            <Button variant="outline" onClick={() => setShowExportDialog(true)} className="gap-2" disabled={results.length === 0}>
              <Download className="h-4 w-4" />
              ייצא תוצאות
            </Button>
          </div>
        </div>

        {/* Export Dialog */}
        <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>ייצוא תוצאות</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                בחר פורמט לייצוא {results.length} תוצאות:
              </p>
              <div className="grid grid-cols-3 gap-4">
                <Button variant="outline" onClick={() => exportResults('txt')} className="flex flex-col items-center gap-2 h-auto py-4">
                  <FileText className="h-8 w-8" />
                  <span>TXT</span>
                </Button>
                <Button variant="outline" onClick={() => exportResults('csv')} className="flex flex-col items-center gap-2 h-auto py-4">
                  <FileText className="h-8 w-8" />
                  <span>CSV</span>
                </Button>
                <Button variant="outline" onClick={() => exportResults('json')} className="flex flex-col items-center gap-2 h-auto py-4">
                  <FileText className="h-8 w-8" />
                  <span>JSON</span>
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Share Dialog */}
        <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>שתף חיפוש</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                הקישור מכיל את כל הגדרות החיפוש:
              </p>
              <div className="flex gap-2">
                <Input value={shareUrl} readOnly className="flex-1" dir="ltr" />
                <Button onClick={copyShareUrl}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* History Dialog */}
        <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>היסטוריית חיפושים</span>
                {searchHistory.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearHistory} className="text-destructive">
                    <RotateCcw className="h-4 w-4 mr-1" />
                    נקה הכל
                  </Button>
                )}
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[400px]">
              {searchHistory.length > 0 ? (
                <div className="space-y-2">
                  {searchHistory.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className="w-full text-right p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => loadFromHistory(item)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium" dir="rtl">{item.query || 'חיפוש ריק'}</span>
                        <Badge variant="outline">{item.resultsCount} תוצאות</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(item.timestamp).toLocaleString('he-IL')}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>אין היסטוריה עדיין</p>
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* Data Quality Dialog */}
        <Dialog open={showDataQualityDialog} onOpenChange={setShowDataQualityDialog}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                בדיקת איכות נתונים
              </DialogTitle>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto space-y-4">
              {/* Run Check Button */}
              <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/30">
                <Button
                  onClick={runDataQualityCheck}
                  disabled={dataQualityResults.isChecking || psakeiDin.length === 0}
                  className="gap-2"
                >
                  {dataQualityResults.isChecking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FlaskConical className="h-4 w-4" />
                  )}
                  הפעל בדיקה
                </Button>
                <div className="text-sm text-muted-foreground">
                  {psakeiDin.length} פסקי דין במערכת
                </div>
              </div>
              
              {/* Duplicates Section */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-white dark:bg-gray-950/30 p-3 border-b flex items-center gap-2">
                  <Copy className="h-4 w-4 text-[#b8860b]" />
                  <span className="font-medium">כפילויות אפשריות</span>
                  <Badge variant="outline" className="mr-auto">
                    {dataQualityResults.duplicates.length}
                  </Badge>
                </div>
                <ScrollArea className="max-h-[200px]">
                  {dataQualityResults.duplicates.length > 0 ? (
                    <div className="divide-y">
                      {dataQualityResults.duplicates.map((dup, i) => (
                        <div key={i} className="p-3 hover:bg-muted/30">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate font-medium">{dup.title1}</p>
                              <p className="text-sm truncate text-muted-foreground">{dup.title2}</p>
                            </div>
                            <Badge variant={dup.similarity > 85 ? 'destructive' : 'secondary'}>
                              {dup.similarity}% דמיון
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-muted-foreground">
                      <Check className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      <p>לא נמצאו כפילויות</p>
                    </div>
                  )}
                </ScrollArea>
              </div>
              
              {/* Low Quality Section */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-red-50 dark:bg-red-950/30 p-3 border-b flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <span className="font-medium">פסקים בעייתיים</span>
                  <Badge variant="outline" className="mr-auto">
                    {dataQualityResults.lowQuality.length}
                  </Badge>
                </div>
                <ScrollArea className="max-h-[250px]">
                  {dataQualityResults.lowQuality.length > 0 ? (
                    <div className="divide-y">
                      {dataQualityResults.lowQuality.map((item) => (
                        <div key={item.id} className="p-3 hover:bg-muted/30">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.issues.map((issue, j) => (
                              <Badge key={j} variant="outline" className="text-xs text-red-600">
                                {issue}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-muted-foreground">
                      <Check className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      <p>כל הפסקים תקינים</p>
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* View Psak Din Dialog */}
        <Dialog open={viewPsakDialog.open} onOpenChange={(open) => setViewPsakDialog(prev => ({ ...prev, open }))}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-right" dir="rtl">
                <BookOpen className="h-5 w-5" />
                {viewPsakDialog.psak?.title}
              </DialogTitle>
              {viewPsakDialog.psak && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground" dir="rtl">
                  <Badge variant="secondary">{viewPsakDialog.psak.court}</Badge>
                  <span>שנת {viewPsakDialog.psak.year}</span>
                  {viewPsakDialog.psak.case_number && (
                    <span>| תיק: {viewPsakDialog.psak.case_number}</span>
                  )}
                </div>
              )}
            </DialogHeader>
            
            <ScrollArea className="flex-1 mt-4">
              {viewPsakDialog.psak && (
                <div className="space-y-4 p-4" dir="rtl">
                  {/* Summary */}
                  <div className="border rounded-lg p-4 bg-muted/30">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      תקציר
                    </h4>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {highlightText(viewPsakDialog.psak.summary, viewPsakDialog.searchTerms)}
                    </p>
                  </div>
                  
                  {/* Full Text */}
                  {viewPsakDialog.psak.full_text && (
                    <div className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        טקסט מלא
                      </h4>
                      <div className="text-sm leading-relaxed whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                        {highlightText(viewPsakDialog.psak.full_text, viewPsakDialog.searchTerms)}
                      </div>
                    </div>
                  )}
                  
                  {/* Tags */}
                  {viewPsakDialog.psak.tags && viewPsakDialog.psak.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {viewPsakDialog.psak.tags.map((tag, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  
                  {/* Source URL */}
                  {viewPsakDialog.psak.source_url && (
                    <div className="text-xs text-muted-foreground">
                      <a 
                        href={viewPsakDialog.psak.source_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:underline text-blue-600"
                      >
                        <Link className="h-3 w-3" />
                        קישור למקור
                      </a>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* Edit Title Dialog */}
        <EditTitleDialog
          open={editDialog.open}
          psak={editDialog.psak}
          newTitle={editDialog.newTitle}
          onOpenChange={(open) => setEditDialog(prev => ({ ...prev, open }))}
          onTitleChange={(title) => setEditDialog(prev => ({ ...prev, newTitle: title }))}
          onSave={saveEditedTitle}
        />

        {/* Floating Settings Button */}
        <div className="fixed bottom-6 left-6 z-50">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full shadow-lg bg-background hover:bg-muted border-2"
                onClick={() => setShowDataQualityDialog(true)}
              >
                <Settings2 className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>בדיקת איכות נתונים</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}

// Condition Card Component
interface ConditionCardProps {
  condition: SearchCondition;
  index: number;
  onUpdate: (updates: Partial<SearchCondition>) => void;
  onRemove: () => void;
  showLogicalOperator: boolean;
}

function ConditionCard({ condition, index, onUpdate, onRemove, showLogicalOperator }: ConditionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border-2 rounded-lg p-3 space-y-3 bg-card">
      {/* Logical Operator */}
      {showLogicalOperator && (
        <div className="flex justify-center -mt-6 mb-2">
          <Select
            value={condition.logicalOperator || 'AND'}
            onValueChange={(value) => onUpdate({ logicalOperator: value as 'AND' | 'OR' | 'NOT' })}
          >
            <SelectTrigger className="w-20 h-7 text-xs bg-background border border-[#b8860b]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AND">וגם</SelectItem>
              <SelectItem value="OR">או</SelectItem>
              <SelectItem value="NOT">ולא</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Main Row */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="w-8 h-8 rounded-full flex items-center justify-center font-bold">
          {index + 1}
        </Badge>

        <Select
          value={condition.operator}
          onValueChange={(value) => onUpdate({ operator: value as SearchCondition['operator'] })}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="contains">חפש</SelectItem>
            <SelectItem value="not_contains">לא מכיל</SelectItem>
            <SelectItem value="starts_with">מתחיל ב</SelectItem>
            <SelectItem value="ends_with">מסתיים ב</SelectItem>
            <SelectItem value="exact">מדויק</SelectItem>
            <SelectItem value="regex">Regex</SelectItem>
            <Separator className="my-1" />
            <SelectItem value="near">🔗 קירבה (NEAR)</SelectItem>
            <SelectItem value="list">📋 רשימה (LIST)</SelectItem>
            <SelectItem value="pattern">🔍 דפוס (PATTERN)</SelectItem>
          </SelectContent>
        </Select>

        {/* Different input based on operator type */}
        {condition.operator === 'near' ? (
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1">
              <Input
                value={condition.term}
                onChange={(e) => onUpdate({ term: e.target.value })}
                placeholder="מילה ראשונה..."
                className="pr-8"
                dir="rtl"
              />
              {condition.term && (
                <button
                  onClick={() => onUpdate({ term: '' })}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <span className="text-sm text-muted-foreground whitespace-nowrap">בקרבת</span>
            <Input
              type="number"
              value={condition.nearDistance || 5}
              onChange={(e) => onUpdate({ nearDistance: parseInt(e.target.value) || 5 })}
              className="w-16"
              min={1}
              max={50}
            />
            <span className="text-sm text-muted-foreground whitespace-nowrap">מילים מ-</span>
            <div className="relative flex-1">
              <Input
                value={condition.nearWord || ''}
                onChange={(e) => onUpdate({ nearWord: e.target.value })}
                placeholder="מילה שנייה..."
                className="pr-8"
                dir="rtl"
              />
              {condition.nearWord && (
                <button
                  onClick={() => onUpdate({ nearWord: '' })}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ) : condition.operator === 'list' ? (
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1">
              <Textarea
                value={(condition.listWords || []).join('\n')}
                onChange={(e) => onUpdate({ listWords: e.target.value.split('\n').filter(w => w.trim()) })}
                placeholder="הזן מילים (כל מילה בשורה חדשה)..."
                className="min-h-[60px] pr-8"
                dir="rtl"
              />
              {(condition.listWords?.length || 0) > 0 && (
                <button
                  onClick={() => onUpdate({ listWords: [] })}
                  className="absolute left-2 top-2 text-gray-400 hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Select
              value={condition.listMode || 'any'}
              onValueChange={(value) => onUpdate({ listMode: value as 'any' | 'all' })}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">אחד מהרשימה</SelectItem>
                <SelectItem value="all">כל הרשימה</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : condition.operator === 'pattern' ? (
          <div className="flex items-center gap-2 flex-1">
            <Select
              value={condition.patternType || 'talmud-ref'}
              onValueChange={(value) => onUpdate({ patternType: value as PatternType })}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PATTERN_PRESETS).map(([key, preset]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex flex-col">
                      <span>{preset.name}</span>
                      <span className="text-xs text-muted-foreground">{preset.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {condition.patternType === 'custom' && (
              <Input
                value={condition.customPattern || ''}
                onChange={(e) => onUpdate({ customPattern: e.target.value })}
                placeholder="ביטוי רגולרי מותאם..."
                className="flex-1 font-mono text-sm"
                dir="ltr"
              />
            )}
            {condition.patternType && condition.patternType !== 'custom' && (
              <div className="flex-1 text-xs text-muted-foreground bg-muted rounded px-2 py-1 font-mono" dir="ltr">
                {PATTERN_PRESETS[condition.patternType].pattern}
              </div>
            )}
          </div>
        ) : (
          <div className="relative flex-1">
            <Input
              value={condition.term}
              onChange={(e) => onUpdate({ term: e.target.value })}
              placeholder="מילת חיפוש (ריק = כל הפסקים)..."
              className="pr-8"
              dir="rtl"
            />
            {condition.term && (
              <button
                onClick={() => onUpdate({ term: '' })}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {condition.operator !== 'near' && condition.operator !== 'list' && condition.operator !== 'pattern' && (
          <div className="flex items-center gap-1">
            <Checkbox
              id={`searchInWord-${condition.id}`}
              checked={condition.searchInWord}
              onCheckedChange={(checked) => onUpdate({ searchInWord: !!checked })}
            />
            <Label htmlFor={`searchInWord-${condition.id}`} className="text-xs whitespace-nowrap">
              חפש גם כחלק ממילה
            </Label>
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <Sparkles className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Expanded Smart Options */}
      {isExpanded && (
        <div className="pt-3 border-t">
          <SmartSearchOptionsPanel
            options={condition.smartOptions}
            onUpdate={(updates) => onUpdate({ smartOptions: { ...condition.smartOptions, ...updates } })}
          />
        </div>
      )}
    </div>
  );
}

// Smart Search Options Panel
interface SmartSearchOptionsPanelProps {
  options?: SmartSearchOptions;
  onUpdate?: (updates: Partial<SmartSearchOptions>) => void;
}

function SmartSearchOptionsPanel({ options = DEFAULT_SMART_OPTIONS, onUpdate }: SmartSearchOptionsPanelProps) {
  const handleChange = (key: keyof SmartSearchOptions, value: boolean) => {
    if (onUpdate) {
      onUpdate({ [key]: value });
    }
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      <div className="flex items-center gap-2 p-2 rounded-lg border bg-muted/50">
        <Checkbox
          id="numbersToLetters"
          checked={options.numbersToLetters}
          onCheckedChange={(checked) => handleChange('numbersToLetters', !!checked)}
        />
        <div>
          <Label htmlFor="numbersToLetters" className="text-sm font-medium cursor-pointer">
            מספרים ↔ אותיות
          </Label>
          <p className="text-xs text-muted-foreground">דף 20 ימצא גם דף כ׳</p>
        </div>
      </div>

      <div className="flex items-center gap-2 p-2 rounded-lg border bg-muted/50">
        <Checkbox
          id="wordVariations"
          checked={options.wordVariations}
          onCheckedChange={(checked) => handleChange('wordVariations', !!checked)}
        />
        <div>
          <Label htmlFor="wordVariations" className="text-sm font-medium cursor-pointer">
            וריאציות מילים
          </Label>
          <p className="text-xs text-muted-foreground">יחיד/רבים, עם/בלי ה׳</p>
        </div>
      </div>

      <div className="flex items-center gap-2 p-2 rounded-lg border bg-muted/50">
        <Checkbox
          id="ignoreNikud"
          checked={options.ignoreNikud}
          onCheckedChange={(checked) => handleChange('ignoreNikud', !!checked)}
        />
        <div>
          <Label htmlFor="ignoreNikud" className="text-sm font-medium cursor-pointer">
            התעלמות מניקוד
          </Label>
          <p className="text-xs text-muted-foreground">מתעלם מסימני ניקוד בחיפוש</p>
        </div>
      </div>

      <div className="flex items-center gap-2 p-2 rounded-lg border bg-muted/50">
        <Checkbox
          id="sofitEquivalence"
          checked={options.sofitEquivalence}
          onCheckedChange={(checked) => handleChange('sofitEquivalence', !!checked)}
        />
        <div>
          <Label htmlFor="sofitEquivalence" className="text-sm font-medium cursor-pointer">
            אותיות סופיות
          </Label>
          <p className="text-xs text-muted-foreground">ך=כ, ם=מ, ן=נ, ף=פ, ץ=צ</p>
        </div>
      </div>

      <div className="flex items-center gap-2 p-2 rounded-lg border bg-muted/50">
        <Checkbox
          id="gematriaSearch"
          checked={options.gematriaSearch}
          onCheckedChange={(checked) => handleChange('gematriaSearch', !!checked)}
        />
        <div>
          <Label htmlFor="gematriaSearch" className="text-sm font-medium cursor-pointer">
            חיפוש גימטריא
          </Label>
          <p className="text-xs text-muted-foreground">מוצא מילים עם אותו ערך מספרי</p>
        </div>
      </div>

      <div className="flex items-center gap-2 p-2 rounded-lg border bg-muted/50">
        <Checkbox
          id="acronymExpansion"
          checked={options.acronymExpansion}
          onCheckedChange={(checked) => handleChange('acronymExpansion', !!checked)}
        />
        <div>
          <Label htmlFor="acronymExpansion" className="text-sm font-medium cursor-pointer">
            ראשי תיבות
          </Label>
          <p className="text-xs text-muted-foreground">מרחיב קיצורים נפוצים</p>
        </div>
      </div>
    </div>
  );
}

// Position Rule Card Component
interface PositionRuleCardProps {
  rule: PositionRule;
  onUpdate: (updates: Partial<PositionRule>) => void;
  onRemove: () => void;
}

function PositionRuleCard({ rule, onUpdate, onRemove }: PositionRuleCardProps) {
  return (
    <div className="p-3 border rounded-lg bg-muted/50 space-y-2">
      <div className="flex items-center justify-between">
        <Badge variant="outline">
          {rule.type === 'relative' ? 'מיקום יחסי' : 'מיקום בשורה'}
        </Badge>
        <Button variant="ghost" size="icon" onClick={onRemove}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {rule.type === 'relative' ? (
        <div className="flex items-center gap-2">
          <Input
            placeholder="מילה 1"
            value={rule.word1 || ''}
            onChange={(e) => onUpdate({ word1: e.target.value })}
            className="flex-1"
            dir="rtl"
          />
          <span className="text-sm text-muted-foreground">במרחק של</span>
          <Input
            type="number"
            value={rule.maxDistance || 5}
            onChange={(e) => onUpdate({ maxDistance: Number.parseInt(e.target.value, 10) || 5 })}
            className="w-16"
            min={1}
          />
          <span className="text-sm text-muted-foreground">מילים מ</span>
          <Input
            placeholder="מילה 2"
            value={rule.word2 || ''}
            onChange={(e) => onUpdate({ word2: e.target.value })}
            className="flex-1"
            dir="rtl"
          />
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">המילה נמצאת ב</span>
          <Select
            value={rule.position || 'start'}
            onValueChange={(value) => onUpdate({ position: value as 'start' | 'middle' | 'end' })}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="start">תחילת</SelectItem>
              <SelectItem value="middle">אמצע</SelectItem>
              <SelectItem value="end">סוף</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">השורה (</span>
          <Input
            type="number"
            value={rule.withinWords || 3}
            onChange={(e) => onUpdate({ withinWords: Number.parseInt(e.target.value, 10) || 3 })}
            className="w-16"
            min={1}
          />
          <span className="text-sm text-muted-foreground">מילים ראשונות)</span>
        </div>
      )}
    </div>
  );
}

// Edit Title Dialog Component
function EditTitleDialog({ 
  open, 
  psak, 
  newTitle, 
  onOpenChange, 
  onTitleChange, 
  onSave 
}: { 
  open: boolean; 
  psak: PsakDin | null; 
  newTitle: string; 
  onOpenChange: (open: boolean) => void; 
  onTitleChange: (title: string) => void; 
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right text-[#1e3a5f]">עריכת כותרת פסק דין</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="new-title" className="text-right">כותרת חדשה</Label>
            <Input
              id="new-title"
              value={newTitle}
              onChange={(e) => onTitleChange(e.target.value)}
              className="text-right"
              dir="rtl"
              placeholder="הזן כותרת חדשה..."
            />
          </div>
          {psak && (
            <div className="p-3 bg-gray-50 rounded-lg text-sm text-muted-foreground">
              <p><strong>בית דין:</strong> {psak.court}</p>
              <p><strong>שנה:</strong> {psak.year}</p>
              {psak.case_number && <p><strong>תיק:</strong> {psak.case_number}</p>}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button 
            onClick={onSave}
            disabled={!newTitle.trim()}
            className="bg-[#b8860b] hover:bg-[#996d00] text-white"
          >
            <Check className="h-4 w-4 ml-1" />
            שמור
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SmartSearchPage;
