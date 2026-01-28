import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Play, 
  FileText,
  Bug,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { SearchCondition, FilterRules, SearchResult } from '@/types/search';
import { matchesCondition, checkFilterRules, normalizeText } from '@/utils/searchUtils';
import { expandSearchTerm, getWordVariations } from '@/utils/hebrewUtils';
import { toast } from '@/hooks/use-toast';

interface RulesValidationSystemProps {
  text: string;
  conditions: SearchCondition[];
  filterRules: FilterRules;
}

interface ValidationResult {
  conditionId: string;
  term: string;
  operator: string;
  passed: boolean;
  matchCount: number;
  matchPositions: number[];
  details: string;
  executionTime: number;
}

interface FilterValidationResult {
  ruleName: string;
  passed: boolean;
  actual: number | string;
  expected: string;
  details: string;
}

export function RulesValidationSystem({
  text,
  conditions,
  filterRules,
}: RulesValidationSystemProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [filterValidationResults, setFilterValidationResults] = useState<FilterValidationResult[]>([]);
  const [validationTime, setValidationTime] = useState(0);

  const runValidation = async () => {
    setIsValidating(true);
    const startTime = performance.now();

    try {
      // Validate conditions
      const conditionResults: ValidationResult[] = [];
      
      for (const condition of conditions) {
        const conditionStart = performance.now();
        const normalizedText = normalizeText(text, condition.smartOptions);
        
        // Get search variations
        let searchTerms = [condition.term];
        if (condition.smartOptions?.expandAcronyms) {
          searchTerms = [...searchTerms, ...expandSearchTerm(condition.term, {
            acronymExpansion: true,
            ignoreNikud: condition.smartOptions?.ignoreNikud,
            sofitEquivalence: condition.smartOptions?.sofitEquivalence,
          })];
        }
        
        const matchPositions: number[] = [];
        let matchCount = 0;

        for (const term of searchTerms) {
          const searchNormalized = normalizeText(term, condition.smartOptions);
          let index = normalizedText.indexOf(searchNormalized);
          while (index !== -1) {
            matchPositions.push(index);
            matchCount++;
            index = normalizedText.indexOf(searchNormalized, index + 1);
          }
        }

        const passed = matchesCondition(text, condition);
        const conditionEnd = performance.now();

        conditionResults.push({
          conditionId: condition.id,
          term: condition.term,
          operator: condition.operator,
          passed,
          matchCount,
          matchPositions,
          details: passed 
            ? `נמצאו ${matchCount} התאמות`
            : 'לא נמצאו התאמות',
          executionTime: conditionEnd - conditionStart,
        });
      }

      setValidationResults(conditionResults);

      // Validate filter rules
      const filterResults: FilterValidationResult[] = [];
      const words = text.split(/\s+/).filter(w => w.length > 0);
      const chars = text.length;

      if (filterRules.minWords !== undefined) {
        filterResults.push({
          ruleName: 'מינימום מילים',
          passed: words.length >= filterRules.minWords,
          actual: words.length,
          expected: `≥ ${filterRules.minWords}`,
          details: words.length >= filterRules.minWords
            ? `${words.length} מילים (עובר)`
            : `${words.length} מילים (נדרש ${filterRules.minWords})`,
        });
      }

      if (filterRules.maxWords !== undefined) {
        filterResults.push({
          ruleName: 'מקסימום מילים',
          passed: words.length <= filterRules.maxWords,
          actual: words.length,
          expected: `≤ ${filterRules.maxWords}`,
          details: words.length <= filterRules.maxWords
            ? `${words.length} מילים (עובר)`
            : `${words.length} מילים (מקסימום ${filterRules.maxWords})`,
        });
      }

      if (filterRules.minChars !== undefined) {
        filterResults.push({
          ruleName: 'מינימום תווים',
          passed: chars >= filterRules.minChars,
          actual: chars,
          expected: `≥ ${filterRules.minChars}`,
          details: chars >= filterRules.minChars
            ? `${chars} תווים (עובר)`
            : `${chars} תווים (נדרש ${filterRules.minChars})`,
        });
      }

      if (filterRules.maxChars !== undefined) {
        filterResults.push({
          ruleName: 'מקסימום תווים',
          passed: chars <= filterRules.maxChars,
          actual: chars,
          expected: `≤ ${filterRules.maxChars}`,
          details: chars <= filterRules.maxChars
            ? `${chars} תווים (עובר)`
            : `${chars} תווים (מקסימום ${filterRules.maxChars})`,
        });
      }

      setFilterValidationResults(filterResults);

      const endTime = performance.now();
      setValidationTime(endTime - startTime);

      toast({
        title: 'הבדיקה הושלמה',
        description: `נבדקו ${conditions.length} תנאים ו-${filterResults.length} כללי סינון`,
      });
    } catch (error) {
      console.error('Validation error:', error);
      toast({
        title: 'שגיאה',
        description: 'אירעה שגיאה בזמן הבדיקה',
        variant: 'destructive',
      });
    } finally {
      setIsValidating(false);
    }
  };

  const totalConditions = conditions.length;
  const passedConditions = validationResults.filter(r => r.passed).length;
  const totalFilters = filterValidationResults.length;
  const passedFilters = filterValidationResults.filter(r => r.passed).length;

  const overallProgress = totalConditions + totalFilters > 0
    ? ((passedConditions + passedFilters) / (totalConditions + totalFilters)) * 100
    : 0;

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Bug className="h-5 w-5" />
            בדיקת כללים
          </CardTitle>
          <Button onClick={runValidation} disabled={isValidating || !text || conditions.length === 0}>
            {isValidating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            הרץ בדיקה
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        {validationResults.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>התקדמות כללית</span>
              <span className="text-muted-foreground">
                {passedConditions + passedFilters} / {totalConditions + totalFilters}
              </span>
            </div>
            <Progress value={overallProgress} className="h-2" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>זמן ביצוע: {validationTime.toFixed(2)}ms</span>
              <span>
                {passedConditions === totalConditions && passedFilters === totalFilters ? (
                  <Badge variant="default" className="bg-green-500">הכל עובר</Badge>
                ) : (
                  <Badge variant="destructive">יש כשלונות</Badge>
                )}
              </span>
            </div>
          </div>
        )}

        {/* Results Tabs */}
        <Tabs defaultValue="conditions" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="conditions" className="gap-2">
              תנאי חיפוש
              {validationResults.length > 0 && (
                <Badge variant={passedConditions === totalConditions ? 'default' : 'destructive'}>
                  {passedConditions}/{totalConditions}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="filters" className="gap-2">
              כללי סינון
              {filterValidationResults.length > 0 && (
                <Badge variant={passedFilters === totalFilters ? 'default' : 'destructive'}>
                  {passedFilters}/{totalFilters}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="conditions">
            <ScrollArea className="h-[300px]">
              {validationResults.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bug className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">לחץ על "הרץ בדיקה" לבדוק את הכללים</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {validationResults.map((result) => (
                    <ValidationResultCard key={result.conditionId} result={result} />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="filters">
            <ScrollArea className="h-[300px]">
              {filterValidationResults.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bug className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">אין כללי סינון להצגה</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filterValidationResults.map((result, index) => (
                    <FilterResultCard key={index} result={result} />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

interface ValidationResultCardProps {
  result: ValidationResult;
}

function ValidationResultCard({ result }: ValidationResultCardProps) {
  const getOperatorLabel = (operator: string) => {
    const labels: Record<string, string> = {
      contains: 'מכיל',
      not_contains: 'לא מכיל',
      starts_with: 'מתחיל ב',
      ends_with: 'מסתיים ב',
      exact: 'מדויק',
      regex: 'Regex',
      proximity: 'קרבה',
      word_list: 'רשימה',
    };
    return labels[operator] || operator;
  };

  return (
    <div className={`
      p-3 border rounded-lg flex items-start gap-3
      ${result.passed ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900' : 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900'}
    `}>
      {result.passed ? (
        <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
      ) : (
        <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline">{getOperatorLabel(result.operator)}</Badge>
          <span className="font-medium">"{result.term}"</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{result.details}</p>
        <p className="text-xs text-muted-foreground mt-1">
          זמן: {result.executionTime.toFixed(2)}ms
        </p>
      </div>
    </div>
  );
}

interface FilterResultCardProps {
  result: FilterValidationResult;
}

function FilterResultCard({ result }: FilterResultCardProps) {
  return (
    <div className={`
      p-3 border rounded-lg flex items-start gap-3
      ${result.passed ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900' : 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900'}
    `}>
      {result.passed ? (
        <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
      ) : (
        <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{result.ruleName}</span>
          <Badge variant="outline">{result.expected}</Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{result.details}</p>
      </div>
    </div>
  );
}
