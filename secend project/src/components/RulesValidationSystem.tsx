import { useState, useCallback } from 'react';
import {
  CheckCircle2,
  XCircle,
  Play,
  FileText,
  AlertTriangle,
  Sparkles,
  RotateCcw,
  ChevronDown,
  Beaker,
  ClipboardCheck,
  Info,
  Target,
  AlignRight,
  Hash,
  Type,
  Ruler,
  Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FilterRules, PositionRule, TextPositionRule } from '@/types/search';

interface TestCase {
  id: string;
  name: string;
  description: string;
  testText: string;
  expectedResult: boolean;
  ruleType: 'position' | 'textPosition' | 'wordCount' | 'numbers' | 'lettersOnly';
  icon: React.ElementType;
  rule?: Partial<PositionRule | TextPositionRule>;
}

interface TestResult {
  testCase: TestCase;
  actualResult: boolean;
  passed: boolean;
  explanation: string;
  details: string[];
}

interface ValidationReport {
  totalTests: number;
  passed: number;
  failed: number;
  successRate: number;
  results: TestResult[];
  timestamp: Date;
}

interface RulesValidationSystemProps {
  rules: FilterRules;
  checkFilterRules: (segment: string, words: string[]) => boolean;
}

// Predefined comprehensive test cases
const generateTestCases = (rules: FilterRules): TestCase[] => {
  const testCases: TestCase[] = [];

  // Position Rules Tests (before/after)
  if (rules.positionRules.length > 0) {
    rules.positionRules.forEach((rule, index) => {
      if (rule.word && rule.relativeWord) {
        // Test: Should PASS - word is correctly positioned
        if (rule.position === 'before') {
          testCases.push({
            id: `pos-pass-${index}`,
            name: `מיקום יחסי #${index + 1} - אמור לעבור`,
            description: `"${rule.word}" לפני "${rule.relativeWord}"`,
            testText: `זה טקסט עם ${rule.word} ואז ${rule.relativeWord} בהמשך`,
            expectedResult: true,
            ruleType: 'position',
            icon: Target,
            rule
          });
          
          // Test: Should FAIL - word is in wrong position
          testCases.push({
            id: `pos-fail-${index}`,
            name: `מיקום יחסי #${index + 1} - אמור להיכשל`,
            description: `"${rule.relativeWord}" לפני "${rule.word}" (הפוך)`,
            testText: `זה טקסט עם ${rule.relativeWord} ואז ${rule.word} בהמשך`,
            expectedResult: false,
            ruleType: 'position',
            icon: Target,
            rule
          });
          
          // Test: Distance check
          testCases.push({
            id: `pos-dist-${index}`,
            name: `מיקום יחסי #${index + 1} - מרחק`,
            description: `בדיקת מרחק מקסימלי של ${rule.maxDistance || 10} מילים`,
            testText: `${rule.word} ${'מילה '.repeat((rule.maxDistance || 10) + 5)}${rule.relativeWord}`,
            expectedResult: false,
            ruleType: 'position',
            icon: Ruler,
            rule
          });
        } else if (rule.position === 'after') {
          testCases.push({
            id: `pos-pass-${index}`,
            name: `מיקום יחסי #${index + 1} - אמור לעבור`,
            description: `"${rule.word}" אחרי "${rule.relativeWord}"`,
            testText: `זה טקסט עם ${rule.relativeWord} ואז ${rule.word} בהמשך`,
            expectedResult: true,
            ruleType: 'position',
            icon: Target,
            rule
          });
          
          testCases.push({
            id: `pos-fail-${index}`,
            name: `מיקום יחסי #${index + 1} - אמור להיכשל`,
            description: `"${rule.word}" לפני "${rule.relativeWord}" (הפוך)`,
            testText: `זה טקסט עם ${rule.word} ואז ${rule.relativeWord} בהמשך`,
            expectedResult: false,
            ruleType: 'position',
            icon: Target,
            rule
          });
        }
      }
    });
  }

  // Text Position Rules Tests (start/end)
  if (rules.textPositionRules.length > 0) {
    rules.textPositionRules.forEach((rule, index) => {
      if (rule.word) {
        if (rule.position === 'start') {
          // Should PASS - word at start
          testCases.push({
            id: `txtpos-pass-${index}`,
            name: `מיקום בשורה #${index + 1} - אמור לעבור`,
            description: `"${rule.word}" בתחילת השורה`,
            testText: `${rule.word} זה טקסט שמתחיל במילה הנכונה`,
            expectedResult: true,
            ruleType: 'textPosition',
            icon: AlignRight,
            rule
          });
          
          // Should FAIL - word at end
          testCases.push({
            id: `txtpos-fail-${index}`,
            name: `מיקום בשורה #${index + 1} - אמור להיכשל`,
            description: `"${rule.word}" בסוף השורה (לא בהתחלה)`,
            testText: `זה טקסט שמסתיים במילה ${rule.word}`,
            expectedResult: false,
            ruleType: 'textPosition',
            icon: AlignRight,
            rule
          });
        } else if (rule.position === 'end') {
          testCases.push({
            id: `txtpos-pass-${index}`,
            name: `מיקום בשורה #${index + 1} - אמור לעבור`,
            description: `"${rule.word}" בסוף השורה`,
            testText: `זה טקסט שמסתיים במילה ${rule.word}`,
            expectedResult: true,
            ruleType: 'textPosition',
            icon: AlignRight,
            rule
          });
          
          testCases.push({
            id: `txtpos-fail-${index}`,
            name: `מיקום בשורה #${index + 1} - אמור להיכשל`,
            description: `"${rule.word}" בתחילת השורה (לא בסוף)`,
            testText: `${rule.word} זה טקסט שמתחיל במילה`,
            expectedResult: false,
            ruleType: 'textPosition',
            icon: AlignRight,
            rule
          });
        }
      }
    });
  }

  // Word Count Tests
  if (rules.minWordCount || rules.maxWordCount) {
    if (rules.minWordCount) {
      testCases.push({
        id: 'wordcount-min-pass',
        name: 'מינימום מילים - אמור לעבור',
        description: `טקסט עם ${rules.minWordCount + 2} מילים (מינימום: ${rules.minWordCount})`,
        testText: 'מילה '.repeat(rules.minWordCount + 2).trim(),
        expectedResult: true,
        ruleType: 'wordCount',
        icon: Ruler
      });
      
      testCases.push({
        id: 'wordcount-min-fail',
        name: 'מינימום מילים - אמור להיכשל',
        description: `טקסט עם ${rules.minWordCount - 1} מילים (מינימום: ${rules.minWordCount})`,
        testText: 'מילה '.repeat(Math.max(1, rules.minWordCount - 1)).trim(),
        expectedResult: false,
        ruleType: 'wordCount',
        icon: Ruler
      });
    }
    
    if (rules.maxWordCount) {
      testCases.push({
        id: 'wordcount-max-pass',
        name: 'מקסימום מילים - אמור לעבור',
        description: `טקסט עם ${rules.maxWordCount - 1} מילים (מקסימום: ${rules.maxWordCount})`,
        testText: 'מילה '.repeat(Math.max(1, rules.maxWordCount - 1)).trim(),
        expectedResult: true,
        ruleType: 'wordCount',
        icon: Ruler
      });
      
      testCases.push({
        id: 'wordcount-max-fail',
        name: 'מקסימום מילים - אמור להיכשל',
        description: `טקסט עם ${rules.maxWordCount + 3} מילים (מקסימום: ${rules.maxWordCount})`,
        testText: 'מילה '.repeat(rules.maxWordCount + 3).trim(),
        expectedResult: false,
        ruleType: 'wordCount',
        icon: Ruler
      });
    }
  }

  // Numbers Tests
  if (rules.mustContainNumbers) {
    testCases.push({
      id: 'numbers-pass',
      name: 'חייב מספרים - אמור לעבור',
      description: 'טקסט עם מספרים',
      testText: 'זה טקסט עם המספר 123 בתוכו',
      expectedResult: true,
      ruleType: 'numbers',
      icon: Hash
    });
    
    testCases.push({
      id: 'numbers-fail',
      name: 'חייב מספרים - אמור להיכשל',
      description: 'טקסט ללא מספרים',
      testText: 'זה טקסט ללא שום מספרים בכלל',
      expectedResult: false,
      ruleType: 'numbers',
      icon: Hash
    });
  }

  // Letters Only Tests
  if (rules.mustContainLettersOnly) {
    testCases.push({
      id: 'letters-pass',
      name: 'אותיות בלבד - אמור לעבור',
      description: 'טקסט עם אותיות בלבד',
      testText: 'זה טקסט עם אותיות בלבד ללא מספרים',
      expectedResult: true,
      ruleType: 'lettersOnly',
      icon: Type
    });
    
    testCases.push({
      id: 'letters-fail',
      name: 'אותיות בלבד - אמור להיכשל',
      description: 'טקסט עם מספרים',
      testText: 'זה טקסט עם המספר 456 בתוכו',
      expectedResult: false,
      ruleType: 'lettersOnly',
      icon: Type
    });
  }

  return testCases;
};

export function RulesValidationSystem({ rules, checkFilterRules }: RulesValidationSystemProps) {
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  const runValidation = useCallback(() => {
    setIsRunning(true);
    
    // Small delay for visual feedback
    setTimeout(() => {
      const testCases = generateTestCases(rules);
      const results: TestResult[] = [];
      
      testCases.forEach(testCase => {
        const words = testCase.testText.toLowerCase().split(/\s+/).filter(w => w.trim());
        const actualResult = checkFilterRules(testCase.testText, words);
        const passed = actualResult === testCase.expectedResult;
        
        let explanation = '';
        const details: string[] = [];
        
        if (passed) {
          explanation = testCase.expectedResult 
            ? 'הטקסט עבר את הכלל כמצופה ✓'
            : 'הטקסט נפסל כמצופה ✓';
        } else {
          explanation = testCase.expectedResult
            ? 'הטקסט היה אמור לעבור אבל נפסל ✗'
            : 'הטקסט היה אמור להיפסל אבל עבר ✗';
        }
        
        details.push(`טקסט הבדיקה: "${testCase.testText}"`);
        details.push(`מספר מילים: ${words.length}`);
        details.push(`תוצאה צפויה: ${testCase.expectedResult ? 'לעבור' : 'להיכשל'}`);
        details.push(`תוצאה בפועל: ${actualResult ? 'עבר' : 'נכשל'}`);
        
        results.push({
          testCase,
          actualResult,
          passed,
          explanation,
          details
        });
      });
      
      const passedCount = results.filter(r => r.passed).length;
      
      setReport({
        totalTests: testCases.length,
        passed: passedCount,
        failed: testCases.length - passedCount,
        successRate: testCases.length > 0 ? (passedCount / testCases.length) * 100 : 0,
        results,
        timestamp: new Date()
      });
      
      setIsRunning(false);
    }, 500);
  }, [rules, checkFilterRules]);

  const toggleExpanded = (id: string) => {
    setExpandedResults(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const hasAnyRules = 
    rules.positionRules.length > 0 ||
    rules.textPositionRules.length > 0 ||
    rules.minWordCount ||
    rules.maxWordCount ||
    rules.mustContainNumbers ||
    rules.mustContainLettersOnly;

  const getSuccessColor = (rate: number) => {
    if (rate >= 90) return 'bg-gold';
    if (rate >= 70) return 'bg-gold/70';
    return 'bg-navy';
  };

  const getRuleTypeLabel = (type: string) => {
    switch (type) {
      case 'position': return 'מיקום יחסי';
      case 'textPosition': return 'מיקום בשורה';
      case 'wordCount': return 'ספירת מילים';
      case 'numbers': return 'מספרים';
      case 'lettersOnly': return 'אותיות בלבד';
      default: return type;
    }
  };

  return (
    <div className="glass-effect rounded-2xl p-6 space-y-6 animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gold rounded-xl flex items-center justify-center shadow-lg">
            <Beaker className="w-6 h-6 text-white" />
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold text-navy">מערכת וידוא ובדיקה</h2>
            <p className="text-sm text-navy/60">
              בדיקה אוטומטית של כל הכללים והפונקציות
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {report && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReport(null)}
              className="gap-2 rounded-xl border-gold/30 text-navy hover:bg-gold/10"
            >
              <RotateCcw className="w-4 h-4" />
              אפס
            </Button>
          )}
          <Button
            onClick={runValidation}
            disabled={!hasAnyRules || isRunning}
            className="gap-2 bg-gold hover:bg-gold/90 text-white rounded-xl px-6 h-12 shadow-md"
          >
            {isRunning ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                בודק...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                הפעל בדיקות
              </>
            )}
          </Button>
        </div>
      </div>

      {/* No Rules Message */}
      {!hasAnyRules && (
        <div className="bg-gold/10 border-2 border-gold/30 rounded-2xl p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-gold mx-auto mb-3" />
          <h3 className="font-bold text-lg text-navy mb-2">אין כללים להבדיקה</h3>
          <p className="text-navy/70">
            הוסף כללי סינון כדי להפעיל את מערכת הוידוא
          </p>
        </div>
      )}

      {/* Report Section */}
      {report && (
        <div className="space-y-6 animate-fade-in">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 text-center border-2 border-navy/20">
              <div className="text-3xl font-bold text-navy">{report.totalTests}</div>
              <div className="text-sm text-navy/60 mt-1">סה"כ בדיקות</div>
            </div>
            
            <div className="bg-white rounded-2xl p-5 text-center border-2 border-gold/30">
              <div className="flex items-center justify-center gap-2 text-3xl font-bold text-gold">
                <CheckCircle2 className="w-7 h-7" />
                {report.passed}
              </div>
              <div className="text-sm text-gold mt-1">עברו</div>
            </div>
            
            <div className="bg-white rounded-2xl p-5 text-center border-2 border-navy/30">
              <div className="flex items-center justify-center gap-2 text-3xl font-bold text-navy">
                <XCircle className="w-7 h-7" />
                {report.failed}
              </div>
              <div className="text-sm text-navy mt-1">נכשלו</div>
            </div>
            
            <div className="bg-gold/10 rounded-2xl p-5 text-center border-2 border-gold/30">
              <div className="text-3xl font-bold text-navy">{report.successRate.toFixed(0)}%</div>
              <div className="text-sm text-navy/60 mt-1">אחוז הצלחה</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-navy">התקדמות הבדיקות</span>
              <span className="text-navy/60">
                {report.passed} מתוך {report.totalTests} עברו
              </span>
            </div>
            <div className="h-4 bg-white border border-gold/30 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${getSuccessColor(report.successRate)}`}
                style={{ width: `${report.successRate}%` }}
              />
            </div>
          </div>

          {/* Detailed Results */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <ClipboardCheck className="w-5 h-5 text-gold" />
              <h3 className="font-bold text-lg text-navy">דוח מפורט</h3>
            </div>
            
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {report.results.map((result) => {
                  const Icon = result.testCase.icon;
                  const isExpanded = expandedResults.has(result.testCase.id);
                  
                  return (
                    <Collapsible 
                      key={result.testCase.id}
                      open={isExpanded}
                      onOpenChange={() => toggleExpanded(result.testCase.id)}
                    >
                      <div 
                        className={`rounded-xl border-2 overflow-hidden transition-all ${
                          result.passed 
                            ? 'bg-gold/5 border-gold/30 hover:border-gold' 
                            : 'bg-navy/5 border-navy/30 hover:border-navy'
                        }`}
                      >
                        <CollapsibleTrigger className="w-full">
                          <div className="flex items-center gap-4 p-4 cursor-pointer">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                              result.passed ? 'bg-gold/20' : 'bg-navy/20'
                            }`}>
                              {result.passed ? (
                                <CheckCircle2 className="w-5 h-5 text-gold" />
                              ) : (
                                <XCircle className="w-5 h-5 text-navy" />
                              )}
                            </div>
                            
                            <div className="flex-1 text-right">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-navy">
                                  {result.testCase.name}
                                </span>
                                <Badge 
                                  variant="secondary" 
                                  className={`text-xs ${
                                    result.passed ? 'bg-gold/20 text-navy' : 'bg-navy/20 text-navy'
                                  }`}
                                >
                                  {getRuleTypeLabel(result.testCase.ruleType)}
                                </Badge>
                              </div>
                              <p className="text-sm text-navy/60 mt-1">
                                {result.testCase.description}
                              </p>
                            </div>
                            
                            <ChevronDown className={`w-5 h-5 text-navy transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </div>
                        </CollapsibleTrigger>
                        
                        <CollapsibleContent>
                          <div className={`p-4 pt-0 space-y-4 ${result.passed ? 'bg-gold/5' : 'bg-navy/5'}`}>
                            {/* Explanation */}
                            <div className={`flex items-start gap-3 p-4 rounded-xl ${
                              result.passed ? 'bg-gold/10' : 'bg-navy/10'
                            }`}>
                              <Info className={`w-5 h-5 mt-0.5 ${result.passed ? 'text-gold' : 'text-navy'}`} />
                              <div>
                                <div className={`font-semibold ${result.passed ? 'text-gold' : 'text-navy'}`}>
                                  {result.explanation}
                                </div>
                              </div>
                            </div>
                            
                            {/* Test Text Preview */}
                            <div className="bg-white rounded-xl p-4 border border-gold/20">
                              <div className="flex items-center gap-2 mb-2">
                                <Eye className="w-4 h-4 text-gold" />
                                <span className="text-sm font-semibold text-navy">טקסט הבדיקה:</span>
                              </div>
                              <div className="text-sm bg-white rounded-lg p-3 font-mono text-navy/70 break-words border border-gold/10">
                                "{result.testCase.testText}"
                              </div>
                            </div>
                            
                            {/* Details List */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-gold" />
                                <span className="text-sm font-semibold text-navy">פרטים:</span>
                              </div>
                              <ul className="space-y-1.5 mr-6">
                                {result.details.map((detail, idx) => (
                                  <li key={idx} className="text-sm text-navy/60 flex items-start gap-2">
                                    <span className="text-gold">•</span>
                                    {detail}
                                  </li>
                                ))}
                              </ul>
                            </div>
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
          <div className="flex items-center justify-center gap-2 text-sm text-navy/60 pt-4 border-t border-gold/20">
            <Sparkles className="w-4 h-4 text-gold" />
            <span>נוצר ב-{report.timestamp.toLocaleTimeString('he-IL')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
