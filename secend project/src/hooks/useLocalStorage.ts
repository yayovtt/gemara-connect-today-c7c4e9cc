import { useState, useEffect, useCallback } from 'react';
import { SearchCondition } from '@/types/search';

export interface SearchHistoryItem {
  id: string;
  timestamp: number;
  text: string;
  conditions: SearchCondition[];
  resultsCount: number;
  matchedTerms: string[];
}

const STORAGE_KEYS = {
  TEXT: 'smart-search-text',
  CONDITIONS: 'smart-search-conditions',
  HISTORY: 'smart-search-history',
};

const MAX_HISTORY_ITEMS = 50;

export function useLocalStorage() {
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);

  // Load history on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.HISTORY);
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load history:', e);
    }
  }, []);

  // Save text to localStorage
  const saveText = useCallback((text: string) => {
    try {
      localStorage.setItem(STORAGE_KEYS.TEXT, text);
    } catch (e) {
      console.error('Failed to save text:', e);
    }
  }, []);

  // Load text from localStorage
  const loadText = useCallback((): string => {
    try {
      return localStorage.getItem(STORAGE_KEYS.TEXT) || '';
    } catch (e) {
      console.error('Failed to load text:', e);
      return '';
    }
  }, []);

  // Save conditions to localStorage
  const saveConditions = useCallback((conditions: SearchCondition[]) => {
    try {
      localStorage.setItem(STORAGE_KEYS.CONDITIONS, JSON.stringify(conditions));
    } catch (e) {
      console.error('Failed to save conditions:', e);
    }
  }, []);

  // Load conditions from localStorage
  const loadConditions = useCallback((): SearchCondition[] | null => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CONDITIONS);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error('Failed to load conditions:', e);
      return null;
    }
  }, []);

  // Add to search history
  const addToHistory = useCallback((
    text: string,
    conditions: SearchCondition[],
    resultsCount: number,
    matchedTerms: string[]
  ) => {
    const newItem: SearchHistoryItem = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      text: text.substring(0, 500), // Save first 500 chars for preview
      conditions,
      resultsCount,
      matchedTerms: [...new Set(matchedTerms)].slice(0, 10),
    };

    setHistory(prev => {
      const updated = [newItem, ...prev].slice(0, MAX_HISTORY_ITEMS);
      try {
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save history:', e);
      }
      return updated;
    });
  }, []);

  // Delete history item
  const deleteHistoryItem = useCallback((id: string) => {
    setHistory(prev => {
      const updated = prev.filter(item => item.id !== id);
      try {
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save history:', e);
      }
      return updated;
    });
  }, []);

  // Clear all history
  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEYS.HISTORY);
    } catch (e) {
      console.error('Failed to clear history:', e);
    }
  }, []);

  return {
    history,
    saveText,
    loadText,
    saveConditions,
    loadConditions,
    addToHistory,
    deleteHistoryItem,
    clearHistory,
  };
}
