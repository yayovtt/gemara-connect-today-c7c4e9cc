import { useState, useEffect } from 'react';
import { Settings, ListChecks, BookOpen, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WordListManager } from './WordListManager';
import { DocumentUploader } from './DocumentUploader';
import { IndexViewer } from './IndexViewer';
import { WordList, WordListCategory } from '@/types/wordList';
import { fetchTractates, Tractate } from '@/services/indexService';

interface SettingsButtonProps {
  wordLists: WordList[];
  categories: WordListCategory[];
  onAddList: (name: string, words: string[], category: string) => void;
  onUpdateList: (id: string, updates: Partial<Omit<WordList, 'id' | 'createdAt'>>) => void;
  onDeleteList: (id: string) => void;
  onAddCategory: (name: string, color: string) => void;
  onDeleteCategory: (id: string) => void;
}

export function SettingsButton({
  wordLists,
  categories,
  onAddList,
  onUpdateList,
  onDeleteList,
  onAddCategory,
  onDeleteCategory,
}: SettingsButtonProps) {
  const [open, setOpen] = useState(false);
  const [tractates, setTractates] = useState<Tractate[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (open) {
      fetchTractates().then(setTractates).catch(console.error);
    }
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-6 left-6 h-14 w-14 rounded-full bg-navy hover:bg-navy-light shadow-lg z-50 transition-all hover:scale-105"
        >
          <Settings className="w-6 h-6" />
        </Button>
      </SheetTrigger>
      <SheetContent 
        side="left" 
        className="w-full sm:max-w-lg p-0"
        dir="rtl"
      >
        <Tabs defaultValue="index" className="h-full flex flex-col">
          <SheetHeader className="p-6 pb-0">
            <SheetTitle className="text-right text-2xl font-bold text-navy">
              הגדרות ואינדקס
            </SheetTitle>
          </SheetHeader>
          
          <TabsList className="mx-6 mt-4 rounded-xl bg-secondary grid grid-cols-3">
            <TabsTrigger 
              value="index" 
              className="gap-1 rounded-lg data-[state=active]:bg-navy data-[state=active]:text-white text-xs"
            >
              <BookOpen className="w-3 h-3" />
              אינדקס
            </TabsTrigger>
            <TabsTrigger 
              value="upload" 
              className="gap-1 rounded-lg data-[state=active]:bg-navy data-[state=active]:text-white text-xs"
            >
              <Upload className="w-3 h-3" />
              העלאה
            </TabsTrigger>
            <TabsTrigger 
              value="lists" 
              className="gap-1 rounded-lg data-[state=active]:bg-navy data-[state=active]:text-white text-xs"
            >
              <ListChecks className="w-3 h-3" />
              רשימות
            </TabsTrigger>
          </TabsList>

          <TabsContent value="index" className="flex-1 p-6 pt-4 overflow-auto">
            <IndexViewer refreshTrigger={refreshTrigger} />
          </TabsContent>

          <TabsContent value="upload" className="flex-1 p-6 pt-4 overflow-auto">
            <DocumentUploader 
              tractates={tractates} 
              onDocumentProcessed={() => setRefreshTrigger(t => t + 1)} 
            />
          </TabsContent>

          <TabsContent value="lists" className="flex-1 p-6 pt-4 overflow-auto">
            <WordListManager
              wordLists={wordLists}
              categories={categories}
              onAddList={onAddList}
              onUpdateList={onUpdateList}
              onDeleteList={onDeleteList}
              onAddCategory={onAddCategory}
              onDeleteCategory={onDeleteCategory}
            />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
