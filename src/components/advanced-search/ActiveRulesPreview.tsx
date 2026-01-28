import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Eye, 
  X, 
  AlertCircle,
  CheckCircle,
  Search,
  Filter,
  ListPlus
} from 'lucide-react';
import { SearchCondition, FilterRules } from '@/types/search';
import { WordList } from '@/types/wordList';

interface ActiveRulesPreviewProps {
  conditions: SearchCondition[];
  filterRules: FilterRules;
  wordLists: WordList[];
  onRemoveCondition?: (id: string) => void;
  onClearAll?: () => void;
}

export function ActiveRulesPreview({
  conditions,
  filterRules,
  wordLists,
  onRemoveCondition,
  onClearAll,
}: ActiveRulesPreviewProps) {
  const hasConditions = conditions.length > 0;
  const hasFilterRules = 
    filterRules.minWords !== undefined ||
    filterRules.maxWords !== undefined ||
    filterRules.minChars !== undefined ||
    filterRules.maxChars !== undefined ||
    (filterRules.positionRules && filterRules.positionRules.length > 0) ||
    (filterRules.textPositionRules && filterRules.textPositionRules.length > 0);

  const totalRules = 
    conditions.length + 
    (filterRules.positionRules?.length || 0) + 
    (filterRules.textPositionRules?.length || 0) +
    (filterRules.minWords !== undefined ? 1 : 0) +
    (filterRules.maxWords !== undefined ? 1 : 0) +
    (filterRules.minChars !== undefined ? 1 : 0) +
    (filterRules.maxChars !== undefined ? 1 : 0);

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

  const getLogicalLabel = (operator?: string) => {
    const labels: Record<string, string> = {
      AND: 'וגם',
      OR: 'או',
      NOT: 'ולא',
    };
    return operator ? labels[operator] || operator : '';
  };

  const getWordListName = (listId?: string) => {
    if (!listId) return '';
    const list = wordLists.find(l => l.id === listId);
    return list?.name || listId;
  };

  if (!hasConditions && !hasFilterRules) {
    return (
      <Card className="w-full">
        <CardContent className="py-6">
          <div className="text-center text-muted-foreground">
            <Eye className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">אין כללים פעילים</p>
            <p className="text-xs mt-1">הוסף תנאי חיפוש או כללי סינון</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Eye className="h-4 w-4" />
            כללים פעילים
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{totalRules}</Badge>
            {onClearAll && totalRules > 0 && (
              <Button variant="ghost" size="sm" onClick={onClearAll}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[300px]">
          <div className="space-y-3">
            {/* Search Conditions */}
            {hasConditions && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Search className="h-3 w-3" />
                  תנאי חיפוש
                </div>
                <div className="flex flex-wrap gap-1">
                  {conditions.map((condition, index) => (
                    <Badge
                      key={condition.id}
                      variant="outline"
                      className="text-xs py-1 px-2 gap-1"
                    >
                      {index > 0 && condition.logicalOperator && (
                        <span className="text-muted-foreground">
                          {getLogicalLabel(condition.logicalOperator)}
                        </span>
                      )}
                      <span className="text-primary">{getOperatorLabel(condition.operator)}</span>
                      {condition.operator === 'word_list' ? (
                        <span>"{getWordListName(condition.wordListId)}"</span>
                      ) : (
                        <span>"{condition.term}"</span>
                      )}
                      {condition.operator === 'proximity' && condition.proximityDistance && (
                        <span className="text-muted-foreground">
                          ({condition.proximityDistance} מילים)
                        </span>
                      )}
                      {condition.smartOptions && (
                        <SmartOptionsIndicator options={condition.smartOptions} />
                      )}
                      {onRemoveCondition && (
                        <button
                          className="hover:text-destructive mr-1"
                          onClick={() => onRemoveCondition(condition.id)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Filter Rules */}
            {hasFilterRules && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Filter className="h-3 w-3" />
                  כללי סינון
                </div>
                <div className="flex flex-wrap gap-1">
                  {filterRules.minWords !== undefined && (
                    <Badge variant="secondary" className="text-xs">
                      מינימום {filterRules.minWords} מילים
                    </Badge>
                  )}
                  {filterRules.maxWords !== undefined && (
                    <Badge variant="secondary" className="text-xs">
                      מקסימום {filterRules.maxWords} מילים
                    </Badge>
                  )}
                  {filterRules.minChars !== undefined && (
                    <Badge variant="secondary" className="text-xs">
                      מינימום {filterRules.minChars} תווים
                    </Badge>
                  )}
                  {filterRules.maxChars !== undefined && (
                    <Badge variant="secondary" className="text-xs">
                      מקסימום {filterRules.maxChars} תווים
                    </Badge>
                  )}
                  {filterRules.positionRules?.map((rule, i) => (
                    <Badge key={`pos-${i}`} variant="secondary" className="text-xs">
                      {rule.type === 'word' ? 'מילה' : 'תו'} {rule.position} {' '}
                      {rule.operator === 'equals' ? '=' : rule.operator === 'not_equals' ? '≠' : rule.operator === 'greater' ? '>' : '<'}{' '}
                      "{rule.value}"
                    </Badge>
                  ))}
                  {filterRules.textPositionRules?.map((rule, i) => (
                    <Badge key={`text-${i}`} variant="secondary" className="text-xs">
                      {rule.section === 'start' ? 'התחלה' : rule.section === 'middle' ? 'אמצע' : 'סוף'}{' '}
                      {rule.percentage}%
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

interface SmartOptionsIndicatorProps {
  options: SearchCondition['smartOptions'];
}

function SmartOptionsIndicator({ options }: SmartOptionsIndicatorProps) {
  if (!options) return null;

  const activeOptions = [];
  if (options.ignoreNikud) activeOptions.push('נ');
  if (options.ignoreSofitLetters) activeOptions.push('ס');
  if (options.searchGematria) activeOptions.push('ג');
  if (options.expandAcronyms) activeOptions.push('ר"ת');
  if (options.fuzzyMatch) activeOptions.push('~');

  if (activeOptions.length === 0) return null;

  return (
    <span className="text-muted-foreground text-[10px] bg-muted px-1 rounded">
      {activeOptions.join('')}
    </span>
  );
}
