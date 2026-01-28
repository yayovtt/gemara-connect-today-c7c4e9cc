import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Search, 
  List,
  Grid,
  ArrowUpDown,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  FileText,
  MapPin
} from 'lucide-react';
import { SearchResult } from '@/types/search';
import { toast } from '@/hooks/use-toast';

interface SearchResultsProps {
  results: SearchResult[];
  isSearching: boolean;
  onBookmark?: (result: SearchResult) => void;
  bookmarkedIds?: Set<string>;
  onResultClick?: (result: SearchResult) => void;
}

type ViewMode = 'list' | 'grid';
type SortBy = 'relevance' | 'position' | 'length';

export function SearchResults({
  results,
  isSearching,
  onBookmark,
  bookmarkedIds = new Set(),
  onResultClick,
}: SearchResultsProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortBy, setSortBy] = useState<SortBy>('relevance');
  const [filterText, setFilterText] = useState('');
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  const filteredAndSortedResults = useMemo(() => {
    let filtered = results;

    // Filter by text
    if (filterText) {
      const searchLower = filterText.toLowerCase();
      filtered = filtered.filter(
        r => r.text.toLowerCase().includes(searchLower) ||
             r.context?.toLowerCase().includes(searchLower)
      );
    }

    // Sort
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'relevance':
          return (b.score || 0) - (a.score || 0);
        case 'position':
          return a.position - b.position;
        case 'length':
          return b.text.length - a.text.length;
        default:
          return 0;
      }
    });
  }, [results, filterText, sortBy]);

  const toggleExpanded = (id: string) => {
    setExpandedResults(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const copyResult = (result: SearchResult) => {
    navigator.clipboard.writeText(result.text);
    toast({
      title: 'הועתק',
      description: 'הטקסט הועתק ללוח',
    });
  };

  const copyAllResults = () => {
    const text = filteredAndSortedResults.map(r => r.text).join('\n\n---\n\n');
    navigator.clipboard.writeText(text);
    toast({
      title: 'הועתק',
      description: `${filteredAndSortedResults.length} תוצאות הועתקו ללוח`,
    });
  };

  if (isSearching) {
    return (
      <Card className="w-full">
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
            <p className="text-muted-foreground">מחפש...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <FileText className="h-5 w-5" />
            תוצאות חיפוש
          </CardTitle>
          <Badge variant="secondary">
            {filteredAndSortedResults.length} מתוך {results.length} תוצאות
          </Badge>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="סנן תוצאות..."
              className="pr-10"
              dir="rtl"
            />
          </div>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
            <SelectTrigger className="w-32">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">רלוונטיות</SelectItem>
              <SelectItem value="position">מיקום</SelectItem>
              <SelectItem value="length">אורך</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex border rounded-md">
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              className="rounded-r-none"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              className="rounded-l-none"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="h-4 w-4" />
            </Button>
          </div>

          {filteredAndSortedResults.length > 0 && (
            <Button variant="outline" size="sm" onClick={copyAllResults}>
              <Copy className="h-4 w-4 mr-1" />
              העתק הכל
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {filteredAndSortedResults.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            {results.length === 0 ? (
              <>
                <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>אין תוצאות להצגה</p>
                <p className="text-sm mt-1">הזן טקסט והגדר תנאי חיפוש</p>
              </>
            ) : (
              <>
                <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>אין תוצאות התואמות לסינון</p>
              </>
            )}
          </div>
        ) : (
          <ScrollArea className="h-[500px]">
            <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-4' : 'space-y-4'}>
              {filteredAndSortedResults.map((result) => (
                <ResultCard
                  key={result.id}
                  result={result}
                  isExpanded={expandedResults.has(result.id)}
                  isBookmarked={bookmarkedIds.has(result.id)}
                  onToggleExpand={() => toggleExpanded(result.id)}
                  onBookmark={() => onBookmark?.(result)}
                  onCopy={() => copyResult(result)}
                  onClick={() => onResultClick?.(result)}
                  compact={viewMode === 'grid'}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

interface ResultCardProps {
  result: SearchResult;
  isExpanded: boolean;
  isBookmarked: boolean;
  onToggleExpand: () => void;
  onBookmark: () => void;
  onCopy: () => void;
  onClick: () => void;
  compact?: boolean;
}

function ResultCard({
  result,
  isExpanded,
  isBookmarked,
  onToggleExpand,
  onBookmark,
  onCopy,
  onClick,
  compact = false,
}: ResultCardProps) {
  const displayText = isExpanded || compact
    ? result.text
    : result.text.length > 200
      ? result.text.slice(0, 200) + '...'
      : result.text;

  return (
    <div
      className={`
        border rounded-lg p-3 transition-colors hover:bg-muted/50 cursor-pointer
        ${compact ? 'text-sm' : ''}
      `}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            <MapPin className="h-3 w-3 mr-1" />
            {result.position}
          </Badge>
          {result.score !== undefined && (
            <Badge variant="secondary" className="text-xs">
              {Math.round(result.score * 100)}%
            </Badge>
          )}
          {result.matchedTerms && result.matchedTerms.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {result.matchedTerms.slice(0, 3).map((term, i) => (
                <Badge key={i} variant="default" className="text-xs">
                  {term}
                </Badge>
              ))}
              {result.matchedTerms.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{result.matchedTerms.length - 3}
                </Badge>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onBookmark();
            }}
          >
            {isBookmarked ? (
              <BookmarkCheck className="h-4 w-4 text-primary" />
            ) : (
              <Bookmark className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onCopy();
            }}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Text Content */}
      <div
        className="text-sm leading-relaxed whitespace-pre-wrap"
        dir="rtl"
        dangerouslySetInnerHTML={{ __html: result.highlightedText || displayText }}
      />

      {/* Context */}
      {result.context && isExpanded && (
        <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
          <strong>הקשר:</strong> {result.context}
        </div>
      )}

      {/* Expand Button */}
      {result.text.length > 200 && !compact && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 w-full"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-4 w-4 mr-1" />
              הצג פחות
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4 mr-1" />
              הצג עוד
            </>
          )}
        </Button>
      )}
    </div>
  );
}
