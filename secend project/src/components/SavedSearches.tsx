import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Star, Trash2, Search, Plus, X } from 'lucide-react';
import { SearchCondition } from '@/types/search';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface SavedSearch {
  id: string;
  name: string;
  description?: string;
  conditions: SearchCondition[];
  createdAt: number;
}

interface SavedSearchesProps {
  onLoadSearch: (conditions: SearchCondition[]) => void;
}

export function SavedSearches({ onLoadSearch }: SavedSearchesProps) {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>(() => {
    const saved = localStorage.getItem('savedSearches');
    return saved ? JSON.parse(saved) : [];
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [searchDescription, setSearchDescription] = useState('');
  const [currentConditions, setCurrentConditions] = useState<SearchCondition[]>([]);
  const { toast } = useToast();

  const saveSearch = (conditions: SearchCondition[]) => {
    if (!searchName.trim()) {
      toast({
        title: 'שגיאה',
        description: 'נא להזין שם לחיפוש',
        variant: 'destructive',
      });
      return;
    }

    const newSearch: SavedSearch = {
      id: Date.now().toString(),
      name: searchName,
      description: searchDescription,
      conditions,
      createdAt: Date.now(),
    };

    const updated = [...savedSearches, newSearch];
    setSavedSearches(updated);
    localStorage.setItem('savedSearches', JSON.stringify(updated));

    toast({
      title: 'נשמר!',
      description: `החיפוש "${searchName}" נשמר בהצלחה`,
    });

    setSearchName('');
    setSearchDescription('');
    setIsDialogOpen(false);
  };

  const deleteSearch = (id: string) => {
    const updated = savedSearches.filter(s => s.id !== id);
    setSavedSearches(updated);
    localStorage.setItem('savedSearches', JSON.stringify(updated));

    toast({
      title: 'נמחק',
      description: 'החיפוש נמחק בהצלחה',
    });
  };

  const loadSearch = (search: SavedSearch) => {
    onLoadSearch(search.conditions);
    toast({
      title: 'נטען!',
      description: `החיפוש "${search.name}" נטען`,
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-gold p-6 shadow-md text-right">
      <div className="flex items-center justify-between mb-4">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="default"
              size="sm"
              className="bg-gold hover:bg-gold-dark text-navy"
              onClick={() => {
                // Get current conditions from parent would need to be passed in
                setIsDialogOpen(true);
              }}
            >
              <Plus className="w-4 h-4 ml-2" />
              שמור חיפוש נוכחי
            </Button>
          </DialogTrigger>
          <DialogContent className="text-right" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-right">שמור חיפוש</DialogTitle>
              <DialogDescription className="text-right">
                תן שם וותיאור לחיפוש כדי לשמור אותו לשימוש עתידי
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-navy">שם החיפוש *</label>
                <Input
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  placeholder="לדוגמה: חיפוש מקורות גמרא"
                  className="text-right"
                  dir="rtl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-navy">תיאור (אופציונלי)</label>
                <Input
                  value={searchDescription}
                  onChange={(e) => setSearchDescription(e.target.value)}
                  placeholder="תיאור קצר של החיפוש"
                  className="text-right"
                  dir="rtl"
                />
              </div>
            </div>
            <DialogFooter className="flex-row-reverse gap-2">
              <Button
                onClick={() => saveSearch(currentConditions)}
                className="bg-gold hover:bg-gold-dark text-navy"
              >
                שמור
              </Button>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                ביטול
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 text-gold" />
          <h3 className="font-bold text-lg text-navy">חיפושים שמורים ({savedSearches.length})</h3>
        </div>
      </div>

      {savedSearches.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">אין חיפושים שמורים עדיין</p>
          <p className="text-xs mt-1">שמור חיפושים שאתה משתמש בהם לעיתים קרובות</p>
        </div>
      ) : (
        <ScrollArea className="h-[300px]">
          <div className="space-y-3">
            {savedSearches.map((search) => (
              <div
                key={search.id}
                className="p-4 bg-secondary/30 rounded-xl border border-gold/30 hover:border-gold transition-all group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => deleteSearch(search.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-gold hover:text-gold hover:bg-gold/10"
                      onClick={() => loadSearch(search)}
                    >
                      <Search className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex-1 text-right">
                    <div className="flex items-center gap-2 justify-end mb-1">
                      <h4 className="font-bold text-navy">{search.name}</h4>
                      <Star className="w-4 h-4 text-gold fill-gold" />
                    </div>
                    {search.description && (
                      <p className="text-sm text-muted-foreground mb-2">{search.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1 justify-end">
                      <Badge variant="secondary" className="text-xs">
                        {search.conditions.length} תנאים
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {new Date(search.createdAt).toLocaleDateString('he-IL')}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
