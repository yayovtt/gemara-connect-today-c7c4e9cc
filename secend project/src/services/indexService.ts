import { supabase } from '@/integrations/supabase/client';
import { TalmudReference } from '@/utils/talmudParser';

export interface Document {
  id: string;
  name: string;
  file_path: string | null;
  content: string | null;
  created_at: string;
  updated_at: string;
}

export interface Tractate {
  id: string;
  name: string;
  name_english: string | null;
  order_num: number;
}

export interface SourceReference {
  id: string;
  document_id: string;
  tractate_id: string;
  daf_number: number;
  amud: string;
  original_text: string;
  context: string | null;
  position_in_doc: number | null;
  created_at: string;
  tractate?: Tractate;
  document?: Document;
}

export interface CustomIndex {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

// Fetch all tractates
export async function fetchTractates(): Promise<Tractate[]> {
  const { data, error } = await supabase
    .from('tractates')
    .select('*')
    .order('order_num');
  
  if (error) throw error;
  return data || [];
}

// Sanitize filename for Supabase Storage (only ASCII allowed)
function sanitizeFileName(originalName: string): string {
  const extension = originalName.split('.').pop() || '';
  const nameWithoutExt = originalName.slice(0, originalName.lastIndexOf('.') || originalName.length);
  
  // Replace Hebrew and non-ASCII characters with underscore, keep alphanumeric
  const sanitized = nameWithoutExt
    .replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII
    .replace(/[^a-zA-Z0-9_-]/g, '_') // Replace special chars
    .replace(/_+/g, '_') // Collapse multiple underscores
    .replace(/^_|_$/g, '') || 'document'; // Remove leading/trailing underscores
  
  return `${Date.now()}-${sanitized}.${extension}`;
}

// Upload document file
export async function uploadDocument(file: File, originalName?: string): Promise<string> {
  const fileName = sanitizeFileName(file.name);
  const { data, error } = await supabase.storage
    .from('documents')
    .upload(fileName, file);
  
  if (error) throw error;
  return data.path;
}

// Create document record
export async function createDocument(name: string, content: string, filePath?: string): Promise<Document> {
  const { data, error } = await supabase
    .from('documents')
    .insert({ name, content, file_path: filePath || null })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// Fetch all documents
export async function fetchDocuments(): Promise<Document[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

// Delete document
export async function deleteDocument(id: string): Promise<void> {
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

// Save source references
export async function saveSourceReferences(
  documentId: string,
  references: TalmudReference[],
  tractates: Tractate[],
  fullText: string
): Promise<SourceReference[]> {
  const tractateMap = new Map(tractates.map(t => [t.name, t.id]));
  
  const toInsert = references
    .filter(ref => tractateMap.has(ref.tractate))
    .map(ref => ({
      document_id: documentId,
      tractate_id: tractateMap.get(ref.tractate)!,
      daf_number: ref.daf,
      amud: ref.amud,
      original_text: ref.originalText,
      context: fullText.substring(
        Math.max(0, ref.startIndex - 50),
        Math.min(fullText.length, ref.endIndex + 50)
      ),
      position_in_doc: ref.startIndex,
    }));
  
  if (toInsert.length === 0) return [];
  
  const { data, error } = await supabase
    .from('source_references')
    .insert(toInsert)
    .select();
  
  if (error) throw error;
  return data || [];
}

// Fetch references by document
export async function fetchReferencesByDocument(documentId: string): Promise<SourceReference[]> {
  const { data, error } = await supabase
    .from('source_references')
    .select(`
      *,
      tractate:tractates(*)
    `)
    .eq('document_id', documentId)
    .order('position_in_doc');
  
  if (error) throw error;
  return (data || []).map(d => ({
    ...d,
    tractate: d.tractate as Tractate,
  }));
}

// Fetch all references grouped by tractate
export async function fetchAllReferencesGrouped(): Promise<Map<string, SourceReference[]>> {
  const { data, error } = await supabase
    .from('source_references')
    .select(`
      *,
      tractate:tractates(*),
      document:documents(*)
    `)
    .order('daf_number')
    .order('amud');
  
  if (error) throw error;
  
  const grouped = new Map<string, SourceReference[]>();
  for (const ref of data || []) {
    const tractate = (ref.tractate as Tractate)?.name || 'לא ידוע';
    if (!grouped.has(tractate)) {
      grouped.set(tractate, []);
    }
    grouped.get(tractate)!.push({
      ...ref,
      tractate: ref.tractate as Tractate,
      document: ref.document as Document,
    });
  }
  
  return grouped;
}

// Create custom index
export async function createCustomIndex(name: string, description?: string): Promise<CustomIndex> {
  const { data, error } = await supabase
    .from('custom_indexes')
    .insert({ name, description: description || null })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// Fetch custom indexes
export async function fetchCustomIndexes(): Promise<CustomIndex[]> {
  const { data, error } = await supabase
    .from('custom_indexes')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

// Add references to index
export async function addReferencesToIndex(indexId: string, referenceIds: string[]): Promise<void> {
  const toInsert = referenceIds.map(refId => ({
    index_id: indexId,
    reference_id: refId,
  }));
  
  const { error } = await supabase
    .from('index_references')
    .upsert(toInsert, { onConflict: 'index_id,reference_id' });
  
  if (error) throw error;
}

// Fetch index with references
export async function fetchIndexWithReferences(indexId: string): Promise<{
  index: CustomIndex;
  references: SourceReference[];
}> {
  const { data: indexData, error: indexError } = await supabase
    .from('custom_indexes')
    .select('*')
    .eq('id', indexId)
    .single();
  
  if (indexError) throw indexError;
  
  const { data: refData, error: refError } = await supabase
    .from('index_references')
    .select(`
      reference:source_references(
        *,
        tractate:tractates(*),
        document:documents(*)
      )
    `)
    .eq('index_id', indexId);
  
  if (refError) throw refError;
  
  const references = (refData || [])
    .map(r => r.reference)
    .filter(Boolean)
    .map(ref => ({
      ...(ref as SourceReference),
      tractate: (ref as any).tractate as Tractate,
      document: (ref as any).document as Document,
    }));
  
  return { index: indexData, references };
}

// Delete custom index
export async function deleteCustomIndex(id: string): Promise<void> {
  const { error } = await supabase
    .from('custom_indexes')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}
