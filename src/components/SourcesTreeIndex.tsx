import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { MASECHTOT } from "@/lib/masechtotData";
import { 
  ChevronLeft, ChevronDown, BookOpen, FileText, Search, 
  ExternalLink, Loader2, FolderTree, Scale, Tag, Hash
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import PsakDinViewDialog from "./PsakDinViewDialog";

interface TreeNode {
  id: string;
  name: string;
  type: "tag" | "subject" | "shortcat";
  children?: TreeNode[];
}

interface HierarchyData {
  description: string;
  tree: TreeNode[];
}

interface IdLookupEntry {
  id: string;
  name: string;
  type: string;
  full_path: string;
  parent_id: string;
  depth: number;
  has_children: boolean;
  children_count: number;
}

interface LinkedPsak {
  id: string;
  title: string;
  court: string;
  year: number;
  summary: string;
  tags?: string[];
  source_url?: string;
  source_id?: number;
  connection_explanation?: string;
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

// Map Hebrew daf names to numbers
const hebrewDafToNumber = (dafName: string): number => {
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
  
  const match = dafName.match(/דף\s+(.+)/);
  if (match) {
    return hebrewNums[match[1]] || 0;
  }
  return 0;
};

// Convert number to Hebrew daf name
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

// Masechet name normalization
const normalizeMasechetName = (name: string): string[] => {
  const mapping: Record<string, string[]> = {
    'בבא בתרא': ['בבא בתרא', 'Bava_Batra'],
    'בבא מציעא': ['בבא מציעא', 'Bava_Metzia'],
    'בבא קמא': ['בבא קמא', 'Bava_Kamma'],
    'סנהדרין': ['סנהדרין', 'Sanhedrin'],
    'קידושין': ['קידושין', 'Kiddushin'],
    'גיטין': ['גיטין', 'Gittin'],
    'כתובות': ['כתובות', 'Ketubot'],
    'יבמות': ['יבמות', 'Yevamot'],
    'שבת': ['שבת', 'Shabbat'],
    'פסחים': ['פסחים', 'Pesachim'],
    'ברכות': ['ברכות', 'Berakhot'],
    'ביצה': ['ביצה', 'Beitzah'],
    'חגיגה': ['חגיגה', 'Chagigah'],
    'מועד קטן': ['מועד קטן', 'Moed_Katan'],
    'סוכה': ['סוכה', 'Sukkah'],
    'ראש השנה': ['ראש השנה', 'Rosh_Hashanah'],
    'תענית': ['תענית', 'Taanit'],
    'מגילה': ['מגילה', 'Megillah'],
    'יומא': ['יומא', 'Yoma'],
    'עירובין': ['עירובין', 'Eruvin'],
    'נדרים': ['נדרים', 'Nedarim'],
    'נזיר': ['נזיר', 'Nazir'],
    'סוטה': ['סוטה', 'Sotah'],
    'מכות': ['מכות', 'Makkot'],
    'שבועות': ['שבועות', 'Shevuot'],
    'עבודה זרה': ['עבודה זרה', 'Avodah_Zarah'],
    'הוריות': ['הוריות', 'Horayot'],
    'זבחים': ['זבחים', 'Zevachim'],
    'מנחות': ['מנחות', 'Menachot'],
    'חולין': ['חולין', 'Chullin'],
    'בכורות': ['בכורות', 'Bekhorot'],
    'ערכין': ['ערכין', 'Arakhin'],
    'תמורה': ['תמורה', 'Temurah'],
    'כריתות': ['כריתות', 'Keritot'],
    'מעילה': ['מעילה', 'Meilah'],
    'נידה': ['נידה', 'Niddah'],
  };
  return mapping[name] || [name];
};

// Build psakim count cache from index
interface PsakimCountCache {
  byMasechet: Record<string, number>;
  byDaf: Record<string, number>; // key: "masechet|daf"
  byAmud: Record<string, number>; // key: "masechet|daf|amud"
}

const buildPsakimCountCache = (index: GemaraPsakimIndex | null): PsakimCountCache => {
  const cache: PsakimCountCache = {
    byMasechet: {},
    byDaf: {},
    byAmud: {}
  };
  
  if (!index?.connections) return cache;
  
  const seenByMasechet: Record<string, Set<string>> = {};
  const seenByDaf: Record<string, Set<string>> = {};
  const seenByAmud: Record<string, Set<string>> = {};
  
  index.connections.forEach(conn => {
    const psakId = conn.psak_id;
    const masechet = conn.masechet;
    const daf = conn.daf;
    const amud = conn.amud;
    
    // Count unique psakim per masechet
    if (!seenByMasechet[masechet]) seenByMasechet[masechet] = new Set();
    seenByMasechet[masechet].add(psakId);
    
    // Count unique psakim per daf
    const dafKey = `${masechet}|${daf}`;
    if (!seenByDaf[dafKey]) seenByDaf[dafKey] = new Set();
    seenByDaf[dafKey].add(psakId);
    
    // Count unique psakim per amud
    const amudKey = `${masechet}|${daf}|${amud}`;
    if (!seenByAmud[amudKey]) seenByAmud[amudKey] = new Set();
    seenByAmud[amudKey].add(psakId);
  });
  
  Object.entries(seenByMasechet).forEach(([key, set]) => {
    cache.byMasechet[key] = set.size;
  });
  Object.entries(seenByDaf).forEach(([key, set]) => {
    cache.byDaf[key] = set.size;
  });
  Object.entries(seenByAmud).forEach(([key, set]) => {
    cache.byAmud[key] = set.size;
  });
  
  return cache;
};

const SourcesTreeIndex = () => {
  const [sourcesHierarchy, setSourcesHierarchy] = useState<HierarchyData | null>(null);
  const [topicsHierarchy, setTopicsHierarchy] = useState<HierarchyData | null>(null);
  const [idLookup, setIdLookup] = useState<Record<string, IdLookupEntry> | null>(null);
  const [gemaraPsakimIndex, setGemaraPsakimIndex] = useState<GemaraPsakimIndex | null>(null);
  const [psakimCountCache, setPsakimCountCache] = useState<PsakimCountCache>({ byMasechet: {}, byDaf: {}, byAmud: {} });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [linkedPsakim, setLinkedPsakim] = useState<LinkedPsak[]>([]);
  const [loadingPsakim, setLoadingPsakim] = useState(false);
  const [selectedPsak, setSelectedPsak] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState<{ masechet?: string; daf?: number; amud?: string; subjectId?: string }>({});
  const [activeTab, setActiveTab] = useState("sources");
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [sourcesRes, topicsRes, lookupRes, psakimIndexRes] = await Promise.all([
        fetch('/data/sources_hierarchy.json'),
        fetch('/data/topics_hierarchy.json'),
        fetch('/data/id_lookup.min.json'),
        fetch('/data/gemara_psakim_index.json')
      ]);
      
      const [sourcesData, topicsData, lookupData, psakimIndexData] = await Promise.all([
        sourcesRes.json(),
        topicsRes.json(),
        lookupRes.json(),
        psakimIndexRes.json()
      ]);
      
      setSourcesHierarchy(sourcesData);
      setTopicsHierarchy(topicsData);
      setIdLookup(lookupData);
      setGemaraPsakimIndex(psakimIndexData);
      
      // Build psakim count cache
      const cache = buildPsakimCountCache(psakimIndexData);
      setPsakimCountCache(cache);
      
      console.log('Loaded gemara psakim index:', psakimIndexData.stats);
      console.log('Psakim count cache built:', Object.keys(cache.byMasechet).length, 'masechtot');
      
      // Auto-expand first level
      if (sourcesData.tree[0]?.id) {
        setExpandedNodes(new Set([sourcesData.tree[0].id]));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const handleSubjectClick = async (node: TreeNode, path: { masechet?: string; daf?: number; amud?: string }) => {
    setSelectedSubjectId(node.id);
    setCurrentPath({ ...path, subjectId: node.id });
    setLoadingPsakim(true);
    
    try {
      const psakim: LinkedPsak[] = [];
      const seenIds = new Set<string>();
      const seenSourceIds = new Set<string>();

      // PRIORITY 1: Search in gemara_psakim_index.json (most accurate source)
      if (path.masechet && path.daf && gemaraPsakimIndex) {
        const dafAsHebrew = numberToHebrewDaf(path.daf);
        const amudLetter = path.amud === 'עמוד א' ? 'א' : 'ב';
        
        console.log(`Searching in gemara_psakim_index for: ${path.masechet} דף ${dafAsHebrew} עמוד ${amudLetter}`);
        
        // Find matching connections from the index
        const matchingConnections = gemaraPsakimIndex.connections.filter(conn => {
          const masechetMatch = conn.masechet === path.masechet;
          const dafMatch = conn.daf === dafAsHebrew || conn.daf === path.daf.toString();
          const amudMatch = !path.amud || conn.amud === amudLetter;
          return masechetMatch && dafMatch && amudMatch;
        });

        console.log(`Found ${matchingConnections.length} connections in index`);

        // Get unique source_ids
        const sourceIds = [...new Set(matchingConnections.map(c => parseInt(c.psak_id)))];
        
        if (sourceIds.length > 0) {
          // Fetch psakim from database by source_id
          const { data: psakimBySourceId, error } = await supabase
            .from('psakei_din')
            .select('id, title, court, year, summary, tags, source_url, source_id')
            .in('source_id', sourceIds);

          if (error) {
            console.error('Error fetching psakim by source_id:', error);
          } else if (psakimBySourceId) {
            console.log(`Found ${psakimBySourceId.length} psakim by source_id`);
            psakimBySourceId.forEach((psak: any) => {
              if (!seenIds.has(psak.id)) {
                seenIds.add(psak.id);
                seenSourceIds.add(psak.source_id?.toString() || '');
                const conn = matchingConnections.find(c => parseInt(c.psak_id) === psak.source_id);
                psakim.push({
                  ...psak,
                  connection_explanation: conn ? `${conn.masechet} דף ${conn.daf} עמוד ${conn.amud} (${conn.source})` : undefined
                });
              }
            });
          }
        }
      }

      // PRIORITY 2: Search in pattern_sugya_links
      if (path.masechet && path.daf) {
        const masechetNames = normalizeMasechetName(path.masechet);
        const dafAsNumber = path.daf.toString();
        const dafAsHebrew = numberToHebrewDaf(path.daf);
        
        const { data: patternLinksNum } = await supabase
          .from('pattern_sugya_links')
          .select(`
            id,
            source_text,
            confidence,
            amud,
            psakei_din:psak_din_id (id, title, court, year, summary, tags, source_url, source_id)
          `)
          .in('masechet', masechetNames)
          .eq('daf', dafAsNumber);

        const { data: patternLinksHeb } = await supabase
          .from('pattern_sugya_links')
          .select(`
            id,
            source_text,
            confidence,
            amud,
            psakei_din:psak_din_id (id, title, court, year, summary, tags, source_url, source_id)
          `)
          .in('masechet', masechetNames)
          .eq('daf', dafAsHebrew);

        const allPatternLinks = [...(patternLinksNum || []), ...(patternLinksHeb || [])];

        allPatternLinks.forEach((link: any) => {
          if (link.psakei_din && !seenIds.has(link.psakei_din.id)) {
            if (path.amud) {
              const amudMatch = path.amud === 'עמוד א' ? 'א' : 'ב';
              if (link.amud && link.amud !== amudMatch) return;
            }
            seenIds.add(link.psakei_din.id);
            psakim.push({
              ...link.psakei_din,
              connection_explanation: link.source_text
            });
          }
        });

        // PRIORITY 3: Search in sugya_psak_links
        const masechetObj = MASECHTOT.find(m => m.hebrewName === path.masechet);
        if (masechetObj) {
          const sugyaIdBase = `${masechetObj.sefariaName.toLowerCase()}_${path.daf}`;
          
          const { data: sugyaLinks } = await supabase
            .from('sugya_psak_links')
            .select(`
              connection_explanation,
              psakei_din:psak_din_id (id, title, court, year, summary, tags, source_url, source_id)
            `)
            .or(`sugya_id.ilike.${sugyaIdBase}%`);

          sugyaLinks?.forEach((link: any) => {
            if (link.psakei_din && !seenIds.has(link.psakei_din.id)) {
              seenIds.add(link.psakei_din.id);
              psakim.push({
                ...link.psakei_din,
                connection_explanation: link.connection_explanation
              });
            }
          });
        }
      }

      console.log(`Total psakim found: ${psakim.length}`);
      setLinkedPsakim(psakim);
    } catch (error) {
      console.error('Error loading linked psakim:', error);
      setLinkedPsakim([]);
    } finally {
      setLoadingPsakim(false);
    }
  };

  const handleTopicSubjectClick = async (node: TreeNode) => {
    setSelectedSubjectId(node.id);
    setCurrentPath({ subjectId: node.id });
    setLoadingPsakim(true);
    
    try {
      // Search for psakim with matching tags
      const { data: psakim } = await supabase
        .from('psakei_din')
        .select('id, title, court, year, summary, tags, source_url, source_id')
        .or(`title.ilike.%${node.name}%,summary.ilike.%${node.name}%`)
        .limit(20);

      setLinkedPsakim(psakim || []);
    } catch (error) {
      console.error('Error loading psakim:', error);
      setLinkedPsakim([]);
    } finally {
      setLoadingPsakim(false);
    }
  };

  const navigateToGemara = (path: { masechet?: string; daf?: number; amud?: string }) => {
    if (!path.masechet || !path.daf) return;
    
    const masechetObj = MASECHTOT.find(m => m.hebrewName === path.masechet);
    if (!masechetObj) return;
    
    const amudSuffix = path.amud === 'עמוד א' ? 'a' : 'b';
    const sugyaId = `${masechetObj.sefariaName.toLowerCase()}_${path.daf}${amudSuffix}`;
    navigate(`/sugya/${sugyaId}`);
  };

  const handlePsakClick = async (psakId: string) => {
    const { data } = await supabase
      .from('psakei_din')
      .select('*')
      .eq('id', psakId)
      .maybeSingle();
    
    if (data) {
      setSelectedPsak(data);
      setDialogOpen(true);
    }
  };

  const renderTreeNode = (
    node: TreeNode, 
    depth: number = 0,
    path: { masechet?: string; daf?: number; amud?: string } = {},
    isTopics: boolean = false
  ) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedSubjectId === node.id;
    
    // Build path for navigation
    let currentNodePath = { ...path };
    
    // Check if this node is a masechet
    const isMasechet = MASECHTOT.some(m => m.hebrewName === node.name) || 
      node.name.includes('בבא') || node.name === 'סנהדרין' || node.name === 'קידושין' || 
      node.name === 'גיטין' || node.name === 'כתובות' || node.name === 'יבמות' ||
      node.name === 'שבת' || node.name === 'פסחים' || node.name === 'ברכות';
      
    if (isMasechet && !isTopics) {
      currentNodePath.masechet = node.name;
    }
    
    const isDaf = node.name.startsWith('דף ');
    const isAmud = node.name.startsWith('עמוד ');
    
    if (isDaf && !isTopics) {
      currentNodePath.daf = hebrewDafToNumber(node.name);
    }
    if (isAmud && !isTopics) {
      currentNodePath.amud = node.name;
    }

    // Get psakim count for this node
    let psakimCount = 0;
    if (!isTopics) {
      if (isMasechet) {
        psakimCount = psakimCountCache.byMasechet[node.name] || 0;
      } else if (isDaf && currentNodePath.masechet) {
        // Get Hebrew daf name from node.name (e.g., "דף ב" -> "ב")
        const dafMatch = node.name.match(/דף\s+(.+)/);
        if (dafMatch) {
          const dafKey = `${currentNodePath.masechet}|${dafMatch[1]}`;
          psakimCount = psakimCountCache.byDaf[dafKey] || 0;
        }
      } else if (isAmud && currentNodePath.masechet && currentNodePath.daf) {
        const amudLetter = node.name === 'עמוד א' ? 'א' : 'ב';
        const dafHebrew = numberToHebrewDaf(currentNodePath.daf);
        const amudKey = `${currentNodePath.masechet}|${dafHebrew}|${amudLetter}`;
        psakimCount = psakimCountCache.byAmud[amudKey] || 0;
      }
    }

    // Filter by search
    if (searchQuery) {
      const matchesSearch = node.name.includes(searchQuery);
      const childrenMatch = node.children?.some(child => 
        child.name.includes(searchQuery) || 
        child.children?.some(c => c.name.includes(searchQuery))
      );
      if (!matchesSearch && !childrenMatch) return null;
    }

    const paddingRight = depth * 16;

    // Subject node (leaf)
    if (node.type === 'subject') {
      return (
        <div
          key={node.id}
          className={`flex items-center gap-2 py-2 px-3 rounded-md cursor-pointer transition-colors
            ${isSelected ? 'bg-primary/10 border-r-2 border-primary' : 'hover:bg-muted/50'}
          `}
          style={{ paddingRight: `${paddingRight + 12}px` }}
          onClick={() => isTopics ? handleTopicSubjectClick(node) : handleSubjectClick(node, currentNodePath)}
        >
          <FileText className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm">{node.name}</span>
          {!isTopics && currentNodePath.masechet && currentNodePath.daf && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 mr-auto"
              onClick={(e) => {
                e.stopPropagation();
                navigateToGemara(currentNodePath);
              }}
            >
              <ExternalLink className="w-3 h-3 ml-1" />
              לדף הגמרא
            </Button>
          )}
        </div>
      );
    }

    // Shortcat node
    if (node.type === 'shortcat') {
      return (
        <div
          key={node.id}
          className="flex items-center gap-2 py-1 px-3 text-xs text-muted-foreground italic"
          style={{ paddingRight: `${paddingRight + 12}px` }}
        >
          <Hash className="w-3 h-3 shrink-0" />
          <span>{node.name}</span>
        </div>
      );
    }

    // Tag node (expandable)
    return (
      <Collapsible
        key={node.id}
        open={isExpanded}
        onOpenChange={() => toggleNode(node.id)}
      >
        <CollapsibleTrigger asChild>
          <div
            className={`flex items-center gap-2 py-2 px-3 rounded-md cursor-pointer transition-colors hover:bg-muted/50
              ${depth === 0 ? 'font-semibold text-lg' : ''}
              ${depth === 1 ? 'font-medium' : ''}
            `}
            style={{ paddingRight: `${paddingRight}px` }}
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" />
              )
            ) : (
              <div className="w-4" />
            )}
            
            {depth === 0 ? (
              isTopics ? <Tag className="w-5 h-5 text-primary shrink-0" /> : <FolderTree className="w-5 h-5 text-primary shrink-0" />
            ) : depth === 1 ? (
              <BookOpen className="w-4 h-4 text-primary shrink-0" />
            ) : (
              <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
            )}
            
            <span>{node.name}</span>
            
            {/* Show psakim count for masechet, daf, or amud */}
            {psakimCount > 0 && !isTopics && (
              <Badge variant="default" className="text-xs bg-primary/80 text-primary-foreground">
                <Scale className="w-3 h-3 ml-1" />
                {psakimCount}
              </Badge>
            )}
            
            {hasChildren && (
              <Badge variant="secondary" className="text-xs mr-auto">
                {node.children?.length}
              </Badge>
            )}
          </div>
        </CollapsibleTrigger>
        
        {hasChildren && (
          <CollapsibleContent>
            {node.children!.map(child => renderTreeNode(child, depth + 1, currentNodePath, isTopics))}
          </CollapsibleContent>
        )}
      </Collapsible>
    );
  };

  // Get the בבלי branch
  const bavliTree = useMemo(() => {
    if (!sourcesHierarchy) return null;
    const sourcesRoot = sourcesHierarchy.tree.find(n => n.name === 'מפתח המקורות');
    return sourcesRoot?.children?.find(n => n.name === 'בבלי') || null;
  }, [sourcesHierarchy]);

  // Get topics tree
  const topicsTree = useMemo(() => {
    if (!topicsHierarchy) return null;
    return topicsHierarchy.tree.find(n => n.name === 'מפתח הנושאים') || null;
  }, [topicsHierarchy]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" dir="rtl">
      {/* Left side: Tree navigation */}
      <Card>
        <CardHeader className="pb-3">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="sources" className="flex-1 gap-2">
                <FolderTree className="w-4 h-4" />
                מקורות
              </TabsTrigger>
              <TabsTrigger value="topics" className="flex-1 gap-2">
                <Tag className="w-4 h-4" />
                נושאים
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative mt-3">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={activeTab === 'sources' ? "חיפוש במסכתות..." : "חיפוש בנושאים..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            {activeTab === 'sources' && bavliTree && renderTreeNode(bavliTree, 0, {}, false)}
            {activeTab === 'topics' && topicsTree && renderTreeNode(topicsTree, 0, {}, true)}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Right side: Linked Psakim */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-primary" />
            פסקי דין מקושרים
            {linkedPsakim.length > 0 && (
              <Badge variant="secondary">{linkedPsakim.length}</Badge>
            )}
          </CardTitle>
          {currentPath.masechet && currentPath.daf && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
              <span>{currentPath.masechet}</span>
              <span>•</span>
              <span>דף {currentPath.daf}</span>
              {currentPath.amud && (
                <>
                  <span>•</span>
                  <span>{currentPath.amud}</span>
                </>
              )}
              {currentPath.subjectId && (
                <>
                  <span>•</span>
                  <Badge variant="outline" className="text-xs">
                    ID: {currentPath.subjectId}
                  </Badge>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                className="mr-auto"
                onClick={() => navigateToGemara(currentPath)}
              >
                <ExternalLink className="w-4 h-4 ml-1" />
                עבור לדף הגמרא
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[550px]">
            {loadingPsakim ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : linkedPsakim.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {selectedSubjectId ? (
                  <div>
                    <p className="mb-2">לא נמצאו פסקי דין מקושרים</p>
                    <p className="text-xs">ID: {selectedSubjectId}</p>
                  </div>
                ) : (
                  <p>בחר נושא מהעץ לצפייה בפסקי דין מקושרים</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {linkedPsakim.map((psak) => (
                  <div
                    key={psak.id}
                    className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => handlePsakClick(psak.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-foreground mb-1">
                        {psak.title}
                      </div>
                      {psak.source_id && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          #{psak.source_id}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mb-2">
                      {psak.court} • {psak.year}
                    </div>
                    {psak.connection_explanation && (
                      <div className="text-xs text-primary/80 mb-2 bg-primary/5 rounded px-2 py-1">
                        📍 {psak.connection_explanation}
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {psak.summary}
                    </p>
                    {psak.tags && psak.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {psak.tags.slice(0, 3).map((tag, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <PsakDinViewDialog
        psak={selectedPsak}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
};

export default SourcesTreeIndex;
