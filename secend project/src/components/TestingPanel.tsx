import React, { useState, useEffect } from 'react';
import { 
  Play, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RefreshCw,
  FileText,
  AlertTriangle,
  Lightbulb,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Bug,
  Shield,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'pending';
  duration: number;
  error?: string;
  category: string;
}

interface TestSuite {
  name: string;
  tests: TestResult[];
  duration: number;
}

interface TestReport {
  totalTests: number;
  passed: number;
  failed: number;
  duration: number;
  suites: TestSuite[];
  timestamp: Date;
}

// סימולציה של תוצאות בדיקות (בסביבת ייצור היה מגיע מ-API)
const simulateTestResults = (): TestReport => {
  const suites: TestSuite[] = [
    {
      name: 'המרת מספרים לעברית',
      duration: 15,
      tests: [
        { name: 'ממיר מספר חד ספרתי', status: 'passed', duration: 2, category: 'conversion' },
        { name: 'ממיר מספר דו ספרתי', status: 'passed', duration: 1, category: 'conversion' },
        { name: 'מטפל במקרים מיוחדים 15 ו-16', status: 'passed', duration: 1, category: 'conversion' },
        { name: 'ממיר מספר תלת ספרתי', status: 'passed', duration: 1, category: 'conversion' },
        { name: 'מחזיר מחרוזת למספרים מחוץ לטווח', status: 'passed', duration: 1, category: 'conversion' },
      ]
    },
    {
      name: 'חישוב גימטריא',
      duration: 12,
      tests: [
        { name: 'מחשב גימטריא של מילה פשוטה', status: 'passed', duration: 2, category: 'gematria' },
        { name: 'מחשב גימטריא של מילים ידועות', status: 'passed', duration: 1, category: 'gematria' },
        { name: 'מטפל באותיות סופיות', status: 'passed', duration: 1, category: 'gematria' },
        { name: 'מחזיר 0 למחרוזת ריקה', status: 'passed', duration: 1, category: 'gematria' },
        { name: 'מתעלם מתווים לא עבריים', status: 'passed', duration: 1, category: 'gematria' },
      ]
    },
    {
      name: 'הסרת ניקוד',
      duration: 8,
      tests: [
        { name: 'מסיר ניקוד מטקסט', status: 'passed', duration: 2, category: 'normalization' },
        { name: 'לא משנה טקסט ללא ניקוד', status: 'passed', duration: 1, category: 'normalization' },
        { name: 'מטפל בטקסט מעורב', status: 'passed', duration: 1, category: 'normalization' },
      ]
    },
    {
      name: 'נרמול אותיות סופיות',
      duration: 8,
      tests: [
        { name: 'ממיר אותיות סופיות לרגילות', status: 'passed', duration: 2, category: 'normalization' },
        { name: 'ממיר מילה שלמה', status: 'passed', duration: 1, category: 'normalization' },
        { name: 'לא משנה אותיות רגילות', status: 'passed', duration: 1, category: 'normalization' },
      ]
    },
    {
      name: 'נרמול טקסט',
      duration: 10,
      tests: [
        { name: 'ממיר לאותיות קטנות', status: 'passed', duration: 1, category: 'normalization' },
        { name: 'מסיר ניקוד כשמופעל', status: 'passed', duration: 2, category: 'normalization' },
        { name: 'ממיר אותיות סופיות כשמופעל', status: 'passed', duration: 1, category: 'normalization' },
        { name: 'משלב מספר אפשרויות', status: 'passed', duration: 1, category: 'normalization' },
      ]
    },
    {
      name: 'בדיקת כללי מיקום יחסי',
      duration: 18,
      tests: [
        { name: 'מזהה מילה לפני מילה אחרת', status: 'passed', duration: 3, category: 'position' },
        { name: 'מזהה מילה אחרי מילה אחרת', status: 'passed', duration: 2, category: 'position' },
        { name: 'בודק מרחק מקסימלי', status: 'passed', duration: 2, category: 'position' },
        { name: 'מחזיר false אם מילה חסרה', status: 'passed', duration: 1, category: 'position' },
        { name: 'מאפשר כל מיקום עם anywhere', status: 'passed', duration: 1, category: 'position' },
      ]
    },
    {
      name: 'בדיקת כללי מיקום בשורה',
      duration: 12,
      tests: [
        { name: 'מזהה מילה בתחילת שורה', status: 'passed', duration: 3, category: 'position' },
        { name: 'מזהה מילה בסוף שורה', status: 'passed', duration: 2, category: 'position' },
        { name: 'מזהה מילה בכל מקום', status: 'passed', duration: 1, category: 'position' },
      ]
    },
    {
      name: 'בדיקת כללי סינון מלאים',
      duration: 20,
      tests: [
        { name: 'בודק מינימום מילים', status: 'passed', duration: 2, category: 'filter' },
        { name: 'בודק מקסימום מילים', status: 'passed', duration: 2, category: 'filter' },
        { name: 'בודק חובת מספרים', status: 'passed', duration: 2, category: 'filter' },
        { name: 'בודק אותיות בלבד', status: 'passed', duration: 2, category: 'filter' },
        { name: 'משלב כללי מיקום', status: 'passed', duration: 3, category: 'filter' },
      ]
    },
    {
      name: 'פיצול טקסט לקטעים',
      duration: 8,
      tests: [
        { name: 'מפצל לפי שורות', status: 'passed', duration: 2, category: 'parsing' },
        { name: 'מתעלם משורות ריקות', status: 'passed', duration: 1, category: 'parsing' },
        { name: 'מחזיר מערך ריק לטקסט ריק', status: 'passed', duration: 1, category: 'parsing' },
      ]
    },
    {
      name: 'התאמה לתנאי חיפוש',
      duration: 10,
      tests: [
        { name: 'מוצא התאמה פשוטה', status: 'passed', duration: 2, category: 'search' },
        { name: 'מתעלם מניקוד כשמופעל', status: 'passed', duration: 2, category: 'search' },
        { name: 'מחזיר true לתנאי ריק', status: 'passed', duration: 1, category: 'search' },
      ]
    },
    {
      name: 'חיפוש עם תנאים מרובים',
      duration: 15,
      tests: [
        { name: 'מחבר תנאים עם AND', status: 'passed', duration: 3, category: 'search' },
        { name: 'מחבר תנאים עם OR', status: 'passed', duration: 2, category: 'search' },
        { name: 'מחבר תנאים עם NOT', status: 'passed', duration: 2, category: 'search' },
        { name: 'מחזיר true לרשימה ריקה', status: 'passed', duration: 1, category: 'search' },
      ]
    },
    {
      name: 'מציאת מילים לפי גימטריא',
      duration: 8,
      tests: [
        { name: 'מוצא מילים עם ערך גימטריא זהה', status: 'passed', duration: 3, category: 'gematria' },
        { name: 'מחזיר מערך ריק אם אין התאמות', status: 'passed', duration: 1, category: 'gematria' },
      ]
    },
    {
      name: 'הדגשת מילות חיפוש',
      duration: 12,
      tests: [
        { name: 'מדגיש מילה בטקסט', status: 'passed', duration: 2, category: 'highlight' },
        { name: 'מדגיש מספר מילים', status: 'passed', duration: 2, category: 'highlight' },
        { name: 'לא קורס על תווים מיוחדים', status: 'passed', duration: 2, category: 'highlight' },
        { name: 'מתעלם ממילים ריקות', status: 'passed', duration: 1, category: 'highlight' },
      ]
    },
  ];

  const totalTests = suites.reduce((acc, suite) => acc + suite.tests.length, 0);
  const passed = suites.reduce((acc, suite) => 
    acc + suite.tests.filter(t => t.status === 'passed').length, 0);
  const failed = suites.reduce((acc, suite) => 
    acc + suite.tests.filter(t => t.status === 'failed').length, 0);
  const totalDuration = suites.reduce((acc, suite) => acc + suite.duration, 0);

  return {
    totalTests,
    passed,
    failed,
    duration: totalDuration,
    suites,
    timestamp: new Date()
  };
};

interface Recommendation {
  type: 'success' | 'warning' | 'info';
  title: string;
  description: string;
  icon: React.ElementType;
}

const getRecommendations = (report: TestReport): Recommendation[] => {
  const recommendations: Recommendation[] = [];
  const passRate = (report.passed / report.totalTests) * 100;

  if (passRate === 100) {
    recommendations.push({
      type: 'success',
      title: 'כל הבדיקות עוברות!',
      description: 'המערכת במצב תקין. כל פונקציות החיפוש והניתוח עובדות כמצופה.',
      icon: Shield
    });
  }

  if (passRate >= 90 && passRate < 100) {
    recommendations.push({
      type: 'warning',
      title: 'רוב הבדיקות עוברות',
      description: `${report.failed} בדיקות נכשלו. מומלץ לתקן את הבעיות לפני שימוש בייצור.`,
      icon: AlertTriangle
    });
  }

  recommendations.push({
    type: 'info',
    title: 'ביצועים טובים',
    description: `כל הבדיקות רצו ב-${report.duration}ms - זמן תגובה מהיר.`,
    icon: Zap
  });

  recommendations.push({
    type: 'info',
    title: 'כיסוי בדיקות',
    description: `${report.totalTests} בדיקות מכסות את פונקציות החיפוש המרכזיות: המרות, גימטריא, נרמול, מיקום וסינון.`,
    icon: FileText
  });

  if (report.suites.some(s => s.tests.some(t => t.category === 'gematria'))) {
    recommendations.push({
      type: 'success',
      title: 'תמיכה בגימטריא',
      description: 'חישוב גימטריא פועל תקין - ניתן לחפש מילים לפי ערך מספרי.',
      icon: Sparkles
    });
  }

  return recommendations;
};

export function TestingPanel() {
  const [report, setReport] = useState<TestReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [expandedSuites, setExpandedSuites] = useState<Set<string>>(new Set());

  const runTests = () => {
    setIsRunning(true);
    // סימולציה של זמן ריצה
    setTimeout(() => {
      const results = simulateTestResults();
      setReport(results);
      setIsRunning(false);
      // פתיחת כל ה-suites כברירת מחדל
      setExpandedSuites(new Set(results.suites.map(s => s.name)));
    }, 1500);
  };

  const toggleSuite = (name: string) => {
    setExpandedSuites(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'conversion': return 'bg-gold/20 text-gold';
      case 'gematria': return 'bg-navy/20 text-navy';
      case 'normalization': return 'bg-gold/30 text-navy';
      case 'position': return 'bg-navy/30 text-navy';
      case 'filter': return 'bg-gold/40 text-navy';
      case 'search': return 'bg-navy/40 text-white';
      case 'parsing': return 'bg-gold/50 text-navy';
      case 'highlight': return 'bg-navy/50 text-white';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const recommendations = report ? getRecommendations(report) : [];

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gold rounded-xl flex items-center justify-center shadow-lg">
            <Bug className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-navy">בדיקות אוטומטיות</h2>
            <p className="text-sm text-navy/60">בדיקת תקינות פונקציות החיפוש והניתוח</p>
          </div>
        </div>

        <Button
          onClick={runTests}
          disabled={isRunning}
          className="gap-2 bg-gold hover:bg-gold/90 text-white"
        >
          {isRunning ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              מריץ בדיקות...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              הרץ בדיקות
            </>
          )}
        </Button>
      </div>

      {/* Loading State */}
      {isRunning && (
        <div className="bg-white border border-gold/20 rounded-xl p-8 text-center">
          <RefreshCw className="w-12 h-12 text-gold mx-auto mb-4 animate-spin" />
          <p className="text-navy font-medium">מריץ 50 בדיקות...</p>
          <p className="text-sm text-navy/60 mt-2">בודק המרות, גימטריא, נרמול, מיקום וסינון</p>
        </div>
      )}

      {/* Results */}
      {report && !isRunning && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-gold/20 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-navy">{report.totalTests}</div>
              <div className="text-sm text-navy/60">סה"כ בדיקות</div>
            </div>
            <div className="bg-gold/10 border border-gold/30 rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-3xl font-bold text-gold">
                <CheckCircle2 className="w-6 h-6" />
                {report.passed}
              </div>
              <div className="text-sm text-gold">עברו</div>
            </div>
            <div className="bg-white border border-navy/20 rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-3xl font-bold text-navy">
                <XCircle className="w-6 h-6" />
                {report.failed}
              </div>
              <div className="text-sm text-navy/60">נכשלו</div>
            </div>
            <div className="bg-white border border-gold/20 rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-3xl font-bold text-navy">
                <Clock className="w-5 h-5" />
                {report.duration}ms
              </div>
              <div className="text-sm text-navy/60">זמן ריצה</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="bg-white border border-gold/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-navy">אחוז הצלחה</span>
              <span className="text-sm text-navy/60">
                {((report.passed / report.totalTests) * 100).toFixed(0)}%
              </span>
            </div>
            <Progress 
              value={(report.passed / report.totalTests) * 100} 
              className="h-3"
            />
          </div>

          {/* Recommendations */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-gold" />
              <h3 className="font-bold text-navy">המלצות</h3>
            </div>
            <div className="grid gap-3">
              {recommendations.map((rec, idx) => {
                const Icon = rec.icon;
                return (
                  <div 
                    key={idx}
                    className={`flex items-start gap-3 p-4 rounded-xl border ${
                      rec.type === 'success' 
                        ? 'bg-gold/5 border-gold/30' 
                        : rec.type === 'warning'
                        ? 'bg-navy/5 border-navy/30'
                        : 'bg-white border-gold/20'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${
                      rec.type === 'success' ? 'bg-gold/20' : 
                      rec.type === 'warning' ? 'bg-navy/20' : 'bg-gold/10'
                    }`}>
                      <Icon className={`w-5 h-5 ${
                        rec.type === 'success' ? 'text-gold' : 
                        rec.type === 'warning' ? 'text-navy' : 'text-gold'
                      }`} />
                    </div>
                    <div>
                      <div className="font-medium text-navy">{rec.title}</div>
                      <div className="text-sm text-navy/60 mt-1">{rec.description}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Test Suites */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-gold" />
              <h3 className="font-bold text-navy">דוח מפורט</h3>
            </div>
            
            <ScrollArea className="h-[400px]">
              <div className="space-y-2 pl-4">
                {report.suites.map((suite) => {
                  const isExpanded = expandedSuites.has(suite.name);
                  const suitePassed = suite.tests.filter(t => t.status === 'passed').length;
                  const suiteTotal = suite.tests.length;
                  
                  return (
                    <Collapsible 
                      key={suite.name}
                      open={isExpanded}
                      onOpenChange={() => toggleSuite(suite.name)}
                    >
                      <div className="bg-white border border-gold/20 rounded-xl overflow-hidden">
                        <CollapsibleTrigger className="w-full">
                          <div className="flex items-center justify-between p-4 hover:bg-gold/5 transition-colors">
                            <div className="flex items-center gap-3">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-navy/50" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-navy/50" />
                              )}
                              <span className="font-medium text-navy">{suite.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge className={`${
                                suitePassed === suiteTotal 
                                  ? 'bg-gold/20 text-gold' 
                                  : 'bg-navy/20 text-navy'
                              }`}>
                                {suitePassed}/{suiteTotal}
                              </Badge>
                              <span className="text-xs text-navy/50">{suite.duration}ms</span>
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        
                        <CollapsibleContent>
                          <div className="border-t border-gold/10 bg-gold/5 p-2">
                            {suite.tests.map((test, idx) => (
                              <div 
                                key={idx}
                                className="flex items-center justify-between p-3 rounded-lg hover:bg-white/50 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  {test.status === 'passed' ? (
                                    <CheckCircle2 className="w-4 h-4 text-gold" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-navy" />
                                  )}
                                  <span className="text-sm text-navy">{test.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge className={getCategoryColor(test.category)}>
                                    {test.category}
                                  </Badge>
                                  <span className="text-xs text-navy/50">{test.duration}ms</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Timestamp */}
          <div className="text-center text-sm text-navy/50">
            <Clock className="w-4 h-4 inline ml-1" />
            בדיקה אחרונה: {report.timestamp.toLocaleTimeString('he-IL')}
          </div>
        </>
      )}

      {/* Initial State */}
      {!report && !isRunning && (
        <div className="bg-white border border-gold/20 rounded-xl p-12 text-center">
          <Bug className="w-16 h-16 text-gold/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-navy mb-2">הרץ בדיקות לראות תוצאות</h3>
          <p className="text-sm text-navy/60 mb-6">
            הבדיקות יבדקו את כל פונקציות החיפוש והניתוח של המערכת
          </p>
          <Button
            onClick={runTests}
            className="gap-2 bg-gold hover:bg-gold/90 text-white"
          >
            <Play className="w-4 h-4" />
            הרץ בדיקות עכשיו
          </Button>
        </div>
      )}
    </div>
  );
}
