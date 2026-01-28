import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { List, Check } from 'lucide-react';
import { WordList } from '@/types/wordList';

interface WordListSelectorProps {
  wordLists: WordList[];
  selectedListId?: string;
  onSelect: (listId: string | undefined) => void;
  multiple?: boolean;
  selectedListIds?: string[];
  onSelectMultiple?: (listIds: string[]) => void;
}

export function WordListSelector({
  wordLists,
  selectedListId,
  onSelect,
  multiple = false,
  selectedListIds = [],
  onSelectMultiple,
}: WordListSelectorProps) {
  if (multiple) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start">
            <List className="h-4 w-4 mr-2" />
            {selectedListIds.length > 0 ? (
              <>
                {selectedListIds.length} רשימות נבחרו
              </>
            ) : (
              'בחר רשימות מילים'
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <div className="space-y-1">
            {wordLists.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                אין רשימות מילים
              </p>
            ) : (
              wordLists.map((list) => {
                const isSelected = selectedListIds.includes(list.id);
                return (
                  <button
                    key={list.id}
                    className={`
                      w-full flex items-center justify-between px-3 py-2 rounded-md
                      text-sm hover:bg-muted transition-colors text-right
                      ${isSelected ? 'bg-muted' : ''}
                    `}
                    onClick={() => {
                      if (isSelected) {
                        onSelectMultiple?.(selectedListIds.filter(id => id !== list.id));
                      } else {
                        onSelectMultiple?.([...selectedListIds, list.id]);
                      }
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="truncate block">{list.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {list.words.length} מילים
                      </span>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Select value={selectedListId || ''} onValueChange={(value) => onSelect(value || undefined)}>
      <SelectTrigger>
        <SelectValue placeholder="בחר רשימת מילים" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="">ללא רשימה</SelectItem>
        {wordLists.map((list) => (
          <SelectItem key={list.id} value={list.id}>
            <div className="flex items-center gap-2">
              <span>{list.name}</span>
              <Badge variant="secondary" className="text-xs">
                {list.words.length}
              </Badge>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
