import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  MapPin,
  FileText,
  Trash2,
  Info,
  Settings2,
  Hash,
  Type,
  Target,
  AlignRight,
  Ruler,
} from 'lucide-react';
import { FilterRules, PositionRule, TextPositionRule, PositionType, TextPosition } from '@/types/search';

interface FilterRulesBuilderProps {
  rules: FilterRules;
  onRulesChange: (rules: FilterRules) => void;
}

export const FilterRulesBuilder: React.FC<FilterRulesBuilderProps> = ({
  rules,
  onRulesChange,
}) => {
  // Position Rules
  const addPositionRule = () => {
    const newRule: PositionRule = {
      id: crypto.randomUUID(),
      word: '',
      relativeWord: '',
      position: 'before',
      maxDistance: 10,
    };
    onRulesChange({
      ...rules,
      positionRules: [...rules.positionRules, newRule],
    });
  };

  const updatePositionRule = (id: string, updates: Partial<PositionRule>) => {
    onRulesChange({
      ...rules,
      positionRules: rules.positionRules.map((rule) =>
        rule.id === id ? { ...rule, ...updates } : rule
      ),
    });
  };

  const removePositionRule = (id: string) => {
    onRulesChange({
      ...rules,
      positionRules: rules.positionRules.filter((rule) => rule.id !== id),
    });
  };

  // Text Position Rules
  const addTextPositionRule = () => {
    const newRule: TextPositionRule = {
      id: crypto.randomUUID(),
      word: '',
      position: 'start',
      withinWords: 3,
    };
    onRulesChange({
      ...rules,
      textPositionRules: [...rules.textPositionRules, newRule],
    });
  };

  const updateTextPositionRule = (id: string, updates: Partial<TextPositionRule>) => {
    onRulesChange({
      ...rules,
      textPositionRules: rules.textPositionRules.map((rule) =>
        rule.id === id ? { ...rule, ...updates } : rule
      ),
    });
  };

  const removeTextPositionRule = (id: string) => {
    onRulesChange({
      ...rules,
      textPositionRules: rules.textPositionRules.filter((rule) => rule.id !== id),
    });
  };

  // Global rules
  const updateGlobalRule = (key: keyof FilterRules, value: any) => {
    onRulesChange({
      ...rules,
      [key]: value,
    });
  };

  const hasAnyRules = 
    rules.positionRules.length > 0 ||
    rules.textPositionRules.length > 0 ||
    rules.minWordCount ||
    rules.maxWordCount ||
    rules.mustContainNumbers ||
    rules.mustContainLettersOnly;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Add Rule Buttons */}
      <div className="flex flex-wrap gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={addPositionRule}
                className="border-gold/30 hover:bg-gold/10 text-navy"
              >
                <Target className="w-4 h-4 ml-2 text-gold" />
                כלל מיקום יחסי
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>הגדר מיקום מילה ביחס למילה אחרת</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={addTextPositionRule}
                className="border-gold/30 hover:bg-gold/10 text-navy"
              >
                <AlignRight className="w-4 h-4 ml-2 text-gold" />
                מיקום בשורה
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>הגדר מיקום מילה בתחילת/סוף שורה</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Position Rules */}
      {rules.positionRules.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-gold" />
            <span className="text-sm font-medium text-navy">כללי מיקום יחסי</span>
          </div>
          {rules.positionRules.map((rule) => (
            <div
              key={rule.id}
              className="bg-white border border-gold/20 rounded-lg p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="border-gold/30 text-navy">
                  מיקום יחסי
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removePositionRule(rule.id)}
                  className="text-navy/50 hover:text-navy hover:bg-gold/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs text-navy/70">מילה</label>
                  <Input
                    placeholder="המילה לחיפוש"
                    value={rule.word}
                    onChange={(e) =>
                      updatePositionRule(rule.id, { word: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-navy/70">מילה יחסית</label>
                  <Input
                    placeholder="ביחס למילה זו"
                    value={rule.relativeWord}
                    onChange={(e) =>
                      updatePositionRule(rule.id, { relativeWord: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs text-navy/70">מיקום</label>
                  <Select
                    value={rule.position}
                    onValueChange={(value: PositionType) =>
                      updatePositionRule(rule.id, { position: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="before">לפני</SelectItem>
                      <SelectItem value="after">אחרי</SelectItem>
                      <SelectItem value="anywhere">בכל מקום</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-navy/70">מרחק מקסימלי (מילים)</label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="10"
                    value={rule.maxDistance || ''}
                    onChange={(e) =>
                      updatePositionRule(rule.id, {
                        maxDistance: parseInt(e.target.value) || undefined,
                      })
                    }
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Text Position Rules */}
      {rules.textPositionRules.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlignRight className="w-4 h-4 text-gold" />
            <span className="text-sm font-medium text-navy">כללי מיקום בשורה</span>
          </div>
          {rules.textPositionRules.map((rule) => (
            <div
              key={rule.id}
              className="bg-white border border-gold/20 rounded-lg p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="border-gold/30 text-navy">
                  מיקום בשורה
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeTextPositionRule(rule.id)}
                  className="text-navy/50 hover:text-navy hover:bg-gold/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs text-navy/70">מילה</label>
                  <Input
                    placeholder="המילה לחיפוש"
                    value={rule.word}
                    onChange={(e) =>
                      updateTextPositionRule(rule.id, { word: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-navy/70">מיקום</label>
                  <Select
                    value={rule.position}
                    onValueChange={(value: TextPosition) =>
                      updateTextPositionRule(rule.id, { position: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="start">בתחילת השורה</SelectItem>
                      <SelectItem value="end">בסוף השורה</SelectItem>
                      <SelectItem value="anywhere">בכל מקום</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-navy/70">תוך כמה מילים מההתחלה/סוף</label>
                <Input
                  type="number"
                  min={1}
                  placeholder="3"
                  value={rule.withinWords || ''}
                  onChange={(e) =>
                    updateTextPositionRule(rule.id, {
                      withinWords: parseInt(e.target.value) || undefined,
                    })
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Global Rules */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-gold" />
          <span className="text-sm font-medium text-navy">הגדרות נוספות</span>
        </div>

        <div className="bg-white border border-gold/20 rounded-lg p-4 space-y-4">
          {/* Word Count */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs text-navy/70 flex items-center gap-2">
                <Ruler className="w-3 h-3" />
                מינימום מילים בשורה
              </label>
              <Input
                type="number"
                min={1}
                placeholder="ללא הגבלה"
                value={rules.minWordCount || ''}
                onChange={(e) =>
                  updateGlobalRule('minWordCount', parseInt(e.target.value) || undefined)
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-navy/70 flex items-center gap-2">
                <Ruler className="w-3 h-3" />
                מקסימום מילים בשורה
              </label>
              <Input
                type="number"
                min={1}
                placeholder="ללא הגבלה"
                value={rules.maxWordCount || ''}
                onChange={(e) =>
                  updateGlobalRule('maxWordCount', parseInt(e.target.value) || undefined)
                }
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gold/5 rounded-lg">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-gold" />
                <span className="text-sm text-navy">חייב להכיל מספרים</span>
              </div>
              <Switch
                checked={rules.mustContainNumbers}
                onCheckedChange={(checked) =>
                  updateGlobalRule('mustContainNumbers', checked)
                }
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-gold/5 rounded-lg">
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-gold" />
                <span className="text-sm text-navy">אותיות בלבד (ללא מספרים)</span>
              </div>
              <Switch
                checked={rules.mustContainLettersOnly}
                onCheckedChange={(checked) =>
                  updateGlobalRule('mustContainLettersOnly', checked)
                }
              />
            </div>
          </div>
        </div>
      </div>

      {/* No Rules Message */}
      {!hasAnyRules && (
        <div className="text-center py-6 text-navy/50">
          <Settings2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">לא הוגדרו כללים</p>
          <p className="text-xs mt-1">לחץ על אחד הכפתורים למעלה להוספת כלל</p>
        </div>
      )}

      {/* Info */}
      {hasAnyRules && (
        <div className="flex items-start gap-2 p-3 bg-gold/5 rounded-lg border border-gold/20">
          <Info className="w-4 h-4 text-gold mt-0.5" />
          <p className="text-xs text-navy/70">
            הכללים יופעלו על כל תוצאה. רק שורות שעומדות בכל הכללים יוצגו.
          </p>
        </div>
      )}
    </div>
  );
};
