import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Filter, 
  Plus, 
  X,
  ArrowUp,
  ArrowDown,
  Hash,
  Type,
  Ruler
} from 'lucide-react';
import { FilterRules } from '@/types/search';

interface FilterRulesBuilderProps {
  rules: FilterRules;
  onChange: (rules: FilterRules) => void;
}

export function FilterRulesBuilder({ rules, onChange }: FilterRulesBuilderProps) {
  const updateRule = <K extends keyof FilterRules>(key: K, value: FilterRules[K]) => {
    onChange({ ...rules, [key]: value });
  };

  const addPositionRule = () => {
    const newRules = [...(rules.positionRules || [])];
    newRules.push({
      type: 'word',
      position: 1,
      operator: 'equals',
    });
    updateRule('positionRules', newRules);
  };

  const updatePositionRule = (index: number, updates: Partial<FilterRules['positionRules'][0]>) => {
    const newRules = [...(rules.positionRules || [])];
    newRules[index] = { ...newRules[index], ...updates };
    updateRule('positionRules', newRules);
  };

  const removePositionRule = (index: number) => {
    const newRules = [...(rules.positionRules || [])];
    newRules.splice(index, 1);
    updateRule('positionRules', newRules);
  };

  const addTextPositionRule = () => {
    const newRules = [...(rules.textPositionRules || [])];
    newRules.push({
      section: 'start',
      percentage: 20,
    });
    updateRule('textPositionRules', newRules);
  };

  const updateTextPositionRule = (index: number, updates: Partial<FilterRules['textPositionRules'][0]>) => {
    const newRules = [...(rules.textPositionRules || [])];
    newRules[index] = { ...newRules[index], ...updates };
    updateRule('textPositionRules', newRules);
  };

  const removeTextPositionRule = (index: number) => {
    const newRules = [...(rules.textPositionRules || [])];
    newRules.splice(index, 1);
    updateRule('textPositionRules', newRules);
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Filter className="h-5 w-5" />
            כללי סינון
          </CardTitle>
          <Badge variant="outline">
            {(rules.positionRules?.length || 0) + (rules.textPositionRules?.length || 0)} כללים
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Filters */}
        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <Ruler className="h-4 w-4" />
            סינון לפי אורך
          </h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>מילים מינימום</Label>
              <Input
                type="number"
                value={rules.minWords || ''}
                onChange={(e) => updateRule('minWords', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="ללא הגבלה"
                min={0}
              />
            </div>
            <div className="space-y-2">
              <Label>מילים מקסימום</Label>
              <Input
                type="number"
                value={rules.maxWords || ''}
                onChange={(e) => updateRule('maxWords', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="ללא הגבלה"
                min={0}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>תווים מינימום</Label>
              <Input
                type="number"
                value={rules.minChars || ''}
                onChange={(e) => updateRule('minChars', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="ללא הגבלה"
                min={0}
              />
            </div>
            <div className="space-y-2">
              <Label>תווים מקסימום</Label>
              <Input
                type="number"
                value={rules.maxChars || ''}
                onChange={(e) => updateRule('maxChars', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="ללא הגבלה"
                min={0}
              />
            </div>
          </div>
        </div>

        {/* Position Rules */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium flex items-center gap-2">
              <Hash className="h-4 w-4" />
              כללי מיקום מילה
            </h4>
            <Button variant="outline" size="sm" onClick={addPositionRule}>
              <Plus className="h-4 w-4 mr-1" />
              הוסף כלל
            </Button>
          </div>

          {rules.positionRules?.map((rule, index) => (
            <div key={index} className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
              <Select
                value={rule.type}
                onValueChange={(value) => updatePositionRule(index, { type: value as 'word' | 'char' })}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="word">מילה</SelectItem>
                  <SelectItem value="char">תו</SelectItem>
                </SelectContent>
              </Select>

              <span className="text-sm">במיקום</span>

              <Input
                type="number"
                value={rule.position}
                onChange={(e) => updatePositionRule(index, { position: parseInt(e.target.value) || 1 })}
                className="w-20"
                min={1}
              />

              <Select
                value={rule.operator}
                onValueChange={(value) => updatePositionRule(index, { operator: value as 'equals' | 'not_equals' | 'greater' | 'less' })}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equals">שווה ל</SelectItem>
                  <SelectItem value="not_equals">שונה מ</SelectItem>
                  <SelectItem value="greater">גדול מ</SelectItem>
                  <SelectItem value="less">קטן מ</SelectItem>
                </SelectContent>
              </Select>

              <Input
                value={rule.value || ''}
                onChange={(e) => updatePositionRule(index, { value: e.target.value })}
                placeholder="ערך..."
                className="flex-1"
                dir="rtl"
              />

              <Button
                variant="ghost"
                size="icon"
                onClick={() => removePositionRule(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* Text Position Rules */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium flex items-center gap-2">
              <Type className="h-4 w-4" />
              כללי מיקום בטקסט
            </h4>
            <Button variant="outline" size="sm" onClick={addTextPositionRule}>
              <Plus className="h-4 w-4 mr-1" />
              הוסף כלל
            </Button>
          </div>

          {rules.textPositionRules?.map((rule, index) => (
            <div key={index} className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
              <span className="text-sm">חפש ב</span>

              <Select
                value={rule.section}
                onValueChange={(value) => updateTextPositionRule(index, { section: value as 'start' | 'middle' | 'end' })}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="start">התחלה</SelectItem>
                  <SelectItem value="middle">אמצע</SelectItem>
                  <SelectItem value="end">סוף</SelectItem>
                </SelectContent>
              </Select>

              <span className="text-sm">של הטקסט</span>

              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={rule.percentage}
                  onChange={(e) => updateTextPositionRule(index, { percentage: parseInt(e.target.value) || 20 })}
                  className="w-20"
                  min={1}
                  max={100}
                />
                <span className="text-sm">%</span>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeTextPositionRule(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* Additional Options */}
        <div className="space-y-4">
          <h4 className="font-medium">אפשרויות נוספות</h4>
          
          <div className="flex items-center space-x-2 space-x-reverse">
            <Checkbox
              id="caseSensitive"
              checked={rules.caseSensitive || false}
              onCheckedChange={(checked) => updateRule('caseSensitive', !!checked)}
            />
            <Label htmlFor="caseSensitive">רגיש לאותיות גדולות/קטנות (אנגלית)</Label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
