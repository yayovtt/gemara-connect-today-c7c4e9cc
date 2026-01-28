import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Test cases with known expected results
const TEST_CASES = [
  {
    id: "test_1_simple_reference",
    name: "מקור פשוט - בבא מציעא",
    text: "על פי הגמרא בבבא מציעא דף ל עמוד א, המוצא אבידה חייב להכריז עליה.",
    expected: {
      masechet: "Bava Metzia",
      daf: 30,
      amud: "א"
    }
  },
  {
    id: "test_2_hebrew_numbers",
    name: "מספרים בעברית - ל\"א",
    text: "כפי שנפסק בגמרא במסכת בבא קמא דף ל\"א עמוד ב, הנזק משתלם מגופו.",
    expected: {
      masechet: "Bava Kamma",
      daf: 31,
      amud: "ב"
    }
  },
  {
    id: "test_3_spelled_numbers",
    name: "מספרים מילוליים - חמישים ושלוש",
    text: "בגמרא סנהדרין דף חמישים ושלוש עמוד א מבואר דין עדים זוממין.",
    expected: {
      masechet: "Sanhedrin",
      daf: 53,
      amud: "א"
    }
  },
  {
    id: "test_4_multiple_refs",
    name: "מספר מקורות",
    text: "הסוגיא מתחילה בבבא בתרא דף ג עמוד א וממשיכה עד דף ה עמוד ב. יש להשוות לגיטין דף נ עמוד א.",
    expected: [
      { masechet: "Bava Batra", daf: 3, amud: "א" },
      { masechet: "Bava Batra", daf: 5, amud: "ב" },
      { masechet: "Gittin", daf: 50, amud: "א" }
    ]
  },
  {
    id: "test_5_abbreviation",
    name: "קיצור מסכת - ב\"מ",
    text: "עיין ב\"מ פד: ובתוס' שם.",
    expected: {
      masechet: "Bava Metzia",
      daf: 84,
      amud: "ב"
    }
  },
  {
    id: "test_6_colon_notation",
    name: "סימון נקודותיים - פד:",
    text: "ראה שבת פד: וברש\"י שם.",
    expected: {
      masechet: "Shabbat",
      daf: 84,
      amud: "ב"
    }
  },
  {
    id: "test_7_dot_notation",
    name: "סימון נקודה - פד.",
    text: "כדאיתא בפסחים קיב. דאמר רב.",
    expected: {
      masechet: "Pesachim",
      daf: 112,
      amud: "א"
    }
  },
  {
    id: "test_8_three_digit",
    name: "דף תלת ספרתי - קעו",
    text: "בבא בתרא דף קעו עמוד ב - זה הדף האחרון במסכת.",
    expected: {
      masechet: "Bava Batra",
      daf: 176,
      amud: "ב"
    }
  },
  {
    id: "test_9_no_amud",
    name: "ללא עמוד",
    text: "במסכת ברכות דף ב מבואר עניין קריאת שמע.",
    expected: {
      masechet: "Berakhot",
      daf: 2,
      amud: null // Either amud or default to א
    }
  },
  {
    id: "test_10_context_only",
    name: "נושא בלבד - השבת אבידה",
    text: "פסק דין בעניין השבת אבידה. התובע מצא חפץ ברחוב והנתבע טוען שהוא הבעלים.",
    expectedTopic: "השבת אבידה",
    expectedMasechet: "Bava Metzia" // Common association
  }
];

interface SourceMatch {
  masechet: string;
  masechetEnglish?: string;
  daf: number;
  amud?: string;
}

interface ValidationResult {
  testId: string;
  testName: string;
  inputText: string;
  expected: any;
  actual: SourceMatch[];
  passed: boolean;
  accuracy: number;
  details: string;
  duration: number;
}

interface ValidationReport {
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  overallAccuracy: number;
  results: ValidationResult[];
  summary: {
    perfectMatches: number;
    partialMatches: number;
    noMatches: number;
    falsePositives: number;
  };
}

function normalizeAmud(amud: string | null | undefined): string | null {
  if (!amud) return null;
  const cleaned = amud.trim().toLowerCase();
  if (cleaned === 'א' || cleaned === 'a' || cleaned === '1') return 'א';
  if (cleaned === 'ב' || cleaned === 'b' || cleaned === '2') return 'ב';
  return amud;
}

function compareSources(expected: any, actual: SourceMatch[]): { matched: boolean; accuracy: number; details: string } {
  if (!actual || actual.length === 0) {
    return { matched: false, accuracy: 0, details: "לא זוהו מקורות" };
  }

  // Handle single expected source
  if (!Array.isArray(expected)) {
    expected = [expected];
  }

  let matchedCount = 0;
  const details: string[] = [];

  for (const exp of expected) {
    const match = actual.find(act => {
      const masechetMatch = 
        act.masechetEnglish?.toLowerCase() === exp.masechet?.toLowerCase() ||
        act.masechet === exp.masechet;
      
      const dafMatch = act.daf === exp.daf;
      
      // Amud matching - flexible
      const expAmud = normalizeAmud(exp.amud);
      const actAmud = normalizeAmud(act.amud);
      const amudMatch = !expAmud || expAmud === actAmud;

      return masechetMatch && dafMatch && amudMatch;
    });

    if (match) {
      matchedCount++;
      details.push(`✓ ${exp.masechet} ${exp.daf}${exp.amud || ''}`);
    } else {
      details.push(`✗ חסר: ${exp.masechet} ${exp.daf}${exp.amud || ''}`);
    }
  }

  // Check for false positives
  const extraSources = actual.filter(act => {
    return !expected.some((exp: any) => {
      const masechetMatch = 
        act.masechetEnglish?.toLowerCase() === exp.masechet?.toLowerCase() ||
        act.masechet === exp.masechet;
      return masechetMatch && act.daf === exp.daf;
    });
  });

  if (extraSources.length > 0) {
    details.push(`⚠️ מקורות נוספים שזוהו: ${extraSources.map(s => `${s.masechet || s.masechetEnglish} ${s.daf}`).join(', ')}`);
  }

  const accuracy = expected.length > 0 ? (matchedCount / expected.length) * 100 : 0;
  const matched = matchedCount === expected.length && extraSources.length === 0;

  return { matched, accuracy, details: details.join('\n') };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const body = await req.json().catch(() => ({}));
    const testIds = body.testIds as string[] | undefined;
    
    // Filter test cases if specific IDs provided
    const testsToRun = testIds 
      ? TEST_CASES.filter(t => testIds.includes(t.id))
      : TEST_CASES;

    const results: ValidationResult[] = [];
    let perfectMatches = 0;
    let partialMatches = 0;
    let noMatches = 0;
    let falsePositives = 0;

    for (const testCase of testsToRun) {
      const start = Date.now();
      
      try {
        // Call the analyze function
        const response = await fetch(`${supabaseUrl}/functions/v1/analyze-psak-din`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ 
            text: testCase.text, 
            fileName: testCase.id 
          }),
        });

        const data = await response.json();
        const duration = Date.now() - start;

        if (!response.ok || !data.success) {
          results.push({
            testId: testCase.id,
            testName: testCase.name,
            inputText: testCase.text,
            expected: testCase.expected,
            actual: [],
            passed: false,
            accuracy: 0,
            details: `שגיאה: ${data.error || response.status}`,
            duration
          });
          noMatches++;
          continue;
        }

        const actualSources: SourceMatch[] = (data.analysis?.sources || []).map((s: any) => ({
          masechet: s.masechet,
          masechetEnglish: s.masechetEnglish,
          daf: s.daf,
          amud: s.amud
        }));

        const comparison = compareSources(testCase.expected, actualSources);

        results.push({
          testId: testCase.id,
          testName: testCase.name,
          inputText: testCase.text,
          expected: testCase.expected,
          actual: actualSources,
          passed: comparison.matched,
          accuracy: comparison.accuracy,
          details: comparison.details,
          duration
        });

        if (comparison.matched) {
          perfectMatches++;
        } else if (comparison.accuracy > 0) {
          partialMatches++;
        } else {
          noMatches++;
        }

      } catch (error: any) {
        results.push({
          testId: testCase.id,
          testName: testCase.name,
          inputText: testCase.text,
          expected: testCase.expected,
          actual: [],
          passed: false,
          accuracy: 0,
          details: `שגיאת מערכת: ${error.message}`,
          duration: Date.now() - start
        });
        noMatches++;
      }
    }

    const passed = results.filter(r => r.passed).length;
    const overallAccuracy = results.length > 0 
      ? results.reduce((sum, r) => sum + r.accuracy, 0) / results.length 
      : 0;

    const report: ValidationReport = {
      timestamp: new Date().toISOString(),
      totalTests: results.length,
      passed,
      failed: results.length - passed,
      overallAccuracy: Math.round(overallAccuracy * 10) / 10,
      results,
      summary: {
        perfectMatches,
        partialMatches,
        noMatches,
        falsePositives
      }
    };

    return new Response(
      JSON.stringify(report),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Validation error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
