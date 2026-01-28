import { useState } from 'react';
import { SearchResult } from '@/types/search';
import { toast } from '@/hooks/use-toast';

export interface BookmarkedResult extends SearchResult {
  bookmarkedAt: Date;
  tags?: string[];
  notes?: string;
}

const STORAGE_KEY = 'advanced-search-bookmarks';

// Hook for managing bookmarks with localStorage
export function useResultBookmarks() {
  const [bookmarks, setBookmarks] = useState<BookmarkedResult[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const saveToStorage = (newBookmarks: BookmarkedResult[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newBookmarks));
    setBookmarks(newBookmarks);
  };

  const addBookmark = (result: SearchResult, tags?: string[], notes?: string) => {
    const existing = bookmarks.find(b => b.id === result.id);
    if (existing) {
      toast({
        title: 'כבר קיים',
        description: 'התוצאה כבר נמצאת בסימניות',
      });
      return;
    }

    const newBookmark: BookmarkedResult = {
      ...result,
      bookmarkedAt: new Date(),
      tags,
      notes,
    };
    saveToStorage([newBookmark, ...bookmarks]);
  };

  const removeBookmark = (id: string) => {
    saveToStorage(bookmarks.filter(b => b.id !== id));
  };

  const updateBookmark = (id: string, updates: Partial<BookmarkedResult>) => {
    saveToStorage(
      bookmarks.map(b => (b.id === id ? { ...b, ...updates } : b))
    );
  };

  const clearAll = () => {
    saveToStorage([]);
  };

  const isBookmarked = (id: string) => bookmarks.some(b => b.id === id);

  return {
    bookmarks,
    addBookmark,
    removeBookmark,
    updateBookmark,
    clearAll,
    isBookmarked,
  };
}
