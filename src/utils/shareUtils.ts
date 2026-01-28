import { SearchCondition, FilterRules } from '@/types/search';

// Utility function to parse shared search from URL
export function parseSharedSearch(url: string): {
  text?: string;
  conditions?: SearchCondition[];
  filterRules?: FilterRules;
} | null {
  try {
    const urlObj = new URL(url);
    const searchParam = urlObj.searchParams.get('search');
    if (!searchParam) return null;

    const decoded = JSON.parse(decodeURIComponent(atob(searchParam)));
    return decoded;
  } catch (error) {
    console.error('Error parsing shared search:', error);
    return null;
  }
}
