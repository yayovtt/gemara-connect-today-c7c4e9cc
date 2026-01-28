import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Filter, RotateCcw } from 'lucide-react';
import { SearchResult } from '@/types/search';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface ResultFiltersProps {
  results: SearchResult[];
  onFilteredResults: (filtered: SearchResult[]) => void;
}

export function ResultFilters({ results, onFilteredResults }: ResultFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [minPosition, setMinPosition] = useState(0);
  const [maxPosition, setMaxPosition] = useState(100);
  const [minContext, setMinContext] = useState(0);
  const [maxContext, setMaxContext] = useState(1000);
  const [filterByLength, setFilterByLength] = useState(false);
  const [minLength, setMinLength] = useState([0]);
  const [maxLength, setMaxLength] = useState([100]);

  const applyFilters = () => {
    let filtered = [...results];

    // Filter by position in text
    const textLength = results[0]?.text?.length || 0;
    const minPos = (minPosition / 100) * textLength;
    const maxPos = (maxPosition / 100) * textLength;
    
    filtered = filtered.filter(r => 
      r.startIndex >= minPos && r.startIndex <= maxPos
    );

    // Filter by context length
    filtered = filtered.filter(r => {
      const contextLength = r.text.length;
      return contextLength >= minContext && contextLength <= maxContext;
    });

    // Filter by matched term length
    if (filterByLength) {
      filtered = filtered.filter(r => {
        const termLength = r.matchedTerms[0]?.length || 0;
        return termLength >= minLength[0] && termLength <= maxLength[0];
      });
    }

    onFilteredResults(filtered);
  };

  const resetFilters = () => {
    setMinPosition(0);
    setMaxPosition(100);
    setMinContext(0);
    setMaxContext(1000);
    setFilterByLength(false);
    setMinLength([0]);
    setMaxLength([100]);
    onFilteredResults(results);
  };

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="bg-white rounded-2xl border border-gold p-4 shadow-md text-right"
    >
      <CollapsibleTrigger className="w-full flex items-center justify-between">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); resetFilters(); }}>
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); applyFilters(); }}>
            החל פילטרים
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-bold text-navy">פילטר תוצאות ({results.length})</span>
          <Filter className="w-5 h-5 text-gold" />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent className="pt-6 space-y-6">
        {/* Position Filter */}
        <div className="space-y-3">
          <Label className="text-navy font-bold">מיקום בטקסט (%)</Label>
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <Label className="text-sm text-muted-foreground">מינימום: {minPosition}%</Label>
              <Slider
                value={[minPosition]}
                onValueChange={([value]) => setMinPosition(value)}
                max={100}
                step={1}
                className="mt-2"
              />
            </div>
            <div className="flex-1">
              <Label className="text-sm text-muted-foreground">מקסימום: {maxPosition}%</Label>
              <Slider
                value={[maxPosition]}
                onValueChange={([value]) => setMaxPosition(value)}
                max={100}
                step={1}
                className="mt-2"
              />
            </div>
          </div>
        </div>

        {/* Context Length Filter */}
        <div className="space-y-3">
          <Label className="text-navy font-bold">אורך הקשר (תווים)</Label>
          <div className="flex gap-4 items-center">
            <Input
              type="number"
              value={minContext}
              onChange={(e) => setMinContext(Number(e.target.value))}
              placeholder="מינימום"
              className="text-right"
            />
            <span className="text-muted-foreground">-</span>
            <Input
              type="number"
              value={maxContext}
              onChange={(e) => setMaxContext(Number(e.target.value))}
              placeholder="מקסימום"
              className="text-right"
            />
          </div>
        </div>

        {/* Term Length Filter */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Switch
              checked={filterByLength}
              onCheckedChange={setFilterByLength}
            />
            <Label className="text-navy font-bold">סנן לפי אורך מילה</Label>
          </div>
          {filterByLength && (
            <div className="flex gap-4 items-center">
              <div className="flex-1">
                <Label className="text-sm text-muted-foreground">מינימום: {minLength[0]} תווים</Label>
                <Slider
                  value={minLength}
                  onValueChange={setMinLength}
                  max={50}
                  step={1}
                  className="mt-2"
                />
              </div>
              <div className="flex-1">
                <Label className="text-sm text-muted-foreground">מקסימום: {maxLength[0]} תווים</Label>
                <Slider
                  value={maxLength}
                  onValueChange={setMaxLength}
                  max={50}
                  step={1}
                  className="mt-2"
                />
              </div>
            </div>
          )}
        </div>

        {/* Apply/Reset Buttons */}
        <div className="flex gap-2 justify-end pt-4 border-t border-gold/30">
          <Button
            onClick={resetFilters}
            variant="outline"
            className="border-gold text-navy"
          >
            <RotateCcw className="w-4 h-4 ml-2" />
            איפוס פילטרים
          </Button>
          <Button
            onClick={applyFilters}
            className="bg-gold hover:bg-gold-dark text-navy"
          >
            <Filter className="w-4 h-4 ml-2" />
            החל פילטרים
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
