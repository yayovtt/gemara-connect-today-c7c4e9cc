import { useMemo } from 'react';
import { 
  Eye, 
  ArrowRight, 
  ArrowLeft, 
  AlignRight, 
  AlignLeft,
  Ruler,
  Hash,
  Type,
  CheckCircle,
  XCircle,
  Sparkles,
  Target,
  MapPin
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { FilterRules } from '@/types/search';

interface ActiveRulesPreviewProps {
  rules: FilterRules;
}

interface RuleExample {
  text: string;
  matches: boolean;
  explanation: string;
}

export function ActiveRulesPreview({ rules }: ActiveRulesPreviewProps) {
  const activeRulesCount = 
    rules.positionRules.filter(r => r.word && r.relativeWord).length +
    rules.textPositionRules.filter(r => r.word).length +
    (rules.minWordCount ? 1 : 0) +
    (rules.maxWordCount ? 1 : 0) +
    (rules.mustContainNumbers ? 1 : 0) +
    (rules.mustContainLettersOnly ? 1 : 0);

  const examples = useMemo(() => {
    const allExamples: { rule: string; ruleType: string; examples: RuleExample[] }[] = [];

    // Position Rules Examples
    rules.positionRules.filter(r => r.word && r.relativeWord).forEach(rule => {
      const ruleDescription = rule.position === 'before'
        ? `"${rule.word}" לפני "${rule.relativeWord}"`
        : rule.position === 'after'
        ? `"${rule.word}" אחרי "${rule.relativeWord}"`
        : `"${rule.word}" בכל מקום ביחס ל"${rule.relativeWord}"`;

      const examplesList: RuleExample[] = [];

      if (rule.position === 'before') {
        examplesList.push({
          text: `${rule.word} אמר ${rule.relativeWord} בספר`,
          matches: true,
          explanation: `"${rule.word}" מופיעה לפני "${rule.relativeWord}" בטווח המותר`
        });
        examplesList.push({
          text: `${rule.relativeWord} אמר ${rule.word} בספר`,
          matches: false,
          explanation: `"${rule.word}" מופיעה אחרי "${rule.relativeWord}" ולא לפניה`
        });
      } else if (rule.position === 'after') {
        examplesList.push({
          text: `${rule.relativeWord} אמר ${rule.word} בספר`,
          matches: true,
          explanation: `"${rule.word}" מופיעה אחרי "${rule.relativeWord}" בטווח המותר`
        });
        examplesList.push({
          text: `${rule.word} אמר ${rule.relativeWord} בספר`,
          matches: false,
          explanation: `"${rule.word}" מופיעה לפני "${rule.relativeWord}" ולא אחריה`
        });
      } else {
        examplesList.push({
          text: `${rule.word} אמר ${rule.relativeWord} בספר`,
          matches: true,
          explanation: `שתי המילים מופיעות בטקסט - הסדר לא משנה`
        });
      }

      allExamples.push({
        rule: ruleDescription,
        ruleType: 'position',
        examples: examplesList
      });
    });

    // Text Position Rules Examples
    rules.textPositionRules.filter(r => r.word).forEach(rule => {
      const ruleDescription = rule.position === 'start'
        ? `"${rule.word}" בתחילת השורה`
        : rule.position === 'end'
        ? `"${rule.word}" בסוף השורה`
        : `"${rule.word}" בכל מקום בשורה`;

      const examplesList: RuleExample[] = [];

      if (rule.position === 'start') {
        const withinWords = rule.withinWords || 3;
        examplesList.push({
          text: `${rule.word} אמר לו הדבר הזה`,
          matches: true,
          explanation: `"${rule.word}" מופיעה בתחילת השורה`
        });
        examplesList.push({
          text: `הוא אמר ${rule.word} לחברו`,
          matches: false,
          explanation: `"${rule.word}" לא מופיעה ב-${withinWords} המילים הראשונות`
        });
      } else if (rule.position === 'end') {
        const withinWords = rule.withinWords || 3;
        examplesList.push({
          text: `הדבר הזה נאמר על ידי ${rule.word}`,
          matches: true,
          explanation: `"${rule.word}" מופיעה בסוף השורה`
        });
        examplesList.push({
          text: `${rule.word} אמר לו הדבר`,
          matches: false,
          explanation: `"${rule.word}" לא מופיעה ב-${withinWords} המילים האחרונות`
        });
      }

      allExamples.push({
        rule: ruleDescription,
        ruleType: 'textPosition',
        examples: examplesList
      });
    });

    // Word Count Examples
    if (rules.minWordCount) {
      const min = rules.minWordCount;
      allExamples.push({
        rule: `מינימום ${min} מילים בשורה`,
        ruleType: 'wordCount',
        examples: [
          {
            text: 'זו שורה עם ' + 'מילים '.repeat(min - 1).trim(),
            matches: false,
            explanation: `השורה מכילה פחות מ-${min} מילים`
          },
          {
            text: 'זו שורה ארוכה יותר עם הרבה מילים נוספות',
            matches: true,
            explanation: `השורה מכילה ${min} מילים או יותר`
          }
        ]
      });
    }

    if (rules.maxWordCount) {
      const max = rules.maxWordCount;
      allExamples.push({
        rule: `מקסימום ${max} מילים בשורה`,
        ruleType: 'wordCount',
        examples: [
          {
            text: 'שורה קצרה',
            matches: true,
            explanation: `השורה מכילה פחות מ-${max} מילים`
          },
          {
            text: 'זו שורה ארוכה מאוד עם יותר מדי מילים שלא עומדת בכלל',
            matches: false,
            explanation: `השורה מכילה יותר מ-${max} מילים`
          }
        ]
      });
    }

    // Number/Letters Rules
    if (rules.mustContainNumbers) {
      allExamples.push({
        rule: 'חייב להכיל מספרים',
        ruleType: 'content',
        examples: [
          {
            text: 'דף כ"ג אמר רבי יוחנן',
            matches: true,
            explanation: 'הטקסט מכיל מספרים (כ"ג)'
          },
          {
            text: 'אמר רבי יוחנן משום רבי שמעון',
            matches: false,
            explanation: 'הטקסט לא מכיל מספרים'
          }
        ]
      });
    }

    if (rules.mustContainLettersOnly) {
      allExamples.push({
        rule: 'אותיות בלבד',
        ruleType: 'content',
        examples: [
          {
            text: 'אמר רבי יוחנן משום רבי שמעון',
            matches: true,
            explanation: 'הטקסט מכיל אותיות בלבד'
          },
          {
            text: 'דף 23 אמר רבי יוחנן',
            matches: false,
            explanation: 'הטקסט מכיל מספרים ולא רק אותיות'
          }
        ]
      });
    }

    return allExamples;
  }, [rules]);

  if (activeRulesCount === 0) {
    return null;
  }

  const getRuleIcon = (ruleType: string) => {
    switch (ruleType) {
      case 'position':
        return <Target className="w-4 h-4" />;
      case 'textPosition':
        return <MapPin className="w-4 h-4" />;
      case 'wordCount':
        return <Ruler className="w-4 h-4" />;
      case 'content':
        return <Type className="w-4 h-4" />;
      default:
        return <Sparkles className="w-4 h-4" />;
    }
  };

  return (
    <div className="glass-effect rounded-2xl p-6 animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-gold rounded-xl flex items-center justify-center shadow-lg">
          <Eye className="w-6 h-6 text-white" />
        </div>
        <div className="text-right">
          <h2 className="text-xl font-bold text-navy flex items-center gap-2">
            תצוגה מקדימה של כללים פעילים
            <Badge className="bg-gold text-white px-3 py-1 rounded-lg">
              {activeRulesCount} כללים
            </Badge>
          </h2>
          <p className="text-sm text-navy/60">
            ראה דוגמאות לטקסטים שיתאימו או לא יתאימו לכללים
          </p>
        </div>
      </div>

      {/* Rules with Examples */}
      <div className="space-y-4">
        {examples.map((ruleGroup, index) => (
          <div 
            key={index}
            className="bg-white rounded-xl border-2 border-gold/20 overflow-hidden shadow-sm animate-scale-in"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            {/* Rule Header */}
            <div className="bg-gold p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-white">
                  {getRuleIcon(ruleGroup.ruleType)}
                </div>
                <span className="font-bold text-white text-lg">{ruleGroup.rule}</span>
              </div>
            </div>

            {/* Examples */}
            <div className="p-4 space-y-3">
              {ruleGroup.examples.map((example, exIndex) => (
                <div 
                  key={exIndex}
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-all ${
                    example.matches 
                      ? 'bg-gold/5 border-gold/30 hover:border-gold' 
                      : 'bg-navy/5 border-navy/30 hover:border-navy'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    example.matches ? 'bg-gold' : 'bg-navy'
                  }`}>
                    {example.matches 
                      ? <CheckCircle className="w-5 h-5 text-white" />
                      : <XCircle className="w-5 h-5 text-white" />
                    }
                  </div>
                  <div className="flex-1 text-right">
                    <div className={`font-semibold text-base mb-1 ${
                      example.matches ? 'text-gold' : 'text-navy'
                    }`}>
                      {example.matches ? 'יתאים ✓' : 'לא יתאים ✗'}
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-gold/20 mb-2">
                      <code className="text-sm text-navy font-medium" dir="rtl">
                        "{example.text}"
                      </code>
                    </div>
                    <p className="text-sm text-navy/60">
                      {example.explanation}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-6 p-4 bg-gold/10 rounded-xl border-2 border-gold/20">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-gold" />
          <span className="text-navy font-medium">
            הטקסטים שיוצגו בתוצאות יעמדו בכל {activeRulesCount} הכללים שהגדרת
          </span>
        </div>
      </div>
    </div>
  );
}
