import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  FileText, 
  Filter, 
  List, 
  History, 
  BookmarkIcon,
  Settings,
  TestTube,
  Share2
} from 'lucide-react';
import { SearchCondition, FilterRules, SearchResult } from '@/types/search';
import { searchWithConditions, applyHighlighting } from '@/utils/searchUtils';
import { parseSharedSearch } from '@/utils/shareUtils';
import { useLocalStorageSearch } from '@/hooks/useLocalStorageSearch';
import { useSearchTemplates, SearchTemplate } from '@/hooks/useSearchTemplates';
import { useResultBookmarks, BookmarkedResult } from '@/hooks/useResultBookmarks';
import { toast } from '@/hooks/use-toast';

// Import components
import { TextInput } from './TextInput';
import { SearchConditionBuilder } from './SearchConditionBuilder';
import { FilterRulesBuilder } from './FilterRulesBuilder';
import { SearchResults } from './SearchResults';
import { WordListManager } from './WordListManager';
import { ActiveRulesPreview } from './ActiveRulesPreview';
import { SearchHistory, SearchHistoryItem } from './SearchHistory';
import { RulesValidationSystem } from './RulesValidationSystem';
import { SearchTemplates } from './SearchTemplates';
import { ExportResults } from './ExportResults';
import { ShareSearch } from './ShareSearch';
import { ResultBookmarks } from './ResultBookmarks';
import { TestingPanel } from './TestingPanel';

export function AdvancedSearchTab() {
  // State for text input
  const [text, setText] = useState('');
  
  // State for search conditions
  const [conditions, setConditions] = useState<SearchCondition[]>([]);
  
  // State for filter rules
  const [filterRules, setFilterRules] = useState<FilterRules>({});
  
  // State for search results
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // State for active tab
  const [activeTab, setActiveTab] = useState('search');
  
  // Hooks
  const { searchHistory, addToHistory, clearHistory, removeFromHistory } = useLocalStorageSearch();
  const { templates, addTemplate, updateTemplate, deleteTemplate } = useSearchTemplates();
  const { bookmarks, addBookmark, removeBookmark, clearBookmarks, updateBookmark } = useResultBookmarks();
  
  // Parse shared search from URL on mount
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const searchParam = searchParams.get('search');
    if (searchParam) {
      const parsed = parseSharedSearch(window.location.href);
      if (parsed) {
        if (parsed.text) setText(parsed.text);
        if (parsed.conditions) setConditions(parsed.conditions);
        if (parsed.filterRules) setFilterRules(parsed.filterRules);
        toast({
          title: 'חיפוש נטען',
          description: 'חיפוש משותף נטען בהצלחה',
        });
      }
    }
  }, []);

  // Handle search execution
  const executeSearch = useCallback(async () => {
    if (!text.trim() && conditions.length === 0) {
      toast({
        title: 'שגיאה',
        description: 'יש להזין טקסט או תנאי חיפוש',
        variant: 'destructive',
      });
      return;
    }

    setIsSearching(true);
    try {
      const searchResults = await searchWithConditions(
        text, 
        conditions, 
        filterRules
      );
      
      setResults(searchResults);
      
      // Add to history
      const historyItem: SearchHistoryItem = {
        id: Date.now().toString(),
        query: conditions.map(c => c.term).join(', ') || text.slice(0, 50),
        conditions,
        filterRules,
        timestamp: new Date(),
        resultCount: searchResults.length,
      };
      addToHistory(historyItem);
      
      toast({
        title: 'חיפוש הושלם',
        description: `נמצאו ${searchResults.length} תוצאות`,
      });
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: 'שגיאה בחיפוש',
        description: 'אירעה שגיאה בעת ביצוע החיפוש',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  }, [text, conditions, filterRules, addToHistory]);

  // Handle adding a condition
  const handleAddCondition = useCallback((condition: SearchCondition) => {
    setConditions(prev => [...prev, { ...condition, id: Date.now().toString() }]);
  }, []);

  // Handle updating a condition
  const handleUpdateCondition = useCallback((id: string, updates: Partial<SearchCondition>) => {
    setConditions(prev => 
      prev.map(c => c.id === id ? { ...c, ...updates } : c)
    );
  }, []);

  // Handle removing a condition
  const handleRemoveCondition = useCallback((id: string) => {
    setConditions(prev => prev.filter(c => c.id !== id));
  }, []);

  // Handle loading from history
  const handleLoadFromHistory = useCallback((item: SearchHistoryItem) => {
    setConditions(item.conditions);
    setFilterRules(item.filterRules || {});
    toast({
      title: 'נטען',
      description: 'חיפוש נטען מההיסטוריה',
    });
  }, []);

  // Handle loading a template
  const handleLoadTemplate = useCallback((template: SearchTemplate) => {
    setConditions(template.conditions);
    setFilterRules(template.filterRules || {});
    toast({
      title: 'נטען',
      description: `תבנית "${template.name}" נטענה בהצלחה`,
    });
  }, []);

  // Handle saving as template
  const handleSaveAsTemplate = useCallback((name: string, description?: string) => {
    const template: SearchTemplate = {
      id: Date.now().toString(),
      name,
      description,
      conditions,
      filterRules,
      createdAt: new Date(),
    };
    addTemplate(template);
    toast({
      title: 'נשמר',
      description: `תבנית "${name}" נשמרה בהצלחה`,
    });
  }, [conditions, filterRules, addTemplate]);

  // Handle bookmarking a result
  const handleBookmarkResult = useCallback((result: SearchResult) => {
    const bookmarked: BookmarkedResult = {
      ...result,
      id: Date.now().toString(),
      bookmarkedAt: new Date(),
    };
    addBookmark(bookmarked);
    toast({
      title: 'נוסף לסימניות',
      description: 'התוצאה נוספה לסימניות',
    });
  }, [addBookmark]);

  // Summary stats
  const stats = useMemo(() => ({
    conditionsCount: conditions.length,
    activeFilters: Object.keys(filterRules).filter(k => filterRules[k as keyof FilterRules] !== undefined).length,
    resultsCount: results.length,
    bookmarksCount: bookmarks.length,
  }), [conditions.length, filterRules, results.length, bookmarks.length]);

  return (
    <div className="flex flex-col h-full p-4 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Search className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">חיפוש מתקדם</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{stats.conditionsCount} תנאים</Badge>
          <Badge variant="outline">{stats.activeFilters} מסננים</Badge>
          <Badge variant="secondary">{stats.resultsCount} תוצאות</Badge>
        </div>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="search" className="gap-2">
            <Search className="h-4 w-4" />
            חיפוש
          </TabsTrigger>
          <TabsTrigger value="text" className="gap-2">
            <FileText className="h-4 w-4" />
            טקסט
          </TabsTrigger>
          <TabsTrigger value="filters" className="gap-2">
            <Filter className="h-4 w-4" />
            מסננים
          </TabsTrigger>
          <TabsTrigger value="wordlists" className="gap-2">
            <List className="h-4 w-4" />
            רשימות מילים
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            היסטוריה
          </TabsTrigger>
          <TabsTrigger value="bookmarks" className="gap-2">
            <BookmarkIcon className="h-4 w-4" />
            סימניות ({stats.bookmarksCount})
          </TabsTrigger>
          <TabsTrigger value="testing" className="gap-2">
            <TestTube className="h-4 w-4" />
            בדיקות
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 mt-4 overflow-hidden">
          {/* Search Tab */}
          <TabsContent value="search" className="h-full mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
              {/* Left Panel - Conditions */}
              <Card className="flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>תנאי חיפוש</span>
                    <div className="flex gap-2">
                      <ShareSearch 
                        conditions={conditions}
                        filterRules={filterRules}
                        text={text}
                      />
                      <Button 
                        onClick={executeSearch} 
                        disabled={isSearching}
                        className="gap-2"
                      >
                        <Search className="h-4 w-4" />
                        {isSearching ? 'מחפש...' : 'חפש'}
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-auto">
                  <SearchConditionBuilder
                    conditions={conditions}
                    onAddCondition={handleAddCondition}
                    onUpdateCondition={handleUpdateCondition}
                    onRemoveCondition={handleRemoveCondition}
                  />
                  <div className="mt-4">
                    <ActiveRulesPreview 
                      conditions={conditions}
                      filterRules={filterRules}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Right Panel - Results */}
              <Card className="flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>תוצאות ({results.length})</span>
                    {results.length > 0 && (
                      <ExportResults 
                        results={results}
                        conditions={conditions}
                        filterRules={filterRules}
                      />
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden">
                  <ScrollArea className="h-full">
                    <SearchResults 
                      results={results}
                      onBookmark={handleBookmarkResult}
                      highlightTerms={conditions.map(c => c.term)}
                    />
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Text Input Tab */}
          <TabsContent value="text" className="h-full mt-0">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>הזנת טקסט לחיפוש</CardTitle>
              </CardHeader>
              <CardContent className="h-[calc(100%-4rem)]">
                <TextInput 
                  value={text}
                  onChange={setText}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Filters Tab */}
          <TabsContent value="filters" className="h-full mt-0">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>מסננים</CardTitle>
              </CardHeader>
              <CardContent className="overflow-auto h-[calc(100%-4rem)]">
                <FilterRulesBuilder
                  filterRules={filterRules}
                  onChange={setFilterRules}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Word Lists Tab */}
          <TabsContent value="wordlists" className="h-full mt-0">
            <WordListManager />
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="h-full mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
              <SearchHistory
                history={searchHistory}
                onLoad={handleLoadFromHistory}
                onDelete={removeFromHistory}
                onClearAll={clearHistory}
              />
              <SearchTemplates
                templates={templates}
                onLoad={handleLoadTemplate}
                onSave={handleSaveAsTemplate}
                onUpdate={updateTemplate}
                onDelete={deleteTemplate}
                currentConditions={conditions}
                currentFilterRules={filterRules}
              />
            </div>
          </TabsContent>

          {/* Bookmarks Tab */}
          <TabsContent value="bookmarks" className="h-full mt-0">
            <ResultBookmarks
              bookmarks={bookmarks}
              onRemoveBookmark={removeBookmark}
              onClearAll={clearBookmarks}
              onUpdateBookmark={updateBookmark}
            />
          </TabsContent>

          {/* Testing Tab */}
          <TabsContent value="testing" className="h-full mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
              <RulesValidationSystem
                text={text}
                conditions={conditions}
                filterRules={filterRules}
              />
              <TestingPanel
                text={text}
                conditions={conditions}
                filterRules={filterRules}
              />
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

export default AdvancedSearchTab;
