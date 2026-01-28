import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Filter, X, Loader2, RefreshCw, Settings2, ChevronDown, Sparkles, History, FileText, Bookmark, FlaskConical, Download, Share2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAdvancedSearch, SearchOptions, SearchResult as HookSearchResult } from '@/hooks/useAdvancedSearch';
import { parseWordList, highlightWords, RangeType, NormalizationOptions, DEFAULT_NORMALIZATION } from '@/lib/textSearchUtils';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

// Import new advanced search components
import {
  TextInput,
  SearchConditionBuilder,
  FilterRulesBuilder,
  SearchResults,
  WordListManager,
  ActiveRulesPreview,
  SearchHistory,
  SearchHistoryItem,
  RulesValidationSystem,
  SearchTemplates,
  useSearchTemplates,
  ExportResults,
  ShareSearch,
  parseSharedSearch,
  ResultBookmarks,
  useResultBookmarks,
  TestingPanel,
} from '@/components/advanced-search';

// Import types and utils
import { SearchCondition, FilterRules, SearchResult, SmartSearchOptions } from '@/types/search';
import { useWordLists } from '@/hooks/useWordLists';
import { useLocalStorage as useLocalStorageSearch } from '@/hooks/useLocalStorageSearch';
import { matchesCondition, checkFilterRules, highlightSearchTerms } from '@/utils/searchUtils';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

const RANGE_PRESETS = {
  lines: [1, 2, 3, 5, 10],
  characters: [50, 100, 200, 500, 1000],
  words: [5, 10, 20, 50, 100]
};

const RANGE_TYPE_LABELS: Record<RangeType, string> = {
  lines: 'שורות',
  characters: 'תווים',
  words: 'מילים'
};

const AdvancedSearchTab = () => {
  // Mode selection - classic or smart
  const [searchMode, setSearchMode] = useState<'classic' | 'smart'>('classic');

  // === CLASSIC SEARCH STATE ===
  // Search state
  const [primaryWordsText, setPrimaryWordsText] = useState('');
  const [logic, setLogic] = useState<'OR' | 'AND'>('OR');
  const [useProximity, setUseProximity] = useState(false);
  const [proximityWordsText, setProximityWordsText] = useState('');
  const [rangeType, setRangeType] = useState<RangeType>('lines');
  const [range, setRange] = useState(3);
  const [customRange, setCustomRange] = useState('');
  
  // Normalization options
  const [normalization, setNormalization] = useState<NormalizationOptions>(DEFAULT_NORMALIZATION);
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);

  // === SMART SEARCH STATE ===
  const [smartText, setSmartText] = useState('');
  const [smartConditions, setSmartConditions] = useState<SearchCondition[]>([]);
  const [smartFilterRules, setSmartFilterRules] = useState<FilterRules>({});
  const [smartResults, setSmartResults] = useState<SearchResult[]>([]);
  const [isSmartSearching, setIsSmartSearching] = useState(false);
  const [smartActiveTab, setSmartActiveTab] = useState<string>('search');
  const [smartSearchHistory, setSmartSearchHistory] = useState<SearchHistoryItem[]>([]);

  // Word lists hook
  const {
    wordLists,
    categories,
    addWordList,
    updateWordList,
    deleteWordList,
    addCategory,
    deleteCategory,
  } = useWordLists();

  // Templates hook
  const {
    templates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
  } = useSearchTemplates();

  // Bookmarks hook
  const {
    bookmarks,
    addBookmark,
    removeBookmark,
    updateBookmark,
    clearAll: clearAllBookmarks,
    isBookmarked,
  } = useResultBookmarks();

  // Local storage for search persistence
  const { saveText, loadText, saveConditions, loadConditions, addToHistory, clearHistory } = useLocalStorageSearch();

  // Hook
  const {
    documentsCount,
    isLoading,
    isCacheReady,
    loadingProgress,
    cacheStats,
    isBuildingCache,
    error,
    results,
    isSearching,
    search,
    clearSearch,
    reloadDocuments,
    buildCache
  } = useAdvancedSearch();

  // Parse words from textareas
  const primaryWords = parseWordList(primaryWordsText);
  const proximityWords = parseWordList(proximityWordsText);

  // Update single normalization option
  const updateNormalization = (key: keyof NormalizationOptions, value: boolean) => {
    setNormalization(prev => ({ ...prev, [key]: value }));
  };

  // Set all normalization options
  const setAllNormalization = (value: boolean) => {
    setNormalization({
      removeNikud: value,
      removeQuotes: value,
      removePunctuation: value,
      removeDashes: value,
      normalizeFinalLetters: value,
      expandHebrewNumbers: value,
    });
  };

  // Trigger search when inputs change
  useEffect(() => {
    if (!isCacheReady) return;

    const options: SearchOptions = {
      primaryWords,
      logic,
      useProximity,
      proximityWords,
      range: customRange ? parseInt(customRange, 10) || range : range,
      rangeType,
      normalization
    };

    if (primaryWords.length > 0) {
      search(options);
    } else {
      clearSearch();
    }
  }, [primaryWordsText, logic, useProximity, proximityWordsText, rangeType, range, customRange, isCacheReady, normalization]);

  // Handle range preset click
  const handleRangePreset = (value: number) => {
    setRange(value);
    setCustomRange('');
  };

  // Handle custom range change
  const handleCustomRangeChange = (value: string) => {
    setCustomRange(value);
    if (value && !isNaN(parseInt(value, 10))) {
      setRange(parseInt(value, 10));
    }
  };

  // Clear all
  const handleClear = () => {
    setPrimaryWordsText('');
    setProximityWordsText('');
    clearSearch();
  };

  // === SMART SEARCH FUNCTIONS ===
  
  // Execute smart search on text
  const executeSmartSearch = useCallback(() => {
    if (!smartText.trim() || smartConditions.length === 0) {
      setSmartResults([]);
      return;
    }

    setIsSmartSearching(true);

    try {
      // Split text into paragraphs/segments
      const segments = smartText.split(/\n\n+/).filter(s => s.trim());
      const searchResults: SearchResult[] = [];

      segments.forEach((segment, index) => {
        // Check if segment passes all conditions
        const passesAllConditions = smartConditions.every((condition, condIndex) => {
          if (condIndex === 0) {
            return matchesCondition(segment, condition);
          }
          
          const prevResult = matchesCondition(segment, condition);
          switch (condition.logicalOperator) {
            case 'AND':
              return prevResult;
            case 'OR':
              return prevResult || true; // OR means previous OR this
            case 'NOT':
              return !prevResult;
            default:
              return prevResult;
          }
        });

        // Check filter rules
        const passesFilters = checkFilterRules(segment, smartFilterRules);

        if (passesAllConditions && passesFilters) {
          // Get matched terms
          const matchedTerms = smartConditions
            .filter(c => matchesCondition(segment, c))
            .map(c => c.term);

          // Calculate score based on matches
          const score = matchedTerms.length / smartConditions.length;

          // Highlight matches
          const highlightedText = highlightSearchTerms(
            segment,
            smartConditions.map(c => c.term),
            smartConditions[0]?.smartOptions
          );

          searchResults.push({
            id: `result-${index}`,
            text: segment,
            highlightedText,
            position: index + 1,
            matchedTerms,
            score,
            context: segments[index - 1]?.slice(-100) || undefined,
          });
        }
      });

      setSmartResults(searchResults);

      // Add to history
      const historyItem: SearchHistoryItem = {
        id: crypto.randomUUID(),
        text: smartText.slice(0, 200),
        conditions: smartConditions,
        timestamp: new Date(),
        resultsCount: searchResults.length,
      };
      setSmartSearchHistory(prev => [historyItem, ...prev.slice(0, 19)]);
      addToHistory(historyItem);

    } catch (error) {
      console.error('Smart search error:', error);
      toast({
        title: 'שגיאה בחיפוש',
        description: 'אירעה שגיאה בזמן החיפוש',
        variant: 'destructive',
      });
    } finally {
      setIsSmartSearching(false);
    }
  }, [smartText, smartConditions, smartFilterRules, addToHistory]);

  // Restore from history
  const handleRestoreHistory = (item: SearchHistoryItem) => {
    setSmartConditions(item.conditions);
    toast({
      title: 'שוחזר',
      description: 'תנאי החיפוש שוחזרו מההיסטוריה',
    });
  };

  // Apply template
  const handleApplyTemplate = (template: { conditions: SearchCondition[]; filterRules: FilterRules }) => {
    setSmartConditions(template.conditions);
    setSmartFilterRules(template.filterRules);
    toast({
      title: 'תבנית הוחלה',
      description: 'תנאי החיפוש נטענו מהתבנית',
    });
  };

  // Handle bookmark
  const handleBookmark = (result: SearchResult) => {
    if (isBookmarked(result.id)) {
      removeBookmark(result.id);
      toast({ title: 'הוסר', description: 'התוצאה הוסרה מהסימניות' });
    } else {
      addBookmark(result);
      toast({ title: 'נשמר', description: 'התוצאה נוספה לסימניות' });
    }
  };

  // Parse shared search from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const searchParam = params.get('search');
    if (searchParam) {
      const shared = parseSharedSearch(window.location.href);
      if (shared) {
        if (shared.text) setSmartText(shared.text);
        if (shared.conditions) setSmartConditions(shared.conditions);
        if (shared.filterRules) setSmartFilterRules(shared.filterRules);
        setSearchMode('smart');
        toast({
          title: 'נטען',
          description: 'חיפוש משותף נטען בהצלחה',
        });
      }
    }
  }, []);

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 'Enter',
      ctrl: true,
      callback: () => {
        if (searchMode === 'smart') {
          executeSmartSearch();
        }
      },
      description: 'בצע חיפוש',
    },
    {
      key: 'l',
      ctrl: true,
      callback: () => handleClear(),
      description: 'נקה הכל',
    },
  ]);

  return (
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">חיפוש מתקדם</h2>
          <p className="text-sm text-muted-foreground">
            חיפוש מהיר בכל המסמכים עם כללים מתקדמים
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isCacheReady && (
            <Badge variant="secondary" className="font-normal">
              {documentsCount.toLocaleString()} מסמכים
            </Badge>
          )}
          <Button 
            variant="outline" 
            size="icon"
            onClick={reloadDocuments}
            disabled={isLoading}
            title="רענן מסמכים"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Mode Selection Tabs */}
      <Tabs value={searchMode} onValueChange={(v) => setSearchMode(v as 'classic' | 'smart')}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="classic" className="gap-2">
            <Search className="h-4 w-4" />
            חיפוש קלאסי
          </TabsTrigger>
          <TabsTrigger value="smart" className="gap-2">
            <Sparkles className="h-4 w-4" />
            חיפוש חכם
          </TabsTrigger>
        </TabsList>

        {/* Loading/Building cache state */}
        {(isLoading || isBuildingCache) && (
          <Card className="border-primary/20 bg-primary/5 mt-4">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {isBuildingCache && !isLoading 
                      ? 'בונה מטמון חיפוש בענן...' 
                      : 'טוען מסמכים מהענן...'}
                  </p>
                  {cacheStats && (
                    <p className="text-xs text-muted-foreground">
                      {cacheStats.cached_documents.toLocaleString()} / {cacheStats.total_documents.toLocaleString()} מסמכים במטמון
                    </p>
                  )}
                  <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${loadingProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{loadingProgress}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error state */}
        {error && (
          <Card className="border-destructive/50 bg-destructive/10 mt-4">
            <CardContent className="p-4">
              <p className="text-sm text-destructive">{error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={reloadDocuments}
              >
                נסה שוב
              </Button>
            </CardContent>
          </Card>
        )}

        {/* CLASSIC SEARCH TAB */}
        <TabsContent value="classic" className="space-y-4 mt-4">
      <Collapsible open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <Card>
          <CardHeader className="py-3 px-4">
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between cursor-pointer">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings2 className="h-5 w-5" />
                  הגדרות חיפוש
                </CardTitle>
                <ChevronDown className={cn(
                  "h-5 w-5 transition-transform",
                  isSettingsOpen && "rotate-180"
                )} />
              </div>
            </CollapsibleTrigger>
          </CardHeader>
          
          <CollapsibleContent>
            <CardContent className="space-y-6 pt-0">
              {/* Primary words */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">רשימת מילים לחיפוש</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">לוגיקה:</span>
                    <Select value={logic} onValueChange={(v) => setLogic(v as 'OR' | 'AND')}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OR">OR - אחת מהן</SelectItem>
                        <SelectItem value="AND">AND - כולן</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Textarea
                  placeholder="הכנס מילים לחיפוש, כל מילה בשורה נפרדת..."
                  value={primaryWordsText}
                  onChange={(e) => setPrimaryWordsText(e.target.value)}
                  className="min-h-[120px] text-base leading-relaxed"
                  dir="rtl"
                />
                {primaryWords.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {primaryWords.map((word, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {word}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Proximity toggle */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Switch
                  id="proximity"
                  checked={useProximity}
                  onCheckedChange={setUseProximity}
                />
                <Label htmlFor="proximity" className="cursor-pointer flex-1">
                  <span className="font-medium">הוסף תנאי קרבה</span>
                  <p className="text-xs text-muted-foreground">
                    התאמה רק אם מילה נוספת נמצאת בקרבת המילה שנמצאה
                  </p>
                </Label>
              </div>

              {/* Proximity settings */}
              {useProximity && (
                <div className="space-y-4 p-4 rounded-lg border border-border bg-card">
                  {/* Proximity words */}
                  <div className="space-y-2">
                    <Label className="text-base font-medium">מילות קרבה</Label>
                    <Textarea
                      placeholder="הכנס מילים שחייבות להופיע בקרבת המילות המסגרת..."
                      value={proximityWordsText}
                      onChange={(e) => setProximityWordsText(e.target.value)}
                      className="min-h-[80px] text-base leading-relaxed"
                      dir="rtl"
                    />
                    {proximityWords.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {proximityWords.map((word, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {word}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Range type */}
                  <div className="space-y-2">
                    <Label className="text-base font-medium">סוג מרחק</Label>
                    <div className="flex gap-2">
                      {(['lines', 'characters', 'words'] as RangeType[]).map((type) => (
                        <Button
                          key={type}
                          variant={rangeType === type ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setRangeType(type)}
                        >
                          {RANGE_TYPE_LABELS[type]}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Range value */}
                  <div className="space-y-2">
                    <Label className="text-base font-medium">
                      טווח: {customRange || range} {RANGE_TYPE_LABELS[rangeType]}
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {RANGE_PRESETS[rangeType].map((preset) => (
                        <Button
                          key={preset}
                          variant={range === preset && !customRange ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleRangePreset(preset)}
                        >
                          {preset}
                        </Button>
                      ))}
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          placeholder="ידני"
                          value={customRange}
                          onChange={(e) => handleCustomRangeChange(e.target.value)}
                          className="w-20 h-8"
                          min={1}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Text normalization options */}
              <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">אפשרויות טקסט</Label>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setAllNormalization(true)}
                    >
                      התעלם מהכל
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setAllNormalization(false)}
                    >
                      התאמה מדויקת
                    </Button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center gap-3">
                    <Switch
                      id="removeNikud"
                      checked={normalization.removeNikud}
                      onCheckedChange={(v) => updateNormalization('removeNikud', v)}
                    />
                    <Label htmlFor="removeNikud" className="cursor-pointer">
                      <span>התעלם מניקוד</span>
                      <span className="text-xs text-muted-foreground mr-1">(קמץ, פתח, צירה...)</span>
                    </Label>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Switch
                      id="removeQuotes"
                      checked={normalization.removeQuotes}
                      onCheckedChange={(v) => updateNormalization('removeQuotes', v)}
                    />
                    <Label htmlFor="removeQuotes" className="cursor-pointer">
                      <span>התעלם מגרשיים</span>
                      <span className="text-xs text-muted-foreground mr-1">(" ' ״ ׳)</span>
                    </Label>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Switch
                      id="removePunctuation"
                      checked={normalization.removePunctuation}
                      onCheckedChange={(v) => updateNormalization('removePunctuation', v)}
                    />
                    <Label htmlFor="removePunctuation" className="cursor-pointer">
                      <span>התעלם מפיסוק</span>
                      <span className="text-xs text-muted-foreground mr-1">(, . ; : ! ?)</span>
                    </Label>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Switch
                      id="removeDashes"
                      checked={normalization.removeDashes}
                      onCheckedChange={(v) => updateNormalization('removeDashes', v)}
                    />
                    <Label htmlFor="removeDashes" className="cursor-pointer">
                      <span>התעלם ממקפים</span>
                      <span className="text-xs text-muted-foreground mr-1">(- – —)</span>
                    </Label>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Switch
                      id="normalizeFinalLetters"
                      checked={normalization.normalizeFinalLetters}
                      onCheckedChange={(v) => updateNormalization('normalizeFinalLetters', v)}
                    />
                    <Label htmlFor="normalizeFinalLetters" className="cursor-pointer">
                      <span>השווה אותיות סופיות</span>
                      <span className="text-xs text-muted-foreground mr-1">(ם=מ, ך=כ...)</span>
                    </Label>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Switch
                      id="expandHebrewNumbers"
                      checked={normalization.expandHebrewNumbers}
                      onCheckedChange={(v) => updateNormalization('expandHebrewNumbers', v)}
                    />
                    <Label htmlFor="expandHebrewNumbers" className="cursor-pointer">
                      <span>הרחב מספרים עבריים</span>
                      <span className="text-xs text-muted-foreground mr-1">(צ׳ ⟷ 90 ⟷ תשעים)</span>
                    </Label>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={handleClear}
                  disabled={primaryWordsText === '' && proximityWordsText === ''}
                >
                  <X className="h-4 w-4 ml-2" />
                  נקה הכל
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Results */}
      <Card>
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-5 w-5" />
              תוצאות
              {isSearching && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </CardTitle>
            {results.length > 0 && (
              <Badge variant="default">
                {results.length.toLocaleString()} תוצאות
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {!isCacheReady ? (
            <div className="text-center py-8 text-muted-foreground">
              ממתין לטעינת מסמכים...
            </div>
          ) : primaryWords.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              הכנס מילים לחיפוש כדי להתחיל
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {isSearching ? 'מחפש...' : 'לא נמצאו תוצאות'}
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {results.slice(0, 100).map((result, index) => (
                  <SearchResultCard 
                    key={result.document.id} 
                    result={result}
                    index={index + 1}
                    allHighlightWords={[...primaryWords, ...proximityWords]}
                  />
                ))}
                {results.length > 100 && (
                  <div className="text-center py-4 text-muted-foreground">
                    מציג 100 תוצאות ראשונות מתוך {results.length.toLocaleString()}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        {/* SMART SEARCH TAB */}
        <TabsContent value="smart" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Main Search Column */}
            <div className="lg:col-span-2 space-y-4">
              {/* Text Input */}
              <TextInput
                value={smartText}
                onChange={setSmartText}
                placeholder="הכנס או טען טקסט לחיפוש..."
                label="טקסט לחיפוש"
                showFileUpload={true}
                showOcr={true}
                showUrlFetch={true}
                minHeight="200px"
              />

              {/* Condition Builder */}
              <SearchConditionBuilder
                conditions={smartConditions}
                onChange={setSmartConditions}
                wordLists={wordLists}
              />

              {/* Search Button */}
              <div className="flex items-center gap-2">
                <Button
                  onClick={executeSmartSearch}
                  disabled={isSmartSearching || !smartText.trim() || smartConditions.length === 0}
                  className="flex-1"
                >
                  {isSmartSearching ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4 mr-2" />
                  )}
                  חפש
                </Button>
                <ExportResults results={smartResults} />
                <ShareSearch
                  conditions={smartConditions}
                  filterRules={smartFilterRules}
                  text={smartText}
                />
              </div>

              {/* Results */}
              <SearchResults
                results={smartResults}
                isSearching={isSmartSearching}
                onBookmark={handleBookmark}
                bookmarkedIds={new Set(bookmarks.map(b => b.id))}
              />
            </div>

            {/* Sidebar Column */}
            <div className="space-y-4">
              {/* Inner Tabs for Sidebar */}
              <Tabs value={smartActiveTab} onValueChange={setSmartActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="rules" className="text-xs px-1">
                    <Filter className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="history" className="text-xs px-1">
                    <History className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="templates" className="text-xs px-1">
                    <FileText className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="bookmarks" className="text-xs px-1">
                    <Bookmark className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="testing" className="text-xs px-1">
                    <FlaskConical className="h-4 w-4" />
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="rules" className="mt-4 space-y-4">
                  <ActiveRulesPreview
                    conditions={smartConditions}
                    filterRules={smartFilterRules}
                    wordLists={wordLists}
                    onRemoveCondition={(id) => setSmartConditions(prev => prev.filter(c => c.id !== id))}
                    onClearAll={() => {
                      setSmartConditions([]);
                      setSmartFilterRules({});
                    }}
                  />
                  <FilterRulesBuilder
                    rules={smartFilterRules}
                    onChange={setSmartFilterRules}
                  />
                  <RulesValidationSystem
                    text={smartText}
                    conditions={smartConditions}
                    filterRules={smartFilterRules}
                  />
                </TabsContent>

                <TabsContent value="history" className="mt-4">
                  <SearchHistory
                    history={smartSearchHistory}
                    onRestore={handleRestoreHistory}
                    onDelete={(id) => setSmartSearchHistory(prev => prev.filter(h => h.id !== id))}
                    onClear={() => {
                      setSmartSearchHistory([]);
                      clearHistory();
                    }}
                  />
                </TabsContent>

                <TabsContent value="templates" className="mt-4 space-y-4">
                  <SearchTemplates
                    templates={templates}
                    currentConditions={smartConditions}
                    currentFilterRules={smartFilterRules}
                    onApplyTemplate={handleApplyTemplate}
                    onSaveTemplate={addTemplate}
                    onUpdateTemplate={updateTemplate}
                    onDeleteTemplate={deleteTemplate}
                  />
                  <WordListManager
                    wordLists={wordLists}
                    categories={categories}
                    onAddList={addWordList}
                    onUpdateList={updateWordList}
                    onDeleteList={deleteWordList}
                    onAddCategory={addCategory}
                    onDeleteCategory={deleteCategory}
                  />
                </TabsContent>

                <TabsContent value="bookmarks" className="mt-4">
                  <ResultBookmarks
                    bookmarks={bookmarks}
                    onRemoveBookmark={removeBookmark}
                    onClearAll={clearAllBookmarks}
                    onUpdateBookmark={updateBookmark}
                  />
                </TabsContent>

                <TabsContent value="testing" className="mt-4">
                  <TestingPanel />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

interface SearchResultCardProps {
  result: HookSearchResult;
  index: number;
  allHighlightWords: string[];
}

const SearchResultCard = ({ result, index, allHighlightWords }: SearchResultCardProps) => {
  const { document, matchedPrimaryWords, matchedProximityWords, excerpt, proximityContext } = result;
  
  return (
    <div className="p-4 rounded-lg border border-border bg-card hover:bg-accent/5 transition-colors">
      <div className="flex items-start gap-3">
        <span className="text-sm font-mono text-muted-foreground min-w-[2rem]">
          {index}
        </span>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-foreground line-clamp-2 mb-1">
            {document.title || 'ללא כותרת'}
          </h4>
          <div className="flex flex-wrap gap-1 mb-2">
            {document.court && (
              <Badge variant="outline" className="text-xs">{document.court}</Badge>
            )}
            {document.year && (
              <Badge variant="outline" className="text-xs">{document.year}</Badge>
            )}
            {document.case_number && (
              <Badge variant="outline" className="text-xs">{document.case_number}</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-1 mb-2">
            {matchedPrimaryWords.map((word, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {word}
              </Badge>
            ))}
            {matchedProximityWords?.map((word, i) => (
              <Badge key={`prox-${i}`} variant="default" className="text-xs">
                קרבה: {word}
              </Badge>
            ))}
          </div>
          <p 
            className="text-sm text-muted-foreground line-clamp-3"
            dangerouslySetInnerHTML={{ 
              __html: highlightWords(excerpt, allHighlightWords) 
            }}
          />
          {proximityContext && (
            <p 
              className="text-xs text-muted-foreground mt-2 p-2 bg-muted/50 rounded"
              dangerouslySetInnerHTML={{ 
                __html: highlightWords(proximityContext, allHighlightWords) 
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default AdvancedSearchTab;
