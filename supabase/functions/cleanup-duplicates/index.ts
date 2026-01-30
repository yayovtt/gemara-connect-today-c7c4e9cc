import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to strip HTML and count actual text
function stripHtmlAndCount(html: string | null): { text: string; wordCount: number } {
  if (!html) return { text: '', wordCount: 0 };
  // Remove HTML tags
  const text = html.replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Count Hebrew words (including with nikud)
  const words = text.split(/\s+/).filter(w => w.length > 0);
  return { text, wordCount: words.length };
}

// Check if two texts are similar (for duplicate detection)
function calculateSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, minWords = 50, similarityThreshold = 0.85 } = await req.json();

    if (action === "stats") {
      // Get statistics
      const { count: totalCount } = await supabase.from('psakei_din').select('*', { count: 'exact', head: true });
      
      // Get unique linked psak IDs
      const { data: linksData } = await supabase
        .from('sugya_psak_links')
        .select('psak_din_id');
      
      const linkedPsakIds = new Set((linksData || []).map(r => r.psak_din_id));
      const linkedCount = linkedPsakIds.size;

      // Find duplicates by title+court+year AND by content_hash
      const { data: allPsakim } = await supabase
        .from('psakei_din')
        .select('id, title, court, year, content_hash, summary, full_text');

      const seenTitles = new Map<string, string>();
      const seenHashes = new Map<string, string>();
      let duplicatesByTitle = 0;
      let duplicatesByHash = 0;
      let emptyOrShortCount = 0;
      
      for (const psak of allPsakim || []) {
        const titleKey = `${psak.title}-${psak.court}-${psak.year}`;
        
        // Check for empty or very short content
        const { wordCount: summaryWords } = stripHtmlAndCount(psak.summary);
        const { wordCount: fullTextWords } = stripHtmlAndCount(psak.full_text);
        const totalWords = summaryWords + fullTextWords;
        
        if (totalWords < minWords) {
          emptyOrShortCount++;
        }
        
        // Check title-based duplicate
        if (seenTitles.has(titleKey)) {
          duplicatesByTitle++;
        } else {
          seenTitles.set(titleKey, psak.id);
        }
        
        // Check hash-based duplicate (only if hash exists)
        if (psak.content_hash) {
          if (seenHashes.has(psak.content_hash)) {
            duplicatesByHash++;
          } else {
            seenHashes.set(psak.content_hash, psak.id);
          }
        }
      }

      // Total unique duplicates (some might be caught by both methods)
      const totalDuplicates = Math.max(duplicatesByTitle, duplicatesByHash);

      return new Response(
        JSON.stringify({
          success: true,
          stats: {
            total: totalCount || 0,
            linked: linkedCount,
            duplicates: totalDuplicates,
            duplicatesByTitle,
            duplicatesByHash,
            emptyOrShort: emptyOrShortCount,
            unlinked: (totalCount || 0) - linkedCount,
            minWordsThreshold: minWords,
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "find-problems") {
      // Find all problematic psakim (duplicates AND empty/short)
      const { data: allPsakim } = await supabase
        .from('psakei_din')
        .select('id, title, court, year, content_hash, summary, full_text, created_at')
        .order('created_at', { ascending: true });

      const problems: Array<{
        id: string;
        title: string;
        court: string;
        year: number;
        wordCount: number;
        reason: string[];
        duplicateOf?: string;
      }> = [];

      const seenTitles = new Map<string, { id: string; title: string }>();
      const seenHashes = new Map<string, { id: string; title: string }>();
      const seenContent = new Map<string, { id: string; title: string; text: string }>();
      
      for (const psak of allPsakim || []) {
        const reasons: string[] = [];
        let duplicateOf: string | undefined;
        const titleKey = `${psak.title}-${psak.court}-${psak.year}`;
        
        // Check for empty or very short content
        const { text: summaryText, wordCount: summaryWords } = stripHtmlAndCount(psak.summary);
        const { text: fullTextText, wordCount: fullTextWords } = stripHtmlAndCount(psak.full_text);
        const totalWords = summaryWords + fullTextWords;
        const combinedText = `${summaryText} ${fullTextText}`.trim();
        
        if (totalWords < minWords) {
          reasons.push(`תוכן קצר מדי (${totalWords} מילים, מינימום ${minWords})`);
        }
        
        // Check title-based duplicate
        if (seenTitles.has(titleKey)) {
          reasons.push('כפילות לפי כותרת');
          duplicateOf = seenTitles.get(titleKey)!.title;
        } else {
          seenTitles.set(titleKey, { id: psak.id, title: psak.title });
        }
        
        // Check hash-based duplicate
        if (psak.content_hash && seenHashes.has(psak.content_hash)) {
          if (!reasons.includes('כפילות לפי כותרת')) {
            reasons.push('כפילות לפי hash');
            duplicateOf = seenHashes.get(psak.content_hash)!.title;
          }
        } else if (psak.content_hash) {
          seenHashes.set(psak.content_hash, { id: psak.id, title: psak.title });
        }
        
        // Check content similarity (for texts without hash)
        if (combinedText.length > 100) {
          for (const [existingId, existing] of seenContent) {
            if (existingId !== psak.id) {
              const similarity = calculateSimilarity(combinedText, existing.text);
              if (similarity >= similarityThreshold) {
                if (!reasons.some(r => r.includes('כפילות'))) {
                  reasons.push(`דמיון תוכן גבוה (${Math.round(similarity * 100)}%)`);
                  duplicateOf = existing.title;
                }
                break;
              }
            }
          }
        }
        seenContent.set(psak.id, { id: psak.id, title: psak.title, text: combinedText });
        
        if (reasons.length > 0) {
          problems.push({
            id: psak.id,
            title: psak.title,
            court: psak.court,
            year: psak.year,
            wordCount: totalWords,
            reason: reasons,
            duplicateOf,
          });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          problems,
          total: problems.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete-selected") {
      const { ids } = await req.json();
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: "לא נבחרו פסקי דין למחיקה" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Delete related data first
      await supabase.from('sugya_psak_links').delete().in('psak_din_id', ids);
      await supabase.from('smart_index_results').delete().in('psak_din_id', ids);
      await supabase.from('faq_items').delete().in('psak_din_id', ids);
      await supabase.from('document_search_cache').delete().in('psak_din_id', ids);
      await supabase.from('pattern_sugya_links').delete().in('psak_din_id', ids);

      // Delete the psakim
      const { error } = await supabase.from('psakei_din').delete().in('id', ids);

      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, deleted: ids.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "cleanup") {
      // Find and remove duplicates by both title+court+year AND content_hash
      const { data: allPsakim } = await supabase
        .from('psakei_din')
        .select('id, title, court, year, content_hash, created_at')
        .order('created_at', { ascending: true });

      const seenTitles = new Map<string, string>();
      const seenHashes = new Map<string, string>();
      const toDelete = new Set<string>();
      
      for (const psak of allPsakim || []) {
        const titleKey = `${psak.title}-${psak.court}-${psak.year}`;
        
        // Check title-based duplicate
        if (seenTitles.has(titleKey)) {
          toDelete.add(psak.id);
          continue;
        }
        seenTitles.set(titleKey, psak.id);
        
        // Check hash-based duplicate
        if (psak.content_hash && seenHashes.has(psak.content_hash)) {
          toDelete.add(psak.id);
          continue;
        }
        if (psak.content_hash) {
          seenHashes.set(psak.content_hash, psak.id);
        }
      }

      const toDeleteArray = Array.from(toDelete);
      console.log(`Found ${toDeleteArray.length} duplicates to delete (by title and/or hash)`);

      if (toDeleteArray.length > 0) {
        // Delete links first
        const { error: linksError } = await supabase
          .from('sugya_psak_links')
          .delete()
          .in('psak_din_id', toDeleteArray);

        if (linksError) {
          console.error("Error deleting links:", linksError);
        }

        // Delete duplicates in batches
        const BATCH_SIZE = 100;
        for (let i = 0; i < toDeleteArray.length; i += BATCH_SIZE) {
          const batch = toDeleteArray.slice(i, i + BATCH_SIZE);
          const { error: deleteError } = await supabase
            .from('psakei_din')
            .delete()
            .in('id', batch);

          if (deleteError) {
            console.error("Error deleting duplicates batch:", deleteError);
          }
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          deleted: toDeleteArray.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get-unlinked") {
      // Get IDs of psakim without links
      const { data: linkedIds } = await supabase
        .from('sugya_psak_links')
        .select('psak_din_id');

      const linkedSet = new Set(linkedIds?.map(r => r.psak_din_id) || []);

      const { data: allPsakim } = await supabase
        .from('psakei_din')
        .select('id');

      const unlinked = (allPsakim || [])
        .filter(p => !linkedSet.has(p.id))
        .map(p => p.id);

      return new Response(
        JSON.stringify({
          success: true,
          unlinkedIds: unlinked,
          count: unlinked.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in cleanup-duplicates:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "שגיאה",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
