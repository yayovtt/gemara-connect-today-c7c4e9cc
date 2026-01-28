export interface WordList {
  id: string;
  name: string;
  description?: string;
  category?: string;
  categoryId?: string;
  words: string[];
  createdAt: number;
  updatedAt: number;
}

export interface WordListCategory {
  id: string;
  name: string;
  color: string;
}
