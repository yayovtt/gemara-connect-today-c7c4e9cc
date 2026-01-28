import { useState } from 'react';
import { SearchCondition, FilterRules } from '@/types/search';

export interface SearchTemplate {
  id: string;
  name: string;
  description?: string;
  conditions: SearchCondition[];
  filterRules: FilterRules;
  createdAt: Date;
  updatedAt: Date;
}

const STORAGE_KEY = 'advanced-search-templates';

// Hook for managing templates with localStorage
export function useSearchTemplates() {
  const [templates, setTemplates] = useState<SearchTemplate[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const saveToStorage = (newTemplates: SearchTemplate[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newTemplates));
    setTemplates(newTemplates);
  };

  const addTemplate = (template: Omit<SearchTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newTemplate: SearchTemplate = {
      ...template,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    saveToStorage([...templates, newTemplate]);
  };

  const updateTemplate = (id: string, updates: Partial<SearchTemplate>) => {
    saveToStorage(
      templates.map(t =>
        t.id === id ? { ...t, ...updates, updatedAt: new Date() } : t
      )
    );
  };

  const deleteTemplate = (id: string) => {
    saveToStorage(templates.filter(t => t.id !== id));
  };

  return {
    templates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
  };
}
