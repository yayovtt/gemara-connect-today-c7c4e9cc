import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PsakData {
  source_id: number;
  title: string;
  court: string;
  year: number;
  case_number: string;
  summary: string;
  full_text: string;
}

// Extract text content from HTML
function extractTextFromHtml(html: string): string {
  // Remove script and style tags
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  // Replace br and p tags with newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  // Remove all other HTML tags
  text = text.replace(/<[^>]+>/g, '');
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

// Parse psak din page
function parsePsakPage(html: string, sourceId: number): PsakData | null {
  try {
    // Extract title - look for common patterns
    let title = `פסק דין ${sourceId}`;
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i) ||
                       html.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
                       html.match(/<h2[^>]*>([^<]+)<\/h2>/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }

    // Extract court
    let court = 'לא ידוע';
    const courtPatterns = [
      /בית\s*(?:ה)?דין\s+(?:ה)?(?:רבני\s+)?(?:ה)?(?:גדול|אזורי|הגדול)?[^\n<]*/i,
      /בד"ר\s+[^\n<]*/i,
      /ביה"ד\s+[^\n<]*/i
    ];
    for (const pattern of courtPatterns) {
      const match = html.match(pattern);
      if (match) {
        court = extractTextFromHtml(match[0]).substring(0, 100);
        break;
      }
    }

    // Extract year
    let year = new Date().getFullYear();
    const yearMatch = html.match(/תש[א-ת]+"?[א-ת]|[12][09]\d{2}/);
    if (yearMatch) {
      const yearStr = yearMatch[0];
      if (/^\d{4}$/.test(yearStr)) {
        year = parseInt(yearStr);
      } else {
        // Hebrew year - approximate conversion
        year = 2020; // Default if can't parse
      }
    }

    // Extract case number
    let caseNumber = '';
    const caseMatch = html.match(/תיק\s*(?:מס['׳]?\.?\s*)?[\d\-\/]+/i) ||
                      html.match(/[\d]+[-\/][\d]+[-\/][\d]+/);
    if (caseMatch) {
      caseNumber = extractTextFromHtml(caseMatch[0]);
    }

    // Extract full text
    const fullText = extractTextFromHtml(html);
    
    // Create summary (first 500 chars)
    const summary = fullText.substring(0, 500) + (fullText.length > 500 ? '...' : '');

    return {
      source_id: sourceId,
      title,
      court,
      year,
      case_number: caseNumber,
      summary,
      full_text: fullText
    };
  } catch (error) {
    console.error(`Error parsing psak ${sourceId}:`, error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { startId, endId, batchSize = 10, tag = 'psakim.org' } = await req.json();

    if (!startId || !endId) {
      return new Response(
        JSON.stringify({ error: 'startId and endId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (startId > endId) {
      return new Response(
        JSON.stringify({ error: 'startId must be less than or equal to endId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results: { id: number; success: boolean; error?: string; title?: string }[] = [];
    const totalCount = endId - startId + 1;
    let processedCount = 0;
    let successCount = 0;
    let skipCount = 0;

    console.log(`Starting download of psakim from ${startId} to ${endId} (${totalCount} total)`);

    // Process in batches
    for (let batchStart = startId; batchStart <= endId; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize - 1, endId);
      const batchPromises: Promise<void>[] = [];

      for (let id = batchStart; id <= batchEnd; id++) {
        batchPromises.push((async () => {
          try {
            // Check if already exists
            const { data: existing } = await supabase
              .from('psakei_din')
              .select('id')
              .eq('source_id', id)
              .single();

            if (existing) {
              console.log(`Psak ${id} already exists, skipping`);
              results.push({ id, success: true, error: 'already exists' });
              skipCount++;
              processedCount++;
              return;
            }

            // Fetch from psakim.org
            const url = `https://www.psakim.org/Psakim/File/${id}`;
            console.log(`Fetching psak ${id} from ${url}`);
            
            const response = await fetch(url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'he,en;q=0.9'
              }
            });

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }

            const html = await response.text();
            
            // Check if page has content
            if (html.length < 500 || html.includes('404') || html.includes('not found')) {
              console.log(`Psak ${id} not found or empty`);
              results.push({ id, success: false, error: 'not found' });
              processedCount++;
              return;
            }

            // Parse the page
            const psakData = parsePsakPage(html, id);
            
            if (!psakData || !psakData.full_text || psakData.full_text.length < 100) {
              console.log(`Psak ${id} has no meaningful content`);
              results.push({ id, success: false, error: 'no content' });
              processedCount++;
              return;
            }

            // Save to database with custom tag
            const tags = [tag];
            if (tag !== 'psakim.org') {
              tags.push('psakim.org'); // Always include source
            }
            
            const { error: insertError } = await supabase
              .from('psakei_din')
              .insert({
                source_id: psakData.source_id,
                title: psakData.title,
                court: psakData.court,
                year: psakData.year,
                case_number: psakData.case_number,
                summary: psakData.summary,
                full_text: psakData.full_text,
                tags: tags
              });

            if (insertError) {
              throw new Error(insertError.message);
            }

            console.log(`Successfully saved psak ${id}: ${psakData.title}`);
            results.push({ id, success: true, title: psakData.title });
            successCount++;
            processedCount++;

          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`Error processing psak ${id}:`, error);
            results.push({ id, success: false, error: errorMessage });
            processedCount++;
          }
        })());
      }

      // Wait for batch to complete
      await Promise.all(batchPromises);
      
      // Small delay between batches to avoid rate limiting
      if (batchEnd < endId) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`Download complete: ${successCount} success, ${skipCount} skipped, ${processedCount - successCount - skipCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        total: totalCount,
        processed: processedCount,
        successful: successCount,
        skipped: skipCount,
        failed: processedCount - successCount - skipCount,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in download-psakim function:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
