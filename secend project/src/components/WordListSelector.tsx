import { useState } from 'react';
import { List, Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { WordList, WordListCategory } from '@/types/wordList';

interface WordListSelectorProps {
  wordLists: WordList[];
  categories: WordListCategory[];
  onSelectList: (words: string[]) => void;
  onAddList?: (name: string, words: string[]) => void;
  currentWords?: string[];
}

export function WordListSelector({ wordLists, categories, onSelectList, onAddList, currentWords = [] }: WordListSelectorProps) {
  const [open, setOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newListName, setNewListName] = useState('');

  const getCategoryColor = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.color || 'hsl(220, 60%, 50%)';
  };

  const getCategoryName = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.name || 'כללי';
  };

  const handleSelect = (list: WordList) => {
    onSelectList(list.words);
    setOpen(false);
  };

  const handleAddList = () => {
    if (newListName.trim() && onAddList && currentWords.length > 0) {
      onAddList(newListName.trim(), currentWords);
      setNewListName('');
      setShowAddForm(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-12 px-4 gap-2 rounded-xl border-2 border-gold bg-white text-navy hover:bg-gold hover:text-white shadow-lg font-semibold"
          title="טען רשימה שמורה"
        >
          <List className="w-6 h-6" />
          <span>טען רשימה</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-0 rounded-xl" 
        align="start"
        dir="rtl"
      >
        <div className="p-3 border-b bg-gold/5 flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-navy">רשימות שמורות</h4>
            <p className="text-xs text-muted-foreground">לחץ על רשימה להוספה לשדה הקלט</p>
          </div>
          {onAddList && (
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg border-gold/50 text-navy hover:bg-gold hover:text-white"
              onClick={() => setShowAddForm(!showAddForm)}
              title="הוסף רשימה חדשה"
            >
              <Plus className="w-5 h-5" />
            </Button>
          )}
        </div>
        
        {/* Add new list form */}
        {showAddForm && onAddList && (
          <div className="p-3 border-b bg-secondary/30 space-y-2">
            <p className="text-xs font-medium text-navy">שמור את הרשימה הנוכחית:</p>
            <div className="flex gap-2">
              <Input
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="שם הרשימה..."
                className="flex-1 h-9 rounded-lg text-sm"
                dir="rtl"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddList();
                  }
                }}
              />
              <Button
                size="sm"
                className="h-9 px-3 bg-gold hover:bg-gold/90 text-white rounded-lg"
                onClick={handleAddList}
                disabled={!newListName.trim() || currentWords.length === 0}
              >
                שמור
              </Button>
            </div>
            {currentWords.length === 0 && (
              <p className="text-xs text-destructive">הכנס מילים לשדה הקלט כדי לשמור</p>
            )}
            {currentWords.length > 0 && (
              <p className="text-xs text-muted-foreground">{currentWords.length} מילים יישמרו</p>
            )}
          </div>
        )}
        
        <ScrollArea className="h-64">
          <div className="p-2 space-y-1">
            {wordLists.length === 0 ? (
              <div className="p-6 text-center">
                <List className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground font-medium">אין רשימות שמורות</p>
                <p className="text-xs text-muted-foreground mt-1">לחץ על + כדי לשמור רשימה חדשה</p>
              </div>
            ) : (
              categories.map((category) => {
                const listsInCategory = wordLists.filter(l => l.category === category.id);
                if (listsInCategory.length === 0) return null;
                
                return (
                  <div key={category.id} className="mb-3">
                    <div className="flex items-center gap-2 px-2 py-1">
                      <div 
                        className="w-2 h-2 rounded-full" 
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="text-xs font-medium text-muted-foreground">
                        {category.name}
                      </span>
                    </div>
                    {listsInCategory.map((list) => (
                      <button
                        key={list.id}
                        onClick={() => handleSelect(list)}
                        className="w-full text-right p-2 rounded-lg hover:bg-secondary/50 transition-colors flex items-center justify-between group"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-sm text-navy">{list.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {list.words.length} מילים
                          </div>
                        </div>
                        <Check className="w-4 h-4 text-gold opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
