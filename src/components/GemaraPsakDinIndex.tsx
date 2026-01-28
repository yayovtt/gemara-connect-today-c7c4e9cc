import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { MASECHTOT, SEDARIM, Masechet } from "@/lib/masechtotData";
import { toHebrewNumeral } from "@/lib/hebrewNumbers";
import { 
  Search, BookOpen, Scale, ChevronRight, TrendingUp, 
  Database, Tag, Filter, BarChart3, Sparkles, Building2, Calendar
} from "lucide-react";
import PsakDinViewDialog from "./PsakDinViewDialog";

interface PsakLink {
  id: string;
  psak_din_id: string;
  sugya_id: string;
  connection_explanation: string;
  relevance_score: number;
  psakei_din?: {
    id: string;
    title: string;
    court: string;
    year: number;
    summary: string;
    tags: string[];
    source_url?: string;
    source_id?: number;
  };
}

interface IndexEntry {
  masechet: Masechet;
  dafim: {
    dafNumber: number;
    sugya_id: string;
    psakimCount: number;
  }[];
  totalPsakim: number;
}

interface Statistics {
  totalPsakim: number;
  totalLinks: number;
  masechtotWithLinks: number;
  topTags: { tag: string; count: number }[];
  topCourts: { court: string; count: number }[];
  yearRange: { min: number; max: number };
}

interface GemaraPsakimConnection {
  psak_id: string;
  psak_title: string;
  masechet: string;
  daf: string;
  amud: string;
  detection_method: string;
  source: string;
  confidence: number;
}

interface GemaraPsakimIndex {
  version: string;
  exported_at: string;
  stats: {
    total_connections: number;
    unique_psakim: number;
    by_masechet: Record<string, number>;
    by_detection_method: Record<string, number>;
  };
  connections: GemaraPsakimConnection[];
}

const GemaraPsakDinIndex = () => {
  const [indexData, setIndexData] = useState<IndexEntry[]>([]);
  const [allLinks, setAllLinks] = useState<PsakLink[]>([]);
  const [gemaraPsakimIndex, setGemaraPsakimIndex] = useState<GemaraPsakimIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSeder, setSelectedSeder] = useState<string>("all");
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [expandedMasechet, setExpandedMasechet] = useState<string | null>(null);
  const [selectedDafPsakim, setSelectedDafPsakim] = useState<PsakLink[]>([]);
  const [selectedDafInfo, setSelectedDafInfo] = useState<{ masechet: string; daf: number } | null>(null);
  const [dialogPsak, setDialogPsak] = useState<any | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"tree" | "stats">("tree");

  const statistics = useMemo<Statistics>(() => {
    const tagCounts = new Map<string, number>();
    const courtCounts = new Map<string, number>();
    const years: number[] = [];
    const uniquePsakim = new Set<string>();

    allLinks.forEach(link => {
      if (link.psakei_din) {
        uniquePsakim.add(link.psak_din_id);
        
        link.psakei_din.tags?.forEach(tag => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
        
        const court = link.psakei_din.court;
        courtCounts.set(court, (courtCounts.get(court) || 0) + 1);
        
        if (link.psakei_din.year) {
          years.push(link.psakei_din.year);
        }
      }
    });

    const topTags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topCourts = Array.from(courtCounts.entries())
      .map(([court, count]) => ({ court, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalPsakim: uniquePsakim.size,
      totalLinks: allLinks.length,
      masechtotWithLinks: indexData.length,
      topTags,
      topCourts,
      yearRange: {
        min: years.length > 0 ? Math.min(...years) : 0,
        max: years.length > 0 ? Math.max(...years) : 0,
      }
    };
  }, [allLinks, indexData]);

  const allTags = useMemo(() => {
    return statistics.topTags.map(t => t.tag);
  }, [statistics]);

  useEffect(() => {
    loadIndexData();
  }, []);

  const loadIndexData = async () => {
    try {
      // Load gemara_psakim_index.json first (primary source)
      const psakimIndexRes = await fetch('/data/gemara_psakim_index.json');
      const psakimIndexData: GemaraPsakimIndex = await psakimIndexRes.json();
      setGemaraPsakimIndex(psakimIndexData);
      console.log('Loaded gemara_psakim_index.json:', psakimIndexData.stats);

      // Get unique source_ids from the index
      const uniqueSourceIds = [...new Set(psakimIndexData.connections.map(c => parseInt(c.psak_id)))];
      console.log('Unique source_ids in index:', uniqueSourceIds.length);

      // Load psakim from database by source_id
      const { data: psakimBySourceId, error: psakimError } = await supabase
        .from('psakei_din')
        .select('id, title, court, year, summary, tags, source_url, source_id')
        .in('source_id', uniqueSourceIds);

      if (psakimError) throw psakimError;

      // Create a map of source_id to psak data
      const sourceIdToPsak = new Map<number, any>();
      (psakimBySourceId || []).forEach((psak: any) => {
        if (psak.source_id) {
          sourceIdToPsak.set(psak.source_id, psak);
        }
      });
      console.log('Psakim found in database by source_id:', sourceIdToPsak.size);

      // Convert gemara_psakim_index connections to PsakLink format
      const indexLinks: PsakLink[] = [];
      const seenPsakIds = new Set<string>();

      psakimIndexData.connections.forEach((conn) => {
        const sourceId = parseInt(conn.psak_id);
        const psak = sourceIdToPsak.get(sourceId);
        if (psak && !seenPsakIds.has(`${psak.id}_${conn.masechet}_${conn.daf}_${conn.amud}`)) {
          seenPsakIds.add(`${psak.id}_${conn.masechet}_${conn.daf}_${conn.amud}`);
          
          // Create sugya_id from the connection info
          const masechetObj = MASECHTOT.find(m => m.hebrewName === conn.masechet);
          const sefariaName = masechetObj?.sefariaName || conn.masechet;
          const hebrewToNumber = hebrewDafToNumber(conn.daf);
          const amudLetter = conn.amud === 'א' ? 'a' : 'b';
          const sugyaId = `${sefariaName.toLowerCase()}_${hebrewToNumber}${amudLetter}`;
          
          indexLinks.push({
            id: `index_${conn.psak_id}_${conn.masechet}_${conn.daf}_${conn.amud}`,
            psak_din_id: psak.id,
            sugya_id: sugyaId,
            connection_explanation: `${conn.masechet} דף ${conn.daf} עמוד ${conn.amud} (${conn.source})`,
            relevance_score: Math.round(conn.confidence * 10),
            psakei_din: psak
          });
        }
      });

      console.log('Links from gemara_psakim_index:', indexLinks.length);

      // Also load from database tables for additional links
      const [sugyaLinksResult, patternLinksResult] = await Promise.all([
        supabase
          .from('sugya_psak_links')
          .select(`
            id,
            psak_din_id,
            sugya_id,
            connection_explanation,
            relevance_score,
            psakei_din (
              id,
              title,
              court,
              year,
              summary,
              tags,
              source_url,
              source_id
            )
          `),
        supabase
          .from('pattern_sugya_links')
          .select(`
            id,
            psak_din_id,
            sugya_id,
            masechet,
            daf,
            amud,
            source_text,
            confidence,
            psakei_din:psak_din_id (
              id,
              title,
              court,
              year,
              summary,
              tags,
              source_url,
              source_id
            )
          `)
      ]);

      const sugyaLinks = sugyaLinksResult.data || [];
      const patternLinks = patternLinksResult.data || [];
      
      console.log('sugya_psak_links count:', sugyaLinks.length);
      console.log('pattern_sugya_links count:', patternLinks.length);

      // Combine all sources
      const combinedLinks: PsakLink[] = [...indexLinks];
      const seenIds = new Set<string>(indexLinks.map(l => l.id));

      // Add sugya_psak_links
      sugyaLinks.forEach((link: any) => {
        if (link.psakei_din && !seenIds.has(link.id)) {
          seenIds.add(link.id);
          combinedLinks.push(link);
        }
      });

      // Add pattern_sugya_links
      patternLinks.forEach((link: any) => {
        const uniqueKey = `pattern_${link.id}`;
        if (link.psakei_din && !seenIds.has(uniqueKey)) {
          seenIds.add(uniqueKey);
          combinedLinks.push({
            id: link.id,
            psak_din_id: link.psak_din_id,
            sugya_id: link.sugya_id,
            connection_explanation: link.source_text || '',
            relevance_score: link.confidence === 'high' ? 8 : link.confidence === 'medium' ? 6 : 4,
            psakei_din: link.psakei_din
          });
        }
      });

      setAllLinks(combinedLinks);
      console.log('Total combined links:', combinedLinks.length);

      // Build index from all sources
      const index: IndexEntry[] = [];
      
      for (const masechet of MASECHTOT) {
        const sefariaName = masechet.sefariaName;
        const hebrewName = masechet.hebrewName;
        
        // Count from gemara_psakim_index
        const indexCount = psakimIndexData.stats.by_masechet[hebrewName] || 0;
        
        // Filter combined links for this masechet
        const masechetLinks = combinedLinks.filter((link: any) => {
          const sugyaId = link.sugya_id || '';
          
          // Check Sefaria format
          if (sugyaId.toLowerCase().startsWith(sefariaName.toLowerCase() + '_')) {
            return true;
          }
          
          // Check Hebrew format
          if (sugyaId.includes(hebrewName.toLowerCase().replace(/ /g, '_'))) {
            return true;
          }
          
          return false;
        });
        
        if (masechetLinks.length === 0 && indexCount === 0) continue;
        
        // Group by daf
        const dafMap = new Map<number, { sugya_id: string; count: number }>();
        
        masechetLinks.forEach((link: any) => {
          let dafNumber: number | null = null;
          const sugyaId = link.sugya_id || '';
          
          // Extract daf number from sugya_id
          const afterMasechet = sugyaId.slice(sefariaName.length + 1);
          const dafMatch = afterMasechet.match(/^(\d+)/);
          if (dafMatch) {
            dafNumber = parseInt(dafMatch[1]);
          }
          
          if (dafNumber && dafNumber >= 2 && dafNumber <= masechet.maxDaf) {
            if (!dafMap.has(dafNumber)) {
              dafMap.set(dafNumber, { sugya_id: sugyaId || `${sefariaName.toLowerCase()}_${dafNumber}a`, count: 0 });
            }
            dafMap.get(dafNumber)!.count++;
          }
        });
        
        if (dafMap.size > 0) {
          const dafim = Array.from(dafMap.entries())
            .map(([dafNumber, data]) => ({
              dafNumber,
              sugya_id: data.sugya_id,
              psakimCount: data.count
            }))
            .sort((a, b) => a.dafNumber - b.dafNumber);
          
          const totalPsakim = dafim.reduce((sum, d) => sum + d.psakimCount, 0);
          index.push({ masechet, dafim, totalPsakim });
        }
      }

      index.sort((a, b) => b.totalPsakim - a.totalPsakim);
      
      console.log('Index built:', index.length, 'masechtot with', 
        index.reduce((sum, e) => sum + e.totalPsakim, 0), 'total links');
      
      setIndexData(index);
    } catch (error) {
      console.error('Error loading index:', error);
    } finally {
      setLoading(false);
    }
  };

  // Hebrew daf number conversion
  const hebrewDafToNumber = (daf: string): number => {
    const hebrewNums: Record<string, number> = {
      'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9, 'י': 10,
      'יא': 11, 'יב': 12, 'יג': 13, 'יד': 14, 'טו': 15, 'טז': 16, 'יז': 17, 'יח': 18, 'יט': 19,
      'כ': 20, 'כא': 21, 'כב': 22, 'כג': 23, 'כד': 24, 'כה': 25, 'כו': 26, 'כז': 27, 'כח': 28, 'כט': 29,
      'ל': 30, 'לא': 31, 'לב': 32, 'לג': 33, 'לד': 34, 'לה': 35, 'לו': 36, 'לז': 37, 'לח': 38, 'לט': 39,
      'מ': 40, 'מא': 41, 'מב': 42, 'מג': 43, 'מד': 44, 'מה': 45, 'מו': 46, 'מז': 47, 'מח': 48, 'מט': 49,
      'נ': 50, 'נא': 51, 'נב': 52, 'נג': 53, 'נד': 54, 'נה': 55, 'נו': 56, 'נז': 57, 'נח': 58, 'נט': 59,
      'ס': 60, 'סא': 61, 'סב': 62, 'סג': 63, 'סד': 64, 'סה': 65, 'סו': 66, 'סז': 67, 'סח': 68, 'סט': 69,
      'ע': 70, 'עא': 71, 'עב': 72, 'עג': 73, 'עד': 74, 'עה': 75, 'עו': 76, 'עז': 77, 'עח': 78, 'עט': 79,
      'פ': 80, 'פא': 81, 'פב': 82, 'פג': 83, 'פד': 84, 'פה': 85, 'פו': 86, 'פז': 87, 'פח': 88, 'פט': 89,
      'צ': 90, 'צא': 91, 'צב': 92, 'צג': 93, 'צד': 94, 'צה': 95, 'צו': 96, 'צז': 97, 'צח': 98, 'צט': 99,
      'ק': 100, 'קא': 101, 'קב': 102, 'קג': 103, 'קד': 104, 'קה': 105, 'קו': 106, 'קז': 107, 'קח': 108, 'קט': 109,
      'קי': 110, 'קיא': 111, 'קיב': 112, 'קיג': 113, 'קיד': 114, 'קטו': 115, 'קטז': 116, 'קיז': 117, 'קיח': 118, 'קיט': 119,
      'קכ': 120, 'קכא': 121, 'קכב': 122, 'קכג': 123, 'קכד': 124, 'קכה': 125, 'קכו': 126, 'קכז': 127, 'קכח': 128, 'קכט': 129,
      'קל': 130, 'קלא': 131, 'קלב': 132, 'קלג': 133, 'קלד': 134, 'קלה': 135, 'קלו': 136, 'קלז': 137, 'קלח': 138, 'קלט': 139,
      'קמ': 140, 'קמא': 141, 'קמב': 142, 'קמג': 143, 'קמד': 144, 'קמה': 145, 'קמו': 146, 'קמז': 147, 'קמח': 148, 'קמט': 149,
      'קנ': 150, 'קנא': 151, 'קנב': 152, 'קנג': 153, 'קנד': 154, 'קנה': 155, 'קנו': 156, 'קנז': 157, 'קנח': 158, 'קנט': 159,
      'קס': 160, 'קסא': 161, 'קסב': 162, 'קסג': 163, 'קסד': 164, 'קסה': 165, 'קסו': 166, 'קסז': 167, 'קסח': 168, 'קסט': 169,
      'קע': 170, 'קעא': 171, 'קעב': 172, 'קעג': 173, 'קעד': 174, 'קעה': 175, 'קעו': 176
    };
    return hebrewNums[daf] || parseInt(daf) || 0;
  };

  const numberToHebrewDaf = (num: number): string => {
    const hebrewNums: Record<number, string> = {
      2: 'ב', 3: 'ג', 4: 'ד', 5: 'ה', 6: 'ו', 7: 'ז', 8: 'ח', 9: 'ט', 10: 'י',
      11: 'יא', 12: 'יב', 13: 'יג', 14: 'יד', 15: 'טו', 16: 'טז', 17: 'יז', 18: 'יח', 19: 'יט',
      20: 'כ', 21: 'כא', 22: 'כב', 23: 'כג', 24: 'כד', 25: 'כה', 26: 'כו', 27: 'כז', 28: 'כח', 29: 'כט',
      30: 'ל', 31: 'לא', 32: 'לב', 33: 'לג', 34: 'לד', 35: 'לה', 36: 'לו', 37: 'לז', 38: 'לח', 39: 'לט',
      40: 'מ', 41: 'מא', 42: 'מב', 43: 'מג', 44: 'מד', 45: 'מה', 46: 'מו', 47: 'מז', 48: 'מח', 49: 'מט',
      50: 'נ', 51: 'נא', 52: 'נב', 53: 'נג', 54: 'נד', 55: 'נה', 56: 'נו', 57: 'נז', 58: 'נח', 59: 'נט',
      60: 'ס', 61: 'סא', 62: 'סב', 63: 'סג', 64: 'סד', 65: 'סה', 66: 'סו', 67: 'סז', 68: 'סח', 69: 'סט',
      70: 'ע', 71: 'עא', 72: 'עב', 73: 'עג', 74: 'עד', 75: 'עה', 76: 'עו', 77: 'עז', 78: 'עח', 79: 'עט',
      80: 'פ', 81: 'פא', 82: 'פב', 83: 'פג', 84: 'פד', 85: 'פה', 86: 'פו', 87: 'פז', 88: 'פח', 89: 'פט',
      90: 'צ', 91: 'צא', 92: 'צב', 93: 'צג', 94: 'צד', 95: 'צה', 96: 'צו', 97: 'צז', 98: 'צח', 99: 'צט',
      100: 'ק', 101: 'קא', 102: 'קב', 103: 'קג', 104: 'קד', 105: 'קה', 106: 'קו', 107: 'קז', 108: 'קח', 109: 'קט',
      110: 'קי', 111: 'קיא', 112: 'קיב', 113: 'קיג', 114: 'קיד', 115: 'קטו', 116: 'קטז', 117: 'קיז', 118: 'קיח', 119: 'קיט',
      120: 'קכ', 121: 'קכא', 122: 'קכב', 123: 'קכג', 124: 'קכד', 125: 'קכה', 126: 'קכו', 127: 'קכז', 128: 'קכח', 129: 'קכט',
      130: 'קל', 131: 'קלא', 132: 'קלב', 133: 'קלג', 134: 'קלד', 135: 'קלה', 136: 'קלו', 137: 'קלז', 138: 'קלח', 139: 'קלט',
      140: 'קמ', 141: 'קמא', 142: 'קמב', 143: 'קמג', 144: 'קמד', 145: 'קמה', 146: 'קמו', 147: 'קמז', 148: 'קמח', 149: 'קמט',
      150: 'קנ', 151: 'קנא', 152: 'קנב', 153: 'קנג', 154: 'קנד', 155: 'קנה', 156: 'קנו', 157: 'קנז', 158: 'קנח', 159: 'קנט',
      160: 'קס', 161: 'קסא', 162: 'קסב', 163: 'קסג', 164: 'קסד', 165: 'קסה', 166: 'קסו', 167: 'קסז', 168: 'קסח', 169: 'קסט',
      170: 'קע', 171: 'קעא', 172: 'קעב', 173: 'קעג', 174: 'קעד', 175: 'קעה', 176: 'קעו'
    };
    return hebrewNums[num] || num.toString();
  };

  const loadDafPsakim = async (sugyaId: string, masechet: string, daf: number) => {
    try {
      // מציאת שם המסכת ב-sefaria format
      const masechetObj = MASECHTOT.find(m => m.hebrewName === masechet);
      const sefariaName = masechetObj?.sefariaName || '';
      const hebrewDaf = numberToHebrewDaf(daf);
      
      // 1. חיפוש ב-gemara_psakim_index.json (מקור ראשי)
      const indexPsakim: PsakLink[] = [];
      const seenPsakIds = new Set<string>();
      
      if (gemaraPsakimIndex) {
        // מציאת כל הקישורים למסכת ודף הזה
        const matchingConnections = gemaraPsakimIndex.connections.filter(conn => {
          const connMasechet = conn.masechet;
          const connDaf = conn.daf;
          
          // בדיקה לפי שם עברי או sefaria
          const masechetMatch = connMasechet === masechet || 
            connMasechet === masechetObj?.hebrewName ||
            connMasechet.toLowerCase() === sefariaName.toLowerCase();
          
          // בדיקה לפי דף - עברי או מספרי
          const dafMatch = connDaf === hebrewDaf || 
            connDaf === daf.toString() ||
            hebrewDafToNumber(connDaf) === daf;
          
          return masechetMatch && dafMatch;
        });
        
        console.log(`Found ${matchingConnections.length} connections in gemara_psakim_index for ${masechet} ${daf}`);
        
        // קבלת source_ids לחיפוש בדאטהבייס
        const sourceIds = [...new Set(matchingConnections.map(c => parseInt(c.psak_id)))];
        
        if (sourceIds.length > 0) {
          const { data: psakimData, error } = await supabase
            .from('psakei_din')
            .select('id, title, court, year, summary, tags, source_url, source_id')
            .in('source_id', sourceIds);
          
          if (!error && psakimData) {
            const sourceIdToPsak = new Map<number, any>();
            psakimData.forEach((p: any) => {
              if (p.source_id) sourceIdToPsak.set(p.source_id, p);
            });
            
            matchingConnections.forEach(conn => {
              const sourceId = parseInt(conn.psak_id);
              const psak = sourceIdToPsak.get(sourceId);
              if (psak && !seenPsakIds.has(psak.id)) {
                seenPsakIds.add(psak.id);
                const amudLetter = conn.amud === 'א' ? 'a' : 'b';
                indexPsakim.push({
                  id: `index_${conn.psak_id}_${daf}_${conn.amud}`,
                  psak_din_id: psak.id,
                  sugya_id: `${sefariaName.toLowerCase()}_${daf}${amudLetter}`,
                  connection_explanation: `${conn.masechet} דף ${conn.daf} עמוד ${conn.amud} (${conn.source})`,
                  relevance_score: Math.round(conn.confidence * 10),
                  psakei_din: psak
                });
              }
            });
          }
        }
      }
      
      // 2. חיפוש בשתי הטבלאות במקביל
      const [sugyaLinksResult, patternLinksResult] = await Promise.all([
        supabase
          .from('sugya_psak_links')
          .select(`
            id,
            psak_din_id,
            sugya_id,
            connection_explanation,
            relevance_score,
            psakei_din (
              id,
              title,
              court,
              year,
              summary,
              tags,
              source_url,
              source_id
            )
          `)
          .like('sugya_id', `${sefariaName}_${daf}%`),
        supabase
          .from('pattern_sugya_links')
          .select(`
            id,
            psak_din_id,
            sugya_id,
            source_text,
            confidence,
            masechet,
            daf,
            amud,
            psakei_din:psak_din_id (
              id,
              title,
              court,
              year,
              summary,
              tags,
              source_url,
              source_id
            )
          `)
          .eq('masechet', masechet)
      ]);

      if (sugyaLinksResult.error) throw sugyaLinksResult.error;
      if (patternLinksResult.error) throw patternLinksResult.error;

      // Combine all sources
      const combined: PsakLink[] = [...indexPsakim];

      // Add sugya_psak_links
      (sugyaLinksResult.data || []).forEach((link: any) => {
        if (link.psakei_din && !seenPsakIds.has(link.psak_din_id)) {
          seenPsakIds.add(link.psak_din_id);
          combined.push(link);
        }
      });

      // Add pattern_sugya_links with daf matching
      (patternLinksResult.data || []).forEach((link: any) => {
        if (!link.psakei_din || seenPsakIds.has(link.psak_din_id)) return;
        
        // בדיקה שהדף תואם
        const linkDaf = link.daf;
        const dafMatch = linkDaf === hebrewDaf || 
          linkDaf === daf.toString() ||
          hebrewDafToNumber(linkDaf) === daf;
        
        if (dafMatch) {
          seenPsakIds.add(link.psak_din_id);
          combined.push({
            id: link.id,
            psak_din_id: link.psak_din_id,
            sugya_id: link.sugya_id,
            connection_explanation: link.source_text || `מקור: ${masechet} דף ${link.daf} עמוד ${link.amud || ''}`,
            relevance_score: link.confidence === 'high' ? 8 : link.confidence === 'medium' ? 6 : 4,
            psakei_din: link.psakei_din
          });
        }
      });

      console.log(`Total psakim for ${masechet} ${daf}: ${combined.length}`);

      // סינון לפי תגית אם נבחרה
      let filteredData = combined;
      if (selectedTag !== "all") {
        filteredData = filteredData.filter((link: any) => 
          link.psakei_din?.tags?.includes(selectedTag)
        );
      }

      setSelectedDafPsakim(filteredData);
      setSelectedDafInfo({ masechet, daf });
    } catch (error) {
      console.error('Error loading daf psakim:', error);
    }
  };

  const handlePsakClick = (psak: any) => {
    if (!psak) return;
    setDialogPsak(psak);
    setDialogOpen(true);
  };

  const handleTagClick = (tag: string) => {
    setSelectedTag(tag === selectedTag ? "all" : tag);
  };

  const filteredIndex = indexData.filter(entry => {
    const matchesSearch = searchQuery === "" || 
      entry.masechet.hebrewName.includes(searchQuery);
    const matchesSeder = selectedSeder === "all" || 
      entry.masechet.seder === selectedSeder;
    return matchesSearch && matchesSeder;
  });

  // חישוב אחוז כיסוי לכל מסכת
  const getCoveragePercent = (entry: IndexEntry) => {
    return Math.round((entry.dafim.length / entry.masechet.maxDaf) * 100);
  };

  // צבע לפי כמות פסקים
  const getHeatColor = (count: number) => {
    if (count >= 5) return "bg-primary text-primary-foreground";
    if (count >= 3) return "bg-primary/80 text-primary-foreground";
    if (count >= 2) return "bg-primary/60 text-primary-foreground";
    return "bg-primary/40 text-primary-foreground";
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Sparkles className="w-8 h-8 animate-pulse text-primary" />
        <p className="text-muted-foreground">טוען אינדקס חכם...</p>
      </div>
    );
  }

return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* כותרת וסטטיסטיקות ראשיות */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Scale className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{statistics.totalPsakim}</p>
                <p className="text-xs text-muted-foreground">פסקי דין</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-border bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Database className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{statistics.totalLinks}</p>
                <p className="text-xs text-muted-foreground">קישורים</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-border bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{statistics.masechtotWithLinks}</p>
                <p className="text-xs text-muted-foreground">מסכתות</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-border bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {statistics.yearRange.min > 0 ? `${statistics.yearRange.min}-${statistics.yearRange.max}` : '-'}
                </p>
                <p className="text-xs text-muted-foreground">טווח שנים</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* תגיות פופולריות */}
      {statistics.topTags.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Tag className="w-4 h-4" />
              תגיות פופולריות (לחץ לסינון)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {statistics.topTags.map(({ tag, count }) => (
                <Badge 
                  key={tag} 
                  variant={selectedTag === tag ? "default" : "secondary"}
                  className="cursor-pointer hover:bg-primary/20 transition-colors"
                  onClick={() => handleTagClick(tag)}
                >
                  {tag}
                  <span className="mr-1 text-xs opacity-70">({count})</span>
                </Badge>
              ))}
              {selectedTag !== "all" && (
                <Badge 
                  variant="outline" 
                  className="cursor-pointer"
                  onClick={() => setSelectedTag("all")}
                >
                  נקה סינון ×
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* סינון וחיפוש */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="חפש מסכת..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
          />
        </div>
        <Select value={selectedSeder} onValueChange={setSelectedSeder}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="כל הסדרים" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסדרים</SelectItem>
            {SEDARIM.map(seder => (
              <SelectItem key={seder} value={seder}>סדר {seder}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-1">
          <Button 
            variant={viewMode === "tree" ? "default" : "outline"} 
            size="icon"
            onClick={() => setViewMode("tree")}
          >
            <BookOpen className="w-4 h-4" />
          </Button>
          <Button 
            variant={viewMode === "stats" ? "default" : "outline"} 
            size="icon"
            onClick={() => setViewMode("stats")}
          >
            <BarChart3 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {viewMode === "stats" ? (
        /* תצוגת סטטיסטיקות */
        <div className="grid md:grid-cols-2 gap-6">
          {/* מסכתות מובילות */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                מסכתות מובילות
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredIndex.slice(0, 8).map((entry, idx) => (
                  <div key={entry.masechet.englishName} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{entry.masechet.hebrewName}</span>
                      <span className="text-muted-foreground">{entry.totalPsakim} פסקים</span>
                    </div>
                    <Progress 
                      value={(entry.totalPsakim / (filteredIndex[0]?.totalPsakim || 1)) * 100} 
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* בתי דין מובילים */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                בתי דין מובילים
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {statistics.topCourts.map((court, idx) => (
                  <div key={court.court} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate max-w-[200px]">{court.court}</span>
                      <span className="text-muted-foreground">{court.count}</span>
                    </div>
                    <Progress 
                      value={(court.count / (statistics.topCourts[0]?.count || 1)) * 100} 
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* תצוגת עץ */
        <div className="grid md:grid-cols-2 gap-6">
          {/* עץ המסכתות */}
          <Card className="border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                מסכתות ({filteredIndex.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {filteredIndex.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    אין פסקי דין מקושרים
                  </div>
                ) : (
                  <Accordion 
                    type="single" 
                    collapsible
                    value={expandedMasechet || undefined}
                    onValueChange={setExpandedMasechet}
                  >
                    {filteredIndex.map((entry) => (
                      <AccordionItem key={entry.masechet.englishName} value={entry.masechet.englishName}>
                        <AccordionTrigger className="hover:no-underline flex-row-reverse">
                          <div className="flex items-center justify-between w-full pr-4">
                            <Badge variant="secondary" className="mr-2">
                              {entry.totalPsakim} פסקים
                            </Badge>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                ({getCoveragePercent(entry)}% כיסוי)
                              </span>
                              <span className="font-medium">{entry.masechet.hebrewName}</span>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="grid grid-cols-6 gap-2 p-2">
                            {entry.dafim.map((daf) => (
                              <Button
                                key={daf.dafNumber}
                                variant={
                                  selectedDafInfo?.masechet === entry.masechet.hebrewName && 
                                  selectedDafInfo?.daf === daf.dafNumber 
                                    ? "default" 
                                    : "outline"
                                }
                                size="sm"
                                className={`relative ${
                                  selectedDafInfo?.masechet !== entry.masechet.hebrewName || 
                                  selectedDafInfo?.daf !== daf.dafNumber 
                                    ? getHeatColor(daf.psakimCount) 
                                    : ''
                                }`}
                                onClick={() => loadDafPsakim(daf.sugya_id, entry.masechet.hebrewName, daf.dafNumber)}
                              >
                                {toHebrewNumeral(daf.dafNumber)}
                                {daf.psakimCount > 1 && (
                                  <span className="absolute -top-1 -left-1 bg-background text-foreground border rounded-full w-4 h-4 text-[10px] flex items-center justify-center">
                                    {daf.psakimCount}
                                  </span>
                                )}
                              </Button>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* רשימת פסקי דין לדף נבחר */}
          <Card className="border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Scale className="w-5 h-5" />
                {selectedDafInfo 
                  ? `פסקי דין - ${selectedDafInfo.masechet} דף ${toHebrewNumeral(selectedDafInfo.daf)}`
                  : 'בחר דף לצפייה בפסקי דין'
                }
                {selectedTag !== "all" && (
                  <Badge variant="outline" className="mr-2">
                    <Filter className="w-3 h-3 ml-1" />
                    {selectedTag}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {!selectedDafInfo ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Scale className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>לחץ על דף באחת המסכתות כדי לראות את פסקי הדין המקושרים</p>
                  </div>
                ) : selectedDafPsakim.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {selectedTag !== "all" 
                      ? `אין פסקי דין עם התגית "${selectedTag}" לדף זה`
                      : 'אין פסקי דין לדף זה'
                    }
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedDafPsakim.map((link) => (
                      <Card 
                        key={link.id} 
                        className="p-4 cursor-pointer hover:bg-accent/50 transition-colors border-r-4 border-r-primary/50"
                        onClick={() => handlePsakClick(link.psakei_din)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 mt-1" />
                          <div className="flex-1 text-right">
                            <h4 className="font-medium text-foreground line-clamp-1">
                              {link.psakei_din?.title}
                            </h4>
                            <div className="flex items-center justify-end gap-3 text-sm text-muted-foreground mt-1">
                              <span className="flex items-center gap-1">
                                {link.psakei_din?.court}
                                <Building2 className="w-3 h-3" />
                              </span>
                              <span className="flex items-center gap-1">
                                {link.psakei_din?.year}
                                <Calendar className="w-3 h-3" />
                              </span>
                            </div>
                            <p className="text-sm text-foreground/80 mt-2 line-clamp-2 text-right">
                              {link.connection_explanation}
                            </p>
                          </div>
                        </div>
                        {link.psakei_din?.tags && link.psakei_din.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {link.psakei_din.tags.slice(0, 4).map((tag, idx) => (
                              <Badge 
                                key={idx} 
                                variant={tag === selectedTag ? "default" : "outline"} 
                                className="text-xs"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}

      <PsakDinViewDialog
        psak={dialogPsak}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
};

export default GemaraPsakDinIndex;
