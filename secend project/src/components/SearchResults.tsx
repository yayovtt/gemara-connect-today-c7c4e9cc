import { useRef, useCallback, useState, useMemo } from 'react';
import { CheckCircle2, AlertCircle, MapPin, ChevronLeft, Eye } from 'lucide-react';
import { SearchResult } from '@/types/search';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SearchResultsProps {
  results: SearchResult[];
  highlightedText: string;
  hasSearched: boolean;
  textRef?: React.RefObject<HTMLDivElement>;
  originalText?: string;
}

export function SearchResults({ results, highlightedText, hasSearched, textRef, originalText = '' }: SearchResultsProps) {
  const highlightedTextRef = useRef<HTMLDivElement>(null);
  const [selectedResultIdx, setSelectedResultIdx] = useState<number | null>(null);
  const [showTextView, setShowTextView] = useState<boolean>(false);

  // Create highlighted version of original text with selected match emphasized
  const textWithHighlight = useMemo(() => {
    if (selectedResultIdx === null || !originalText || !results[selectedResultIdx]) {
      return originalText;
    }
    
    const result = results[selectedResultIdx];
    const matchedTerm = result.matchedTerms[0];
    if (!matchedTerm) return originalText;
    
    // Highlight the matched term in the original text
    const regex = new RegExp(`(${matchedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g');
    return originalText.replace(regex, '<mark class="bg-gold text-navy px-1 rounded font-bold">$1</mark>');
  }, [selectedResultIdx, originalText, results]);

  const scrollToMatch = useCallback((resultIndex: number, startIndex: number, matchedTerms: string[]) => {
    setSelectedResultIdx(resultIndex);
    setShowTextView(true); // Show text view when clicking a result
    
    const container = highlightedTextRef.current;
    if (!container) return;

    // Find all mark elements
    const marks = container.querySelectorAll('mark');
    let targetMark: Element | null = null;
    let matchCount = 0;
    
    // Find the specific mark by counting matches
    for (const mark of marks) {
      const markText = mark.textContent?.trim() || '';
      if (matchedTerms.some(term => markText === term || markText.includes(term) || term.includes(markText))) {
        if (matchCount === resultIndex) {
          targetMark = mark;
          break;
        }
        matchCount++;
      }
    }

    // If found, scroll and highlight
    if (targetMark) {
      // Remove previous highlights
      container.querySelectorAll('.active-highlight').forEach(el => {
        el.classList.remove('active-highlight');
        (el as HTMLElement).style.backgroundColor = '';
        (el as HTMLElement).style.boxShadow = '';
        (el as HTMLElement).style.transform = '';
      });
      
      // Add highlight to target with strong visual effect
      targetMark.classList.add('active-highlight');
      (targetMark as HTMLElement).style.backgroundColor = '#D4AF37';
      (targetMark as HTMLElement).style.boxShadow = '0 0 0 4px rgba(212, 175, 55, 0.6), 0 0 20px rgba(212, 175, 55, 0.4)';
      (targetMark as HTMLElement).style.transform = 'scale(1.1)';
      (targetMark as HTMLElement).style.transition = 'all 0.3s ease';
      (targetMark as HTMLElement).style.borderRadius = '4px';
      (targetMark as HTMLElement).style.padding = '2px 4px';
      
      targetMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Remove the glow after animation but keep highlighted
      setTimeout(() => {
        if (targetMark) {
          (targetMark as HTMLElement).style.boxShadow = '0 0 0 2px rgba(212, 175, 55, 0.4)';
          (targetMark as HTMLElement).style.transform = '';
        }
      }, 3000);
    }
  }, []);

  if (!hasSearched) {
    return (
      <div className="glass-effect rounded-2xl p-10 text-center animate-fade-in">
        <div className="text-muted-foreground">
          <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔍</span>
          </div>
          <p className="text-lg font-medium mb-2">הגדר מילות חיפוש ולחץ על כפתור החיפוש</p>
          <p className="text-sm">השתמש בבנאי השאילתות למעלה להגדרת תנאי החיפוש</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in text-right" dir="rtl">
      {/* Results summary */}
      <div className={`glass-effect rounded-2xl p-5 flex items-center gap-4 flex-row-reverse ${
        results.length > 0 
          ? 'border-success/30' 
          : 'border-warning/30'
      }`}>
        {results.length > 0 ? (
          <>
            <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-success" />
            </div>
            <div className="text-right flex-1">
              <span className="font-bold text-lg text-foreground">נמצאו {results.length} התאמות</span>
              <p className="text-sm text-muted-foreground">לחץ על תוצאה לניווט ישיר</p>
            </div>
          </>
        ) : (
          <>
            <div className="w-12 h-12 bg-warning/10 rounded-xl flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-warning" />
            </div>
            <div className="text-right flex-1">
              <span className="font-bold text-lg text-foreground">לא נמצאו התאמות</span>
              <p className="text-sm text-muted-foreground">נסה לשנות את מילות החיפוש</p>
            </div>
          </>
        )}
      </div>

      {results.length > 0 && (
        <div className="space-y-4">
          {/* Text view with highlighted match - shown when result is clicked */}
          {showTextView && selectedResultIdx !== null && (
            <div className="glass-effect rounded-2xl overflow-hidden animate-fade-in border border-gold">
              <div className="bg-white border border-gold px-5 py-4 flex items-center justify-between">
                <button 
                  onClick={() => setShowTextView(false)}
                  className="text-navy hover:text-navy/70 text-sm font-medium"
                >
                  ✕ סגור
                </button>
                <h3 className="font-bold text-lg text-navy text-right flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  מיקום בטקסט: "{results[selectedResultIdx]?.matchedTerms[0]}"
                </h3>
              </div>
              <ScrollArea className="h-[300px]">
                <div className="p-5">
                  <div
                    ref={highlightedTextRef}
                    className="text-foreground leading-loose whitespace-pre-wrap text-base text-right"
                    dir="rtl"
                    dangerouslySetInnerHTML={{ __html: textWithHighlight }}
                  />
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Results List */}
          <div className="glass-effect rounded-2xl overflow-hidden border border-gold">
            <div className="bg-white border border-gold px-5 py-4">
              <h3 className="font-bold text-lg text-navy text-right flex items-center gap-2 justify-end">
                <span>תוצאות ({results.length})</span>
                <MapPin className="w-5 h-5 text-gold" />
              </h3>
            </div>
            <ScrollArea className="h-[300px]">
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {results.map((result, idx) => (
                  <button
                    key={idx}
                    onClick={() => scrollToMatch(idx, result.startIndex, result.matchedTerms)}
                    className={`text-right p-4 rounded-xl border transition-all group animate-slide-up ${
                      selectedResultIdx === idx
                        ? 'bg-gold/20 border-gold shadow-lg ring-2 ring-gold'
                        : 'bg-secondary/30 hover:bg-gold/10 border-border hover:border-gold'
                    }`}
                    style={{ animationDelay: `${idx * 30}ms` }}
                  >
                    <div className="flex flex-col gap-2">
                      {/* Show matched term prominently */}
                      <div className="flex items-center gap-2 justify-between">
                        <ChevronLeft className="w-4 h-4 text-muted-foreground group-hover:text-gold transition-colors shrink-0" />
                        <Badge className="bg-gold text-navy font-bold text-sm px-3 py-1">
                          {result.matchedTerms[0]}
                        </Badge>
                      </div>
                      <p className="text-foreground text-xs leading-relaxed line-clamp-2" dir="rtl">
                        ...{result.text.substring(0, 60)}...
                      </p>
                      <span className="text-xs text-muted-foreground">מיקום: {result.startIndex}</span>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  );
}
