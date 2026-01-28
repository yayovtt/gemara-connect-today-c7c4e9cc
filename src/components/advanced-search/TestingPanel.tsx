import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  FlaskConical, 
  Play, 
  Copy,
  Check,
  X,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { SearchCondition, SmartSearchOptions } from '@/types/search';
import { 
  removeNikud, 
  normalizeSofitLetters, 
  calculateGematria,
  expandAcronym,
  getWordVariations,
  numberToHebrew,
  hebrewToNumber
} from '@/utils/hebrewUtils';
import { findTalmudReferences } from '@/utils/talmudParser';
import { toast } from '@/hooks/use-toast';

export function TestingPanel() {
  const [testInput, setTestInput] = useState('');
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runTests = async () => {
    if (!testInput.trim()) {
      toast({
        title: 'שגיאה',
        description: 'נא להזין טקסט לבדיקה',
        variant: 'destructive',
      });
      return;
    }

    setIsRunning(true);
    const results: TestResult[] = [];

    try {
      // Test 1: Nikud removal
      results.push({
        name: 'הסרת ניקוד',
        input: testInput,
        output: removeNikud(testInput),
        passed: true,
      });

      // Test 2: Sofit normalization
      results.push({
        name: 'נרמול אותיות סופיות',
        input: testInput,
        output: normalizeSofitLetters(testInput),
        passed: true,
      });

      // Test 3: Gematria calculation
      const gematria = calculateGematria(testInput);
      results.push({
        name: 'חישוב גימטריה',
        input: testInput,
        output: `${gematria} (${numberToHebrew(gematria)})`,
        passed: true,
      });

      // Test 4: Hebrew number conversion
      const hebrewNum = hebrewToNumber(testInput);
      if (hebrewNum > 0) {
        results.push({
          name: 'המרת מספר עברי',
          input: testInput,
          output: `${hebrewNum}`,
          passed: true,
        });
      }

      // Test 5: Acronym expansion
      const expanded = expandAcronym(testInput);
      if (expanded.length > 0) {
        results.push({
          name: 'פיענוח ראשי תיבות',
          input: testInput,
          output: expanded.join(', '),
          passed: expanded.length > 0,
        });
      }

      // Test 6: Word variations
      const variations = getWordVariations(testInput);
      results.push({
        name: 'וריאציות מילה',
        input: testInput,
        output: variations.slice(0, 10).join(', ') + (variations.length > 10 ? '...' : ''),
        passed: variations.length > 1,
      });

      // Test 7: Talmud references
      const refs = findTalmudReferences(testInput);
      if (refs.length > 0) {
        results.push({
          name: 'זיהוי מראי מקומות',
          input: testInput,
          output: refs.map(r => `${r.tractate} ${r.daf}${r.amud}`).join(', '),
          passed: true,
        });
      }

      setTestResults(results);
      toast({
        title: 'הבדיקות הושלמו',
        description: `${results.length} בדיקות בוצעו`,
      });
    } catch (error) {
      console.error('Test error:', error);
      toast({
        title: 'שגיאה',
        description: 'אירעה שגיאה בזמן הבדיקה',
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
    }
  };

  const copyResult = (result: TestResult) => {
    navigator.clipboard.writeText(result.output);
    toast({
      title: 'הועתק',
      description: 'התוצאה הועתקה ללוח',
    });
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <FlaskConical className="h-5 w-5" />
          פאנל בדיקות
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input */}
        <div className="space-y-2">
          <Label>טקסט לבדיקה</Label>
          <div className="flex gap-2">
            <Input
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              placeholder='לדוגמה: בְּרֵאשִׁית או רש"י או ברכות ב:'
              dir="rtl"
              className="flex-1"
            />
            <Button onClick={runTests} disabled={isRunning}>
              {isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Quick Tests */}
        <div className="space-y-2">
          <Label>בדיקות מהירות</Label>
          <div className="flex flex-wrap gap-2">
            <QuickTestButton 
              label='רש"י' 
              onClick={() => setTestInput('רש"י')} 
            />
            <QuickTestButton 
              label="בְּרֵאשִׁית" 
              onClick={() => setTestInput('בְּרֵאשִׁית')} 
            />
            <QuickTestButton 
              label="ברכות ב:" 
              onClick={() => setTestInput('ברכות ב:')} 
            />
            <QuickTestButton 
              label="שבת קמ״א" 
              onClick={() => setTestInput('שבת קמ״א')} 
            />
            <QuickTestButton 
              label="אמת" 
              onClick={() => setTestInput('אמת')} 
            />
            <QuickTestButton 
              label="שלום" 
              onClick={() => setTestInput('שלום')} 
            />
          </div>
        </div>

        <Separator />

        {/* Results */}
        <ScrollArea className="h-[300px]">
          {testResults.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FlaskConical className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">הזן טקסט ולחץ על הרצה</p>
            </div>
          ) : (
            <div className="space-y-2">
              {testResults.map((result, index) => (
                <TestResultCard 
                  key={index} 
                  result={result} 
                  onCopy={() => copyResult(result)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

interface TestResult {
  name: string;
  input: string;
  output: string;
  passed: boolean;
  error?: string;
}

interface TestResultCardProps {
  result: TestResult;
  onCopy: () => void;
}

function TestResultCard({ result, onCopy }: TestResultCardProps) {
  return (
    <div className={`
      p-3 border rounded-lg
      ${result.passed 
        ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900' 
        : 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900'}
    `}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {result.passed ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <X className="h-4 w-4 text-red-500" />
            )}
            <span className="font-medium text-sm">{result.name}</span>
          </div>
          
          <div className="mt-2 space-y-1 text-sm">
            <div className="flex gap-2">
              <span className="text-muted-foreground shrink-0">קלט:</span>
              <span dir="rtl" className="font-hebrew">{result.input}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground shrink-0">פלט:</span>
              <span dir="rtl" className="font-hebrew break-all">{result.output}</span>
            </div>
          </div>

          {result.error && (
            <div className="mt-2 text-sm text-red-500 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {result.error}
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onCopy}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

interface QuickTestButtonProps {
  label: string;
  onClick: () => void;
}

function QuickTestButton({ label, onClick }: QuickTestButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className="font-hebrew"
    >
      {label}
    </Button>
  );
}
