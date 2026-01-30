import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trash2, Search, RefreshCw, AlertTriangle, CheckCircle2, FileText, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProblemPsak {
  id: string;
  title: string;
  court: string;
  year: number;
  wordCount: number;
  reason: string[];
  duplicateOf?: string;
}

interface Stats {
  total: number;
  linked: number;
  duplicates: number;
  duplicatesByTitle: number;
  duplicatesByHash: number;
  emptyOrShort: number;
  unlinked: number;
  minWordsThreshold: number;
}

export const CleanupDuplicatesTab: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [problems, setProblems] = useState<ProblemPsak[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [minWords, setMinWords] = useState(50);
  const [similarityThreshold, setSimilarityThreshold] = useState(85);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('cleanup-duplicates', {
        body: { action: 'stats', minWords }
      });

      if (error) throw error;
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast.error('שגיאה בטעינת סטטיסטיקות');
    } finally {
      setIsLoading(false);
    }
  };

  const findProblems = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('cleanup-duplicates', {
        body: { 
          action: 'find-problems', 
          minWords,
          similarityThreshold: similarityThreshold / 100
        }
      });

      if (error) throw error;
      if (data.success) {
        setProblems(data.problems);
        setSelectedIds(new Set());
        toast.success(`נמצאו ${data.total} פסקי דין בעייתיים`);
      }
    } catch (error) {
      console.error('Error finding problems:', error);
      toast.error('שגיאה בחיפוש בעיות');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0) {
      toast.warning('לא נבחרו פסקי דין למחיקה');
      return;
    }

    if (!confirm(`האם אתה בטוח שברצונך למחוק ${selectedIds.size} פסקי דין?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('cleanup-duplicates', {
        body: { action: 'delete-selected', ids: Array.from(selectedIds) }
      });

      if (error) throw error;
      if (data.success) {
        toast.success(`נמחקו ${data.deleted} פסקי דין בהצלחה`);
        // Refresh the list
        await findProblems();
        await fetchStats();
      }
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('שגיאה במחיקת פסקי דין');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (selectedIds.size === problems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(problems.map(p => p.id)));
    }
  };

  const selectByReason = (reasonFilter: string) => {
    const matching = problems.filter(p => 
      p.reason.some(r => r.includes(reasonFilter))
    );
    setSelectedIds(new Set(matching.map(p => p.id)));
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const getReasonBadgeColor = (reason: string): string => {
    if (reason.includes('כפילות')) return 'bg-orange-100 text-orange-800 border-orange-300';
    if (reason.includes('קצר')) return 'bg-red-100 text-red-800 border-red-300';
    if (reason.includes('דמיון')) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-gray-100 text-gray-800 border-gray-300';
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Card */}
      <Card className="border-2 border-[#b8860b]/30 bg-white">
        <CardHeader>
          <CardTitle className="text-[#1e3a5f] flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            ניקוי פסקי דין כפולים וריקים
          </CardTitle>
          <CardDescription>
            זיהוי ומחיקת פסקי דין כפולים, עם תוכן דומה מאוד, או עם מעט מדי טקסט
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Settings */}
          <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Label htmlFor="minWords">מינימום מילים:</Label>
              <Input
                id="minWords"
                type="number"
                value={minWords}
                onChange={(e) => setMinWords(Number(e.target.value))}
                className="w-20"
                min={10}
                max={500}
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="similarity">סף דמיון (%):</Label>
              <Input
                id="similarity"
                type="number"
                value={similarityThreshold}
                onChange={(e) => setSimilarityThreshold(Number(e.target.value))}
                className="w-20"
                min={50}
                max={100}
              />
            </div>
            <Button 
              onClick={findProblems} 
              disabled={isLoading}
              className="bg-[#1e3a5f] hover:bg-[#2a4a6f]"
            >
              {isLoading ? <RefreshCw className="h-4 w-4 animate-spin ml-2" /> : <Search className="h-4 w-4 ml-2" />}
              חפש בעיות
            </Button>
          </div>

          {/* Statistics */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-2xl font-bold text-blue-700">{stats.total}</div>
                <div className="text-sm text-blue-600">סה"כ פסקי דין</div>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                <div className="text-2xl font-bold text-orange-700">{stats.duplicates}</div>
                <div className="text-sm text-orange-600">כפילויות</div>
              </div>
              <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                <div className="text-2xl font-bold text-red-700">{stats.emptyOrShort}</div>
                <div className="text-sm text-red-600">ריקים/קצרים</div>
              </div>
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="text-2xl font-bold text-green-700">{stats.linked}</div>
                <div className="text-sm text-green-600">מקושרים לסוגיות</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Problems List */}
      {problems.length > 0 && (
        <Card className="border-2 border-[#b8860b]/30 bg-white">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-[#1e3a5f]">
                פסקי דין בעייתיים ({problems.length})
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAll}
                  className="border-[#b8860b] text-[#1e3a5f]"
                >
                  {selectedIds.size === problems.length ? 'בטל בחירה' : 'בחר הכל'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectByReason('כפילות')}
                  className="border-orange-400 text-orange-700"
                >
                  <Copy className="h-4 w-4 ml-1" />
                  בחר כפילויות
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectByReason('קצר')}
                  className="border-red-400 text-red-700"
                >
                  <FileText className="h-4 w-4 ml-1" />
                  בחר ריקים
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {selectedIds.size > 0 && (
              <Alert className="mb-4 border-red-300 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-700">
                  נבחרו {selectedIds.size} פסקי דין למחיקה
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={deleteSelected}
                    disabled={isDeleting}
                    className="mr-4"
                  >
                    {isDeleting ? <RefreshCw className="h-4 w-4 animate-spin ml-1" /> : <Trash2 className="h-4 w-4 ml-1" />}
                    מחק נבחרים
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {problems.map((psak) => (
                  <div
                    key={psak.id}
                    className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                      selectedIds.has(psak.id)
                        ? 'bg-red-50 border-red-300'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => toggleSelect(psak.id)}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedIds.has(psak.id)}
                        onCheckedChange={() => toggleSelect(psak.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-[#1e3a5f] truncate">
                            {psak.title}
                          </span>
                          <span className="text-sm text-gray-500">
                            ({psak.court}, {psak.year})
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-gray-400">
                            {psak.wordCount} מילים
                          </span>
                          {psak.reason.map((r, i) => (
                            <Badge
                              key={i}
                              variant="outline"
                              className={`text-xs ${getReasonBadgeColor(r)}`}
                            >
                              {r}
                            </Badge>
                          ))}
                        </div>
                        {psak.duplicateOf && (
                          <div className="text-xs text-orange-600 mt-1">
                            כפילות של: {psak.duplicateOf}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* No problems found */}
      {problems.length === 0 && !isLoading && stats && (
        <Alert className="border-green-300 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">
            לא נמצאו בעיות. לחץ על "חפש בעיות" לסריקה מחדש.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default CleanupDuplicatesTab;
