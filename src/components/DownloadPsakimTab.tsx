import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Loader2, CheckCircle2, XCircle, AlertCircle, StopCircle, RotateCcw, FolderOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PROGRESS_STORAGE_KEY = 'download-psakim-progress';

interface DownloadProgress {
  lastProcessedId: number;
  tag: string;
  stats: { total: number; successful: number; skipped: number; failed: number };
  timestamp: number;
}

interface DownloadResult {
  id: number;
  success: boolean;
  error?: string;
  title?: string;
}

export const DownloadPsakimTab = () => {
  const [startId, setStartId] = useState<string>("1");
  const [endId, setEndId] = useState<string>("100");
  const [customTag, setCustomTag] = useState<string>("psakim.org");
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<DownloadResult[]>([]);
  const [stats, setStats] = useState({ total: 0, successful: 0, skipped: 0, failed: 0 });
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [currentBatch, setCurrentBatch] = useState<string>("");
  const [savedProgress, setSavedProgress] = useState<DownloadProgress | null>(null);

  // Load saved progress on mount
  useEffect(() => {
    const saved = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as DownloadProgress;
        // Only show if less than 24 hours old
        if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          setSavedProgress(parsed);
        } else {
          localStorage.removeItem(PROGRESS_STORAGE_KEY);
        }
      } catch {
        localStorage.removeItem(PROGRESS_STORAGE_KEY);
      }
    }
  }, []);

  const saveProgress = (lastId: number, tag: string, currentStats: typeof stats) => {
    const progressData: DownloadProgress = {
      lastProcessedId: lastId,
      tag,
      stats: currentStats,
      timestamp: Date.now()
    };
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progressData));
    setSavedProgress(progressData);
  };

  const clearSavedProgress = () => {
    localStorage.removeItem(PROGRESS_STORAGE_KEY);
    setSavedProgress(null);
  };

  const handleDownload = async () => {
    const start = parseInt(startId);
    const end = parseInt(endId);

    if (isNaN(start) || isNaN(end)) {
      toast.error("יש להזין מספרים תקינים");
      return;
    }

    if (start > end) {
      toast.error("מספר התחלה חייב להיות קטן ממספר סיום");
      return;
    }

    if (end - start > 500) {
      toast.error("ניתן להוריד עד 500 פסקים בפעם אחת");
      return;
    }

    setIsDownloading(true);
    setProgress(0);
    setResults([]);
    setStats({ total: 0, successful: 0, skipped: 0, failed: 0 });

    const controller = new AbortController();
    setAbortController(controller);

    try {
      // Simulate progress during download
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 2, 90));
      }, 1000);

      const { data, error } = await supabase.functions.invoke('download-psakim', {
        body: { startId: start, endId: end, batchSize: 5, tag: customTag }
      });

      clearInterval(progressInterval);

      if (error) {
        throw error;
      }

      setProgress(100);
      setResults(data.results || []);
      setStats({
        total: data.total || 0,
        successful: data.successful || 0,
        skipped: data.skipped || 0,
        failed: data.failed || 0
      });

      if (data.successful > 0) {
        toast.success(`הורדו בהצלחה ${data.successful} פסקי דין`);
      } else {
        toast.info("לא נמצאו פסקי דין חדשים בטווח המבוקש");
      }

    } catch (error: any) {
      console.error('Download error:', error);
      if (error.name !== 'AbortError') {
        toast.error(`שגיאה בהורדה: ${error.message}`);
      }
    } finally {
      setIsDownloading(false);
      setAbortController(null);
    }
  };

  const handleStop = () => {
    if (abortController) {
      abortController.abort();
      setIsDownloadingAll(false);
      toast.info("ההורדה הופסקה");
    }
  };

  const handleDownloadAll = async (resumeFromId?: number) => {
    setIsDownloadingAll(true);
    setProgress(0);
    setResults([]);
    
    // If resuming, start with saved stats
    const initialStats = resumeFromId && savedProgress 
      ? { ...savedProgress.stats }
      : { total: 0, successful: 0, skipped: 0, failed: 0 };
    setStats(initialStats);

    const controller = new AbortController();
    setAbortController(controller);

    let currentStart = resumeFromId || 1;
    const batchSize = 100;
    let consecutiveEmpty = 0;
    let totalStats = { ...initialStats };
    let allResults: DownloadResult[] = [];
    const tagToUse = resumeFromId && savedProgress ? savedProgress.tag : customTag;

    if (resumeFromId) {
      toast.info(`ממשיך הורדה מ-ID ${resumeFromId} עם תגית "${tagToUse}"`);
    }

    try {
      while (consecutiveEmpty < 3 && !controller.signal.aborted) {
        const currentEnd = currentStart + batchSize - 1;
        setCurrentBatch(`${currentStart}-${currentEnd}`);

        const { data, error } = await supabase.functions.invoke('download-psakim', {
          body: { startId: currentStart, endId: currentEnd, batchSize: 5, tag: tagToUse }
        });

        if (error) throw error;

        // Update cumulative stats
        totalStats.total += data.total || 0;
        totalStats.successful += data.successful || 0;
        totalStats.skipped += data.skipped || 0;
        totalStats.failed += data.failed || 0;
        
        allResults = [...allResults, ...(data.results || [])];
        setStats({ ...totalStats });
        setResults(allResults.slice(-50)); // Keep last 50 for display

        // Save progress after each batch
        saveProgress(currentEnd, tagToUse, totalStats);

        // Check if batch was empty (all skipped or no new content)
        if (data.successful === 0 && data.failed === 0) {
          consecutiveEmpty++;
        } else {
          consecutiveEmpty = 0;
        }

        // Progress estimate (rough)
        setProgress(Math.min(95, (totalStats.successful / Math.max(totalStats.total, 1)) * 100));

        currentStart += batchSize;
        
        // Small delay to prevent overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      setProgress(100);
      clearSavedProgress(); // Clear saved progress on successful completion
      toast.success(`הורדה הושלמה! נוספו ${totalStats.successful} פסקי דין חדשים`);

    } catch (error: any) {
      console.error('Download all error:', error);
      if (error.name !== 'AbortError') {
        toast.error(`שגיאה בהורדה: ${error.message}`);
      }
    } finally {
      setIsDownloadingAll(false);
      setAbortController(null);
      setCurrentBatch("");
    }
  };

  const getStatusIcon = (result: DownloadResult) => {
    if (result.success && result.error === 'already exists') {
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
    if (result.success) {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  const getStatusText = (result: DownloadResult) => {
    if (result.success && result.error === 'already exists') {
      return 'קיים';
    }
    if (result.success) {
      return result.title || 'הצלחה';
    }
    return result.error || 'נכשל';
  };

  return (
    <div className="space-y-6" dir="rtl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            הורדת פסקי דין מ-psakim.org
          </CardTitle>
          <CardDescription>
            הזן טווח מספרים להורדת פסקי דין מאתר psakim.org
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Saved Progress Banner */}
          {savedProgress && !isDownloadingAll && (
            <Card className="border-amber-500/50 bg-amber-500/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-amber-700 dark:text-amber-400">
                      נמצאה הורדה קודמת שלא הסתיימה
                    </p>
                    <p className="text-sm text-muted-foreground">
                      נעצר ב-ID {savedProgress.lastProcessedId} | תגית: "{savedProgress.tag}" | 
                      הורדו: {savedProgress.stats.successful} | דולגו: {savedProgress.stats.skipped}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleDownloadAll(savedProgress.lastProcessedId + 1)}
                      className="bg-amber-600 hover:bg-amber-700"
                    >
                      <RotateCcw className="ml-2 h-4 w-4" />
                      המשך
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={clearSavedProgress}
                    >
                      נקה
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tag Selection */}
          <div className="space-y-2">
            <Label htmlFor="customTag" className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              תגית/קטגוריה
            </Label>
            <Input
              id="customTag"
              type="text"
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
              placeholder="לדוגמה: ממון, אישות, ירושה"
              disabled={isDownloading || isDownloadingAll}
            />
            <p className="text-xs text-muted-foreground">
              כל הפסקים שיורדו יסומנו בתגית זו לסינון וחיפוש קל
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startId">מספר התחלה</Label>
              <Input
                id="startId"
                type="number"
                value={startId}
                onChange={(e) => setStartId(e.target.value)}
                placeholder="1"
                disabled={isDownloading || isDownloadingAll}
                min={1}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endId">מספר סיום</Label>
              <Input
                id="endId"
                type="number"
                value={endId}
                onChange={(e) => setEndId(e.target.value)}
                placeholder="100"
                disabled={isDownloading || isDownloadingAll}
                min={1}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleDownload}
              disabled={isDownloading || isDownloadingAll}
              className="flex-1"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  מוריד...
                </>
              ) : (
                <>
                  <Download className="ml-2 h-4 w-4" />
                  התחל הורדה
                </>
              )}
            </Button>
            <Button
              onClick={() => handleDownloadAll()}
              disabled={isDownloading || isDownloadingAll}
              variant="secondary"
              className="flex-1"
            >
              {isDownloadingAll ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  מוריד הכל... {currentBatch && `(${currentBatch})`}
                </>
              ) : (
                <>
                  <Download className="ml-2 h-4 w-4" />
                  הורד את הכל
                </>
              )}
            </Button>
            {(isDownloading || isDownloadingAll) && (
              <Button variant="destructive" onClick={handleStop}>
                <StopCircle className="ml-2 h-4 w-4" />
                עצור
              </Button>
            )}
          </div>

          {(isDownloading || progress > 0) && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-muted-foreground text-center">
                {progress}% הושלם
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {stats.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>תוצאות ההורדה</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-sm">
                סה"כ: {stats.total}
              </Badge>
              <Badge variant="default" className="bg-green-500 text-sm">
                הצלחה: {stats.successful}
              </Badge>
              <Badge variant="secondary" className="text-sm">
                דילוג: {stats.skipped}
              </Badge>
              <Badge variant="destructive" className="text-sm">
                נכשל: {stats.failed}
              </Badge>
            </div>

            {results.length > 0 && (
              <ScrollArea className="h-64 border rounded-md">
                <div className="p-2 space-y-1">
                  {results.map((result) => (
                    <div
                      key={result.id}
                      className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 text-sm"
                    >
                      {getStatusIcon(result)}
                      <span className="font-mono text-muted-foreground min-w-[60px]">
                        #{result.id}
                      </span>
                      <span className="flex-1 truncate">
                        {getStatusText(result)}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
