import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Database,
  Search,
  Link2,
  Brain,
  Upload,
  HardDrive,
  Clock,
  Sparkles,
  ChevronDown,
  BookOpen,
  Zap,
  FlaskConical
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AnalysisValidation } from "./AnalysisValidation";

interface HealthCheckResult {
  name: string;
  nameHe: string;
  status: "success" | "warning" | "error";
  message: string;
  details?: Record<string, any>;
  duration?: number;
}

interface SystemHealthReport {
  timestamp: string;
  overallStatus: "success" | "warning" | "error";
  checks: HealthCheckResult[];
  summary: {
    total: number;
    passed: number;
    warnings: number;
    failed: number;
  };
}

const iconMap: Record<string, React.ReactNode> = {
  database_connection: <Database className="h-4 w-4" />,
  search_cache: <Search className="h-4 w-4" />,
  sugya_links: <Link2 className="h-4 w-4" />,
  smart_index: <Brain className="h-4 w-4" />,
  ai_service: <Sparkles className="h-4 w-4" />,
  sefaria_api: <BookOpen className="h-4 w-4" />,
  document_analysis: <Zap className="h-4 w-4" />,
  upload_function: <Upload className="h-4 w-4" />,
  storage_buckets: <HardDrive className="h-4 w-4" />,
  recent_activity: <Clock className="h-4 w-4" />,
  system: <Activity className="h-4 w-4" />
};

const statusColors = {
  success: "bg-green-500/10 text-green-600 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800",
  warning: "bg-yellow-500/10 text-yellow-600 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800",
  error: "bg-red-500/10 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
};

const statusIcons = {
  success: <CheckCircle2 className="h-5 w-5 text-green-500 dark:text-green-400" />,
  warning: <AlertTriangle className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />,
  error: <XCircle className="h-5 w-5 text-red-500 dark:text-red-400" />
};

export function SystemHealthCheck() {
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<SystemHealthReport | null>(null);
  const [expandedChecks, setExpandedChecks] = useState<Set<string>>(new Set());

  const runHealthCheck = useCallback(async (fullTest: boolean = false) => {
    setIsRunning(true);
    setReport(null);
    
    try {
      toast.info(fullTest ? "מריץ בדיקה מקיפה..." : "מריץ בדיקה מהירה...");
      
      const { data, error } = await supabase.functions.invoke('system-health-check', {
        body: { fullTest }
      });

      if (error) throw error;
      
      setReport(data as SystemHealthReport);
      
      const summary = data.summary;
      if (data.overallStatus === "success") {
        toast.success(`✅ כל ${summary.total} הבדיקות עברו בהצלחה!`);
      } else if (data.overallStatus === "warning") {
        toast.warning(`⚠️ ${summary.passed} עברו, ${summary.warnings} אזהרות`);
      } else {
        toast.error(`❌ ${summary.failed} בדיקות נכשלו`);
      }
    } catch (error: any) {
      console.error("Health check failed:", error);
      toast.error(`שגיאה בבדיקה: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  }, []);

  const toggleExpand = (name: string) => {
    setExpandedChecks(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const getOverallStatusMessage = () => {
    if (!report) return null;
    
    switch (report.overallStatus) {
      case "success":
        return { icon: "✅", text: "כל המערכות תקינות!", color: "text-green-600" };
      case "warning":
        return { icon: "⚠️", text: "יש כמה אזהרות", color: "text-yellow-600" };
      case "error":
        return { icon: "❌", text: "יש בעיות שדורשות טיפול", color: "text-red-600" };
    }
  };

  const overallMessage = getOverallStatusMessage();

  return (
    <Tabs defaultValue="health" className="w-full">
      <TabsList className="grid w-full grid-cols-2 mb-4">
        <TabsTrigger value="health" className="flex items-center gap-2">
          <Activity className="h-4 w-4" />
          בדיקת תקינות
        </TabsTrigger>
        <TabsTrigger value="validation" className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4" />
          אימות דיוק
        </TabsTrigger>
      </TabsList>

      <TabsContent value="health">
        <Card className="w-full">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5" />
                בדיקת תקינות המערכת
              </CardTitle>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runHealthCheck(false)}
                  disabled={isRunning}
                >
                  {isRunning ? (
                    <RefreshCw className="h-4 w-4 ml-2 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4 ml-2" />
                  )}
                  בדיקה מהירה
                </Button>
                
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => runHealthCheck(true)}
                  disabled={isRunning}
                >
                  {isRunning ? (
                    <RefreshCw className="h-4 w-4 ml-2 animate-spin" />
                  ) : (
                    <Activity className="h-4 w-4 ml-2" />
                  )}
                  בדיקה מקיפה
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {isRunning && (
              <div className="py-8 text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                <p className="text-muted-foreground">בודק את המערכות...</p>
              </div>
            )}

            {!isRunning && !report && (
              <div className="py-8 text-center text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>לחץ על אחד הכפתורים למעלה להרצת בדיקה</p>
                <p className="text-sm mt-2">
                  <strong>בדיקה מהירה:</strong> בודק חיבורים בסיסיים
                  <br />
                  <strong>בדיקה מקיפה:</strong> בודק גם AI וניתוח מסמכים
                </p>
              </div>
            )}

            {report && (
              <>
                {/* Overall Status */}
                <div className={`p-4 rounded-lg mb-4 ${
                  report.overallStatus === "success" ? "bg-green-50 dark:bg-green-950/30" :
                  report.overallStatus === "warning" ? "bg-yellow-50 dark:bg-yellow-950/30" :
                  "bg-red-50 dark:bg-red-950/30"
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{overallMessage?.icon}</span>
                      <div>
                        <p className={`font-medium ${overallMessage?.color}`}>
                          {overallMessage?.text}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(report.timestamp).toLocaleString('he-IL')}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-3 text-sm">
                      <Badge variant="outline" className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700">
                        ✓ {report.summary.passed}
                      </Badge>
                      {report.summary.warnings > 0 && (
                        <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700">
                          ⚠ {report.summary.warnings}
                        </Badge>
                      )}
                      {report.summary.failed > 0 && (
                        <Badge variant="outline" className="bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700">
                          ✗ {report.summary.failed}
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <Progress 
                    value={(report.summary.passed / report.summary.total) * 100} 
                    className="mt-3 h-2"
                  />
                </div>

                {/* Individual Checks */}
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {report.checks.map((check) => (
                      <Collapsible
                        key={check.name}
                        open={expandedChecks.has(check.name)}
                        onOpenChange={() => toggleExpand(check.name)}
                      >
                        <div className={`p-3 rounded-lg border ${statusColors[check.status]}`}>
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between cursor-pointer">
                              <div className="flex items-center gap-3">
                                {statusIcons[check.status]}
                                <span className="opacity-60">
                                  {iconMap[check.name] || <Activity className="h-4 w-4" />}
                                </span>
                                <div>
                                  <p className="font-medium">{check.nameHe}</p>
                                  <p className="text-sm opacity-80">{check.message}</p>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                {check.duration && (
                                  <span className="text-xs opacity-50">
                                    {check.duration}ms
                                  </span>
                                )}
                                {check.details && (
                                  <ChevronDown className={`h-4 w-4 transition-transform ${
                                    expandedChecks.has(check.name) ? "rotate-180" : ""
                                  }`} />
                                )}
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          
                          {check.details && (
                            <CollapsibleContent>
                              <div className="mt-3 pt-3 border-t border-current/10">
                                <pre className="text-xs bg-background/50 p-2 rounded overflow-auto max-h-32" dir="ltr">
                                  {JSON.stringify(check.details, null, 2)}
                                </pre>
                              </div>
                            </CollapsibleContent>
                          )}
                        </div>
                      </Collapsible>
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="validation">
        <AnalysisValidation />
      </TabsContent>
    </Tabs>
  );
}
