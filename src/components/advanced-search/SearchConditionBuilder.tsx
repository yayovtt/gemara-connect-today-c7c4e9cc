import React, { useState } from 'react';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  Plus, 
  X, 
  ChevronDown, 
  ChevronUp,
  Search,
  Sparkles,
  Copy,
  Trash2,
  GripVertical
} from 'lucide-react';
import { SearchCondition, ConditionOperator, SmartSearchOptions } from '@/types/search';
import { WordList } from '@/types/wordList';
import { toast } from '@/hooks/use-toast';

interface SearchConditionBuilderProps {
  conditions: SearchCondition[];
  onChange: (conditions: SearchCondition[]) => void;
  wordLists: WordList[];
}

const OPERATORS: { value: ConditionOperator; label: string; description: string }[] = [
  { value: 'contains', label: 'מכיל', description: 'הטקסט מכיל את המילה' },
  { value: 'not_contains', label: 'לא מכיל', description: 'הטקסט לא מכיל את המילה' },
  { value: 'starts_with', label: 'מתחיל ב', description: 'המילה מתחילה ב...' },
  { value: 'ends_with', label: 'מסתיים ב', description: 'המילה מסתיימת ב...' },
  { value: 'exact', label: 'מילה מדויקת', description: 'התאמה מדויקת של המילה' },
  { value: 'regex', label: 'Regex', description: 'ביטוי רגולרי' },
  { value: 'proximity', label: 'קרבה', description: 'מילים בקרבת מילים אחרות' },
  { value: 'word_list', label: 'רשימת מילים', description: 'חיפוש מרשימת מילים' },
];

const DEFAULT_SMART_OPTIONS: SmartSearchOptions = {
  ignoreNikud: true,
  ignoreSofitLetters: true,
  searchGematria: false,
  expandAcronyms: false,
  fuzzyMatch: false,
  fuzzyThreshold: 0.8,
};

export function SearchConditionBuilder({
  conditions,
  onChange,
  wordLists = [],
}: SearchConditionBuilderProps) {
  const [expandedConditions, setExpandedConditions] = useState<Set<string>>(new Set());

  const addCondition = () => {
    const newCondition: SearchCondition = {
      id: crypto.randomUUID(),
      term: '',
      operator: 'contains',
      logicalOperator: conditions.length > 0 ? 'AND' : undefined,
      smartOptions: { ...DEFAULT_SMART_OPTIONS },
    };
    onChange([...conditions, newCondition]);
    setExpandedConditions(prev => new Set([...prev, newCondition.id]));
  };

  const updateCondition = (id: string, updates: Partial<SearchCondition>) => {
    onChange(
      conditions.map(c => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const removeCondition = (id: string) => {
    const newConditions = conditions.filter(c => c.id !== id);
    // Update the first condition to not have a logical operator
    if (newConditions.length > 0 && newConditions[0].logicalOperator) {
      newConditions[0] = { ...newConditions[0], logicalOperator: undefined };
    }
    onChange(newConditions);
    setExpandedConditions(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const duplicateCondition = (condition: SearchCondition) => {
    const newCondition: SearchCondition = {
      ...condition,
      id: crypto.randomUUID(),
      logicalOperator: 'AND',
    };
    const index = conditions.findIndex(c => c.id === condition.id);
    const newConditions = [...conditions];
    newConditions.splice(index + 1, 0, newCondition);
    onChange(newConditions);
  };

  const toggleExpanded = (id: string) => {
    setExpandedConditions(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const moveCondition = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= conditions.length) return;

    const newConditions = [...conditions];
    [newConditions[index], newConditions[newIndex]] = [newConditions[newIndex], newConditions[index]];
    
    // Fix logical operators
    newConditions.forEach((c, i) => {
      if (i === 0) {
        c.logicalOperator = undefined;
      } else if (!c.logicalOperator) {
        c.logicalOperator = 'AND';
      }
    });
    
    onChange(newConditions);
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Search className="h-5 w-5" />
            תנאי חיפוש
          </CardTitle>
          <Badge variant="outline">{conditions.length} תנאים</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {conditions.map((condition, index) => (
          <ConditionRow
            key={condition.id}
            condition={condition}
            index={index}
            isExpanded={expandedConditions.has(condition.id)}
            wordLists={wordLists}
            onUpdate={(updates) => updateCondition(condition.id, updates)}
            onRemove={() => removeCondition(condition.id)}
            onDuplicate={() => duplicateCondition(condition)}
            onToggleExpand={() => toggleExpanded(condition.id)}
            onMove={(direction) => moveCondition(index, direction)}
            canMoveUp={index > 0}
            canMoveDown={index < conditions.length - 1}
            showLogicalOperator={index > 0}
          />
        ))}

        <Button
          variant="outline"
          className="w-full"
          onClick={addCondition}
        >
          <Plus className="h-4 w-4 mr-2" />
          הוסף תנאי חיפוש
        </Button>
      </CardContent>
    </Card>
  );
}

interface ConditionRowProps {
  condition: SearchCondition;
  index: number;
  isExpanded: boolean;
  wordLists: WordList[];
  onUpdate: (updates: Partial<SearchCondition>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onToggleExpand: () => void;
  onMove: (direction: 'up' | 'down') => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  showLogicalOperator: boolean;
}

function ConditionRow({
  condition,
  index,
  isExpanded,
  wordLists,
  onUpdate,
  onRemove,
  onDuplicate,
  onToggleExpand,
  onMove,
  canMoveUp,
  canMoveDown,
  showLogicalOperator,
}: ConditionRowProps) {
  return (
    <div className="border rounded-lg p-3 space-y-3 bg-card">
      {/* Logical Operator */}
      {showLogicalOperator && (
        <div className="flex justify-center -mt-6 mb-2">
          <Select
            value={condition.logicalOperator || 'AND'}
            onValueChange={(value) => onUpdate({ logicalOperator: value as 'AND' | 'OR' | 'NOT' })}
          >
            <SelectTrigger className="w-20 h-7 text-xs bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AND">וגם</SelectItem>
              <SelectItem value="OR">או</SelectItem>
              <SelectItem value="NOT">ולא</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Main Row */}
      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={() => onMove('up')}
            disabled={!canMoveUp}
          >
            <ChevronUp className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={() => onMove('down')}
            disabled={!canMoveDown}
          >
            <ChevronDown className="h-3 w-3" />
          </Button>
        </div>

        <Badge variant="secondary" className="w-6 h-6 rounded-full flex items-center justify-center text-xs">
          {index + 1}
        </Badge>

        <Select
          value={condition.operator}
          onValueChange={(value) => onUpdate({ operator: value as ConditionOperator })}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPERATORS.map((op) => (
              <SelectItem key={op.value} value={op.value}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>{op.label}</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{op.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {condition.operator === 'word_list' ? (
          <Select
            value={condition.wordListId || ''}
            onValueChange={(value) => onUpdate({ wordListId: value })}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="בחר רשימת מילים" />
            </SelectTrigger>
            <SelectContent>
              {wordLists.map((list) => (
                <SelectItem key={list.id} value={list.id}>
                  {list.name} ({list.words.length} מילים)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            value={condition.term}
            onChange={(e) => onUpdate({ term: e.target.value })}
            placeholder={condition.operator === 'proximity' ? 'מילה1,מילה2' : 'מילת חיפוש...'}
            className="flex-1"
            dir="rtl"
          />
        )}

        {condition.operator === 'proximity' && (
          <Input
            type="number"
            value={condition.proximityDistance || 5}
            onChange={(e) => onUpdate({ proximityDistance: parseInt(e.target.value) || 5 })}
            className="w-20"
            min={1}
            max={50}
          />
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleExpand}
        >
          <Sparkles className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onDuplicate}
        >
          <Copy className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Smart Options (Expanded) */}
      {isExpanded && (
        <SmartOptionsPanel
          options={condition.smartOptions || DEFAULT_SMART_OPTIONS}
          onChange={(options) => onUpdate({ smartOptions: options })}
        />
      )}
    </div>
  );
}

interface SmartOptionsPanelProps {
  options: SmartSearchOptions;
  onChange: (options: SmartSearchOptions) => void;
}

function SmartOptionsPanel({ options, onChange }: SmartOptionsPanelProps) {
  const updateOption = <K extends keyof SmartSearchOptions>(
    key: K,
    value: SmartSearchOptions[K]
  ) => {
    onChange({ ...options, [key]: value });
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-3 border-t">
      <div className="flex items-center space-x-2 space-x-reverse">
        <Checkbox
          id="ignoreNikud"
          checked={options.ignoreNikud}
          onCheckedChange={(checked) => updateOption('ignoreNikud', !!checked)}
        />
        <Label htmlFor="ignoreNikud" className="text-sm">התעלם מניקוד</Label>
      </div>

      <div className="flex items-center space-x-2 space-x-reverse">
        <Checkbox
          id="ignoreSofitLetters"
          checked={options.ignoreSofitLetters}
          onCheckedChange={(checked) => updateOption('ignoreSofitLetters', !!checked)}
        />
        <Label htmlFor="ignoreSofitLetters" className="text-sm">התעלם מאותיות סופיות</Label>
      </div>

      <div className="flex items-center space-x-2 space-x-reverse">
        <Checkbox
          id="searchGematria"
          checked={options.searchGematria}
          onCheckedChange={(checked) => updateOption('searchGematria', !!checked)}
        />
        <Label htmlFor="searchGematria" className="text-sm">חפש גימטריה</Label>
      </div>

      <div className="flex items-center space-x-2 space-x-reverse">
        <Checkbox
          id="expandAcronyms"
          checked={options.expandAcronyms}
          onCheckedChange={(checked) => updateOption('expandAcronyms', !!checked)}
        />
        <Label htmlFor="expandAcronyms" className="text-sm">הרחב ראשי תיבות</Label>
      </div>

      <div className="flex items-center space-x-2 space-x-reverse">
        <Checkbox
          id="fuzzyMatch"
          checked={options.fuzzyMatch}
          onCheckedChange={(checked) => updateOption('fuzzyMatch', !!checked)}
        />
        <Label htmlFor="fuzzyMatch" className="text-sm">התאמה מטושטשת</Label>
      </div>

      {options.fuzzyMatch && (
        <div className="flex items-center gap-2">
          <Label htmlFor="fuzzyThreshold" className="text-sm whitespace-nowrap">רגישות:</Label>
          <Input
            id="fuzzyThreshold"
            type="number"
            value={options.fuzzyThreshold}
            onChange={(e) => updateOption('fuzzyThreshold', parseFloat(e.target.value) || 0.8)}
            className="w-20"
            min={0}
            max={1}
            step={0.1}
          />
        </div>
      )}
    </div>
  );
}
