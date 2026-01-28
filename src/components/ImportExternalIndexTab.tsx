import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  Upload, FileJson, Database, CheckCircle2, AlertCircle,
  Loader2, BookOpen, Link2, RefreshCw, FolderArchive, FileText, Eye
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fromHebrewNumeral } from "@/lib/hebrewNumbers";
import JSZip from "jszip";
import { Archive } from "libarchive.js";

// Map Hebrew masechet names to English for sugya_id
const MASECHET_MAP: Record<string, string> = {
  'בבא בתרא': 'Bava_Batra',
  'בבא קמא': 'Bava_Kamma',
  'בבא מציעא': 'Bava_Metzia',
  'סנהדרין': 'Sanhedrin',
  'כתובות': 'Ketubot',
  'גיטין': 'Gittin',
  'קידושין': 'Kiddushin',
  'יבמות': 'Yevamot',
  'נדרים': 'Nedarim',
  'שבועות': 'Shevuot',
  'מכות': 'Makkot',
  'חולין': 'Chullin',
  'מנחות': 'Menachot',
  'ערכין': 'Arakhin',
  'בכורות': 'Bekhorot',
  'זבחים': 'Zevachim',
  'כריתות': 'Keritot',
  'תמורה': 'Temurah',
  'מעילה': 'Meilah',
  'עבודה זרה': 'Avodah_Zarah',
  'הוריות': 'Horayot',
  'שבת': 'Shabbat',
  'עירובין': 'Eruvin',
  'פסחים': 'Pesachim',
  'ביצה': 'Beitzah',
  'ראש השנה': 'Rosh_Hashanah',
  'יומא': 'Yoma',
  'סוכה': 'Sukkah',
  'תענית': 'Taanit',
  'מגילה': 'Megillah',
  'מועד קטן': 'Moed_Katan',
  'חגיגה': 'Chagigah',
  'ברכות': 'Berakhot',
  'סוטה': 'Sotah',
  'נזיר': 'Nazir',
};

// Patterns to detect index files vs psak din documents
const INDEX_PATTERNS = {
  // JSON fields that indicate an index file
  jsonFields: ['connections', 'psak_id', 'masechet', 'daf', 'amud', 'gemara'],
  // CSV headers that indicate an index file  
  csvHeaders: ['psak_id', 'masechet', 'daf', 'amud', 'psak_title'],
  // Filename patterns for index files
  fileNames: ['index', 'gemara', 'psakim', 'connections', 'links']
};

interface ImportConnection {
  psak_id: string;
  psak_title: string;
  masechet: string;
  daf: string;
  amud: string;
  detection_method: string;
  source: string;
  confidence: number;
}

interface ImportStats {
  total_connections: number;
  unique_psakim: number;
  by_masechet: Record<string, number>;
}

interface ImportData {
  version: string;
  exported_at: string;
  stats: ImportStats;
  connections: ImportConnection[];
}

interface DetectedFile {
  name: string;
  type: 'index' | 'psak_din' | 'unknown';
  format: 'json' | 'csv' | 'txt' | 'html' | 'xml' | 'other';
  size: number;
  content?: string;
  preview?: string;
  parsedData?: any;
}

interface ZipAnalysis {
  totalFiles: number;
  indexFiles: DetectedFile[];
  psakDinFiles: DetectedFile[];
  unknownFiles: DetectedFile[];
}

const ImportExternalIndexTab = () => {
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, phase: '' });
  const [importResult, setImportResult] = useState<{
    success: boolean;
    newPsakim: number;
    matchedPsakim: number;
    newLinks: number;
    duplicateLinks: number;
    errors: string[];
  } | null>(null);
  const [fileData, setFileData] = useState<ImportData | null>(null);
  const [zipAnalysis, setZipAnalysis] = useState<ZipAnalysis | null>(null);
  const [analyzingZip, setAnalyzingZip] = useState(false);
  const [selectedIndexFile, setSelectedIndexFile] = useState<DetectedFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await loadJsonData(await file.text());
  };

  const loadBundledFile = async () => {
    try {
      const response = await fetch('/data/gemara_psakim_index.json');
      if (!response.ok) throw new Error('Failed to load bundled file');
      const text = await response.text();
      await loadJsonData(text);
    } catch (error) {
      toast({
        title: "שגיאה בטעינת הקובץ המובנה",
        variant: "destructive",
      });
    }
  };

  const loadJsonData = async (text: string) => {
    try {
      const data: ImportData = JSON.parse(text);
      
      if (!data.connections || !Array.isArray(data.connections)) {
        throw new Error('Invalid file format');
      }

      setFileData(data);
      setImportResult(null);
      
      toast({
        title: "קובץ נטען",
        description: `נמצאו ${data.stats.unique_psakim} פסקים ייחודיים עם ${data.stats.total_connections} חיבורים`,
      });
    } catch (error) {
      toast({
        title: "שגיאה בקריאת הקובץ",
        description: "הקובץ לא בפורמט JSON תקין",
        variant: "destructive",
      });
    }
  };

  const generateSugyaId = (masechet: string, daf: string, amud: string): string | null => {
    const englishMasechet = MASECHET_MAP[masechet];
    if (!englishMasechet) return null;

    const dafNum = fromHebrewNumeral(daf);
    if (!dafNum) return null;

    const amudLetter = amud === 'א' ? 'a' : amud === 'ב' ? 'b' : 'a';
    return `${englishMasechet}.${dafNum}${amudLetter}`;
  };

  const runImport = async () => {
    if (!fileData) return;

    setImporting(true);
    const result = {
      success: true,
      newPsakim: 0,
      matchedPsakim: 0,
      newLinks: 0,
      duplicateLinks: 0,
      errors: [] as string[]
    };

    try {
      // Phase 1: Get existing psakim with source_id
      setImportProgress({ current: 0, total: 100, phase: 'בודק פסקי דין קיימים...' });
      
      const { data: existingPsakim } = await supabase
        .from('psakei_din')
        .select('id, source_id, title');

      const psakimBySourceId = new Map<string, string>();
      const psakimByTitle = new Map<string, string>();
      
      existingPsakim?.forEach(p => {
        if (p.source_id) {
          psakimBySourceId.set(String(p.source_id), p.id);
        }
        psakimByTitle.set(p.title.toLowerCase().trim(), p.id);
      });

      // Phase 2: Group connections by psak_id
      const connectionsByPsak = new Map<string, ImportConnection[]>();
      for (const conn of fileData.connections) {
        const key = conn.psak_id;
        if (!connectionsByPsak.has(key)) {
          connectionsByPsak.set(key, []);
        }
        connectionsByPsak.get(key)!.push(conn);
      }

      // Phase 3: Process each unique psak
      setImportProgress({ current: 10, total: 100, phase: 'מעבד פסקי דין...' });
      
      const psakIdToUuid = new Map<string, string>();
      const uniquePsakIds = Array.from(connectionsByPsak.keys());
      const newPsakimToInsert: any[] = [];

      for (let i = 0; i < uniquePsakIds.length; i++) {
        const psakId = uniquePsakIds[i];
        const connections = connectionsByPsak.get(psakId)!;
        const firstConn = connections[0];

        // Try to find existing psak
        let uuid = psakimBySourceId.get(psakId);
        
        if (!uuid) {
          // Try to match by title
          const titleKey = firstConn.psak_title.toLowerCase().trim();
          uuid = psakimByTitle.get(titleKey);
        }

        if (uuid) {
          psakIdToUuid.set(psakId, uuid);
          result.matchedPsakim++;
        } else {
          // Create new psak entry
          newPsakimToInsert.push({
            title: firstConn.psak_title,
            source_id: parseInt(psakId) || null,
            court: 'psakim.org',
            year: new Date().getFullYear(),
            summary: `פסק דין מאינדקס חיצוני - ${firstConn.psak_title}`,
          });
        }

        if (i % 100 === 0) {
          setImportProgress({ 
            current: 10 + Math.round((i / uniquePsakIds.length) * 30), 
            total: 100, 
            phase: `מעבד פסקי דין... ${i}/${uniquePsakIds.length}` 
          });
        }
      }

      // Insert new psakim
      if (newPsakimToInsert.length > 0) {
        setImportProgress({ current: 40, total: 100, phase: `מוסיף ${newPsakimToInsert.length} פסקי דין חדשים...` });
        
        const batchSize = 100;
        for (let i = 0; i < newPsakimToInsert.length; i += batchSize) {
          const batch = newPsakimToInsert.slice(i, i + batchSize);
          const { data: inserted, error } = await supabase
            .from('psakei_din')
            .insert(batch)
            .select('id, source_id, title');

          if (error) {
            result.errors.push(`שגיאה בהוספת פסקים: ${error.message}`);
          } else if (inserted) {
            inserted.forEach(p => {
              if (p.source_id) {
                psakIdToUuid.set(String(p.source_id), p.id);
              }
              result.newPsakim++;
            });
          }
        }
      }

      // Phase 4: Get existing links to avoid duplicates
      setImportProgress({ current: 60, total: 100, phase: 'בודק חיבורים קיימים...' });
      
      const { data: existingLinks } = await supabase
        .from('pattern_sugya_links')
        .select('psak_din_id, sugya_id');

      const existingLinkSet = new Set<string>();
      existingLinks?.forEach(l => {
        existingLinkSet.add(`${l.psak_din_id}:${l.sugya_id}`);
      });

      // Phase 5: Create pattern links
      setImportProgress({ current: 70, total: 100, phase: 'יוצר חיבורים לגמרא...' });
      
      const linksToInsert: any[] = [];
      const seenLinks = new Set<string>();

      for (const [psakId, connections] of connectionsByPsak) {
        const uuid = psakIdToUuid.get(psakId);
        if (!uuid) continue;

        for (const conn of connections) {
          const sugyaId = generateSugyaId(conn.masechet, conn.daf, conn.amud);
          if (!sugyaId) continue;

          const linkKey = `${uuid}:${sugyaId}`;
          
          // Skip if already exists or already in our batch
          if (existingLinkSet.has(linkKey) || seenLinks.has(linkKey)) {
            result.duplicateLinks++;
            continue;
          }

          seenLinks.add(linkKey);
          linksToInsert.push({
            psak_din_id: uuid,
            sugya_id: sugyaId,
            masechet: conn.masechet,
            daf: conn.daf,
            amud: conn.amud,
            source_text: conn.psak_title,
            confidence: conn.confidence === 1 ? 'high' : 'medium'
          });
        }
      }

      // Insert links in batches
      setImportProgress({ current: 80, total: 100, phase: `מוסיף ${linksToInsert.length} חיבורים...` });
      
      const linkBatchSize = 200;
      for (let i = 0; i < linksToInsert.length; i += linkBatchSize) {
        const batch = linksToInsert.slice(i, i + linkBatchSize);
        const { error } = await supabase
          .from('pattern_sugya_links')
          .insert(batch);

        if (error) {
          result.errors.push(`שגיאה בהוספת חיבורים: ${error.message}`);
        } else {
          result.newLinks += batch.length;
        }

        setImportProgress({ 
          current: 80 + Math.round((i / linksToInsert.length) * 20), 
          total: 100, 
          phase: `מוסיף חיבורים... ${Math.min(i + linkBatchSize, linksToInsert.length)}/${linksToInsert.length}` 
        });
      }

      setImportProgress({ current: 100, total: 100, phase: 'הושלם!' });
      result.success = result.errors.length === 0;
      setImportResult(result);

      toast({
        title: result.success ? "ייבוא הושלם בהצלחה" : "ייבוא הושלם עם שגיאות",
        description: `${result.newPsakim} פסקים חדשים, ${result.newLinks} חיבורים חדשים`,
        variant: result.success ? "default" : "destructive",
      });

    } catch (error) {
      console.error('Import error:', error);
      result.errors.push(`שגיאה כללית: ${error}`);
      result.success = false;
      setImportResult(result);

      toast({
        title: "שגיאה בייבוא",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  // ZIP Analysis Functions
  const getFileFormat = (fileName: string): DetectedFile['format'] => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'json') return 'json';
    if (ext === 'csv') return 'csv';
    if (ext === 'txt') return 'txt';
    if (ext === 'html' || ext === 'htm') return 'html';
    if (ext === 'xml') return 'xml';
    return 'other';
  };

  const detectFileType = async (fileName: string, content: string, format: DetectedFile['format']): Promise<DetectedFile['type']> => {
    const lowerName = fileName.toLowerCase();
    
    // Check filename patterns for index files
    if (INDEX_PATTERNS.fileNames.some(p => lowerName.includes(p))) {
      return 'index';
    }

    // Analyze content based on format
    if (format === 'json') {
      try {
        const data = JSON.parse(content);
        // Check if it has index-like structure
        if (data.connections && Array.isArray(data.connections)) return 'index';
        if (Array.isArray(data) && data.length > 0) {
          const first = data[0];
          if (INDEX_PATTERNS.jsonFields.some(f => first[f] !== undefined)) return 'index';
        }
        // Check if it looks like a psak din
        if (data.title || data.court || data.full_text) return 'psak_din';
      } catch {
        // Invalid JSON
      }
    }

    if (format === 'csv') {
      const firstLine = content.split('\n')[0]?.toLowerCase() || '';
      if (INDEX_PATTERNS.csvHeaders.some(h => firstLine.includes(h))) return 'index';
    }

    // Check content for psak din indicators
    const hebrewIndicators = ['בית משפט', 'פסק דין', 'התובע', 'הנתבע', 'בפני', 'פסיקה'];
    if (hebrewIndicators.some(ind => content.includes(ind))) {
      return 'psak_din';
    }

    return 'unknown';
  };

  const analyzeArchiveFile = async (file: File) => {
    setAnalyzingZip(true);
    setZipAnalysis(null);
    setSelectedIndexFile(null);

    const fileName = file.name.toLowerCase();
    const isRar = fileName.endsWith('.rar');
    const is7z = fileName.endsWith('.7z');
    const isZip = fileName.endsWith('.zip');

    try {
      const analysis: ZipAnalysis = {
        totalFiles: 0,
        indexFiles: [],
        psakDinFiles: [],
        unknownFiles: []
      };

      const supportedExtensions = ['json', 'csv', 'txt', 'html', 'htm', 'xml'];
      
      if (isRar || is7z) {
        // Use libarchive.js for RAR and 7z files
        try {
          // Initialize Archive with worker from CDN
          Archive.init({
            workerUrl: 'https://unpkg.com/libarchive.js@1.3.0/dist/worker-bundle.js'
          });

          const archive = await Archive.open(file);
          const extractedFiles = await archive.extractFiles();
          
          // Flatten the extracted files object
          const flattenFiles = (obj: any, prefix = ''): Array<{name: string, file: File}> => {
            const result: Array<{name: string, file: File}> = [];
            for (const [key, value] of Object.entries(obj)) {
              const fullPath = prefix ? `${prefix}/${key}` : key;
              if (value instanceof File) {
                result.push({ name: fullPath, file: value });
              } else if (typeof value === 'object' && value !== null) {
                result.push(...flattenFiles(value, fullPath));
              }
            }
            return result;
          };

          const allFiles = flattenFiles(extractedFiles);
          const filteredFiles = allFiles.filter(({ name }) => {
            const ext = name.split('.').pop()?.toLowerCase();
            return ext && supportedExtensions.includes(ext);
          });

          analysis.totalFiles = filteredFiles.length;

          for (const { name, file: extractedFile } of filteredFiles) {
            try {
              const content = await extractedFile.text();
              const format = getFileFormat(name);
              const type = await detectFileType(name, content, format);

              const detectedFile: DetectedFile = {
                name: name.split('/').pop() || name,
                type,
                format,
                size: content.length,
                content,
                preview: content.substring(0, 500) + (content.length > 500 ? '...' : '')
              };

              if (type === 'index' && format === 'json') {
                try {
                  detectedFile.parsedData = JSON.parse(content);
                } catch {}
              }

              if (type === 'index') {
                analysis.indexFiles.push(detectedFile);
              } else if (type === 'psak_din') {
                analysis.psakDinFiles.push(detectedFile);
              } else {
                analysis.unknownFiles.push(detectedFile);
              }
            } catch (e) {
              console.error(`Error processing ${name}:`, e);
            }
          }
        } catch (rarError) {
          console.error('RAR/7z analysis error:', rarError);
          throw new Error('שגיאה בפתיחת קובץ RAR/7z');
        }
      } else {
        // Use JSZip for ZIP files
        const zip = await JSZip.loadAsync(file);
        
        const files = Object.entries(zip.files).filter(([name, f]) => {
          if (f.dir) return false;
          const ext = name.split('.').pop()?.toLowerCase();
          return ext && supportedExtensions.includes(ext);
        });

        analysis.totalFiles = files.length;

        for (const [entryName, zipEntry] of files) {
          try {
            const content = await zipEntry.async('string');
            const format = getFileFormat(entryName);
            const type = await detectFileType(entryName, content, format);

            const detectedFile: DetectedFile = {
              name: entryName.split('/').pop() || entryName,
              type,
              format,
              size: content.length,
              content,
              preview: content.substring(0, 500) + (content.length > 500 ? '...' : '')
            };

            if (type === 'index' && format === 'json') {
              try {
                detectedFile.parsedData = JSON.parse(content);
              } catch {}
            }

            if (type === 'index') {
              analysis.indexFiles.push(detectedFile);
            } else if (type === 'psak_din') {
              analysis.psakDinFiles.push(detectedFile);
            } else {
              analysis.unknownFiles.push(detectedFile);
            }
          } catch (e) {
            console.error(`Error processing ${entryName}:`, e);
          }
        }
      }

      setZipAnalysis(analysis);
      
      toast({
        title: "ניתוח ארכיון הושלם",
        description: `נמצאו ${analysis.indexFiles.length} קבצי אינדקס, ${analysis.psakDinFiles.length} פסקי דין`,
      });

    } catch (error) {
      console.error('Archive analysis error:', error);
      toast({
        title: "שגיאה בניתוח הקובץ",
        description: error instanceof Error ? error.message : "לא ניתן לפתוח את הארכיון",
        variant: "destructive",
      });
    } finally {
      setAnalyzingZip(false);
    }
  };

  const handleArchiveSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await analyzeArchiveFile(file);
  };

  const selectIndexForImport = async (file: DetectedFile) => {
    setSelectedIndexFile(file);
    if (file.content) {
      await loadJsonData(file.content);
    }
  };

  const importPsakDinFiles = async () => {
    if (!zipAnalysis?.psakDinFiles.length) return;

    setImporting(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (let i = 0; i < zipAnalysis.psakDinFiles.length; i++) {
        const file = zipAnalysis.psakDinFiles[i];
        setImportProgress({
          current: Math.round((i / zipAnalysis.psakDinFiles.length) * 100),
          total: 100,
          phase: `מייבא פסק דין: ${file.name}`
        });

        try {
          // Extract title from filename or content
          const title = file.name.replace(/\.[^/.]+$/, '');
          
          const { error } = await supabase.from('psakei_din').insert({
            title,
            court: 'ייבוא ZIP',
            year: new Date().getFullYear(),
            summary: file.preview || title,
            full_text: file.content
          });

          if (error) {
            errorCount++;
          } else {
            successCount++;
          }
        } catch {
          errorCount++;
        }
      }

      toast({
        title: "ייבוא פסקי דין הושלם",
        description: `${successCount} הצליחו, ${errorCount} נכשלו`,
        variant: errorCount > 0 ? "destructive" : "default"
      });

    } finally {
      setImporting(false);
      setImportProgress({ current: 100, total: 100, phase: 'הושלם' });
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <Tabs defaultValue="zip" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="zip">
            <FolderArchive className="w-4 h-4 ml-2" />
            ניתוח ZIP חכם
          </TabsTrigger>
          <TabsTrigger value="json">
            <FileJson className="w-4 h-4 ml-2" />
            ייבוא JSON ישיר
          </TabsTrigger>
        </TabsList>

        <TabsContent value="zip" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderArchive className="w-5 h-5" />
                ניתוח קובץ ארכיון (ZIP/RAR/7z)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                העלה קובץ ZIP, RAR או 7z והמערכת תזהה אוטומטית קבצי אינדקס (JSON/CSV) ופסקי דין (TXT/HTML).
              </p>

              <input
                ref={zipInputRef}
                type="file"
                accept=".zip,.rar,.7z"
                onChange={handleArchiveSelect}
                className="hidden"
              />
              
              <Button
                onClick={() => zipInputRef.current?.click()}
                variant="outline"
                disabled={analyzingZip}
                className="w-full"
              >
                {analyzingZip ? (
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 ml-2" />
                )}
                {analyzingZip ? 'מנתח...' : 'בחר קובץ ZIP/RAR/7z'}
              </Button>

              {zipAnalysis && (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-3">
                    <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                      <CardContent className="p-3 text-center">
                        <div className="text-2xl font-bold text-green-600">{zipAnalysis.indexFiles.length}</div>
                        <div className="text-xs text-muted-foreground">קבצי אינדקס</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                      <CardContent className="p-3 text-center">
                        <div className="text-2xl font-bold text-blue-600">{zipAnalysis.psakDinFiles.length}</div>
                        <div className="text-xs text-muted-foreground">פסקי דין</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/50">
                      <CardContent className="p-3 text-center">
                        <div className="text-2xl font-bold">{zipAnalysis.unknownFiles.length}</div>
                        <div className="text-xs text-muted-foreground">לא מזוהים</div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Index Files */}
                  {zipAnalysis.indexFiles.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Database className="w-4 h-4" />
                          קבצי אינדקס ({zipAnalysis.indexFiles.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-40">
                          <div className="space-y-2">
                            {zipAnalysis.indexFiles.map((file, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                                <div className="flex items-center gap-2">
                                  <FileJson className="w-4 h-4 text-green-600" />
                                  <div>
                                    <div className="text-sm font-medium">{file.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {file.format.toUpperCase()} • {(file.size / 1024).toFixed(1)} KB
                                      {file.parsedData?.stats?.total_connections && (
                                        <span> • {file.parsedData.stats.total_connections} חיבורים</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => selectIndexForImport(file)}
                                  disabled={selectedIndexFile?.name === file.name}
                                >
                                  {selectedIndexFile?.name === file.name ? 'נבחר' : 'בחר לייבוא'}
                                </Button>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}

                  {/* Psak Din Files */}
                  {zipAnalysis.psakDinFiles.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            פסקי דין ({zipAnalysis.psakDinFiles.length})
                          </div>
                          <Button size="sm" onClick={importPsakDinFiles} disabled={importing}>
                            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'ייבא הכל'}
                          </Button>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-40">
                          <div className="space-y-2">
                            {zipAnalysis.psakDinFiles.slice(0, 20).map((file, idx) => (
                              <div key={idx} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                                <FileText className="w-4 h-4 text-blue-600" />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium truncate">{file.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {file.format.toUpperCase()} • {(file.size / 1024).toFixed(1)} KB
                                  </div>
                                </div>
                              </div>
                            ))}
                            {zipAnalysis.psakDinFiles.length > 20 && (
                              <div className="text-xs text-muted-foreground text-center py-2">
                                ועוד {zipAnalysis.psakDinFiles.length - 20} קבצים...
                              </div>
                            )}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}

                  {/* Unknown Files */}
                  {zipAnalysis.unknownFiles.length > 0 && (
                    <Card className="border-dashed">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                          <Eye className="w-4 h-4" />
                          קבצים לא מזוהים ({zipAnalysis.unknownFiles.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-1">
                          {zipAnalysis.unknownFiles.slice(0, 10).map((file, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {file.name}
                            </Badge>
                          ))}
                          {zipAnalysis.unknownFiles.length > 10 && (
                            <Badge variant="outline" className="text-xs">
                              +{zipAnalysis.unknownFiles.length - 10}
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="json" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileJson className="w-5 h-5" />
                ייבוא אינדקס JSON
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                ייבא קובץ JSON עם חיבורים בין פסקי דין לסוגיות גמרא.
              </p>

              <div className="flex gap-2 flex-wrap">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  disabled={importing}
                >
                  <Upload className="w-4 h-4 ml-2" />
                  בחר קובץ JSON
                </Button>

                <Button
                  onClick={loadBundledFile}
                  variant="outline"
                  disabled={importing}
                >
                  <Database className="w-4 h-4 ml-2" />
                  טען אינדקס מובנה (2997 חיבורים)
                </Button>

                {fileData && (
                  <Button
                    onClick={runImport}
                    disabled={importing}
                  >
                    {importing ? (
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    ) : (
                      <Database className="w-4 h-4 ml-2" />
                    )}
                    התחל ייבוא
                  </Button>
                )}
              </div>

              {fileData && !importing && !importResult && (
                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold">{fileData.stats.unique_psakim}</div>
                        <div className="text-xs text-muted-foreground">פסקים ייחודיים</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{fileData.stats.total_connections}</div>
                        <div className="text-xs text-muted-foreground">חיבורים לגמרא</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{Object.keys(fileData.stats.by_masechet).length}</div>
                        <div className="text-xs text-muted-foreground">מסכתות</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{fileData.version}</div>
                        <div className="text-xs text-muted-foreground">גרסת קובץ</div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="text-sm font-medium mb-2">מסכתות בקובץ:</div>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(fileData.stats.by_masechet)
                          .sort((a, b) => b[1] - a[1])
                          .map(([masechet, count]) => (
                            <Badge key={masechet} variant="outline" className="text-xs">
                              {masechet}: {count}
                            </Badge>
                          ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {importing && (
                <Card>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">{importProgress.phase}</span>
                    </div>
                    <Progress value={importProgress.current} max={100} />
                    <div className="text-xs text-muted-foreground text-center">
                      {importProgress.current}%
                    </div>
                  </CardContent>
                </Card>
              )}

              {importResult && (
                <Card className={importResult.success ? "border-green-500" : "border-destructive"}>
                  <CardContent className="pt-4 space-y-4">
                    <div className="flex items-center gap-2">
                      {importResult.success ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-destructive" />
                      )}
                      <span className="font-medium">
                        {importResult.success ? "ייבוא הושלם בהצלחה" : "ייבוא הושלם עם שגיאות"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div>
                        <div className="text-xl font-bold text-green-600">{importResult.newPsakim}</div>
                        <div className="text-xs text-muted-foreground">פסקים חדשים</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-blue-600">{importResult.matchedPsakim}</div>
                        <div className="text-xs text-muted-foreground">פסקים מותאמים</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-green-600">{importResult.newLinks}</div>
                        <div className="text-xs text-muted-foreground">חיבורים חדשים</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-muted-foreground">{importResult.duplicateLinks}</div>
                        <div className="text-xs text-muted-foreground">כפילויות שנדלגו</div>
                      </div>
                    </div>

                    {importResult.errors.length > 0 && (
                      <div className="mt-4">
                        <div className="text-sm font-medium text-destructive mb-2">שגיאות:</div>
                        <ScrollArea className="h-32">
                          {importResult.errors.map((err, i) => (
                            <div key={i} className="text-xs text-destructive">{err}</div>
                          ))}
                        </ScrollArea>
                      </div>
                    )}

                    <Button
                      variant="outline"
                      onClick={() => {
                        setFileData(null);
                        setImportResult(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    >
                      <RefreshCw className="w-4 h-4 ml-2" />
                      ייבוא נוסף
                    </Button>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ImportExternalIndexTab;
