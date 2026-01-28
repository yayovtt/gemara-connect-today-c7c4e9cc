import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, TrendingUp } from 'lucide-react';
import { SearchCondition } from '@/types/search';

interface SearchSuggestionsProps {
  text: string;
  currentConditions: SearchCondition[];
  onApplySuggestion: (suggestion: string) => void;
}

export function SearchSuggestions({ text, currentConditions, onApplySuggestion }: SearchSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [relatedTerms, setRelatedTerms] = useState<string[]>([]);

  useEffect(() => {
    if (!text || text.length < 100) return;

    // Generate suggestions based on text analysis
    const words = text.split(/\s+/).filter(w => w.length > 3);
    const wordFrequency: Record<string, number> = {};

    // Count word frequency
    words.forEach(word => {
      const clean = word.replace(/[^\u0590-\u05FFa-zA-Z]/g, '');
      if (clean.length > 3) {
        wordFrequency[clean] = (wordFrequency[clean] || 0) + 1;
      }
    });

    // Get top frequent words
    const sortedWords = Object.entries(wordFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);

    setSuggestions(sortedWords);

    // Find related terms (words that appear near current search terms)
    if (currentConditions.length > 0) {
      const searchTerm = currentConditions[0].term;
      if (searchTerm) {
        const regex = new RegExp(`${searchTerm}.{0,50}`, 'gi');
        const matches = text.match(regex) || [];
        const nearby = matches.flatMap(m => 
          m.split(/\s+/).filter(w => 
            w.length > 3 && 
            !w.includes(searchTerm) &&
            /[\u0590-\u05FFa-zA-Z]/.test(w)
          )
        );
        
        const uniqueNearby = Array.from(new Set(nearby)).slice(0, 5);
        setRelatedTerms(uniqueNearby);
      }
    }
  }, [text, currentConditions]);

  if (suggestions.length === 0 && relatedTerms.length === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl border border-gold p-6 shadow-md text-right space-y-4">
      <div className="flex items-center gap-2 justify-end">
        <h3 className="font-bold text-lg text-navy">הצעות חיפוש חכמות</h3>
        <Lightbulb className="w-5 h-5 text-gold fill-gold" />
      </div>

      {/* Most Frequent Terms */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 justify-end text-sm text-muted-foreground">
            <span>מילים נפוצות בטקסט</span>
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            {suggestions.map((suggestion, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                onClick={() => onApplySuggestion(suggestion)}
                className="border-gold hover:bg-gold hover:text-navy transition-all"
              >
                {suggestion}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Related Terms */}
      {relatedTerms.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-gold/30">
          <div className="text-sm text-muted-foreground text-right">
            מילים קשורות לחיפוש הנוכחי:
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            {relatedTerms.map((term, idx) => (
              <Badge
                key={idx}
                variant="secondary"
                className="cursor-pointer hover:bg-gold hover:text-navy transition-all px-3 py-1"
                onClick={() => onApplySuggestion(term)}
              >
                {term}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="text-xs text-muted-foreground text-center pt-2 border-t border-gold/30">
        💡 לחץ על הצעה כדי להוסיף אותה כתנאי חיפוש חדש
      </div>
    </div>
  );
}
