import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  ListPlus, 
  Plus, 
  Trash2, 
  Edit2, 
  Copy,
  FolderOpen,
  Check,
  X
} from 'lucide-react';
import { WordList, WordListCategory } from '@/types/wordList';
import { toast } from '@/hooks/use-toast';

interface WordListManagerProps {
  wordLists: WordList[];
  categories: WordListCategory[];
  onAddList: (list: Omit<WordList, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateList: (id: string, updates: Partial<WordList>) => void;
  onDeleteList: (id: string) => void;
  onAddCategory: (category: Omit<WordListCategory, 'id'>) => void;
  onDeleteCategory: (id: string) => void;
}

export function WordListManager({
  wordLists,
  categories,
  onAddList,
  onUpdateList,
  onDeleteList,
  onAddCategory,
  onDeleteCategory,
}: WordListManagerProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingList, setEditingList] = useState<WordList | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    categoryId: '',
    wordsText: '',
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      categoryId: '',
      wordsText: '',
    });
  };

  const handleOpenAdd = () => {
    resetForm();
    setEditingList(null);
    setIsAddDialogOpen(true);
  };

  const handleOpenEdit = (list: WordList) => {
    setFormData({
      name: list.name,
      description: list.description || '',
      categoryId: list.categoryId || '',
      wordsText: list.words.join('\n'),
    });
    setEditingList(list);
    setIsAddDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast({
        title: 'שגיאה',
        description: 'נא להזין שם לרשימה',
        variant: 'destructive',
      });
      return;
    }

    const words = formData.wordsText
      .split(/[\n,]/)
      .map(w => w.trim())
      .filter(w => w.length > 0);

    if (words.length === 0) {
      toast({
        title: 'שגיאה',
        description: 'נא להזין לפחות מילה אחת',
        variant: 'destructive',
      });
      return;
    }

    if (editingList) {
      onUpdateList(editingList.id, {
        name: formData.name,
        description: formData.description || undefined,
        categoryId: formData.categoryId || undefined,
        words,
      });
      toast({
        title: 'עודכן',
        description: 'הרשימה עודכנה בהצלחה',
      });
    } else {
      onAddList({
        name: formData.name,
        description: formData.description || undefined,
        categoryId: formData.categoryId || undefined,
        words,
      });
      toast({
        title: 'נוסף',
        description: 'הרשימה נוספה בהצלחה',
      });
    }

    setIsAddDialogOpen(false);
    resetForm();
    setEditingList(null);
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) {
      toast({
        title: 'שגיאה',
        description: 'נא להזין שם לקטגוריה',
        variant: 'destructive',
      });
      return;
    }

    onAddCategory({
      name: newCategoryName,
      color: getRandomColor(),
    });

    setNewCategoryName('');
    setShowNewCategory(false);
    toast({
      title: 'נוסף',
      description: 'הקטגוריה נוספה בהצלחה',
    });
  };

  const copyListToClipboard = (list: WordList) => {
    navigator.clipboard.writeText(list.words.join('\n'));
    toast({
      title: 'הועתק',
      description: 'המילים הועתקו ללוח',
    });
  };

  const getListsByCategory = (categoryId?: string) => {
    return wordLists.filter(list => 
      categoryId ? list.categoryId === categoryId : !list.categoryId
    );
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <ListPlus className="h-5 w-5" />
            ניהול רשימות מילים
          </CardTitle>
          <Button onClick={handleOpenAdd}>
            <Plus className="h-4 w-4 mr-1" />
            רשימה חדשה
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Categories */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>קטגוריות</Label>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowNewCategory(!showNewCategory)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {showNewCategory && (
            <div className="flex gap-2">
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="שם קטגוריה..."
                className="flex-1"
              />
              <Button size="icon" onClick={handleAddCategory}>
                <Check className="h-4 w-4" />
              </Button>
              <Button 
                size="icon" 
                variant="ghost"
                onClick={() => {
                  setShowNewCategory(false);
                  setNewCategoryName('');
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {categories.map(category => (
              <Badge
                key={category.id}
                variant="outline"
                className="cursor-pointer"
                style={{ borderColor: category.color, color: category.color }}
              >
                {category.name}
                <button
                  className="mr-1 hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteCategory(category.id);
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

        {/* Word Lists */}
        <ScrollArea className="h-[400px]">
          <div className="space-y-6">
            {/* Uncategorized Lists */}
            {getListsByCategory().length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" />
                  ללא קטגוריה
                </h4>
                <div className="grid gap-2">
                  {getListsByCategory().map(list => (
                    <WordListCard
                      key={list.id}
                      list={list}
                      onEdit={() => handleOpenEdit(list)}
                      onDelete={() => onDeleteList(list.id)}
                      onCopy={() => copyListToClipboard(list)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Categorized Lists */}
            {categories.map(category => {
              const listsInCategory = getListsByCategory(category.id);
              if (listsInCategory.length === 0) return null;

              return (
                <div key={category.id} className="space-y-2">
                  <h4 
                    className="text-sm font-medium flex items-center gap-2"
                    style={{ color: category.color }}
                  >
                    <FolderOpen className="h-4 w-4" />
                    {category.name}
                  </h4>
                  <div className="grid gap-2">
                    {listsInCategory.map(list => (
                      <WordListCard
                        key={list.id}
                        list={list}
                        onEdit={() => handleOpenEdit(list)}
                        onDelete={() => onDeleteList(list.id)}
                        onCopy={() => copyListToClipboard(list)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {wordLists.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <ListPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>אין רשימות מילים</p>
                <p className="text-sm">לחץ על "רשימה חדשה" כדי להתחיל</p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Add/Edit Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingList ? 'עריכת רשימה' : 'רשימה חדשה'}
              </DialogTitle>
              <DialogDescription>
                הזן את פרטי רשימת המילים
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>שם הרשימה</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="לדוגמה: שמות תנאים"
                />
              </div>

              <div className="space-y-2">
                <Label>תיאור (אופציונלי)</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="תיאור קצר של הרשימה"
                />
              </div>

              <div className="space-y-2">
                <Label>קטגוריה (אופציונלי)</Label>
                <Select
                  value={formData.categoryId}
                  onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="בחר קטגוריה" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">ללא קטגוריה</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>מילים (מילה בכל שורה או מופרדות בפסיק)</Label>
                <Textarea
                  value={formData.wordsText}
                  onChange={(e) => setFormData({ ...formData, wordsText: e.target.value })}
                  placeholder="רבי עקיבא&#10;רבי מאיר&#10;רבי יהודה"
                  className="min-h-[150px] font-hebrew"
                  dir="rtl"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                ביטול
              </Button>
              <Button onClick={handleSave}>
                {editingList ? 'עדכן' : 'הוסף'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

interface WordListCardProps {
  list: WordList;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
}

function WordListCard({ list, onEdit, onDelete, onCopy }: WordListCardProps) {
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex-1 min-w-0">
        <h5 className="font-medium truncate">{list.name}</h5>
        {list.description && (
          <p className="text-sm text-muted-foreground truncate">{list.description}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {list.words.length} מילים
        </p>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onCopy}>
          <Copy className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
          <Edit2 className="h-4 w-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function getRandomColor(): string {
  const colors = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
    '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e',
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}
