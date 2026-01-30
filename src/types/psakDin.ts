// Type definition for Psak Din
export interface PsakDin {
  id: string;
  title: string;
  court: string;
  year: number;
  summary: string;
  full_text?: string | null;
  case_number: string | null;  // Required but nullable to match SmartSearchPage
  tags?: string[] | null;
  source_url?: string | null;
  source_id?: number | null;
  content_hash?: string | null;
  created_at?: string;
  updated_at?: string;
}
