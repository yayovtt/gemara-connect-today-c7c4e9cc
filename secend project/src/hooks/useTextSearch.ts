import { useState, useCallback, useMemo } from 'react';
import { SearchCondition, SearchResult } from '@/types/search';

export function useTextSearch(text: string, conditions: SearchCondition[]) {
  const [results, setResults] = useState<SearchResult[]>([]);

  const search = useCallback(() => {
    if (!text.trim() || conditions.length === 0 || !conditions[0].term.trim()) {
      setResults([]);
      return;
    }

    // Split text into paragraphs/sentences
    const segments = text.split(/[\n]+/).filter(s => s.trim());
    const foundResults: SearchResult[] = [];

    // Helper function to normalize text for comparison
    const normalize = (str: string) => str.trim().toLowerCase();

    // Helper function to check proximity
    const checkProximity = (
      segmentText: string,
      baseTerm: string,
      nearTerm: string,
      range: number,
      direction: 'before' | 'after' | 'both'
    ): boolean => {
      const words = segmentText.split(/\s+/).filter(w => w.trim());
      const baseTermNorm = normalize(baseTerm);
      const nearTermNorm = normalize(nearTerm);

      const basePositions: number[] = [];
      words.forEach((word, idx) => {
        if (normalize(word).includes(baseTermNorm)) {
          basePositions.push(idx);
        }
      });

      if (basePositions.length === 0) return false;

      const nearPositions: number[] = [];
      words.forEach((word, idx) => {
        if (normalize(word).includes(nearTermNorm)) {
          nearPositions.push(idx);
        }
      });

      if (nearPositions.length === 0) return false;

      for (const basePos of basePositions) {
        for (const nearPos of nearPositions) {
          const distance = Math.abs(nearPos - basePos);
          
          if (distance <= range) {
            if (direction === 'both') {
              return true;
            } else if (direction === 'before' && nearPos < basePos) {
              return true;
            } else if (direction === 'after' && nearPos > basePos) {
              return true;
            }
          }
        }
      }

      return false;
    };

    // Helper function to check list condition
    const checkList = (
      segmentNorm: string,
      words: string[],
      mode: 'any' | 'all'
    ): { matches: boolean; matchedWords: string[] } => {
      const matchedWords: string[] = [];
      
      for (const word of words) {
        if (word.trim() && segmentNorm.includes(normalize(word))) {
          matchedWords.push(word);
        }
      }

      if (mode === 'any') {
        return { matches: matchedWords.length > 0, matchedWords };
      } else {
        return { matches: matchedWords.length === words.filter(w => w.trim()).length, matchedWords };
      }
    };

    segments.forEach((segment) => {
      const segmentNorm = normalize(segment);
      const matchedTerms: string[] = [];

      let hasRequiredTerms = true;
      let hasAnyOrTerm = false;
      let hasExcludedTerm = false;
      let nearConditionsPassed = true;
      let listConditionsPassed = true;

      const firstTerm = conditions[0]?.term || '';
      const firstTermFound = segmentNorm.includes(normalize(firstTerm));

      conditions.forEach((condition, condIdx) => {
        if (condIdx === 0) {
          if (!condition.term.trim()) return;
          const termNorm = normalize(condition.term);
          if (segmentNorm.includes(termNorm)) {
            matchedTerms.push(condition.term);
          } else {
            hasRequiredTerms = false;
          }
          return;
        }

        switch (condition.operator) {
          case 'AND':
            if (!condition.term.trim()) return;
            if (segmentNorm.includes(normalize(condition.term))) {
              matchedTerms.push(condition.term);
            } else {
              hasRequiredTerms = false;
            }
            break;

          case 'OR':
            if (!condition.term.trim()) return;
            if (segmentNorm.includes(normalize(condition.term))) {
              hasAnyOrTerm = true;
              matchedTerms.push(condition.term);
            }
            break;

          case 'NOT':
            if (!condition.term.trim()) return;
            if (segmentNorm.includes(normalize(condition.term))) {
              hasExcludedTerm = true;
            }
            break;

          case 'NEAR':
            if (!condition.term.trim()) return;
            if (firstTermFound) {
              const range = condition.proximityRange || 10;
              const direction = condition.proximityDirection || 'both';
              const isNear = checkProximity(segment, firstTerm, condition.term, range, direction);
              
              if (isNear) {
                matchedTerms.push(condition.term);
              } else {
                nearConditionsPassed = false;
              }
            } else {
              nearConditionsPassed = false;
            }
            break;

          case 'LIST':
            const listWords = condition.listWords || [];
            if (listWords.length === 0) return;
            
            const listMode = condition.listMode || 'any';
            const listResult = checkList(segmentNorm, listWords, listMode);
            
            if (listResult.matches) {
              matchedTerms.push(...listResult.matchedWords);
            } else {
              listConditionsPassed = false;
            }
            break;
        }
      });

      const hasOrConditions = conditions.some((c, i) => i > 0 && c.operator === 'OR');
      const hasNearConditions = conditions.some((c, i) => i > 0 && c.operator === 'NEAR');
      const hasListConditions = conditions.some((c, i) => i > 0 && c.operator === 'LIST' && (c.listWords?.length || 0) > 0);

      let matchesCriteria = false;

      if (hasOrConditions) {
        matchesCriteria = (hasRequiredTerms || hasAnyOrTerm) && !hasExcludedTerm;
      } else {
        matchesCriteria = hasRequiredTerms && !hasExcludedTerm;
      }

      if (hasNearConditions && !nearConditionsPassed) {
        matchesCriteria = false;
      }

      if (hasListConditions && !listConditionsPassed) {
        matchesCriteria = false;
      }

      if (matchesCriteria && matchedTerms.length > 0) {
        const startIndex = text.indexOf(segment);
        foundResults.push({
          text: segment.trim(),
          startIndex,
          endIndex: startIndex + segment.length,
          matchedTerms: [...new Set(matchedTerms)],
        });
      }
    });

    setResults(foundResults);
  }, [text, conditions]);

  const highlightedText = useMemo(() => {
    if (results.length === 0 || conditions.length === 0) return text;

    let highlighted = text;
    
    // Collect all terms including list words
    const allTerms: string[] = [];
    conditions.forEach(c => {
      if (c.operator === 'NOT') return;
      if (c.operator === 'LIST' && c.listWords) {
        allTerms.push(...c.listWords.filter(w => w.trim()));
      } else if (c.term.trim()) {
        allTerms.push(c.term);
      }
    });

    const uniqueTerms = [...new Set(allTerms)];
    
    uniqueTerms.forEach((term, idx) => {
      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escapedTerm})`, 'gi');
      const highlightClass = idx === 0 ? 'highlight-match' : 
                            idx === 1 ? 'highlight-match-secondary' : 
                            'highlight-match-tertiary';
      highlighted = highlighted.replace(regex, `<mark class="${highlightClass}">$1</mark>`);
    });

    return highlighted;
  }, [text, results, conditions]);

  return { results, search, highlightedText };
}
