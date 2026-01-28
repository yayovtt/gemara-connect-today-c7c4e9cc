import { History, Trash2, Clock, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SearchHistoryItem } from '@/hooks/useLocalStorage';
import { SearchCondition } from '@/types/search';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface SearchHistoryProps {
  history: SearchHistoryItem[];
  onRestore: (text: string, conditions: SearchCondition[]) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

export function SearchHistory({
  history,
  onRestore,
  onDelete,
  onClear,
}: SearchHistoryProps) {
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('he-IL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getOperatorLabel = (op: string) => {
    switch (op) {
      case 'AND': return 'וגם';
      case 'OR': return 'או';
      case 'NOT': return 'לא';
      case 'NEAR': return 'בקרבת';
      case 'LIST': return 'רשימה';
      default: return op;
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <History className="w-4 h-4" />
          היסטוריה
          {history.length > 0 && (
            <Badge variant="secondary" className="mr-1">
              {history.length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              היסטוריית חיפושים
            </SheetTitle>
            {history.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-destructive">
                    <Trash2 className="w-4 h-4 ml-1" />
                    נקה הכל
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>מחיקת היסטוריה</AlertDialogTitle>
                    <AlertDialogDescription>
                      האם אתה בטוח שברצונך למחוק את כל היסטוריית החיפושים?
                      פעולה זו לא ניתנת לביטול.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>ביטול</AlertDialogCancel>
                    <AlertDialogAction onClick={onClear}>מחק הכל</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-100px)] mt-4">
          {history.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>אין היסטוריית חיפושים</p>
              <p className="text-sm">החיפושים שלך יישמרו כאן</p>
            </div>
          ) : (
            <div className="space-y-3 pl-4">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="p-4 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(item.timestamp)}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onRestore(item.text, item.conditions)}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => onDelete(item.id)}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {item.conditions.map((cond, idx) => (
                        <span key={cond.id} className="flex items-center gap-1">
                          {idx > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {getOperatorLabel(cond.operator)}
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            {cond.operator === 'LIST' 
                              ? `רשימה (${cond.listWords?.length || 0})` 
                              : cond.term || '—'}
                          </Badge>
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <Badge 
                        variant={item.resultsCount > 0 ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {item.resultsCount} תוצאות
                      </Badge>
                      {item.matchedTerms.length > 0 && (
                        <span className="text-xs text-muted-foreground truncate">
                          נמצאו: {item.matchedTerms.slice(0, 3).join(', ')}
                          {item.matchedTerms.length > 3 && '...'}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {item.text.substring(0, 100)}...
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
