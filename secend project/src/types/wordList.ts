export interface WordList {
  id: string;
  name: string;
  category: string;
  words: string[];
  createdAt: number;
  updatedAt: number;
}

export interface WordListCategory {
  id: string;
  name: string;
  color: string;
}
