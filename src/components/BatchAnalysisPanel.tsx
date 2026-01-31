import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Play, Pause, Square, RotateCcw, RefreshCw, 
  Loader2, CheckCircle2, XCircle, Clock, Zap 
} from 'lucide-react';
import { useBatchAnalysis } from '@/hooks/useBatchAnalysis';

const BatchAnalysisPanel = () => {
  const {
    isRunning,
    isPaused,
    progress,
    currentPsakTitle,
    error,
    startAnalysis,
    resumeAnalysis,
    pauseAnalysis,
    cancelAnalysis,
    resetAnalysis,
    hasSavedProgress,
  } = useBatchAnalysis();

  const totalToProcess = progress?.psakIds.length || 0;
  const currentIndex = progress?.currentIndex || 0;
  const successCount = progress?.successCount || 0;
  const failCount = progress?.failCount || 0;
  const percentComplete = totalToProcess > 0 ? (currentIndex / totalToProcess) * 100 : 0;
  const remaining = totalToProcess - currentIndex;

  // Estimate time remaining (1.5 seconds per item average)
  const estimatedMinutes = Math.ceil(remaining * 1.5 / 60);

  return (
    <Card className="border-primary/30" dir="rtl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            ניתוח AI ב-Batches
          </CardTitle>
          {hasSavedProgress && !isRunning && (
            <Badge variant="outline" className="text-amber-600 border-amber-600">
              <Clock className="w-3 h-3 ml-1" />
              יש ניתוח להמשך
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          מנתח 5 פסקי דין בכל פעם • שומר התקדמות אוטומטית
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress Stats */}
        {progress && (
          <div className="grid grid-cols-4 gap-3 text-center">
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-2xl font-bold">{totalToProcess}</div>
              <div className="text-xs text-muted-foreground">סה"כ</div>
            </div>
            <div className="bg-green-500/10 rounded-lg p-3">
              <div className="text-2xl font-bold text-green-600">{successCount}</div>
              <div className="text-xs text-muted-foreground">הצליחו</div>
            </div>
            <div className="bg-red-500/10 rounded-lg p-3">
              <div className="text-2xl font-bold text-red-600">{failCount}</div>
              <div className="text-xs text-muted-foreground">נכשלו</div>
            </div>
            <div className="bg-primary/10 rounded-lg p-3">
              <div className="text-2xl font-bold text-primary">{remaining}</div>
              <div className="text-xs text-muted-foreground">נותרו</div>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        {isRunning || (progress && !progress.isCompleted) ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                {isRunning && !isPaused ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                ) : isPaused ? (
                  <Pause className="w-4 h-4 text-amber-500" />
                ) : (
                  <Clock className="w-4 h-4 text-muted-foreground" />
                )}
                {isRunning ? (isPaused ? 'מושהה' : 'מנתח...') : 'ממתין להמשך'}
              </span>
              <span className="text-muted-foreground">
                {currentIndex}/{totalToProcess} ({Math.round(percentComplete)}%)
              </span>
            </div>
            
            <Progress value={percentComplete} className="h-3" />
            
            {currentPsakTitle && isRunning && !isPaused && (
              <p className="text-sm text-muted-foreground truncate">
                מנתח: {currentPsakTitle}
              </p>
            )}

            {remaining > 0 && (
              <p className="text-xs text-muted-foreground">
                זמן משוער: ~{estimatedMinutes} דקות
              </p>
            )}
          </div>
        ) : progress?.isCompleted ? (
          <div className="flex items-center gap-2 p-4 bg-green-500/10 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <span className="text-green-600 font-medium">
              הניתוח הושלם! {successCount} פסקים נותחו בהצלחה
            </span>
          </div>
        ) : null}

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 rounded-lg text-red-600 text-sm">
            <XCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-wrap gap-2">
          {!isRunning ? (
            <>
              {hasSavedProgress ? (
                <Button onClick={resumeAnalysis} className="gap-2 flex-1">
                  <Play className="w-4 h-4" />
                  המשך ניתוח ({remaining} נותרו)
                </Button>
              ) : (
                <Button onClick={startAnalysis} className="gap-2 flex-1">
                  <Zap className="w-4 h-4" />
                  התחל ניתוח חדש
                </Button>
              )}
              
              {hasSavedProgress && (
                <>
                  <Button variant="outline" onClick={startAnalysis} className="gap-2">
                    <RefreshCw className="w-4 h-4" />
                    התחל מחדש
                  </Button>
                  <Button variant="ghost" onClick={resetAnalysis} className="gap-2 text-red-600">
                    <RotateCcw className="w-4 h-4" />
                    מחק התקדמות
                  </Button>
                </>
              )}
            </>
          ) : (
            <>
              {isPaused ? (
                <Button onClick={resumeAnalysis} className="gap-2 flex-1">
                  <Play className="w-4 h-4" />
                  המשך
                </Button>
              ) : (
                <Button variant="outline" onClick={pauseAnalysis} className="gap-2 flex-1">
                  <Pause className="w-4 h-4" />
                  השהה
                </Button>
              )}
              <Button variant="destructive" onClick={cancelAnalysis} className="gap-2">
                <Square className="w-4 h-4" />
                עצור
              </Button>
            </>
          )}
        </div>

        {/* Info */}
        <div className="text-xs text-muted-foreground space-y-1 border-t pt-3">
          <p>• מנתח 5 פסקים בכל מחזור עם השהייה בין פריטים</p>
          <p>• ההתקדמות נשמרת אוטומטית - ניתן להפסיק ולהמשיך בכל עת</p>
          <p>• מדלג על פסקים שכבר מקושרים לסוגיות</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default BatchAnalysisPanel;
