import { useState, useEffect, useMemo, useRef } from 'react';
import { Header } from '@/components/Header';
import { TextInput } from '@/components/TextInput';
import { SearchResults } from '@/components/SearchResults';
import { SearchHistory } from '@/components/SearchHistory';
import { SearchTemplates } from '@/components/SearchTemplates';
import { ExportResults } from '@/components/ExportResults';
import { ShareSearch } from '@/components/ShareSearch';
import { ResultBookmarks } from '@/components/ResultBookmarks';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useWordLists } from '@/hooks/useWordLists';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { SearchCondition, SearchResult, SmartSearchOptions, FilterRules, ConditionOperator, ProximityDirection, ListMode, PatternType } from '@/types/search';
import { useToast } from '@/hooks/use-toast';
import { FilterRulesBuilder } from '@/components/FilterRulesBuilder';
import { RulesValidationSystem } from '@/components/RulesValidationSystem';
import { ActiveRulesPreview } from '@/components/ActiveRulesPreview';
import { SettingsButton } from '@/components/SettingsButton';
import { TestingPanel } from '@/components/TestingPanel';
import { Search, Plus, X, Filter, Sparkles, HelpCircle, BookTemplate, Hash, Languages, Type, AlignJustify, Calculator, FileText, List, Eye, ArrowUp, Bug, Regex, ChevronDown, ChevronUp } from 'lucide-react';
import { expandSearchTerm } from '@/utils/hebrewUtils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { WordListSelector } from '@/components/WordListSelector';

// תבניות חיפוש מוכנות
const searchTemplates = [
  {
    id: 'exact-phrase',
    name: 'חיפוש מדויק',
    description: 'מצא ביטוי מדויק בטקסט',
    conditions: [{ id: '1', term: '', operator: 'AND' as ConditionOperator }],
  },
  {
    id: 'include-exclude',
    name: 'כולל + לא כולל',
    description: 'מצא מילה אחת אבל לא אחרת',
    conditions: [
      { id: '1', term: '', operator: 'AND' as ConditionOperator },
      { id: '2', term: '', operator: 'NOT' as ConditionOperator },
    ],
  },
  {
    id: 'multiple-options',
    name: 'אחת מכמה אפשרויות',
    description: 'מצא אחת מרשימת מילים',
    conditions: [
      { id: '1', term: '', operator: 'AND' as ConditionOperator },
      { id: '2', term: '', operator: 'LIST' as ConditionOperator, listWords: [], listMode: 'any' as ListMode },
    ],
  },
  {
    id: 'proximity',
    name: 'מילים קרובות',
    description: 'מצא מילים בקרבה זו לזו',
    conditions: [
      { id: '1', term: '', operator: 'AND' as ConditionOperator },
      { id: '2', term: '', operator: 'NEAR' as ConditionOperator, proximityRange: 10, proximityDirection: 'both' as ProximityDirection },
    ],
  },
];

// הסברים לאופרטורים
const operatorHelp: Record<ConditionOperator, { label: string; description: string; example: string }> = {
  AND: {
    label: 'וגם',
    description: 'שתי המילים חייבות להופיע יחד',
    example: '"תורה" וגם "משה" → ימצא רק שורות עם שתי המילים',
  },
  OR: {
    label: 'או',
    description: 'לפחות אחת מהמילים צריכה להופיע',
    example: '"משה" או "אהרון" → ימצא שורות עם אחת מהן',
  },
  NOT: {
    label: 'ללא',
    description: 'המילה לא צריכה להופיע',
    example: '"תורה" ללא "משנה" → ימצא תורה ללא משנה',
  },
  NEAR: {
    label: 'בקרבת',
    description: 'המילים צריכות להיות קרובות זו לזו',
    example: '"משה" בקרבת 5 מילים מ-"הר" → ימצא כשהן קרובות',
  },
  LIST: {
    label: 'רשימה',
    description: 'חפש אחת או כל המילים מרשימה',
    example: 'רשימה של שמות → ימצא כל שם מהרשימה',
  },
  PATTERN: {
    label: 'דפוס',
    description: 'חפש לפי תבנית/דפוס קבוע',
    example: 'דפוס תלמודי: לא,א או קכג,ב',
  },
};

// דפוסים מוכנים לחיפוש
// רשימת כל מסכתות הש"ס
const masechotList = [
  // סדר זרעים
  'ברכות',
  // סדר מועד
  'שבת', 'עירובין', 'פסחים', 'שקלים', 'יומא', 'סוכה', 'ביצה', 'ראש השנה', 'תענית', 'מגילה', 'מועד קטן', 'חגיגה',
  // סדר נשים
  'יבמות', 'כתובות', 'נדרים', 'נזיר', 'סוטה', 'גיטין', 'קידושין',
  // סדר נזיקין
  'בבא קמא', 'בבא מציעא', 'בבא בתרא', 'סנהדרין', 'מכות', 'שבועות', 'עבודה זרה', 'הוריות',
  // סדר קדשים
  'זבחים', 'מנחות', 'חולין', 'בכורות', 'ערכין', 'תמורה', 'כריתות', 'מעילה', 'תמיד', 'מדות', 'קינים',
  // סדר טהרות
  'נדה',
];

// ראשי תיבות של מסכתות - רשימה מלאה
const masechotAbbreviations = [
  // בבות
  'ב"ק', 'בב"ק', 'ב״ק',      // בבא קמא
  'ב"מ', 'בב"מ', 'ב״מ',      // בבא מציעא
  'ב"ב', 'בב"ב', 'ב״ב',      // בבא בתרא
  // מועד
  'ר"ה', 'ר״ה',              // ראש השנה
  'מו"ק', 'מ"ק', 'מו״ק',     // מועד קטן
  'ע"ז', 'א"ז', 'ע״ז',       // עבודה זרה
  // נשים
  'קיד\'', 'קידו\'',         // קידושין
  // אחרים
  'שבו\'', 'שבוע\'',         // שבועות
  'סנה\'', 'סנהד\'',         // סנהדרין
  'גיט\'',                    // גיטין
  'כתו\'', 'כתוב\'',         // כתובות
  'יבמ\'', 'יבמו\'',         // יבמות
  'פסח\'', 'פסחי\'',         // פסחים
  'עירו\'',                   // עירובין
  'זבח\'', 'זבחי\'',         // זבחים
  'מנח\'', 'מנחו\'',         // מנחות
  'חול\'', 'חולי\'',         // חולין
  'בכור\'', 'בכורו\'',       // בכורות
  'ערכי\'',                   // ערכין
  'כריתו\'', 'כרית\'',       // כריתות
  'מעיל\'',                   // מעילה
  'נדרי\'',                   // נדרים
];

// דפוס regex לכל המסכתות כולל ראשי תיבות
const masechotPattern = [...masechotList, ...masechotAbbreviations].join('|');

const patternPresets = [
  {
    id: 'talmud-ref',
    name: 'מראה מקום תלמודי',
    description: 'כז,א / קכ,א / קכא,ב',
    pattern: '[א-ת]{2,4},[אב]',
    example: 'בבא בתרא קכא,א או כז,א',
  },
  {
    id: 'talmud-full',
    name: 'מסכת + דף + עמוד',
    description: 'מסכת שבת כז,א / ב"מ כז,א',
    pattern: `(מסכת |מס' |מס\\. )?(${masechotPattern}) ?[א-ת]{1,4},[אב]`,
    example: 'מסכת בבא בתרא קכא,א / ב"מ כז,א',
  },
  {
    id: 'masechet-name',
    name: 'שם מסכת בלבד',
    description: 'זיהוי שם מסכת מלא או ר"ת',
    pattern: `(${masechotPattern})`,
    example: 'בבא קמא, ב"ק, ב"מ, ר"ה, מו"ק',
  },
  {
    id: 'sefer-ref',
    name: 'ספר + פרק + פסוק',
    description: 'בראשית א,ב',
    pattern: '(בראשית|שמות|ויקרא|במדבר|דברים|יהושע|שופטים|שמואל|מלכים|ישעיהו|ירמיהו|יחזקאל|תהלים|משלי|איוב|שיר השירים|רות|איכה|קהלת|אסתר|דניאל|עזרא|נחמיה|דברי הימים) [א-ת]{1,3},[א-ת]{1,3}',
    example: 'בראשית א,א',
  },
  {
    id: 'daf-amud',
    name: 'דף + עמוד',
    description: 'דף כז עמוד א',
    pattern: 'דף [א-ת]{1,4} עמוד [אב]',
    example: 'דף קכא עמוד ב',
  },
  {
    id: 'perek-mishna',
    name: 'פרק ומשנה',
    description: 'פ"א מ"ב',
    pattern: 'פ"[א-ת] מ"[א-ת]',
    example: 'אבות פ"א מ"ב',
  },
  {
    id: 'brackets-ref',
    name: 'מקור בסוגריים',
    description: '(כח,א) / (קכא,ב)',
    pattern: '\\([א-ת]{1,4},[אב]',
    example: '(כח,א בעמה"ר)',
  },
  {
    id: 'daf-number',
    name: 'דף עם מספר',
    description: 'דף 5 / דף 123',
    pattern: 'דף \\d{1,3}',
    example: 'דף 25 עמוד א',
  },
  {
    id: 'custom',
    name: 'דפוס מותאם אישית',
    description: 'כתוב regex משלך',
    pattern: '',
    example: '',
  },
];

// הגדרות חיפוש חכם
const smartSearchConfig = [
  {
    key: 'numberToHebrew' as keyof SmartSearchOptions,
    icon: Hash,
    label: 'מספרים ↔ אותיות',
    description: 'דף 20 ימצא גם דף כ׳',
    example: 'פרק 5 = פרק ה׳',
  },
  {
    key: 'wordVariations' as keyof SmartSearchOptions,
    icon: Languages,
    label: 'וריאציות מילים',
    description: 'יחיד/רבים, עם/בלי ה׳',
    example: 'ספר = הספר = ספרים',
  },
  {
    key: 'ignoreNikud' as keyof SmartSearchOptions,
    icon: Type,
    label: 'התעלמות מניקוד',
    description: 'מתעלם מסימני ניקוד בחיפוש',
    example: 'שָׁלוֹם = שלום',
  },
  {
    key: 'sofitEquivalence' as keyof SmartSearchOptions,
    icon: AlignJustify,
    label: 'אותיות סופיות',
    description: 'ך=כ, ם=מ, ן=נ, ף=פ, ץ=צ',
    example: 'שלם = שלום (עם ם סופית)',
  },
  {
    key: 'gematriaSearch' as keyof SmartSearchOptions,
    icon: Calculator,
    label: 'חיפוש גימטריא',
    description: 'מוצא מילים עם אותו ערך מספרי',
    example: 'אחד (13) = אהבה (13)',
  },
  {
    key: 'acronymExpansion' as keyof SmartSearchOptions,
    icon: FileText,
    label: 'ראשי תיבות',
    description: 'מרחיב קיצורים נפוצים',
    example: 'רמב"ם = רבי משה בן מימון',
  },
];

const Index = () => {
  const { toast } = useToast();
  const {
    history,
    saveText,
    loadText,
    saveConditions,
    loadConditions,
    addToHistory,
    deleteHistoryItem,
    clearHistory,
  } = useLocalStorage();

  const {
    wordLists,
    categories,
    addWordList,
    updateWordList,
    deleteWordList,
    addCategory,
    deleteCategory,
  } = useWordLists();

  const [text, setText] = useState('');
  
  const [conditions, setConditions] = useState<SearchCondition[]>([
    { id: crypto.randomUUID(), term: '', operator: 'AND' },
  ]);

  const [smartOptions, setSmartOptions] = useState<SmartSearchOptions>({
    numberToHebrew: true,
    wordVariations: false,
    ignoreNikud: true,
    sofitEquivalence: true,
    gematriaSearch: false,
    acronymExpansion: false,
  });

  const [filterRules, setFilterRules] = useState<FilterRules>({
    positionRules: [],
    textPositionRules: [],
    mustContainNumbers: false,
    mustContainLettersOnly: false,
    caseSensitive: false,
  });

  const [showTemplates, setShowTemplates] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'tests'>('search');
  
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Bookmarks state - for marking/highlighting results
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [resultNotes, setResultNotes] = useState<Record<string, string>>({});
  const [resultColors, setResultColors] = useState<Record<string, string>>({});

  // Collapsible conditions state
  const [collapsedConditions, setCollapsedConditions] = useState<Set<string>>(new Set());
  const resultsRef = useRef<HTMLDivElement>(null);

  // Draggable search button state
  const [buttonPosition, setButtonPosition] = useState({ x: 32, y: typeof window !== 'undefined' ? window.innerHeight - 96 : 500 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 'f',
      ctrl: true,
      callback: () => {
        document.querySelector<HTMLTextAreaElement>('textarea')?.focus();
      },
      description: 'התמקד בחיפוש',
    },
    {
      key: 's',
      ctrl: true,
      callback: () => {
        if (conditions.length > 0 && hasSearched) {
          // Save current search to history
          (window as any).saveSearchHistory?.(conditions, results.length);
          toast({ title: 'החיפוש נשמר להיסטוריה' });
        }
      },
      description: 'שמור חיפוש',
    },
    {
      key: 'e',
      ctrl: true,
      callback: () => {
        if (results.length > 0) {
          document.querySelector<HTMLButtonElement>('[aria-label="ייצא תוצאות"]')?.click();
        }
      },
      description: 'ייצא תוצאות',
    },
  ]);

  // Bookmark functions
  const toggleBookmark = (resultId: string) => {
    setBookmarkedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(resultId)) {
        newSet.delete(resultId);
        // Remove note and color when unbookmarking
        setResultNotes(notes => {
          const newNotes = { ...notes };
          delete newNotes[resultId];
          return newNotes;
        });
        setResultColors(colors => {
          const newColors = { ...colors };
          delete newColors[resultId];
          return newColors;
        });
      } else {
        newSet.add(resultId);
      }
      return newSet;
    });
  };

  const addNote = (resultId: string, note: string) => {
    setResultNotes(prev => ({ ...prev, [resultId]: note }));
  };

  const setColor = (resultId: string, color: string) => {
    setResultColors(prev => ({ ...prev, [resultId]: color }));
  };

  // Load search from URL params (for sharing)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const searchParam = params.get('search');
    if (searchParam) {
      try {
        const decoded = JSON.parse(decodeURIComponent(atob(searchParam)));
        if (decoded.conditions) {
          setConditions(decoded.conditions);
          if (decoded.text) {
            setText(decoded.text);
          }
          toast({
            title: 'חיפוש נטען',
            description: 'החיפוש המשותף נטען בהצלחה',
          });
        }
      } catch (error) {
        console.error('Error loading shared search:', error);
      }
    }
  }, []);

  // Toggle condition collapse
  const toggleConditionCollapse = (id: string) => {
    setCollapsedConditions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const collapseAllConditions = () => {
    setCollapsedConditions(new Set(conditions.map(c => c.id)));
  };

  const expandAllConditions = () => {
    setCollapsedConditions(new Set());
  };

  useEffect(() => {
    const savedText = loadText();
    const savedConditions = loadConditions();

    if (savedText) {
      setText(savedText);
    }
    if (savedConditions && savedConditions.length > 0) {
      setConditions(savedConditions);
    }
    setIsInitialized(true);
  }, [loadText, loadConditions]);

  useEffect(() => {
    if (isInitialized) {
      saveText(text);
    }
  }, [text, saveText, isInitialized]);

  useEffect(() => {
    if (isInitialized) {
      saveConditions(conditions);
    }
  }, [conditions, saveConditions, isInitialized]);

  // Helper function to check filter rules
  const checkFilterRules = (segment: string, words: string[]): boolean => {
    for (const rule of filterRules.positionRules) {
      if (!rule.word || !rule.relativeWord) continue;
      
      const wordIndex = words.findIndex(w => w.includes(rule.word.toLowerCase()));
      const relativeIndex = words.findIndex(w => w.includes(rule.relativeWord.toLowerCase()));
      
      if (wordIndex === -1 || relativeIndex === -1) continue;
      
      const distance = Math.abs(wordIndex - relativeIndex);
      const maxDist = rule.maxDistance || 10;
      
      if (rule.position === 'before' && (wordIndex >= relativeIndex || distance > maxDist)) {
        return false;
      }
      if (rule.position === 'after' && (wordIndex <= relativeIndex || distance > maxDist)) {
        return false;
      }
    }
    
    for (const rule of filterRules.textPositionRules) {
      if (!rule.word) continue;
      
      const withinWords = rule.withinWords || 3;
      const wordLower = rule.word.toLowerCase();
      
      if (rule.position === 'start') {
        const startWords = words.slice(0, withinWords);
        if (!startWords.some(w => w.includes(wordLower))) {
          return false;
        }
      }
      if (rule.position === 'end') {
        const endWords = words.slice(-withinWords);
        if (!endWords.some(w => w.includes(wordLower))) {
          return false;
        }
      }
    }
    
    if (filterRules.minWordCount && words.length < filterRules.minWordCount) {
      return false;
    }
    if (filterRules.maxWordCount && words.length > filterRules.maxWordCount) {
      return false;
    }
    
    if (filterRules.mustContainNumbers && !/\d/.test(segment)) {
      return false;
    }
    
    if (filterRules.mustContainLettersOnly && /[\d]/.test(segment)) {
      return false;
    }
    
    return true;
  };

  const addCondition = () => {
    const newCondition: SearchCondition = {
      id: crypto.randomUUID(),
      term: '',
      operator: 'AND',
      proximityRange: 10,
      proximityDirection: 'both',
      listWords: [],
      listMode: 'any',
    };
    setConditions([...conditions, newCondition]);
  };

  const removeCondition = (id: string) => {
    setConditions(conditions.filter(c => c.id !== id));
  };

  const updateCondition = (id: string, updates: Partial<SearchCondition>) => {
    setConditions(
      conditions.map(c => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const handleListWordsChange = (id: string, text: string) => {
    const words = text.split('\n').map(w => w.trim()).filter(w => w);
    updateCondition(id, { listWords: words, term: text });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if ((e.target as HTMLElement).tagName !== 'TEXTAREA') {
        performSearch();
      }
    }
  };

  // Draggable button handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only enable dragging if Shift key is pressed
    if (e.shiftKey) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({ x: e.clientX - buttonPosition.x, y: e.clientY - buttonPosition.y });
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      e.preventDefault();
      const newX = Math.max(16, Math.min(window.innerWidth - 80, e.clientX - dragStart.x));
      const newY = Math.max(16, Math.min(window.innerHeight - 80, e.clientY - dragStart.y));
      setButtonPosition({ x: newX, y: newY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  const applyTemplate = (template: typeof searchTemplates[0]) => {
    const newConditions = template.conditions.map(c => ({
      ...c,
      id: crypto.randomUUID(),
    }));
    setConditions(newConditions);
    setShowTemplates(false);
  };

  const performSearch = () => {
    if (!text.trim()) {
      setResults([]);
      setHasSearched(true);
      return;
    }

    const normalize = (str: string) => str.trim().toLowerCase();
    const segments = text.split(/[\n]+/).filter(s => s.trim());
    const foundResults: SearchResult[] = [];

    const expandTerm = (term: string): string[] => {
      return expandSearchTerm(term, {
        includeNumberVariations: smartOptions.numberToHebrew,
        includeWordVariations: smartOptions.wordVariations,
        ignoreNikud: smartOptions.ignoreNikud,
        sofitEquivalence: smartOptions.sofitEquivalence,
        gematriaSearch: smartOptions.gematriaSearch,
        acronymExpansion: smartOptions.acronymExpansion,
      });
    };

    // Helper function to check if term is found based on partialMatch setting
    const checkMatch = (segmentText: string, searchTerm: string, partialMatch: boolean = false): boolean => {
      const normalizedSegment = normalize(segmentText);
      const normalizedTerm = normalize(searchTerm);
      
      if (partialMatch) {
        // Partial match: find term anywhere in text (even as part of another word)
        return normalizedSegment.includes(normalizedTerm);
      } else {
        // Exact match: term must be a whole word (with word boundaries)
        const regex = new RegExp(`(^|\\s)${normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|\\s)`, 'i');
        return regex.test(normalizedSegment);
      }
    };

    segments.forEach((segment) => {
      const segmentWords = segment.toLowerCase().split(/\s+/).filter(w => w.trim());
      const matchedTerms: string[] = [];

      let hasRequiredTerms = true;
      let hasExcludedTerm = false;
      let hasListMatch = true;
      let hasPatternMatch = true;

      const firstTermConditions = conditions.filter(c => c.operator !== 'LIST' && c.operator !== 'NOT' && c.operator !== 'OR' && c.operator !== 'PATTERN');
      const listConditions = conditions.filter(c => c.operator === 'LIST');
      const notConditions = conditions.filter(c => c.operator === 'NOT');
      const patternConditions = conditions.filter(c => c.operator === 'PATTERN');
      
      // Separate pattern conditions by their logic (AND vs OR)
      const andPatternConditions = patternConditions.filter(c => c.patternLogic !== 'OR');
      const orPatternConditions = patternConditions.filter(c => c.patternLogic === 'OR');

      // Check if this is a pattern-only search (no other required terms)
      const hasOtherTerms = firstTermConditions.some(c => c.term.trim()) ||
                            listConditions.some(c => (c.listWords?.length || 0) > 0);
      
      // Process pattern conditions
      if (patternConditions.length > 0) {
        const patternMatches: string[] = [];
        let andPatternsMatch = true;
        let orPatternsMatch = orPatternConditions.length === 0; // True if no OR patterns
        
        // Check AND patterns - all must match
        andPatternConditions.forEach(cond => {
          if (!cond.customPattern) return;
          
          try {
            const regex = new RegExp(cond.customPattern, 'g');
            const matches = segment.match(regex);
            
            if (matches && matches.length > 0) {
              patternMatches.push(...matches);
            } else {
              andPatternsMatch = false;
            }
          } catch (e) {
            console.warn('Invalid pattern:', cond.customPattern);
          }
        });
        
        // Check OR patterns - at least one must match
        orPatternConditions.forEach(cond => {
          if (!cond.customPattern) return;
          
          try {
            const regex = new RegExp(cond.customPattern, 'g');
            const matches = segment.match(regex);
            
            if (matches && matches.length > 0) {
              patternMatches.push(...matches);
              orPatternsMatch = true;
            }
          } catch (e) {
            console.warn('Invalid pattern:', cond.customPattern);
          }
        });
        
        // Combined pattern match result
        hasPatternMatch = andPatternsMatch && orPatternsMatch;
        
        // If pattern-only search, create individual results for each match
        if (!hasOtherTerms && patternMatches.length > 0 && hasPatternMatch) {
          const segmentStartInText = text.indexOf(segment);
          
          patternConditions.forEach(cond => {
            if (!cond.customPattern) return;
            
            try {
              const regex = new RegExp(cond.customPattern, 'g');
              let match;
              
              while ((match = regex.exec(segment)) !== null) {
                const matchText = match[0];
                const matchStartInSegment = match.index;
                const matchStartInText = segmentStartInText + matchStartInSegment;
                
                // Get context around the match (50 chars before and after)
                const contextStart = Math.max(0, matchStartInText - 50);
                const contextEnd = Math.min(text.length, matchStartInText + matchText.length + 50);
                const contextText = text.substring(contextStart, contextEnd);
                
                foundResults.push({
                  text: contextText.trim(),
                  startIndex: matchStartInText,
                  endIndex: matchStartInText + matchText.length,
                  matchedTerms: [matchText],
                });
              }
            } catch (e) {
              console.warn('Invalid pattern:', cond.customPattern);
            }
          });
          return; // Skip the rest for pattern-only search
        }
        
        // For combined search, add pattern matches to matchedTerms
        if (patternMatches.length > 0) {
          matchedTerms.push(...patternMatches);
        }
      }

      firstTermConditions.forEach(cond => {
        if (!cond.term.trim()) return;
        
        const variations = expandTerm(cond.term);
        let found = false;
        
        for (const variation of variations) {
          if (checkMatch(segment, variation, cond.partialMatch)) {
            matchedTerms.push(cond.term);
            found = true;
            break;
          }
        }
        
        if (!found) {
          hasRequiredTerms = false;
        }
      });

      listConditions.forEach(cond => {
        const words = cond.listWords || [];
        if (words.length === 0) return;
        
        let foundAny = false;
        words.forEach(word => {
          if (!word.trim()) return;
          
          const variations = expandTerm(word);
          for (const variation of variations) {
            if (checkMatch(segment, variation, cond.partialMatch)) {
              matchedTerms.push(word);
              foundAny = true;
              break;
            }
          }
        });
        
        if (cond.listMode === 'any' && !foundAny) {
          hasListMatch = false;
        }
      });

      notConditions.forEach(cond => {
        if (!cond.term.trim()) return;
        
        const variations = expandTerm(cond.term);
        for (const variation of variations) {
          if (checkMatch(segment, variation, cond.partialMatch)) {
            hasExcludedTerm = true;
            break;
          }
        }
      });

      const hasContent = firstTermConditions.some(c => c.term.trim()) || 
                         listConditions.some(c => (c.listWords?.length || 0) > 0) ||
                         patternConditions.some(c => c.customPattern);
      const passesBasicSearch = hasContent && hasRequiredTerms && hasListMatch && hasPatternMatch && !hasExcludedTerm && matchedTerms.length > 0;
      
      console.log('firstTermConditions:', firstTermConditions.map(c => c.term));
      
      const passesFilterRules = checkFilterRules(segment, segmentWords);
      
      const matches = passesBasicSearch && passesFilterRules;

      if (matches) {
        const startIndex = text.indexOf(segment);
        foundResults.push({
          text: segment.trim(),
          startIndex,
          endIndex: startIndex + segment.length,
          matchedTerms: [...new Set(matchedTerms)],
        });
      }
    });

    setResults(foundResults);
    setHasSearched(true);

    const allMatchedTerms = foundResults.flatMap(r => r.matchedTerms);
    addToHistory(text, conditions, foundResults.length, allMatchedTerms);

    // Scroll to results after search
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const highlightedText = useMemo(() => {
    if (results.length === 0) return text;

    let highlighted = text;
    const allTerms: string[] = [];

    conditions.forEach(c => {
      if (c.operator === 'NOT') return;
      if (c.operator === 'LIST' && c.listWords) {
        allTerms.push(...c.listWords.filter(w => w.trim()));
      } else if (c.term.trim()) {
        allTerms.push(c.term);
      }
    });

    const uniqueTerms = [...new Set(allTerms)];
    
    uniqueTerms.forEach((term, idx) => {
      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escapedTerm})`, 'gi');
      const highlightClass = idx % 3 === 0 ? 'highlight-match' : 
                            idx % 3 === 1 ? 'highlight-match-secondary' : 
                            'highlight-match-tertiary';
      highlighted = highlighted.replace(regex, `<mark class="${highlightClass}">$1</mark>`);
    });

    return highlighted;
  }, [text, results, conditions]);

  const handleRestore = (savedText: string, savedConditions: SearchCondition[]) => {
    setText(savedText);
    setConditions(savedConditions);
    setHasSearched(false);
    toast({
      title: 'שוחזר מהיסטוריה',
      description: 'הטקסט והתנאים שוחזרו בהצלחה',
    });
  };

  // בניית תצוגה מקדימה של השאילתה
  const queryPreview = useMemo(() => {
    const parts: string[] = [];
    
    conditions.forEach((cond, index) => {
      if (!cond.term.trim() && cond.operator !== 'LIST') return;
      if (cond.operator === 'LIST' && (!cond.listWords || cond.listWords.length === 0)) return;
      
      if (index > 0 && parts.length > 0) {
        parts.push(operatorHelp[cond.operator].label);
      }
      
      if (cond.operator === 'LIST') {
        const words = cond.listWords?.slice(0, 3).join(', ') || '';
        const more = (cond.listWords?.length || 0) > 3 ? '...' : '';
        parts.push(`[${words}${more}]`);
      } else {
        parts.push(`"${cond.term}"`);
      }
    });
    
    return parts.join(' ');
  }, [conditions]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="min-h-screen bg-background" dir="rtl">
        <Header />
        
        <main className="container mx-auto px-4 sm:px-6 py-8">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Hero section */}
            <div className="text-center py-6 animate-fade-in">
              <div className="flex justify-center mb-4 flex-col gap-4">
                <SearchHistory
                  history={history}
                  onRestore={handleRestore}
                  onDelete={deleteHistoryItem}
                  onClear={clearHistory}
                />
                <SearchTemplates
                  onApplyTemplate={(templateConditions) => {
                    setConditions(templateConditions);
                    toast({
                      title: 'תבנית הוחלה',
                      description: 'תנאי החיפוש מהתבנית נטענו בהצלחה',
                    });
                  }}
                />
                <div className="flex gap-3 justify-center flex-wrap">
                  <ExportResults
                    results={results}
                    text={text}
                    conditions={conditions}
                  />
                  <ShareSearch
                    conditions={conditions}
                    text={text}
                  />
                </div>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-navy mb-2">
                מערכת חיפוש מתקדמת
              </h2>
              <p className="text-base text-muted-foreground max-w-xl mx-auto">
                בנה שאילתות חיפוש מורכבות עם כל הכלים במקום אחד
              </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 bg-white p-2 rounded-xl border border-gold/30 shadow-md">
              <button
                onClick={() => setActiveTab('search')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${
                  activeTab === 'search'
                    ? 'bg-gold text-white shadow-md'
                    : 'text-navy/70 hover:bg-gold/10 hover:text-navy'
                }`}
              >
                <Search className="w-5 h-5" />
                חיפוש
              </button>
              <button
                onClick={() => setActiveTab('tests')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${
                  activeTab === 'tests'
                    ? 'bg-gold text-white shadow-md'
                    : 'text-navy/70 hover:bg-gold/10 hover:text-navy'
                }`}
              >
                <Bug className="w-5 h-5" />
                בדיקות
              </button>
            </div>

            {/* Tests Tab */}
            {activeTab === 'tests' && (
              <div className="bg-white rounded-2xl p-6 animate-fade-in border border-gold shadow-xl text-right">
                <TestingPanel />
              </div>
            )}

            {/* Search Tab Content */}
            {activeTab === 'search' && (
              <>
                {/* Text input */}
                <TextInput text={text} onTextChange={setText} />

                {/* Results - Right after text input */}
                <div ref={resultsRef}>
                  {hasSearched && results.length > 0 ? (
                    <div className="bg-white rounded-2xl p-6 animate-fade-in border border-gold shadow-md">
                      <div className="flex items-center justify-between mb-6 flex-row-reverse">
                        <h2 className="text-2xl font-bold text-navy">
                          תוצאות חיפוש ({results.length})
                        </h2>
                        <div className="flex gap-2">
                          <ExportResults
                            results={results}
                            text={text}
                            conditions={conditions}
                          />
                          <ShareSearch
                            conditions={conditions}
                            text={text}
                          />
                        </div>
                      </div>
                      <div className="space-y-4">
                        <ResultBookmarks
                          results={results.map((r, i) => ({
                            ...r,
                            note: resultNotes[`result-${i}`],
                            highlightColor: resultColors[`result-${i}`],
                          }))}
                          bookmarkedIds={bookmarkedIds}
                          onToggleBookmark={toggleBookmark}
                          onAddNote={addNote}
                          onSetColor={setColor}
                        />
                      </div>
                    </div>
                  ) : hasSearched && results.length === 0 ? (
                    <div className="bg-white rounded-2xl p-8 text-center animate-fade-in border border-gold shadow-md">
                      <p className="text-lg text-muted-foreground">לא נמצאו תוצאות</p>
                    </div>
                  ) : null}
                </div>

                {/* Unified Search Builder */}
                <div className="bg-white rounded-2xl p-6 space-y-5 animate-fade-in border border-gold shadow-xl text-right">
                  {/* Header with buttons */}
                  <div className="flex items-center justify-between gap-4 flex-wrap bg-white border border-gold rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gold rounded-2xl flex items-center justify-center shadow-lg">
                        <Search className="w-6 h-6 text-navy" />
                      </div>
                      <div className="text-right">
                        <h2 className="text-xl font-bold text-navy">בנאי שאילתות חיפוש</h2>
                    <p className="text-sm text-muted-foreground">בנה חיפוש מתקדם עם תנאים מרובים</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={() => {
                          if (collapsedConditions.size === conditions.length) {
                            expandAllConditions();
                          } else {
                            collapseAllConditions();
                          }
                        }}
                        variant="outline"
                        size="sm"
                        className="bg-white border border-gold text-navy"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{collapsedConditions.size === conditions.length ? 'הרחב הכל' : 'מזער הכל'}</TooltipContent>
                  </Tooltip>
                  <Button
                    onClick={() => setShowTemplates(!showTemplates)}
                    variant="secondary"
                    size="sm"
                  >
                    <BookTemplate className="w-4 h-4" />
                    תבניות
                  </Button>
                  <Button
                    onClick={addCondition}
                    variant="default"
                    size="sm"
                  >
                    <Plus className="w-4 h-4" />
                    הוסף תנאי
                  </Button>
                </div>
              </div>

              {/* Search templates */}
              {showTemplates && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-white rounded-2xl border border-gold animate-fade-in shadow-md">
                  <div className="col-span-full flex items-center gap-2 pb-3 border-b border-gold bg-white text-right">
                    <Sparkles className="w-5 h-5 text-gold" />
                    <span className="font-bold text-navy text-lg">תבניות חיפוש מוכנות</span>
                  </div>
                  {searchTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => applyTemplate(template)}
                      className="text-right p-4 rounded-xl bg-white border border-gold hover:border-gold hover:bg-gold/5 transition-all hover:shadow-lg"
                    >
                      <div className="font-bold text-navy text-lg">{template.name}</div>
                      <div className="text-sm text-muted-foreground mt-1">{template.description}</div>
                    </button>
                  ))}
                </div>
              )}

              {/* Search Conditions */}
              <div className="space-y-4">
                {conditions.map((condition, index) => {
                  const isCollapsed = collapsedConditions.has(condition.id);
                  const conditionSummary = condition.operator === 'LIST' 
                    ? `רשימה (${condition.listWords?.length || 0} מילים)`
                    : condition.operator === 'PATTERN'
                    ? `דפוס: ${condition.patternType || 'לא נבחר'}`
                    : condition.term || 'ריק';
                  
                  return (
                  <Collapsible
                    key={condition.id}
                    open={!isCollapsed}
                    onOpenChange={() => toggleConditionCollapse(condition.id)}
                    className="animate-slide-up bg-white rounded-2xl border border-gold hover:border-gold transition-all shadow-md hover:shadow-xl overflow-hidden text-right"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {/* Collapsible Header */}
                    <CollapsibleTrigger className="w-full flex items-center justify-between gap-3 p-4 hover:bg-gold/5 transition-colors text-right">
                      <div className="flex items-center gap-3">
                        {isCollapsed ? <ChevronDown className="w-3 h-3 text-navy" /> : <ChevronUp className="w-3 h-3 text-navy" />}
                        <span className="font-semibold text-navy">תנאי {index + 1}</span>
                        {isCollapsed && (
                          <span className="text-sm text-muted-foreground bg-secondary/50 px-3 py-1 rounded-lg">
                            {index > 0 && <span className="text-gold font-bold ml-2">{condition.operator}</span>}
                            {conditionSummary}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {conditions.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCondition(condition.id)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </CollapsibleTrigger>

                    {/* Collapsible Content */}
                    <CollapsibleContent>
                    <div className="p-5 pt-0 border-t border-gold/20">
                    <div className="flex items-start gap-3 pt-4">
                      {/* Operator */}
                      {index > 0 ? (
                        <div className="flex items-center gap-1">
                          <Select
                            value={condition.operator}
                            onValueChange={(value: ConditionOperator) =>
                              updateCondition(condition.id, { operator: value })
                            }
                          >
                            <SelectTrigger className="w-28 bg-secondary rounded-xl font-semibold border border-navy/20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white border border-navy/20 rounded-xl">
                              <SelectItem value="AND">וגם</SelectItem>
                              <SelectItem value="OR">או</SelectItem>
                              <SelectItem value="NOT">ללא</SelectItem>
                              <SelectItem value="NEAR">בקרבת</SelectItem>
                              <SelectItem value="LIST">רשימה</SelectItem>
                              <SelectItem value="PATTERN">דפוס</SelectItem>
                            </SelectContent>
                          </Select>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button className="p-1 text-muted-foreground hover:text-navy transition-colors">
                                <HelpCircle className="w-4 h-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs text-right bg-navy text-white p-3 rounded-xl">
                              <div className="font-bold mb-1">{operatorHelp[condition.operator].label}</div>
                              <div className="text-sm opacity-90 mb-2">{operatorHelp[condition.operator].description}</div>
                              <div className="text-xs bg-white/10 p-2 rounded-lg">
                                {operatorHelp[condition.operator].example}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Select
                            value={condition.operator}
                            onValueChange={(value: ConditionOperator) =>
                              updateCondition(condition.id, { operator: value })
                            }
                          >
                            <SelectTrigger className="w-28 bg-navy text-white rounded-xl font-semibold border border-navy">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white border border-navy/20 rounded-xl">
                              <SelectItem value="AND">חפש</SelectItem>
                              <SelectItem value="LIST">רשימה</SelectItem>
                            </SelectContent>
                          </Select>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button className="p-1 text-muted-foreground hover:text-navy transition-colors">
                                <HelpCircle className="w-4 h-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs text-right bg-navy text-white p-3 rounded-xl">
                              {condition.operator === 'LIST' ? (
                                <>
                                  <div className="font-bold mb-1">חיפוש ברשימה</div>
                                  <div className="text-sm opacity-90 mb-2">חפש לפי רשימת מילים - כל שורה היא מילת חיפוש</div>
                                  <div className="text-xs bg-white/10 p-2 rounded-lg">
                                    בחר "אחת מהן" (OR) או "כולן" (AND)
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="font-bold mb-1">חיפוש רגיל</div>
                                  <div className="text-sm opacity-90">הקלד מילה או ביטוי לחיפוש</div>
                                </>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      )}

                      {/* Input field - LIST mode for any condition */}
                      {condition.operator === 'LIST' ? (
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-xl flex-wrap">
                            <List className="w-5 h-5 text-navy" />
                            <span className="text-sm text-muted-foreground font-medium">רשימת מילים (כל שורה = מילה אחת)</span>
                            <Select
                              value={condition.listMode || 'any'}
                              onValueChange={(value: ListMode) =>
                                updateCondition(condition.id, { listMode: value })
                              }
                            >
                              <SelectTrigger className="w-32 bg-white rounded-xl border border-gold/30">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-white rounded-xl">
                                <SelectItem value="any">אחת מהן</SelectItem>
                                <SelectItem value="all">כולן</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-3">
                            <div className="relative">
                              <Textarea
                                value={condition.term || ''}
                                onChange={(e) => handleListWordsChange(condition.id, e.target.value)}
                                onKeyDown={(e) => {
                                  // Allow Enter to create new line in textarea
                                  if (e.key === 'Enter') {
                                    e.stopPropagation();
                                    // Don't prevent default - let Enter work naturally
                                  }
                                }}
                                placeholder="הכנס מילים (כל מילה בשורה נפרדת)..."
                                className="w-full min-h-[120px] rounded-xl bg-secondary/30 border border-border focus:border-navy text-right resize-none"
                                dir="rtl"
                              />
                            </div>
                            <div className="flex justify-end">
                              <WordListSelector
                                wordLists={wordLists}
                                categories={categories}
                                currentWords={condition.listWords || []}
                                onSelectList={(words) => {
                                  const currentText = condition.term || '';
                                  const newText = currentText ? `${currentText}\n${words.join('\n')}` : words.join('\n');
                                  handleListWordsChange(condition.id, newText);
                                }}
                                onAddList={(name, words) => {
                                  addWordList(name, words, 'general');
                                  toast({
                                    title: 'רשימה נשמרה!',
                                    description: `הרשימה "${name}" נשמרה עם ${words.length} מילים`,
                                  });
                                }}
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2 p-3 bg-secondary/30 rounded-xl">
                            <Switch
                              id={`partial-${condition.id}`}
                              checked={condition.partialMatch || false}
                              onCheckedChange={(checked) => updateCondition(condition.id, { partialMatch: checked })}
                              className="data-[state=checked]:bg-gold"
                            />
                            <Label htmlFor={`partial-${condition.id}`} className="text-sm font-medium text-navy cursor-pointer">
                              חפש גם כחלק ממילה (לדוגמא: "מסכת" ימצא גם "במסכת")
                            </Label>
                          </div>
                          {condition.listWords && condition.listWords.length > 0 && (
                            <div className="flex flex-wrap gap-2 p-3 bg-gold/10 rounded-xl">
                              {condition.listWords.slice(0, 10).map((word, i) => (
                                <Badge key={i} variant="secondary" className="bg-white text-navy">
                                  {word}
                                </Badge>
                              ))}
                              {condition.listWords.length > 10 && (
                                <Badge variant="outline" className="text-muted-foreground">
                                  +{condition.listWords.length - 10} עוד
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      ) : condition.operator === 'PATTERN' ? (
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-xl flex-wrap justify-between">
                            <div className="flex items-center gap-3">
                              <Regex className="w-5 h-5 text-navy" />
                              <span className="text-sm text-muted-foreground font-medium">חיפוש לפי דפוס/תבנית</span>
                            </div>
                            {/* Logic selector for pattern - AND/OR with other conditions */}
                            {index > 0 && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">קשר לתנאים אחרים:</span>
                                <Select
                                  value={condition.patternLogic || 'AND'}
                                  onValueChange={(value: 'AND' | 'OR') =>
                                    updateCondition(condition.id, { patternLogic: value })
                                  }
                                >
                                  <SelectTrigger className="w-24 h-8 bg-white rounded-lg border border-gold/30 text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-white rounded-xl">
                                    <SelectItem value="AND">וגם (AND)</SelectItem>
                                    <SelectItem value="OR">או (OR)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {patternPresets.map((preset) => (
                              <button
                                key={preset.id}
                                onClick={() => updateCondition(condition.id, { 
                                  patternType: preset.id as PatternType,
                                  customPattern: preset.pattern,
                                  term: preset.pattern
                                })}
                                className={`p-3 rounded-xl text-right transition-all border ${
                                  condition.patternType === preset.id
                                    ? 'border-gold bg-gold/10 text-navy'
                                    : 'border-border bg-white hover:border-gold/50'
                                }`}
                              >
                                <div className="font-medium text-sm">{preset.name}</div>
                                <div className="text-xs text-muted-foreground">{preset.description}</div>
                                {preset.example && (
                                  <div className="text-xs text-gold mt-1">דוגמה: {preset.example}</div>
                                )}
                              </button>
                            ))}
                          </div>
                          {condition.patternType === 'custom' && (
                            <div className="space-y-2">
                              <Label className="text-sm font-medium text-navy">דפוס מותאם אישית (Regex):</Label>
                              <Input
                                value={condition.customPattern || ''}
                                onChange={(e) => updateCondition(condition.id, { 
                                  customPattern: e.target.value,
                                  term: e.target.value
                                })}
                                placeholder="לדוגמה: [א-ת]{2,3},[אב]"
                                className="font-mono text-sm rounded-xl"
                                dir="ltr"
                              />
                              <p className="text-xs text-muted-foreground">
                                * = כל תו, [א-ת] = אות עברית, {'{2,3}'} = 2 עד 3 פעמים
                              </p>
                            </div>
                          )}
                          {condition.patternType && condition.patternType !== 'custom' && (
                            <div className="p-3 bg-gold/10 rounded-xl">
                              <p className="text-sm text-navy">
                                <span className="font-medium">הדפוס שנבחר: </span>
                                <code className="bg-white px-2 py-1 rounded text-xs font-mono" dir="ltr">
                                  {condition.customPattern}
                                </code>
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex-1 space-y-2">
                          <Input
                            value={condition.term}
                            onChange={(e) => updateCondition(condition.id, { term: e.target.value })}
                            onKeyPress={handleKeyPress}
                            placeholder="הקלד מילה לחיפוש..."
                            className="w-full text-lg h-12 rounded-xl bg-secondary/30 border border-border focus:border-navy text-right"
                            dir="rtl"
                          />
                          <div className="flex items-center gap-2 p-2 bg-secondary/30 rounded-xl">
                            <Switch
                              id={`partial-${condition.id}`}
                              checked={condition.partialMatch || false}
                              onCheckedChange={(checked) => updateCondition(condition.id, { partialMatch: checked })}
                              className="data-[state=checked]:bg-gold"
                            />
                            <Label htmlFor={`partial-${condition.id}`} className="text-sm font-medium text-navy cursor-pointer">
                              חפש גם כחלק ממילה
                            </Label>
                          </div>
                        </div>
                      )}

                      {/* NEAR options */}
                      {condition.operator === 'NEAR' && (
                        <div className="flex items-center gap-2 p-2 bg-secondary/50 rounded-xl">
                          <span className="text-sm text-muted-foreground">בטווח</span>
                          <Input
                            type="number"
                            min={1}
                            max={100}
                            value={condition.proximityRange || 10}
                            onChange={(e) =>
                              updateCondition(condition.id, { proximityRange: parseInt(e.target.value) || 10 })
                            }
                            className="w-16 h-8 text-center rounded-lg"
                          />
                          <span className="text-sm text-muted-foreground">מילים</span>
                        </div>
                      )}
                    </div>
                    </div>
                  </CollapsibleContent>
                  </Collapsible>
                  );
                })}
              </div>

              {/* Query preview */}
              {queryPreview && (
                <div className="flex items-start gap-3 p-5 bg-white rounded-2xl border border-gold animate-fade-in shadow-md text-right">
                  <Eye className="w-6 h-6 text-navy mt-0.5 shrink-0" />
                  <div className="text-right">
                    <div className="text-base font-bold text-navy mb-2">תצוגה מקדימה של השאילתה:</div>
                    <div className="text-lg font-mono text-foreground bg-white px-4 py-3 rounded-xl inline-block border border-gold shadow-sm">
                      {queryPreview}
                    </div>
                  </div>
                </div>
              )}

              {/* Divider */}
              <div className="border-t-2 border-gold/30"></div>

              {/* Smart Search Options - Integrated */}
              <div>
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gold/30 bg-white text-right px-4 py-2 rounded-xl border border-gold">
                  <Sparkles className="w-5 h-5 text-gold" />
                  <h4 className="font-bold text-navy text-lg">חיפוש חכם</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {smartSearchConfig.map((config) => {
                    const Icon = config.icon;
                    const isActive = smartOptions[config.key];
                    
                    return (
                      <Tooltip key={config.key}>
                        <TooltipTrigger asChild>
                          <div 
                            className={`flex items-center justify-between p-5 rounded-2xl transition-all cursor-pointer shadow-md ${
                              isActive 
                                ? 'bg-white border border-gold shadow-lg' 
                                : 'bg-white border border-gold/30 hover:border-gold/50 hover:shadow-lg'
                            }`}
                            onClick={() => setSmartOptions({ ...smartOptions, [config.key]: !isActive })}
                          >
                            <div className="flex items-center gap-3 text-right">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${isActive ? 'bg-gold text-navy' : 'bg-muted text-muted-foreground'}`}>
                                <Icon className="w-5 h-5" />
                              </div>
                              <div>
                                <Label className={`font-bold text-base cursor-pointer ${isActive ? 'text-navy' : 'text-foreground'}`}>{config.label}</Label>
                                <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
                              </div>
                            </div>
                            <Switch
                              checked={isActive}
                              onCheckedChange={(checked) => setSmartOptions({ ...smartOptions, [config.key]: checked })}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-navy text-white p-4 rounded-2xl max-w-xs text-right shadow-2xl">
                          <div className="font-bold mb-2 text-base">{config.label}</div>
                          <div className="text-sm opacity-90 mb-2">{config.description}</div>
                          <div className="text-xs bg-white/10 px-3 py-2 rounded-xl inline-block font-mono">
                            דוגמה: {config.example}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t-2 border-gold/30"></div>

              {/* Filter Rules - Integrated */}
              <div>
                <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-gold/30">
                  <Filter className="w-5 h-5 text-navy" />
                  <h4 className="font-bold text-navy text-lg">כללי מיקום וסינון</h4>
                </div>
                <FilterRulesBuilder
                  rules={filterRules}
                  onRulesChange={setFilterRules}
                />
                
                {/* Active Rules Preview with Examples */}
                <ActiveRulesPreview rules={filterRules} />
              </div>
            </div>

            {/* Validation System */}
            <RulesValidationSystem 
              rules={filterRules}
              checkFilterRules={checkFilterRules}
            />
              </>
            )}
          </div>
        </main>

        {/* Floating Search Button - Draggable */}
        <div 
          className="fixed z-50"
          style={{ 
            left: buttonPosition.x, 
            top: buttonPosition.y,
            cursor: isDragging ? 'grabbing' : 'grab'
          }}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                ref={buttonRef}
                onClick={() => !isDragging && performSearch()}
                onMouseDown={handleMouseDown}
                size="lg"
                className={`w-16 h-16 rounded-full bg-gold hover:bg-gold-dark text-navy shadow-2xl border border-navy/10 ${isDragging ? 'scale-110 opacity-80' : ''}`}
              >
                <Search className="w-7 h-7" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-navy text-white rounded-xl font-semibold px-4 py-2">
              {isDragging ? 'גרור לכל מקום' : 'חפש עכשיו (Shift + לחיצה לגרירה)'}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Scroll to top button */}
        <Button
          onClick={scrollToTop}
          variant="secondary"
          size="icon"
          className="fixed bottom-8 right-8 z-50 w-14 h-14 rounded-full shadow-2xl transition-all hover:scale-110"
        >
          <ArrowUp className="w-6 h-6" />
        </Button>

        {/* Footer */}
        <footer className="bg-navy border-t-4 border-gold mt-12 py-8">
          <div className="container mx-auto px-6 text-center">
            <p className="text-white font-bold text-lg">חיפוש חכם - ניתוח טקסטים מתקדם</p>
            <p className="text-gold text-sm mt-2 font-semibold">הנתונים נשמרים במחשב שלך 💾</p>
          </div>
        </footer>

        {/* Settings Button */}
        <SettingsButton
          wordLists={wordLists}
          categories={categories}
          onAddList={addWordList}
          onUpdateList={updateWordList}
          onDeleteList={deleteWordList}
          onAddCategory={addCategory}
          onDeleteCategory={deleteCategory}
        />
      </div>
    </TooltipProvider>
  );
};

export default Index;