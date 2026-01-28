import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HealthCheckResult {
  name: string;
  nameHe: string;
  status: "success" | "warning" | "error";
  message: string;
  details?: Record<string, any>;
  duration?: number;
}

interface SystemHealthReport {
  timestamp: string;
  overallStatus: "success" | "warning" | "error";
  checks: HealthCheckResult[];
  summary: {
    total: number;
    passed: number;
    warnings: number;
    failed: number;
  };
}

async function measureAsync<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
  const start = Date.now();
  const result = await fn();
  return { result, duration: Date.now() - start };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const checks: HealthCheckResult[] = [];
  
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const runFullTest = body.fullTest === true;

    // ===== 1. Database Connection =====
    try {
      const { result, duration } = await measureAsync(async () => {
        const { count, error } = await supabase
          .from('psakei_din')
          .select('id', { count: 'exact', head: true });
        return { count, error };
      });
      
      if (result.error) throw result.error;
      
      checks.push({
        name: "database_connection",
        nameHe: "חיבור לבסיס נתונים",
        status: "success",
        message: `מחובר - ${result.count?.toLocaleString()} פסקי דין במערכת`,
        details: { documentCount: result.count },
        duration
      });
    } catch (error: any) {
      checks.push({
        name: "database_connection",
        nameHe: "חיבור לבסיס נתונים",
        status: "error",
        message: `שגיאה בחיבור: ${error.message}`
      });
    }

    // ===== 2. Search Cache Status =====
    try {
      const { result, duration } = await measureAsync(async () => {
        const { data, error } = await supabase
          .from('search_cache_stats')
          .select('*')
          .single();
        return { data, error };
      });

      if (result.error) throw result.error;
      
      const cached = result.data?.cached_documents || 0;
      const total = result.data?.total_documents || 0;
      const percent = total > 0 ? Math.round((cached / total) * 100) : 0;
      
      checks.push({
        name: "search_cache",
        nameHe: "מטמון חיפוש",
        status: percent >= 90 ? "success" : percent >= 50 ? "warning" : "error",
        message: `${cached.toLocaleString()} / ${total.toLocaleString()} מסמכים במטמון (${percent}%)`,
        details: { cached, total, percent },
        duration
      });
    } catch (error: any) {
      checks.push({
        name: "search_cache",
        nameHe: "מטמון חיפוש",
        status: "warning",
        message: `לא ניתן לבדוק מטמון: ${error.message}`
      });
    }

    // ===== 3. Sugya Links Status =====
    try {
      const { result, duration } = await measureAsync(async () => {
        const { count: linkCount, error: linkError } = await supabase
          .from('sugya_psak_links')
          .select('id', { count: 'exact', head: true });
        
        const { count: patternCount } = await supabase
          .from('pattern_sugya_links')
          .select('id', { count: 'exact', head: true });
          
        return { linkCount, patternCount, error: linkError };
      });

      if (result.error) throw result.error;
      
      const total = (result.linkCount || 0) + (result.patternCount || 0);
      
      checks.push({
        name: "sugya_links",
        nameHe: "קישורים לסוגיות",
        status: total > 0 ? "success" : "warning",
        message: `${total.toLocaleString()} קישורים (${result.linkCount?.toLocaleString()} AI + ${result.patternCount?.toLocaleString()} תבניות)`,
        details: { aiLinks: result.linkCount, patternLinks: result.patternCount, total },
        duration
      });
    } catch (error: any) {
      checks.push({
        name: "sugya_links",
        nameHe: "קישורים לסוגיות",
        status: "error",
        message: `שגיאה: ${error.message}`
      });
    }

    // ===== 4. Smart Index Results =====
    try {
      const { result, duration } = await measureAsync(async () => {
        const { count, error } = await supabase
          .from('smart_index_results')
          .select('id', { count: 'exact', head: true });
        return { count, error };
      });

      if (result.error) throw result.error;
      
      checks.push({
        name: "smart_index",
        nameHe: "אינדקס חכם",
        status: (result.count || 0) > 0 ? "success" : "warning",
        message: `${(result.count || 0).toLocaleString()} פסקים מאונדקסים`,
        details: { indexedCount: result.count },
        duration
      });
    } catch (error: any) {
      checks.push({
        name: "smart_index",
        nameHe: "אינדקס חכם",
        status: "warning",
        message: `לא ניתן לבדוק: ${error.message}`
      });
    }

    // ===== 5. AI Service (LOVABLE_API_KEY) =====
    try {
      const apiKey = Deno.env.get("LOVABLE_API_KEY");
      
      if (!apiKey) {
        checks.push({
          name: "ai_service",
          nameHe: "שירות AI",
          status: "error",
          message: "מפתח API לא מוגדר"
        });
      } else if (runFullTest) {
        // Actually test the AI
        const { result, duration } = await measureAsync(async () => {
          const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                { role: "user", content: "Reply with just: OK" }
              ],
              max_tokens: 10
            }),
          });
          return { ok: response.ok, status: response.status };
        });
        
        checks.push({
          name: "ai_service",
          nameHe: "שירות AI",
          status: result.ok ? "success" : "error",
          message: result.ok ? "שירות AI פעיל ומגיב" : `שגיאה: ${result.status}`,
          duration
        });
      } else {
        checks.push({
          name: "ai_service",
          nameHe: "שירות AI",
          status: "success",
          message: "מפתח API מוגדר (לא נבדק בפועל)"
        });
      }
    } catch (error: any) {
      checks.push({
        name: "ai_service",
        nameHe: "שירות AI",
        status: "error",
        message: `שגיאה: ${error.message}`
      });
    }

    // ===== 6. Sefaria API =====
    if (runFullTest) {
      try {
        const { result, duration } = await measureAsync(async () => {
          const response = await fetch("https://www.sefaria.org/api/texts/Bava_Metzia.2a?commentary=0");
          return { ok: response.ok, status: response.status };
        });
        
        checks.push({
          name: "sefaria_api",
          nameHe: "API ספריא",
          status: result.ok ? "success" : "warning",
          message: result.ok ? "ספריא מגיב" : `שגיאה: ${result.status}`,
          duration
        });
      } catch (error: any) {
        checks.push({
          name: "sefaria_api",
          nameHe: "API ספריא",
          status: "warning",
          message: `לא ניתן להתחבר: ${error.message}`
        });
      }
    }

    // ===== 7. Test Document Analysis (if fullTest) =====
    if (runFullTest) {
      try {
        const testText = "בבא מציעא דף ל עמוד א - השבת אבידה";
        
        const { result, duration } = await measureAsync(async () => {
          const response = await fetch(`${supabaseUrl}/functions/v1/analyze-psak-din`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${supabaseServiceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ text: testText, fileName: "test" }),
          });
          const data = await response.json();
          return { ok: response.ok, data };
        });

        const foundSources = result.data?.analysis?.sources?.length || 0;
        
        checks.push({
          name: "document_analysis",
          nameHe: "ניתוח מסמכים",
          status: result.ok && foundSources > 0 ? "success" : result.ok ? "warning" : "error",
          message: result.ok 
            ? `ניתוח עובד - זוהו ${foundSources} מקורות בטקסט לדוגמה`
            : `שגיאה: ${result.data?.error || "Unknown error"}`,
          details: { testResult: result.data?.analysis },
          duration
        });
      } catch (error: any) {
        checks.push({
          name: "document_analysis",
          nameHe: "ניתוח מסמכים",
          status: "error",
          message: `שגיאה: ${error.message}`
        });
      }
    }

    // ===== 8. Upload Function Test =====
    if (runFullTest) {
      try {
        const { result, duration } = await measureAsync(async () => {
          const response = await fetch(`${supabaseUrl}/functions/v1/upload-psak-din`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${supabaseServiceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ action: "health-check" }),
          });
          return { ok: response.ok, status: response.status };
        });

        checks.push({
          name: "upload_function",
          nameHe: "פונקציית העלאה",
          status: result.ok ? "success" : "warning",
          message: result.ok ? "פונקציית העלאה מגיבה" : `סטטוס: ${result.status}`,
          duration
        });
      } catch (error: any) {
        checks.push({
          name: "upload_function",
          nameHe: "פונקציית העלאה",
          status: "warning",
          message: `לא ניתן לבדוק: ${error.message}`
        });
      }
    }

    // ===== 9. Storage Buckets =====
    try {
      const { result, duration } = await measureAsync(async () => {
        const { data, error } = await supabase.storage.listBuckets();
        return { data, error };
      });

      if (result.error) throw result.error;
      
      const bucketNames = result.data?.map(b => b.name) || [];
      
      checks.push({
        name: "storage_buckets",
        nameHe: "אחסון קבצים",
        status: bucketNames.length > 0 ? "success" : "warning",
        message: `${bucketNames.length} buckets: ${bucketNames.join(", ")}`,
        details: { buckets: bucketNames },
        duration
      });
    } catch (error: any) {
      checks.push({
        name: "storage_buckets",
        nameHe: "אחסון קבצים",
        status: "warning",
        message: `לא ניתן לבדוק: ${error.message}`
      });
    }

    // ===== 10. Recent Activity =====
    try {
      const { result, duration } = await measureAsync(async () => {
        const { data, error } = await supabase
          .from('psakei_din')
          .select('created_at')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        return { data, error };
      });

      if (result.error && result.error.code !== 'PGRST116') throw result.error;
      
      if (result.data) {
        const lastAdd = new Date(result.data.created_at);
        const daysSince = Math.floor((Date.now() - lastAdd.getTime()) / (1000 * 60 * 60 * 24));
        
        checks.push({
          name: "recent_activity",
          nameHe: "פעילות אחרונה",
          status: daysSince < 7 ? "success" : daysSince < 30 ? "warning" : "error",
          message: daysSince === 0 
            ? "נוסף מסמך היום" 
            : `מסמך אחרון נוסף לפני ${daysSince} ימים`,
          details: { lastAddedAt: result.data.created_at, daysSince },
          duration
        });
      } else {
        checks.push({
          name: "recent_activity",
          nameHe: "פעילות אחרונה",
          status: "warning",
          message: "לא נמצאו מסמכים במערכת"
        });
      }
    } catch (error: any) {
      checks.push({
        name: "recent_activity",
        nameHe: "פעילות אחרונה",
        status: "warning",
        message: `לא ניתן לבדוק: ${error.message}`
      });
    }

    // Calculate summary
    const summary = {
      total: checks.length,
      passed: checks.filter(c => c.status === "success").length,
      warnings: checks.filter(c => c.status === "warning").length,
      failed: checks.filter(c => c.status === "error").length
    };

    const overallStatus: "success" | "warning" | "error" = 
      summary.failed > 0 ? "error" : 
      summary.warnings > 0 ? "warning" : "success";

    const report: SystemHealthReport = {
      timestamp: new Date().toISOString(),
      overallStatus,
      checks,
      summary
    };

    return new Response(
      JSON.stringify(report),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Health check error:", error);
    return new Response(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        overallStatus: "error",
        checks: [{
          name: "system",
          nameHe: "מערכת",
          status: "error",
          message: `שגיאה כללית: ${error instanceof Error ? error.message : "Unknown"}`
        }],
        summary: { total: 1, passed: 0, warnings: 0, failed: 1 }
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
