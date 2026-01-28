import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  History, 
  Search, 
  Clock, 
  Trash2, 
  RotateCcw,
  X
} from 'lucide-react';
import { SearchCondition } from '@/types/search';

export interface SearchHistoryItem {
  id: string;
  text: string;
  conditions: SearchCondition[];
  timestamp: Date;
  resultsCount?: number;
}

interface SearchHistoryProps {
  history: SearchHistoryItem[];
  onRestore: (item: SearchHistoryItem) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

export function SearchHistory({
  history,
  onRestore,
  onDelete,
  onClear,
}: SearchHistoryProps) {
  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'עכשיו';
    if (minutes < 60) return `לפני ${minutes} דקות`;
    if (hours < 24) return `לפני ${hours} שעות`;
    if (days < 7) return `לפני ${days} ימים`;
    
    return date.toLocaleDateString('he-IL');
  };

  const getConditionsSummary = (conditions: SearchCondition[]) => {
    if (conditions.length === 0) return 'חיפוש פשוט';
    if (conditions.length === 1) {
      const c = conditions[0];
      return `"${c.term}" (${getOperatorLabel(c.operator)})`;
    }
    return `${conditions.length} תנאים`;
  };

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
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <History className="h-4 w-4" />
            היסטוריית חיפושים
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{history.length}</Badge>
            {history.length > 0 && (
              <Button variant="ghost" size="sm" onClick={onClear}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">אין היסטוריה</p>
            <p className="text-xs mt-1">חיפושים קודמים יופיעו כאן</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="p-3 border rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {/* Text Preview */}
                      <p className="text-sm truncate" dir="rtl">
                        {item.text.slice(0, 100)}
                        {item.text.length > 100 ? '...' : ''}
                      </p>
                      
                      {/* Conditions Summary */}
                      <p className="text-xs text-muted-foreground mt-1">
                        <Search className="h-3 w-3 inline mr-1" />
                        {getConditionsSummary(item.conditions)}
                      </p>
                      
                      {/* Timestamp & Results */}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(new Date(item.timestamp))}
                        </span>
                        {item.resultsCount !== undefined && (
                          <Badge variant="outline" className="text-xs">
                            {item.resultsCount} תוצאות
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onRestore(item)}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:text-destructive"
                        onClick={() => onDelete(item.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
