import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Building2, FileText, List, BookOpen, Sparkles, Brain, Loader2, Link, Plus, Search, Trash2, Filter, Edit, Wand2 } from "lucide-react";
import PsakDinViewDialog from "./PsakDinViewDialog";
import PsakDinEditDialog from "./PsakDinEditDialog";
import PsakDinActions from "./PsakDinActions";
import BulkActionsBar from "./BulkActionsBar";
import GemaraPsakDinIndex from "./GemaraPsakDinIndex";
import SourcesTreeIndex from "./SourcesTreeIndex";
import { DataQualityChecker } from "./DataQualityChecker";
import { useToast } from "@/hooks/use-toast";
import { FolderTree } from "lucide-react";

const ITEMS_PER_PAGE = 50;

// Pattern to detect junk/fake psakim
const JUNK_TITLE_PATTERN = 'אתר פסקי דין רבניים';
const JUNK_CONTENT_PATTERNS = [
  'לא נמצא הפריט המבוקש',
  'דף בית מפתח פסקי הדין',
  'חיפוש מתקדם מאמרים ועיונים',
  'צור קשר אודות English',
  'psakim.org',
];

const isJunkPsak = (psak: any): boolean => {
  const title = psak.title?.toLowerCase() || '';
  const summary = (psak.summary || psak.full_text || '').toLowerCase();
  
  if (title.includes(JUNK_TITLE_PATTERN.toLowerCase())) return true;
  
  for (const pattern of JUNK_CONTENT_PATTERNS) {
    if (summary.includes(pattern.toLowerCase())) return true;
  }
  
  return false;
};

const PsakDinTab = () => {
  const [psakim, setPsakim] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPsak, setSelectedPsak] = useState<any | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedForAnalysis, setSelectedForAnalysis] = useState<Set<string>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0 });
  const [psakLinks, setPsakLinks] = useState<Map<string, number>>(new Map());
  const [totalUnlinkedCount, setTotalUnlinkedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPsak, setEditingPsak] = useState<any | null>(null);
  const [isNewPsak, setIsNewPsak] = useState(false);
  const [selectedForBulk, setSelectedForBulk] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [showJunkOnly, setShowJunkOnly] = useState(false);
  const [deletingJunk, setDeletingJunk] = useState(false);
  const [cleaningTitles, setCleaningTitles] = useState(false);
  const { toast } = useToast();

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  useEffect(() => {
    loadPsakim(currentPage);
    loadLinkCounts();
    loadTotalUnlinkedCount();
  }, [currentPage]);

  const loadPsakim = async (page: number) => {
    setLoading(true);
    try {
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data, error, count } = await supabase
        .from('psakei_din')
        .select('*', { count: 'exact' })
        .order('year', { ascending: false })
        .range(from, to);

      if (error) throw error;
      setPsakim(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error loading psakim:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLinkCounts = async () => {
    try {
      const { data, error } = await supabase
        .from('sugya_psak_links')
        .select('psak_din_id');

      if (error) throw error;

      const counts = new Map<string, number>();
      data?.forEach(link => {
        counts.set(link.psak_din_id, (counts.get(link.psak_din_id) || 0) + 1);
      });
      setPsakLinks(counts);
    } catch (error) {
      console.error('Error loading link counts:', error);
    }
  };

  const loadTotalUnlinkedCount = async () => {
    try {
      // Get total psakei din count
      const { count: totalCount } = await supabase
        .from('psakei_din')
        .select('*', { count: 'exact', head: true });

      // Get linked psakei din count  
      const { data: linkedData } = await supabase
        .from('sugya_psak_links')
        .select('psak_din_id');
      
      const uniqueLinkedIds = new Set(linkedData?.map(l => l.psak_din_id) || []);
      
      setTotalUnlinkedCount((totalCount || 0) - uniqueLinkedIds.size);
    } catch (error) {
      console.error('Error loading unlinked count:', error);
    }
  };

  const handlePsakClick = (psak: any) => {
    setSelectedPsak(psak);
    setDialogOpen(true);
  };

  const handleEditPsak = async (psakId: string) => {
    const psak = psakim.find(p => p.id === psakId);
    if (psak) {
      setEditingPsak(psak);
      setIsNewPsak(false);
      setEditDialogOpen(true);
    }
  };

  const handleAddNew = () => {
    setEditingPsak(null);
    setIsNewPsak(true);
    setEditDialogOpen(true);
  };

  const handleEditSaved = () => {
    loadPsakim(currentPage);
    loadLinkCounts();
  };

  const handleDeletePsak = () => {
    loadPsakim(currentPage);
    loadLinkCounts();
    loadTotalUnlinkedCount();
  };

  // Filter psakim based on search and junk filter
  const filteredPsakim = useMemo(() => {
    let filtered = psakim;
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.title?.toLowerCase().includes(query) ||
        p.summary?.toLowerCase().includes(query) ||
        p.court?.toLowerCase().includes(query) ||
        p.case_number?.toLowerCase().includes(query)
      );
    }
    
    // Filter junk only
    if (showJunkOnly) {
      filtered = filtered.filter(isJunkPsak);
    }
    
    return filtered;
  }, [psakim, searchQuery, showJunkOnly]);
  
  // Count junk psakim in current view
  const junkCount = useMemo(() => {
    return psakim.filter(isJunkPsak).length;
  }, [psakim]);
  
  // Select all junk psakim for bulk delete
  const selectAllJunk = () => {
    const junkIds = psakim.filter(isJunkPsak).map(p => p.id);
    setSelectedForBulk(new Set(junkIds));
    toast({
      title: `נבחרו ${junkIds.length} פסקי דין זבל`,
      description: 'לחץ על "מחק נבחרים" למחיקה',
    });
  };
  
  // Find and delete ALL junk psakim from entire database
  const findAndDeleteAllJunk = async () => {
    if (!confirm('האם אתה בטוח? פעולה זו תמצא ותמחק את כל פסקי הדין הפייק מהמאגר כולו!')) {
      return;
    }
    
    setDeletingJunk(true);
    
    try {
      // First find all junk psakim by title pattern
      const { data: junkByTitle, error: titleError } = await supabase
        .from('psakei_din')
        .select('id, title')
        .ilike('title', `%${JUNK_TITLE_PATTERN}%`);
      
      if (titleError) throw titleError;
      
      const junkIds = new Set(junkByTitle?.map(p => p.id) || []);
      
      toast({
        title: `נמצאו ${junkIds.size} פסקי דין זבל`,
        description: 'מוחק...',
      });
      
      if (junkIds.size === 0) {
        toast({ title: 'לא נמצאו פסקי דין זבל' });
        return;
      }
      
      // Delete in batches of 100
      const idsArray = Array.from(junkIds);
      let deleted = 0;
      
      for (let i = 0; i < idsArray.length; i += 100) {
        const batch = idsArray.slice(i, i + 100);
        const { error } = await supabase
          .from('psakei_din')
          .delete()
          .in('id', batch);
        
        if (error) throw error;
        deleted += batch.length;
      }
      
      toast({
        title: `נמחקו ${deleted} פסקי דין זבל!`,
        description: 'המאגר נוקה בהצלחה',
      });
      
      // Reload
      loadPsakim(currentPage);
      loadTotalUnlinkedCount();
      
    } catch (error) {
      console.error('Error deleting junk:', error);
      toast({
        title: 'שגיאה במחיקה',
        description: String(error),
        variant: 'destructive',
      });
    } finally {
      setDeletingJunk(false);
    }
  };

  // Clean a single title - remove non-Hebrew text and duplicate icons
  const cleanTitle = (title: string): string => {
    if (!title) return title;
    
    let cleaned = title;
    
    // Remove duplicate/adjacent emojis and icons (two or more emojis next to each other)
    // Match emoji patterns
    const emojiPattern = /([\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}])/gu;
    // Remove consecutive emojis (2 or more)
    cleaned = cleaned.replace(/([\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]\s*){2,}/gu, '');
    
    // Remove English text (keep Hebrew, numbers, punctuation, and spaces)
    // Hebrew range: \u0590-\u05FF (includes nikud and taamim)
    // Also keep common punctuation and numbers
    cleaned = cleaned.replace(/[a-zA-Z]+/g, '');
    
    // Remove URLs
    cleaned = cleaned.replace(/https?:\/\/[^\s]+/gi, '');
    cleaned = cleaned.replace(/www\.[^\s]+/gi, '');
    
    // Remove email addresses
    cleaned = cleaned.replace(/[\w.-]+@[\w.-]+\.[a-z]{2,}/gi, '');
    
    // Remove excess whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    // Remove leading/trailing punctuation that doesn't make sense
    cleaned = cleaned.replace(/^[\s,.:;\-|/]+/, '').replace(/[\s,.:;\-|/]+$/, '');
    
    return cleaned;
  };

  // Clean all titles in the database
  const cleanAllTitles = async () => {
    if (!confirm('האם לנקות את כל הכותרות? הפעולה תסיר טקסט באנגלית ואייקונים כפולים מכל הכותרות.')) {
      return;
    }
    
    setCleaningTitles(true);
    
    try {
      // Get all psakim with titles
      const { data: allPsakim, error: fetchError } = await supabase
        .from('psakei_din')
        .select('id, title');
      
      if (fetchError) throw fetchError;
      
      let updatedCount = 0;
      let skippedCount = 0;
      
      // Process in batches
      for (const psak of allPsakim || []) {
        if (!psak.title) {
          skippedCount++;
          continue;
        }
        
        const cleanedTitle = cleanTitle(psak.title);
        
        // Only update if the title changed
        if (cleanedTitle !== psak.title && cleanedTitle.length > 0) {
          const { error: updateError } = await supabase
            .from('psakei_din')
            .update({ title: cleanedTitle })
            .eq('id', psak.id);
          
          if (!updateError) {
            updatedCount++;
          }
        } else {
          skippedCount++;
        }
      }
      
      toast({
        title: `נוקו ${updatedCount} כותרות!`,
        description: `${skippedCount} כותרות לא הצטרכו שינוי`,
      });
      
      // Reload
      loadPsakim(currentPage);
      
    } catch (error) {
      console.error('Error cleaning titles:', error);
      toast({
        title: 'שגיאה בניקוי כותרות',
        description: String(error),
        variant: 'destructive',
      });
    } finally {
      setCleaningTitles(false);
    }
  };

  const toggleBulkSelect = (id: string) => {
    setSelectedForBulk(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const selectAllForBulk = () => {
    setSelectedForBulk(new Set(filteredPsakim.map(p => p.id)));
  };

  const clearBulkSelection = () => {
    setSelectedForBulk(new Set());
  };

  const toggleSelectForAnalysis = (id: string) => {
    setSelectedForAnalysis(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const selectAllForAnalysis = () => {
    const unlinkedPsakim = psakim.filter(p => !psakLinks.has(p.id));
    if (selectedForAnalysis.size === unlinkedPsakim.length) {
      setSelectedForAnalysis(new Set());
    } else {
      setSelectedForAnalysis(new Set(unlinkedPsakim.map(p => p.id)));
    }
  };

  const runAIAnalysis = async () => {
    if (selectedForAnalysis.size === 0) {
      toast({
        title: "בחר פסקי דין לניתוח",
        variant: "destructive",
      });
      return;
    }

    setAnalyzing(true);
    const idsToAnalyze = Array.from(selectedForAnalysis);
    setAnalysisProgress({ current: 0, total: idsToAnalyze.length });

    let successCount = 0;
    
    for (let i = 0; i < idsToAnalyze.length; i++) {
      setAnalysisProgress({ current: i + 1, total: idsToAnalyze.length });
      
      try {
        const { error } = await supabase.functions.invoke('analyze-psak-din', {
          body: { psakId: idsToAnalyze[i] }
        });
        
        if (!error) {
          successCount++;
        }
        console.log(`Analyzed psak ${idsToAnalyze[i]}`);
      } catch (err) {
        console.error(`Error analyzing psak ${idsToAnalyze[i]}:`, err);
      }
      
      if (i < idsToAnalyze.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    setAnalyzing(false);
    setSelectedForAnalysis(new Set());
    
    // Reload link counts, page data and refresh the list to update status badges
    await loadLinkCounts();
    await loadTotalUnlinkedCount();
    await loadPsakim(currentPage); // Reload the current page to refresh badges
    
    toast({
      title: "ניתוח AI הושלם",
      description: `נותחו ${successCount} פסקי דין בהצלחה`,
    });
  };

  const displayedUnlinkedCount = psakim.filter(p => !psakLinks.has(p.id)).length;

  return (
    <div className="container mx-auto px-4 py-8" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <Tabs defaultValue="recent" className="space-y-6">
          <TabsList className="grid w-full max-w-2xl grid-cols-3 ml-auto">
            <TabsTrigger value="recent" className="gap-2 flex-row-reverse">
              פסקי דין אחרונים
              <List className="w-4 h-4" />
            </TabsTrigger>
            <TabsTrigger value="index" className="gap-2 flex-row-reverse">
              אינדקס מסכתות
              <BookOpen className="w-4 h-4" />
            </TabsTrigger>
            <TabsTrigger value="tree" className="gap-2 flex-row-reverse">
              עץ מקורות
              <FolderTree className="w-4 h-4" />
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recent">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">טוען...</div>
            ) : (
              <div className="max-w-4xl mx-auto space-y-4">
                {/* Database Count Card */}
                <Card className="mb-4 border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-full bg-primary/10">
                          <FileText className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">סה"כ פסקי דין במאגר</p>
                          <p className="text-3xl font-bold text-primary">
                            {loading ? (
                              <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                              totalCount.toLocaleString('he-IL')
                            )}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadPsakim(currentPage)}
                        disabled={loading}
                        className="gap-2"
                      >
                        {loading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <span className="rotate-180">↻</span>
                        )}
                        עדכן
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Header */}
                <div className="flex items-center justify-between mb-6 flex-row-reverse">
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-foreground">פסקי דין אחרונים</h2>
                    <Button
                      size="sm"
                      onClick={handleAddNew}
                      className="gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      הוסף פסק דין
                    </Button>
                    <DataQualityChecker 
                      psakeiDin={psakim.map(psak => ({
                        id: psak.id,
                        title: psak.title || '',
                        summary: psak.summary || '',
                        full_text: psak.full_text || psak.summary || '',
                        court: psak.court || '',
                        year: psak.year || 0,
                        case_number: psak.case_number,
                        tags: psak.tags,
                        content_hash: psak.content_hash,
                        created_at: psak.created_at,
                      }))}
                      onRefresh={() => loadPsakim(currentPage)}
                      isLoading={loading}
                      compact={true}
                    />
                  </div>
                  
                  {totalUnlinkedCount > 0 && (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        {totalUnlinkedCount} פסקים ללא קישור
                      </span>
                      {selectedForAnalysis.size > 0 && (
                        <Button
                          size="sm"
                          onClick={runAIAnalysis}
                          disabled={analyzing}
                          className="gap-2 flex-row-reverse"
                        >
                          {analyzing ? (
                            <>
                              מנתח...
                              <Loader2 className="w-4 h-4 animate-spin" />
                            </>
                          ) : (
                            <>
                              נתח {selectedForAnalysis.size} פסקים
                              <Sparkles className="w-4 h-4" />
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Search and Filter Bar */}
                <Card className="border border-border">
                  <CardContent className="p-3">
                    <div className="flex flex-wrap gap-3 items-center">
                      {/* Search Input */}
                      <div className="flex-1 min-w-[200px]">
                        <div className="relative">
                          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            placeholder="חיפוש לפי כותרת, בית משפט, תקציר..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pr-10"
                          />
                        </div>
                      </div>
                      
                      {/* Junk Filter Toggle */}
                      <Button
                        variant={showJunkOnly ? "default" : "outline"}
                        size="sm"
                        onClick={() => setShowJunkOnly(!showJunkOnly)}
                        className="gap-2"
                      >
                        <Filter className="w-4 h-4" />
                        {showJunkOnly ? 'הצג הכל' : `הצג רק זבל (${junkCount})`}
                      </Button>
                      
                      {/* Select All Junk */}
                      {junkCount > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={selectAllJunk}
                          className="gap-2 text-orange-600 border-orange-300 hover:bg-orange-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          בחר זבל ({junkCount})
                        </Button>
                      )}
                      
                      {/* Delete All Junk from DB */}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={findAndDeleteAllJunk}
                        disabled={deletingJunk}
                        className="gap-2"
                      >
                        {deletingJunk ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                        🗑️ מחק כל הזבל מהמאגר
                      </Button>
                      
                      {/* Clean All Titles Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={cleanAllTitles}
                        disabled={cleaningTitles}
                        className="gap-2 text-blue-600 border-blue-300 hover:bg-blue-50"
                      >
                        {cleaningTitles ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Wand2 className="w-4 h-4" />
                        )}
                        ✨ נקה כותרות (הסר אנגלית ואייקונים)
                      </Button>
                    </div>
                    
                    {/* Search Results Info */}
                    {(searchQuery || showJunkOnly) && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        מציג {filteredPsakim.length} תוצאות
                        {searchQuery && ` עבור "${searchQuery}"`}
                        {showJunkOnly && ' (סינון: זבל בלבד)'}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Bulk Actions Bar */}
                <BulkActionsBar
                  selectedCount={selectedForBulk.size}
                  totalCount={filteredPsakim.length}
                  onSelectAll={selectAllForBulk}
                  onClearSelection={clearBulkSelection}
                  selectedIds={Array.from(selectedForBulk)}
                  onDeleted={handleDeletePsak}
                />

                {/* Analysis Progress */}
                {analyzing && (
                  <Card className="border border-primary/30 bg-primary/5">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-2 flex-row-reverse">
                        <Brain className="w-5 h-5 text-primary animate-pulse" />
                        <span className="font-medium">מנתח פסקי דין באמצעות AI...</span>
                        <span className="ml-auto text-sm">
                          {analysisProgress.current}/{analysisProgress.total}
                        </span>
                      </div>
                      <Progress 
                        value={(analysisProgress.current / analysisProgress.total) * 100} 
                        className="h-2" 
                      />
                      <p className="text-xs text-muted-foreground mt-2 text-right">
                        מזהה מקורות תלמודיים ומקשר לדפי גמרא רלוונטיים
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Select All for Analysis */}
                {displayedUnlinkedCount > 0 && !analyzing && (
                  <Card className="border border-accent/30 bg-accent/5">
                    <CardContent className="p-3 flex items-center justify-between flex-row-reverse">
                      <div className="flex items-center gap-3 flex-row-reverse">
                        <Sparkles className="w-5 h-5 text-accent" />
                        <div className="text-right">
                          <p className="font-medium text-sm">ניתוח AI לפסקי דין קיימים</p>
                          <p className="text-xs text-muted-foreground">
                            בחר פסקי דין לניתוח וקישור אוטומטי למקורות גמרא
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={selectAllForAnalysis}
                      >
                        {selectedForAnalysis.size === displayedUnlinkedCount ? 'בטל בחירה' : `בחר הכל (${displayedUnlinkedCount})`}
                      </Button>
                    </CardContent>
                  </Card>
                )}
                
                {filteredPsakim.map((psak) => {
                  const hasLinks = psakLinks.has(psak.id);
                  const linkCount = psakLinks.get(psak.id) || 0;
                  const isSelected = selectedForAnalysis.has(psak.id);
                  const isPsakJunk = isJunkPsak(psak);
                  
                  return (
                    <Card 
                      key={psak.id} 
                      className={`border shadow-sm hover:shadow-md transition-shadow ${
                        isSelected ? 'border-accent ring-1 ring-accent' : 
                        isPsakJunk ? 'border-red-300 bg-red-50/30' : 'border-border'
                      }`}
                    >
                      <CardContent className="p-4">
                        {/* Junk Badge */}
                        {isPsakJunk && (
                          <Badge variant="destructive" className="mb-2">
                            🗑️ זבל / דף שגיאה
                          </Badge>
                        )}
                        
                        {/* Top Row: Title + Action Items */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          {/* Right Side: Title and Meta */}
                          <div 
                            className="flex-1 cursor-pointer"
                            onClick={() => handlePsakClick(psak)}
                          >
                            <h3 className="text-lg font-semibold text-foreground text-right mb-2 leading-tight">
                              {psak.title}
                            </h3>
                            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground justify-end">
                              <div className="flex items-center gap-1">
                                <span>{psak.court}</span>
                                <Building2 className="w-3.5 h-3.5 text-primary" />
                              </div>
                              <div className="flex items-center gap-1">
                                <span>{psak.year}</span>
                                <Calendar className="w-3.5 h-3.5 text-primary" />
                              </div>
                              {psak.case_number && (
                                <div className="flex items-center gap-1">
                                  <span>{psak.case_number}</span>
                                  <FileText className="w-3.5 h-3.5 text-primary" />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Left Side: Actions + Checkbox */}
                          <div className="flex items-center gap-1 shrink-0">
                            <PsakDinActions
                              psakId={psak.id}
                              onEdit={handleEditPsak}
                              onDelete={handleDeletePsak}
                              showCheckbox={true}
                              isSelected={selectedForBulk.has(psak.id)}
                              onSelectChange={() => toggleBulkSelect(psak.id)}
                              compact
                            />
                            {!hasLinks && !analyzing && (
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSelectForAnalysis(psak.id)}
                                onClick={(e) => e.stopPropagation()}
                                title="בחר לניתוח AI"
                              />
                            )}
                          </div>
                        </div>

                        {/* Summary */}
                        <p 
                          className="text-foreground mb-4 line-clamp-2 text-right cursor-pointer"
                          onClick={() => handlePsakClick(psak)}
                        >
                          {psak.summary}
                        </p>

                        {/* Bottom Row: Status Badge + Tags */}
                        <div className="flex items-center justify-between gap-3 border-t border-border/50 pt-3">
                          {/* Right Side: Tags */}
                          <div className="flex flex-wrap gap-1.5 flex-1 justify-end">
                            {psak.tags && psak.tags.slice(0, 4).map((tag: string, idx: number) => (
                              <Badge 
                                key={idx} 
                                variant="secondary" 
                                className="text-xs px-2 py-0.5 bg-muted/60 text-muted-foreground"
                              >
                                {tag}
                              </Badge>
                            ))}
                            {psak.tags && psak.tags.length > 4 && (
                              <Badge variant="outline" className="text-xs px-2 py-0.5">
                                +{psak.tags.length - 4}
                              </Badge>
                            )}
                          </div>

                          {/* Left Side: Status Badge + Quick Action */}
                          <div className="flex items-center gap-2 shrink-0">
                            {hasLinks ? (
                              <Badge className="gap-1.5 text-xs px-2.5 py-1 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20">
                                <Link className="w-3 h-3" />
                                <span>{linkCount} קישורים</span>
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs px-2.5 py-1 text-muted-foreground border-dashed">
                                לא מנותח
                              </Badge>
                            )}
                            {!hasLinks && !analyzing && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  setSelectedForAnalysis(new Set([psak.id]));
                                  await runAIAnalysis();
                                }}
                                className="h-7 px-2 gap-1 text-xs"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>נתח</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1 || loading}
                    >
                      הקודם
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            disabled={loading}
                            className="w-10"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                      {totalPages > 5 && currentPage < totalPages - 2 && (
                        <>
                          <span className="px-2 text-muted-foreground">...</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={loading}
                            className="w-10"
                          >
                            {totalPages}
                          </Button>
                        </>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages || loading}
                    >
                      הבא
                    </Button>
                    <span className="text-sm text-muted-foreground mr-4">
                      עמוד {currentPage} מתוך {totalPages} ({totalCount} פסקי דין)
                    </span>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="index">
            <GemaraPsakDinIndex />
          </TabsContent>

          <TabsContent value="tree">
            <SourcesTreeIndex />
          </TabsContent>
        </Tabs>

        <PsakDinViewDialog 
          psak={selectedPsak} 
          open={dialogOpen} 
          onOpenChange={setDialogOpen} 
        />

        <PsakDinEditDialog
          psak={editingPsak}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSaved={handleEditSaved}
          isNew={isNewPsak}
        />
      </div>
    </div>
  );
};

export default PsakDinTab;
