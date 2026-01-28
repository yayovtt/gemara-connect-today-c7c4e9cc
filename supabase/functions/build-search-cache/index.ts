import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Strip HTML tags from text
function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { batchSize = 100, offset = 0 } = await req.json().catch(() => ({}));

    // Get documents that are not yet cached
    const { data: uncachedDocs, error: fetchError } = await supabase
      .from('psakei_din')
      .select('id, full_text')
      .not('id', 'in', 
        supabase.from('document_search_cache').select('psak_din_id')
      )
      .range(offset, offset + batchSize - 1);

    if (fetchError) {
      // Fallback: get all docs and filter manually
      const { data: allDocs, error: allError } = await supabase
        .from('psakei_din')
        .select('id, full_text')
        .range(offset, offset + batchSize - 1);
      
      if (allError) throw allError;

      // Get existing cache IDs
      const { data: cachedIds } = await supabase
        .from('document_search_cache')
        .select('psak_din_id');

      const cachedIdSet = new Set((cachedIds || []).map(c => c.psak_din_id));
      
      const docsToProcess = (allDocs || []).filter(d => !cachedIdSet.has(d.id));
      
      if (docsToProcess.length === 0) {
        // Get stats
        const { data: stats } = await supabase
          .from('search_cache_stats')
          .select('*')
          .single();

        return new Response(
          JSON.stringify({ 
            processed: 0, 
            message: 'Cache is complete',
            stats
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Process and insert
      const cacheEntries = docsToProcess.map(doc => {
        const strippedText = stripHtml(doc.full_text || '');
        const wordCount = strippedText.split(/\s+/).filter(w => w.length > 0).length;
        return {
          psak_din_id: doc.id,
          stripped_text: strippedText,
          word_count: wordCount
        };
      });

      const { error: insertError } = await supabase
        .from('document_search_cache')
        .upsert(cacheEntries, { onConflict: 'psak_din_id' });

      if (insertError) throw insertError;

      // Get updated stats
      const { data: stats } = await supabase
        .from('search_cache_stats')
        .select('*')
        .single();

      return new Response(
        JSON.stringify({ 
          processed: cacheEntries.length,
          stats
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process the uncached documents
    if (!uncachedDocs || uncachedDocs.length === 0) {
      const { data: stats } = await supabase
        .from('search_cache_stats')
        .select('*')
        .single();

      return new Response(
        JSON.stringify({ 
          processed: 0, 
          message: 'Cache is complete',
          stats
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cacheEntries = uncachedDocs.map(doc => {
      const strippedText = stripHtml(doc.full_text || '');
      const wordCount = strippedText.split(/\s+/).filter(w => w.length > 0).length;
      return {
        psak_din_id: doc.id,
        stripped_text: strippedText,
        word_count: wordCount
      };
    });

    const { error: insertError } = await supabase
      .from('document_search_cache')
      .upsert(cacheEntries, { onConflict: 'psak_din_id' });

    if (insertError) throw insertError;

    const { data: stats } = await supabase
      .from('search_cache_stats')
      .select('*')
      .single();

    return new Response(
      JSON.stringify({ 
        processed: cacheEntries.length,
        stats
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error building cache:", error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
