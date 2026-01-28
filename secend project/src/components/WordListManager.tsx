import { useState } from 'react';
import { Plus, Trash2, Edit2, Save, X, FolderPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { WordList, WordListCategory } from '@/types/wordList';

interface WordListManagerProps {
  wordLists: WordList[];
  categories: WordListCategory[];
  onAddList: (name: string, words: string[], category: string) => void;
  onUpdateList: (id: string, updates: Partial<Omit<WordList, 'id' | 'createdAt'>>) => void;
  onDeleteList: (id: string) => void;
  onAddCategory: (name: string, color: string) => void;
  onDeleteCategory: (id: string) => void;
}

const CATEGORY_COLORS = [
  'hsl(220, 60%, 50%)',
  'hsl(45, 90%, 50%)',
  'hsl(142, 71%, 45%)',
  'hsl(280, 60%, 50%)',
  'hsl(0, 70%, 50%)',
  'hsl(180, 60%, 45%)',
];

export function WordListManager({
  wordLists,
  categories,
  onAddList,
  onUpdateList,
  onDeleteList,
  onAddCategory,
  onDeleteCategory,
}: WordListManagerProps) {
  const [isAddingList, setIsAddingList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListWords, setNewListWords] = useState('');
  const [newListCategory, setNewListCategory] = useState('general');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editWords, setEditWords] = useState('');
  
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState(CATEGORY_COLORS[0]);

  const handleAddList = () => {
    if (!newListName.trim()) return;
    
    const words = newListWords.split('\n').filter(w => w.trim());
    onAddList(newListName.trim(), words, newListCategory);
    
    setNewListName('');
    setNewListWords('');
    setNewListCategory('general');
    setIsAddingList(false);
  };

  const startEditing = (list: WordList) => {
    setEditingId(list.id);
    setEditName(list.name);
    setEditWords(list.words.join('\n'));
  };

  const handleSaveEdit = (id: string, category: string) => {
    if (!editName.trim()) return;
    
    const words = editWords.split('\n').filter(w => w.trim());
    onUpdateList(id, { name: editName.trim(), words, category });
    setEditingId(null);
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    onAddCategory(newCategoryName.trim(), newCategoryColor);
    setNewCategoryName('');
  };

  const getCategoryColor = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.color || 'hsl(220, 60%, 50%)';
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-navy">רשימות מילים</h3>
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 rounded-xl">
                <FolderPlus className="w-4 h-4" />
                קטגוריה
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md" dir="rtl">
              <DialogHeader>
                <DialogTitle>הוסף קטגוריה חדשה</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="שם הקטגוריה..."
                  className="rounded-xl"
                />
                <div className="flex gap-2 flex-wrap">
                  {CATEGORY_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewCategoryColor(color)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        newCategoryColor === color ? 'border-navy scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <Button onClick={handleAddCategory} className="w-full rounded-xl bg-navy">
                  הוסף קטגוריה
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          
          <Button 
            onClick={() => setIsAddingList(true)} 
            size="sm" 
            className="gap-2 rounded-xl bg-navy"
          >
            <Plus className="w-4 h-4" />
            רשימה חדשה
          </Button>
        </div>
      </div>

      {/* Add new list form */}
      {isAddingList && (
        <div className="bg-secondary/30 rounded-xl p-4 space-y-4 animate-fade-in border-2 border-gold/30">
          <Input
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder="שם הרשימה..."
            className="rounded-xl bg-white"
          />
          <Select value={newListCategory} onValueChange={setNewListCategory}>
            <SelectTrigger className="rounded-xl bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white rounded-xl">
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: cat.color }}
                    />
                    {cat.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            value={newListWords}
            onChange={(e) => setNewListWords(e.target.value)}
            placeholder="הזן מילים - כל שורה מילה אחת..."
            className="min-h-[100px] rounded-xl bg-white font-mono"
          />
          <div className="flex gap-2">
            <Button onClick={handleAddList} className="gap-2 rounded-xl bg-navy flex-1">
              <Save className="w-4 h-4" />
              שמור
            </Button>
            <Button 
              onClick={() => setIsAddingList(false)} 
              variant="outline" 
              className="gap-2 rounded-xl"
            >
              <X className="w-4 h-4" />
              ביטול
            </Button>
          </div>
        </div>
      )}

      {/* Categories and lists */}
      <ScrollArea className="h-[400px] pr-4">
        <Accordion type="multiple" className="space-y-2">
          {categories.map((category) => {
            const listsInCategory = wordLists.filter(l => l.category === category.id);
            
            return (
              <AccordionItem 
                key={category.id} 
                value={category.id}
                className="bg-white rounded-xl border-2 border-border/50 overflow-hidden"
              >
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-secondary/30">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: category.color }}
                    />
                    <span className="font-semibold text-navy">{category.name}</span>
                    <Badge variant="secondary" className="rounded-full">
                      {listsInCategory.length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  {listsInCategory.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">אין רשימות בקטגוריה זו</p>
                  ) : (
                    <div className="space-y-3">
                      {listsInCategory.map((list) => (
                        <div 
                          key={list.id} 
                          className="bg-secondary/30 rounded-xl p-3 space-y-2"
                        >
                          {editingId === list.id ? (
                            <div className="space-y-3">
                              <Input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="rounded-lg bg-white"
                              />
                              <Select 
                                value={list.category} 
                                onValueChange={(val) => onUpdateList(list.id, { category: val })}
                              >
                                <SelectTrigger className="rounded-lg bg-white">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-white rounded-lg">
                                  {categories.map((cat) => (
                                    <SelectItem key={cat.id} value={cat.id}>
                                      <div className="flex items-center gap-2">
                                        <div 
                                          className="w-3 h-3 rounded-full" 
                                          style={{ backgroundColor: cat.color }}
                                        />
                                        {cat.name}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Textarea
                                value={editWords}
                                onChange={(e) => setEditWords(e.target.value)}
                                className="min-h-[80px] rounded-lg bg-white font-mono text-sm"
                              />
                              <div className="flex gap-2">
                                <Button 
                                  onClick={() => handleSaveEdit(list.id, list.category)} 
                                  size="sm"
                                  className="gap-1 rounded-lg bg-navy"
                                >
                                  <Save className="w-3 h-3" />
                                  שמור
                                </Button>
                                <Button 
                                  onClick={() => setEditingId(null)} 
                                  size="sm"
                                  variant="outline"
                                  className="gap-1 rounded-lg"
                                >
                                  <X className="w-3 h-3" />
                                  ביטול
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-navy">{list.name}</span>
                                <div className="flex gap-1">
                                  <Button
                                    onClick={() => startEditing(list)}
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 rounded-lg hover:bg-navy/10"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    onClick={() => onDeleteList(list.id)}
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 rounded-lg hover:bg-destructive/10 text-destructive"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {list.words.slice(0, 8).map((word, idx) => (
                                  <Badge 
                                    key={idx} 
                                    variant="outline" 
                                    className="rounded-full text-xs"
                                    style={{ borderColor: getCategoryColor(list.category) }}
                                  >
                                    {word}
                                  </Badge>
                                ))}
                                {list.words.length > 8 && (
                                  <Badge variant="secondary" className="rounded-full text-xs">
                                    +{list.words.length - 8}
                                  </Badge>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </ScrollArea>
    </div>
  );
}
