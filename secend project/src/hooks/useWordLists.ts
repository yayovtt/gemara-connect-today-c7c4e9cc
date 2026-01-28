import { useState, useEffect, useCallback } from 'react';
import { WordList, WordListCategory } from '@/types/wordList';

const STORAGE_KEYS = {
  WORD_LISTS: 'smart-search-word-lists',
  CATEGORIES: 'smart-search-categories',
};

const DEFAULT_CATEGORIES: WordListCategory[] = [
  { id: 'general', name: 'כללי', color: 'hsl(220, 60%, 50%)' },
  { id: 'names', name: 'שמות', color: 'hsl(45, 90%, 50%)' },
  { id: 'places', name: 'מקומות', color: 'hsl(142, 71%, 45%)' },
  { id: 'concepts', name: 'מושגים', color: 'hsl(280, 60%, 50%)' },
];

export function useWordLists() {
  const [wordLists, setWordLists] = useState<WordList[]>([]);
  const [categories, setCategories] = useState<WordListCategory[]>(DEFAULT_CATEGORIES);

  // Load data on mount
  useEffect(() => {
    try {
      const savedLists = localStorage.getItem(STORAGE_KEYS.WORD_LISTS);
      if (savedLists) {
        setWordLists(JSON.parse(savedLists));
      }
      
      const savedCategories = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      if (savedCategories) {
        setCategories(JSON.parse(savedCategories));
      }
    } catch (e) {
      console.error('Failed to load word lists:', e);
    }
  }, []);

  // Save word lists
  const saveWordLists = useCallback((lists: WordList[]) => {
    try {
      localStorage.setItem(STORAGE_KEYS.WORD_LISTS, JSON.stringify(lists));
      setWordLists(lists);
    } catch (e) {
      console.error('Failed to save word lists:', e);
    }
  }, []);

  // Save categories
  const saveCategories = useCallback((cats: WordListCategory[]) => {
    try {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(cats));
      setCategories(cats);
    } catch (e) {
      console.error('Failed to save categories:', e);
    }
  }, []);

  // Add word list
  const addWordList = useCallback((name: string, words: string[], category: string = 'general') => {
    const newList: WordList = {
      id: crypto.randomUUID(),
      name,
      category,
      words: words.filter(w => w.trim()),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    const updated = [...wordLists, newList];
    saveWordLists(updated);
    return newList;
  }, [wordLists, saveWordLists]);

  // Update word list
  const updateWordList = useCallback((id: string, updates: Partial<Omit<WordList, 'id' | 'createdAt'>>) => {
    const updated = wordLists.map(list => 
      list.id === id 
        ? { ...list, ...updates, updatedAt: Date.now() }
        : list
    );
    saveWordLists(updated);
  }, [wordLists, saveWordLists]);

  // Delete word list
  const deleteWordList = useCallback((id: string) => {
    const updated = wordLists.filter(list => list.id !== id);
    saveWordLists(updated);
  }, [wordLists, saveWordLists]);

  // Add category
  const addCategory = useCallback((name: string, color: string) => {
    const newCategory: WordListCategory = {
      id: crypto.randomUUID(),
      name,
      color,
    };
    
    const updated = [...categories, newCategory];
    saveCategories(updated);
    return newCategory;
  }, [categories, saveCategories]);

  // Delete category
  const deleteCategory = useCallback((id: string) => {
    // Don't delete if it's a default category
    if (DEFAULT_CATEGORIES.some(c => c.id === id)) return;
    
    const updated = categories.filter(cat => cat.id !== id);
    saveCategories(updated);
    
    // Move lists in this category to 'general'
    const updatedLists = wordLists.map(list =>
      list.category === id ? { ...list, category: 'general' } : list
    );
    saveWordLists(updatedLists);
  }, [categories, wordLists, saveCategories, saveWordLists]);

  // Get lists by category
  const getListsByCategory = useCallback((categoryId: string) => {
    return wordLists.filter(list => list.category === categoryId);
  }, [wordLists]);

  return {
    wordLists,
    categories,
    addWordList,
    updateWordList,
    deleteWordList,
    addCategory,
    deleteCategory,
    getListsByCategory,
  };
}
