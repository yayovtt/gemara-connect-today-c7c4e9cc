import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  FlaskConical, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  Target,
  Clock,
  FileText
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SourceMatch {
  masechet: string;
  masechetEnglish?: string;
  daf: number;
  amud?: string;
}

interface ValidationResult {
  testId: string;
  testName: string;
  inputText: string;
  expected: any;
  actual: SourceMatch[];
  passed: boolean;
  accuracy: number;
  details: string;
  duration: number;
}

interface ValidationReport {
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  overallAccuracy: number;
  results: ValidationResult[];
  summary: {
    perfectMatches: number;
    partialMatches: number;
    noMatches: number;
    falsePositives: number;
  };
}

export function AnalysisValidation() {
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());

  const runValidation = useCallback(async () => {
    setIsRunning(true);
    setReport(null);
    
    try {
      toast.info("מריץ בדיקות אימות...");
      
      const { data, error } = await supabase.functions.invoke('validate-analysis-accuracy', {
        body: {}
      });

      if (error) throw error;
      
      setReport(data as ValidationReport);
      
      if (data.overallAccuracy >= 90) {
        toast.success(`✅ דיוק מעולה: ${data.overallAccuracy}%`);
      } else if (data.overallAccuracy >= 70) {
        toast.warning(`⚠️ דיוק בינוני: ${data.overallAccuracy}%`);
      } else {
        toast.error(`❌ דיוק נמוך: ${data.overallAccuracy}%`);
      }
    } catch (error: any) {
      console.error("Validation failed:", error);
      toast.error(`שגיאה: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  }, []);

  const toggleExpand = (testId: string) => {
    setExpandedTests(prev => {
      const next = new Set(prev);
      if (next.has(testId)) {
        next.delete(testId);
      } else {
        next.add(testId);
      }
      return next;
    });
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 90) return "text-green-600";
    if (accuracy >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  const getAccuracyBg = (accuracy: number) => {
    if (accuracy >= 90) return "bg-green-50 dark:bg-green-950/30";
    if (accuracy >= 70) return "bg-yellow-50 dark:bg-yellow-950/30";
    return "bg-red-50 dark:bg-red-950/30";
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FlaskConical className="h-5 w-5" />
            אימות דיוק זיהוי מקורות
          </CardTitle>
          
          <Button
            variant="default"
            size="sm"
            onClick={runValidation}
            disabled={isRunning}
          >
            {isRunning ? (
              <RefreshCw className="h-4 w-4 ml-2 animate-spin" />
            ) : (
              <Target className="h-4 w-4 ml-2" />
            )}
            הרץ בדיקות
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          בודק האם המערכת מזהה נכון מקורות תלמודיים (מסכת, דף, עמוד)
        </p>
      </CardHeader>

      <CardContent>
        {isRunning && (
          <div className="py-8 text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">מנתח טקסטים לדוגמה...</p>
            <p className="text-sm text-muted-foreground mt-1">
              זה יכול לקחת כ-30 שניות
            </p>
          </div>
        )}

        {!isRunning && !report && (
          <div className="py-8 text-center text-muted-foreground">
            <FlaskConical className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>לחץ "הרץ בדיקות" כדי לבדוק את דיוק זיהוי המקורות</p>
            <p className="text-sm mt-2">
              הבדיקות כוללות 10 טקסטים עם תוצאות צפויות ידועות
            </p>
          </div>
        )}

        {report && (
          <>
            {/* Overall Accuracy */}
            <div className={`p-4 rounded-lg mb-4 ${getAccuracyBg(report.overallAccuracy)}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold ${getAccuracyColor(report.overallAccuracy)}">
                    {report.overallAccuracy}%
                  </span>
                  <div>
                    <p className={`font-medium ${getAccuracyColor(report.overallAccuracy)}`}>
                      דיוק כללי
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {report.passed} / {report.totalTests} בדיקות עברו
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2 text-sm">
                  <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">
                    מושלם: {report.summary.perfectMatches}
                  </Badge>
                  {report.summary.partialMatches > 0 && (
                    <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-200">
                      חלקי: {report.summary.partialMatches}
                    </Badge>
                  )}
                  {report.summary.noMatches > 0 && (
                    <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">
                      נכשל: {report.summary.noMatches}
                    </Badge>
                  )}
                </div>
              </div>
              
              <Progress 
                value={report.overallAccuracy} 
                className="mt-3 h-3"
              />
            </div>

            {/* Test Results */}
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {report.results.map((result) => (
                  <Collapsible
                    key={result.testId}
                    open={expandedTests.has(result.testId)}
                    onOpenChange={() => toggleExpand(result.testId)}
                  >
                    <div className={`p-3 rounded-lg border ${
                      result.passed 
                        ? "bg-green-500/10 border-green-200" 
                        : result.accuracy > 0 
                          ? "bg-yellow-500/10 border-yellow-200"
                          : "bg-red-500/10 border-red-200"
                    }`}>
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between cursor-pointer">
                          <div className="flex items-center gap-3">
                            {result.passed ? (
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                            ) : result.accuracy > 0 ? (
                              <AlertTriangle className="h-5 w-5 text-yellow-500" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-500" />
                            )}
                            <div>
                              <p className="font-medium">{result.testName}</p>
                              <p className="text-sm opacity-70">
                                דיוק: {result.accuracy}%
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className="text-xs opacity-50 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {result.duration}ms
                            </span>
                            <ChevronDown className={`h-4 w-4 transition-transform ${
                              expandedTests.has(result.testId) ? "rotate-180" : ""
                            }`} />
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent>
                        <div className="mt-3 pt-3 border-t border-current/10 space-y-3">
                          {/* Input Text */}
                          <div>
                            <p className="text-xs font-medium mb-1 flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              טקסט קלט:
                            </p>
                            <p className="text-sm bg-background/50 p-2 rounded">
                              {result.inputText}
                            </p>
                          </div>
                          
                          {/* Expected vs Actual */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs font-medium mb-1">צפוי:</p>
                              <pre className="text-xs bg-background/50 p-2 rounded overflow-auto" dir="ltr">
                                {JSON.stringify(result.expected, null, 2)}
                              </pre>
                            </div>
                            <div>
                              <p className="text-xs font-medium mb-1">בפועל:</p>
                              <pre className="text-xs bg-background/50 p-2 rounded overflow-auto" dir="ltr">
                                {JSON.stringify(result.actual, null, 2)}
                              </pre>
                            </div>
                          </div>
                          
                          {/* Details */}
                          <div>
                            <p className="text-xs font-medium mb-1">פירוט:</p>
                            <pre className="text-xs bg-background/50 p-2 rounded whitespace-pre-wrap">
                              {result.details}
                            </pre>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}
              </div>
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  );
}
