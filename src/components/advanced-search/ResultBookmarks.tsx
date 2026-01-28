import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bookmark, 
  Search, 
  Trash2,
  Copy,
  X,
  Tag
} from 'lucide-react';
import { SearchResult } from '@/types/search';
import { BookmarkedResult } from '@/hooks/useResultBookmarks';
import { toast } from '@/hooks/use-toast';

interface ResultBookmarksProps {
  bookmarks: BookmarkedResult[];
  onRemoveBookmark: (id: string) => void;
  onClearAll: () => void;
  onUpdateBookmark: (id: string, updates: Partial<BookmarkedResult>) => void;
  onResultClick?: (result: BookmarkedResult) => void;
}

export function ResultBookmarks({
  bookmarks,
  onRemoveBookmark,
  onClearAll,
  onUpdateBookmark,
  onResultClick,
}: ResultBookmarksProps) {
  const [filterText, setFilterText] = useState('');
  const [filterTag, setFilterTag] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    bookmarks.forEach(b => b.tags?.forEach(t => tags.add(t)));
    return Array.from(tags);
  }, [bookmarks]);

  const filteredBookmarks = useMemo(() => {
    let filtered = bookmarks;

    if (filterText) {
      const search = filterText.toLowerCase();
      filtered = filtered.filter(b => 
        b.text.toLowerCase().includes(search) ||
        b.notes?.toLowerCase().includes(search)
      );
    }

    if (filterTag) {
      filtered = filtered.filter(b => b.tags?.includes(filterTag));
    }

    return filtered.sort((a, b) => 
      new Date(b.bookmarkedAt).getTime() - new Date(a.bookmarkedAt).getTime()
    );
  }, [bookmarks, filterText, filterTag]);

  const copyBookmark = (bookmark: BookmarkedResult) => {
    navigator.clipboard.writeText(bookmark.text);
    toast({
      title: 'הועתק',
      description: 'הטקסט הועתק ללוח',
    });
  };

  const copyAllBookmarks = () => {
    const text = filteredBookmarks.map(b => b.text).join('\n\n---\n\n');
    navigator.clipboard.writeText(text);
    toast({
      title: 'הועתק',
      description: `${filteredBookmarks.length} סימניות הועתקו ללוח`,
    });
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('he-IL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Bookmark className="h-5 w-5" />
            סימניות
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{bookmarks.length}</Badge>
            {bookmarks.length > 0 && (
              <Button variant="ghost" size="sm" onClick={onClearAll}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        {bookmarks.length > 0 && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder="חפש בסימניות..."
                  className="pr-10"
                  dir="rtl"
                />
              </div>
              {filteredBookmarks.length > 0 && (
                <Button variant="outline" size="sm" onClick={copyAllBookmarks}>
                  <Copy className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Tags Filter */}
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {filterTag && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFilterTag(null)}
                    className="h-7"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
                {allTags.map(tag => (
                  <Badge
                    key={tag}
                    variant={filterTag === tag ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                  >
                    <Tag className="h-3 w-3 mr-1" />
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bookmarks List */}
        <ScrollArea className="h-[400px]">
          {bookmarks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bookmark className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">אין סימניות</p>
              <p className="text-xs mt-1">לחץ על סמל הסימנייה בתוצאות כדי לשמור</p>
            </div>
          ) : filteredBookmarks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">אין תוצאות התואמות לחיפוש</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredBookmarks.map((bookmark) => (
                <BookmarkCard
                  key={bookmark.id}
                  bookmark={bookmark}
                  onRemove={() => onRemoveBookmark(bookmark.id)}
                  onCopy={() => copyBookmark(bookmark)}
                  onClick={() => onResultClick?.(bookmark)}
                  formatDate={formatDate}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

interface BookmarkCardProps {
  bookmark: BookmarkedResult;
  onRemove: () => void;
  onCopy: () => void;
  onClick: () => void;
  formatDate: (date: Date) => string;
}

function BookmarkCard({ 
  bookmark, 
  onRemove, 
  onCopy, 
  onClick,
  formatDate 
}: BookmarkCardProps) {
  const displayText = bookmark.text.length > 150
    ? bookmark.text.slice(0, 150) + '...'
    : bookmark.text;

  return (
    <div
      className="p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Tags */}
          {bookmark.tags && bookmark.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {bookmark.tags.map(tag => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Text */}
          <p className="text-sm leading-relaxed" dir="rtl">
            {displayText}
          </p>

          {/* Notes */}
          {bookmark.notes && (
            <p className="text-xs text-muted-foreground mt-2 italic">
              {bookmark.notes}
            </p>
          )}

          {/* Meta */}
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span>מיקום: {bookmark.position}</span>
            <span>נשמר: {formatDate(bookmark.bookmarkedAt)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              onCopy();
            }}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}