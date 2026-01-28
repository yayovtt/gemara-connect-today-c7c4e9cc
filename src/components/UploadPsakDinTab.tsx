import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileText, Archive, X, Loader2, CheckCircle, AlertCircle, FolderUp, Sparkles, Brain, Copy, Ban, Hash, Layers, RefreshCw, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast, toast } from "@/hooks/use-toast";
import { useUploadStore } from "@/stores/uploadStore";
import { useUploadController } from "@/hooks/useUploadController";
import { calculateFileHashes } from "@/lib/fileHash";
import { isOnline } from "@/lib/uploadUtils";
import UploadSummaryDialog from "./UploadSummaryDialog";
import PsakDinStats from "./PsakDinStats";
import JSZip from "jszip";

interface DuplicateFile {
  name: string;
  file: File;
  reason: 'title' | 'hash';
  existingTitle?: string;
  existingId?: string;
}

interface ExtractedZip {
  name: string;
  files: File[];
}

const UploadPsakDinTab = () => {
  const [extractedZips, setExtractedZips] = useState<ExtractedZip[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateFile[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [hashProgress, setHashProgress] = useState<{ current: number; total: number } | null>(null);
  const [extractProgress, setExtractProgress] = useState<{ current: number; total: number; zipName: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const { toast: showToast } = useToast();
  
  const [court, setCourt] = useState("");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [tags, setTags] = useState("");
  const [showSummary, setShowSummary] = useState(false);
  const [completedSessionId, setCompletedSessionId] = useState<string | undefined>();
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [overwritingDuplicates, setOverwritingDuplicates] = useState(false);
  
  // Use the upload controller hook
  const {
    sessions,
    getActiveSessions,
    uploadFiles,
    analyzeExisting,
    clearSession,
    clearAllSessions,
  } = useUploadController({
    onComplete: (sessionId) => {
      setCompletedSessionId(sessionId);
      setShowSummary(true);
    },
  });
  
  // Clean up stale sessions on mount
  const { cleanupStaleSessions, addFileHash, hasFileHash, getFileByHash } = useUploadStore();
  useState(() => {
    cleanupStaleSessions();
  });
  
  // Derived state
  const activeSessions = getActiveSessions();
  const isActive = activeSessions.length > 0;

  // Check for duplicates - only against DATABASE (not local cache)
  // Local hash cache is only populated AFTER successful upload
  const checkDuplicates = useCallback(async (filesToCheck: File[]): Promise<File[]> => {
    if (filesToCheck.length === 0) return [];
    
    setCheckingDuplicates(true);
    
    try {
      // Step 1: Calculate file hashes for content-based duplicate detection
      setHashProgress({ current: 0, total: filesToCheck.length });
      const fileHashes = await calculateFileHashes(filesToCheck, (completed, total) => {
        setHashProgress({ current: completed, total });
      });
      setHashProgress(null);
      
      // Step 2: Get existing records from DATABASE (the source of truth)
      const { data: existingPsakim } = await supabase
        .from('psakei_din')
        .select('id, title, content_hash');
      
      const existingTitlesMap = new Map(
        (existingPsakim || []).map(p => [p.title.toLowerCase().trim(), p.id])
      );
      
      // Create map of existing content hashes from DATABASE
      const existingHashesMap = new Map(
        (existingPsakim || [])
          .filter(p => p.content_hash)
          .map(p => [p.content_hash!, { id: p.id, title: p.title }])
      );
      
      const foundDuplicates: DuplicateFile[] = [];
      const uniqueFiles: File[] = [];
      
      for (const file of filesToCheck) {
        const baseName = file.name.replace(/\.[^/.]+$/, '').toLowerCase().trim();
        const hash = fileHashes.get(file.name);
        
        // Check content hash against DATABASE (not local cache)
        if (hash && existingHashesMap.has(hash)) {
          const matchingPsak = existingHashesMap.get(hash);
          foundDuplicates.push({
            name: file.name,
            file,
            reason: 'hash',
            existingTitle: matchingPsak?.title || 'קובץ קיים',
            existingId: matchingPsak?.id,
          });
          continue;
        }
        
        // Check title match against DATABASE
        const matchingTitle = Array.from(existingTitlesMap.entries()).find(([title, _]) => 
          title.includes(baseName) || baseName.includes(title)
        );
        
        if (matchingTitle) {
          foundDuplicates.push({
            name: file.name,
            file,
            reason: 'title',
            existingTitle: matchingTitle[0],
            existingId: matchingTitle[1],
          });
        } else {
          uniqueFiles.push(file);
          // NOTE: We do NOT save hash here anymore - only after successful upload
        }
      }
      
      if (foundDuplicates.length > 0) {
        setDuplicates(prev => [...prev, ...foundDuplicates]);
        
        // Show toast notification
        toast({
          title: `נמצאו ${foundDuplicates.length} קבצים כפולים`,
          description: "קבצים אלו כבר קיימים במאגר",
          variant: "destructive",
        });
      }
      
      return uniqueFiles;
      
    } catch (error) {
      console.error('Error checking duplicates:', error);
      return filesToCheck;
    } finally {
      setCheckingDuplicates(false);
    }
  }, []);

  // Debug logging helper
  const addDebug = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString('he-IL');
    const logMsg = `[${timestamp}] ${message}`;
    console.log(logMsg);
    setDebugLog(prev => [...prev.slice(-50), logMsg]); // Keep last 50 logs
  }, []);

  // Extract files from ZIP with progress tracking
  const extractZipFiles = useCallback(async (zipFile: File): Promise<File[]> => {
    const extractedFiles: File[] = [];
    addDebug(`📦 מתחיל לחלץ ZIP: ${zipFile.name} (${(zipFile.size / 1024 / 1024).toFixed(2)} MB)`);
    
    try {
      addDebug(`⏳ טוען ZIP לזכרון...`);
      const zip = await JSZip.loadAsync(zipFile);
      const validExts = ['pdf', 'docx', 'doc', 'txt', 'rtf', 'html', 'htm', 'json', 'xml'];
      
      const entries = Object.entries(zip.files).filter(([_, entry]) => !entry.dir);
      addDebug(`📁 נמצאו ${entries.length} קבצים בתוך ה-ZIP`);
      
      setExtractProgress({ current: 0, total: entries.length, zipName: zipFile.name });
      
      let validCount = 0;
      let skippedCount = 0;
      
      for (let i = 0; i < entries.length; i++) {
        const [path, zipEntry] = entries[i];
        const fileName = path.split('/').pop() || path;
        const ext = fileName.split('.').pop()?.toLowerCase();
        
        // Update progress every 10 files or at the end
        if (i % 10 === 0 || i === entries.length - 1) {
          setExtractProgress({ current: i + 1, total: entries.length, zipName: zipFile.name });
        }
        
        if (validExts.includes(ext || '')) {
          try {
            const blob = await zipEntry.async('blob');
            const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
            extractedFiles.push(file);
            validCount++;
          } catch (fileErr) {
            addDebug(`⚠️ שגיאה בחילוץ קובץ: ${fileName}`);
            console.error(`Error extracting ${fileName}:`, fileErr);
          }
        } else {
          skippedCount++;
        }
      }
      
      addDebug(`✅ חילוץ הושלם: ${validCount} קבצים תקינים, ${skippedCount} דולגו (סיומת לא נתמכת)`);
      
    } catch (err) {
      addDebug(`❌ שגיאה בחילוץ ZIP: ${err instanceof Error ? err.message : 'שגיאה לא ידועה'}`);
      console.error('Error extracting ZIP:', err);
      toast({
        title: `שגיאה בחילוץ ${zipFile.name}`,
        description: err instanceof Error ? err.message : 'לא ניתן לפתוח את קובץ ה-ZIP',
        variant: 'destructive',
      });
    } finally {
      setExtractProgress(null);
    }
    
    return extractedFiles;
  }, [addDebug]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    addDebug(`📥 נבחרו ${selectedFiles.length} קבצים`);
    
    const validExts = ['pdf', 'docx', 'doc', 'txt', 'rtf', 'zip', 'html', 'htm', 'json', 'xml'];
    
    const regularFiles: File[] = [];
    const zipFiles: File[] = [];
    
    // Separate ZIP files from regular files
    for (const file of selectedFiles) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'zip') {
        zipFiles.push(file);
        addDebug(`🗜️ זוהה ZIP: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
      } else if (validExts.includes(ext || '')) {
        regularFiles.push(file);
      }
    }
    
    addDebug(`📊 סיכום: ${zipFiles.length} קבצי ZIP, ${regularFiles.length} קבצים רגילים`);
    
    // Extract files from ZIPs and add each as separate upload batch
    if (zipFiles.length > 0) {
      toast({
        title: `מחלץ ${zipFiles.length} קבצי ZIP...`,
        description: 'אנא המתן - פעולה זו עלולה לקחת זמן',
      });
      
      for (const zipFile of zipFiles) {
        addDebug(`🔄 מעבד ZIP: ${zipFile.name}`);
        const extracted = await extractZipFiles(zipFile);
        addDebug(`➕ חולצו ${extracted.length} קבצים מ-${zipFile.name}`);
        
        // Check duplicates
        addDebug(`🔍 בודק כפילויות...`);
        const uniqueFiles = await checkDuplicates(extracted);
        addDebug(`✅ ${uniqueFiles.length} קבצים ייחודיים`);
        
        if (uniqueFiles.length > 0) {
          setExtractedZips(prev => [...prev, { name: zipFile.name, files: uniqueFiles }]);
        }
      }
      
      toast({
        title: `קבצי ZIP מוכנים להעלאה`,
        description: 'לחץ על "העלה הכל" להתחיל העלאה מקבילית',
      });
    }
    
    // Add regular files as a batch if any
    if (regularFiles.length > 0) {
      addDebug(`🔍 בודק כפילויות עבור ${regularFiles.length} קבצים רגילים...`);
      const uniqueRegular = await checkDuplicates(regularFiles);
      if (uniqueRegular.length > 0) {
        setExtractedZips(prev => [...prev, { name: 'קבצים בודדים', files: uniqueRegular }]);
      }
      addDebug(`✅ בדיקת כפילויות הושלמה`);
    }
    
    // Reset input to allow re-selecting same files
    e.target.value = '';
  }, [showToast, checkDuplicates, extractZipFiles, addDebug]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    
    // Create a fake event for reuse
    const fakeEvent = {
      target: { files: droppedFiles, value: '' }
    } as unknown as React.ChangeEvent<HTMLInputElement>;
    
    await handleFileSelect(fakeEvent);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const removeZip = (index: number) => {
    setExtractedZips(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllZips = () => {
    setExtractedZips([]);
    setDuplicates([]);
  };

  const clearDuplicates = () => {
    setDuplicates([]);
  };

  // Delete all psakei din from database
  const handleDeleteAllPsakim = async () => {
    setDeletingAll(true);
    try {
      // Delete all related links first
      await supabase.from('sugya_psak_links').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('pattern_sugya_links').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('smart_index_results').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('faq_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // Delete all psakei din
      const { error } = await supabase.from('psakei_din').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      if (error) throw error;
      
      toast({
        title: "כל פסקי הדין נמחקו בהצלחה",
        description: "המאגר נוקה לחלוטין",
      });
      
      setDeleteAllDialogOpen(false);
      
      // Clear local hash cache too
      Object.keys(useUploadStore.getState().fileHashes).forEach(hash => {
        // Can't delete individual hashes, so we'd need to reset
      });
      
    } catch (error) {
      console.error('Error deleting all psakim:', error);
      toast({
        title: "שגיאה במחיקת פסקי הדין",
        variant: "destructive",
      });
    } finally {
      setDeletingAll(false);
    }
  };

  // Overwrite duplicates - delete existing and upload new ones
  const handleOverwriteDuplicates = async () => {
    if (duplicates.length === 0) return;
    
    setOverwritingDuplicates(true);
    try {
      const idsToDelete = duplicates.filter(d => d.existingId).map(d => d.existingId!);
      
      // Delete existing entries first
      for (const id of idsToDelete) {
        await supabase.from('sugya_psak_links').delete().eq('psak_din_id', id);
        await supabase.from('pattern_sugya_links').delete().eq('psak_din_id', id);
        await supabase.from('smart_index_results').delete().eq('psak_din_id', id);
        await supabase.from('faq_items').delete().eq('psak_din_id', id);
        await supabase.from('psakei_din').delete().eq('id', id);
      }
      
      // Prepare files for upload
      const filesToUpload = duplicates.map(d => d.file);
      
      toast({
        title: `נמחקו ${idsToDelete.length} כפולים, מעלה קבצים חדשים...`,
      });
      
      // Add files to upload queue
      setExtractedZips(prev => [...prev, { name: 'קבצים מוחלפים', files: filesToUpload }]);
      setDuplicates([]);
      
    } catch (error) {
      console.error('Error overwriting duplicates:', error);
      toast({
        title: "שגיאה בהחלפת קבצים",
        variant: "destructive",
      });
    } finally {
      setOverwritingDuplicates(false);
    }
  };

  // Upload single ZIP batch
  const handleUploadSingle = async (zipBatch: ExtractedZip, withAI: boolean = false) => {
    const metadata = {
      court: court || undefined,
      year: parseInt(year) || new Date().getFullYear(),
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    };

    // Remove from pending list
    setExtractedZips(prev => prev.filter(z => z.name !== zipBatch.name));
    
    // Start upload with ZIP name as session name
    await uploadFiles(zipBatch.files, metadata, withAI, zipBatch.name);
  };

  // Upload ALL pending ZIPs concurrently
  const handleUploadAll = async (withAI: boolean = false) => {
    if (extractedZips.length === 0) {
      showToast({
        title: "אנא בחר קבצים להעלאה",
        variant: "destructive",
      });
      return;
    }
    
    const metadata = {
      court: court || undefined,
      year: parseInt(year) || new Date().getFullYear(),
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    };

    // Copy and clear the list
    const zipsToUpload = [...extractedZips];
    setExtractedZips([]);
    
    // Start ALL uploads concurrently
    toast({
      title: `מתחיל ${zipsToUpload.length} העלאות מקביליות`,
      description: `סה"כ ${zipsToUpload.reduce((sum, z) => sum + z.files.length, 0)} קבצים`,
    });
    
    // Fire all uploads in parallel (no await in loop)
    zipsToUpload.forEach(zipBatch => {
      uploadFiles(zipBatch.files, metadata, withAI, zipBatch.name);
    });
    
    // Reset form
    setCourt("");
    setYear(new Date().getFullYear().toString());
    setTags("");
    setDuplicates([]);
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'zip') return <Archive className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  const totalPendingFiles = extractedZips.reduce((sum, z) => sum + z.files.length, 0);

  return (
    <div className="container mx-auto px-4 py-8" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6 text-right">
        {/* Database Statistics */}
        <PsakDinStats />
        
        {/* Active Uploads Banner */}
        {isActive && (
          <Card className="border-2 border-primary/50 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-row-reverse">
                <div className="flex items-center gap-3 flex-row-reverse">
                  <Layers className="w-5 h-5 text-primary" />
                  <div className="text-right">
                    <p className="font-medium">{activeSessions.length} העלאות פעילות</p>
                    <p className="text-sm text-muted-foreground">
                      ניתן להוסיף עוד קבצים להעלאה מקבילית
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => {
                    clearAllSessions();
                    setExtractedZips([]);
                    setDuplicates([]);
                  }}>
                    נקה הכל ואפס
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Duplicates Warning with Overwrite Option */}
        {duplicates.length > 0 && (
          <Card className="border-2 border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 flex-row-reverse text-amber-700 dark:text-amber-400">
                <Copy className="w-4 h-4" />
                קבצים כפולים נמצאו ({duplicates.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="flex flex-wrap gap-2">
                {duplicates.slice(0, 8).map((dup, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs flex items-center gap-1 bg-background">
                    <span title={dup.reason === 'hash' ? "זוהה לפי תוכן" : "זוהה לפי שם"}>
                      {dup.reason === 'hash' ? (
                        <Hash className="w-3 h-3" />
                      ) : (
                        <Ban className="w-3 h-3" />
                      )}
                    </span>
                    {dup.name}
                  </Badge>
                ))}
                {duplicates.length > 8 && (
                  <Badge variant="outline" className="text-xs bg-background">
                    +{duplicates.length - 8} נוספים
                  </Badge>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button 
                  size="sm" 
                  variant="default"
                  onClick={handleOverwriteDuplicates}
                  disabled={overwritingDuplicates}
                  className="gap-2"
                >
                  {overwritingDuplicates ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  החלף קיימים ({duplicates.length})
                </Button>
                <Button size="sm" variant="ghost" onClick={clearDuplicates} className="text-xs">
                  <X className="w-4 h-4 mr-1" />
                  התעלם ודלג
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2 flex-row-reverse">
              <Upload className="w-5 h-5" />
              העלאת פסקי דין
              <span className="text-sm font-normal text-muted-foreground">
                (העלאה מקבילית של מספר ZIPs)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* File Selection Buttons */}
            <div className="flex flex-col gap-4">
              {/* Hidden Inputs */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.txt,.rtf,.zip,.json,.html,.htm,.xml"
                onChange={handleFileSelect}
                className="hidden"
              />
              <input
                ref={folderInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.txt,.rtf,.zip,.json,.html,.htm,.xml"
                onChange={handleFileSelect}
                className="hidden"
                {...{ webkitdirectory: "", directory: "" } as any}
              />
              
              {/* Status Display */}
              {(extractProgress || checkingDuplicates) && (
                <div className="border-2 border-dashed border-primary rounded-lg p-6 text-center bg-primary/5">
                  {extractProgress ? (
                    <>
                      <Archive className="w-12 h-12 mx-auto text-primary mb-4 animate-pulse" />
                      <p className="text-foreground font-medium">מחלץ קבצים מ-ZIP...</p>
                      <p className="text-sm text-muted-foreground mt-1">{extractProgress.zipName}</p>
                      <Progress 
                        value={(extractProgress.current / extractProgress.total) * 100} 
                        className="h-2 mt-3 max-w-xs mx-auto" 
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        {extractProgress.current}/{extractProgress.total} קבצים
                      </p>
                    </>
                  ) : (
                    <>
                      <Loader2 className="w-12 h-12 mx-auto text-accent mb-4 animate-spin" />
                      <p className="text-foreground font-medium">
                        {hashProgress 
                          ? `מחשב hash לקבצים... (${hashProgress.current}/${hashProgress.total})`
                          : 'בודק קבצים כפולים...'
                        }
                      </p>
                    </>
                  )}
                </div>
              )}
              
              {/* Selection Buttons - Always Visible */}
              {!extractProgress && !checkingDuplicates && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Individual Files Button */}
                  <div
                    className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors border-border bg-muted/20"
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                  >
                    <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-foreground font-medium">קבצים בודדים / ZIP</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      PDF, DOCX, DOC, TXT, RTF, JSON, HTML או ZIP
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 gap-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                    >
                      <Upload className="w-4 h-4" />
                      בחר קבצים
                    </Button>
                  </div>

                  {/* Folder Button */}
                  <div
                    className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors border-border bg-muted/20"
                    onClick={() => folderInputRef.current?.click()}
                  >
                    <FolderUp className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-foreground font-medium">תיקייה שלמה</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      בחר תיקייה להעלאת כל הקבצים שבתוכה
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 gap-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        folderInputRef.current?.click();
                      }}
                    >
                      <FolderUp className="w-4 h-4" />
                      בחר תיקייה
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Pending ZIP Batches */}
            {extractedZips.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-row-reverse">
                  <Label className="text-foreground flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    ממתינים להעלאה ({extractedZips.length} קבוצות, {totalPendingFiles} קבצים)
                  </Label>
                  <Button variant="ghost" size="sm" onClick={clearAllZips} className="text-destructive">
                    <X className="w-4 h-4 ml-1" />
                    נקה הכל
                  </Button>
                </div>
                <div className="space-y-2">
                  {extractedZips.map((zipBatch, index) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <Archive className="w-4 h-4 text-primary" />
                        <span className="font-medium">{zipBatch.name}</span>
                        <Badge variant="secondary">{zipBatch.files.length} קבצים</Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleUploadSingle(zipBatch, false)}
                        >
                          העלה
                        </Button>
                        <Button 
                          size="sm"
                          onClick={() => handleUploadSingle(zipBatch, true)}
                        >
                          <Sparkles className="w-3 h-3 ml-1" />
                          העלה + AI
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => removeZip(index)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="court">בית דין (לכל הקבצים)</Label>
                <Input
                  id="court"
                  value={court}
                  onChange={(e) => setCourt(e.target.value)}
                  placeholder="לדוגמה: בית הדין הרבני"
                  className="bg-card border-border text-right"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">שנה</Label>
                <Input
                  id="year"
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="bg-card border-border text-right"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags">תגיות (מופרדות בפסיקים)</Label>
                <Input
                  id="tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="ממונות, נזיקין"
                  className="bg-card border-border text-right"
                />
              </div>
            </div>

            {/* Upload All Buttons */}
            {extractedZips.length > 0 && (
              <div className="flex gap-3 flex-row-reverse">
                <Button
                  onClick={() => handleUploadAll(false)}
                  disabled={extractedZips.length === 0}
                  variant="outline"
                  className="flex-1 gap-2"
                  size="lg"
                >
                  <Upload className="w-4 h-4" />
                  העלה הכל ({totalPendingFiles} קבצים)
                </Button>
                
                <Button
                  onClick={() => handleUploadAll(true)}
                  disabled={extractedZips.length === 0}
                  className="flex-1 gap-2"
                  size="lg"
                >
                  <Brain className="w-4 h-4" />
                  העלה הכל + ניתוח AI
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Completed Sessions Summary */}
        {Object.values(sessions).filter(s => s.status === 'completed').length > 0 && (
          <Card className="border border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-foreground flex items-center gap-2 flex-row-reverse">
                <CheckCircle className="w-5 h-5 text-green-500" />
                העלאות שהושלמו
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.values(sessions)
                  .filter(s => s.status === 'completed')
                  .map((session) => (
                    <div 
                      key={session.id}
                      className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="font-medium">{session.name}</span>
                        <Badge variant="secondary">
                          {session.results.filter(r => r.success).length} הועלו
                        </Badge>
                        {session.results.some(r => r.analyzed) && (
                          <Badge variant="outline">
                            <Sparkles className="w-3 h-3 ml-1" />
                            {session.results.filter(r => r.analyzed).length} נותחו
                          </Badge>
                        )}
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => clearSession(session.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Debug Log */}
        {debugLog.length > 0 && (
          <Card className="border border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between flex-row-reverse">
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  לוג פעילות ({debugLog.length})
                </span>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => setDebugLog([])}
                  className="text-xs"
                >
                  נקה לוג
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-48 overflow-y-auto bg-muted/30 rounded p-2 font-mono text-xs">
                {debugLog.map((log, index) => (
                  <div key={index} className="py-0.5 text-right border-b border-border/30 last:border-0">
                    {log}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Summary Dialog */}
      <UploadSummaryDialog 
        open={showSummary} 
        onOpenChange={setShowSummary}
        sessionId={completedSessionId}
      />
      
      {/* Delete All Confirmation Dialog */}
      <AlertDialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              מחיקת כל פסקי הדין
            </AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך למחוק את כל פסקי הדין במאגר?
              <br />
              <strong className="text-destructive">פעולה זו בלתי הפיכה!</strong>
              <br />
              כל הקישורים, הניתוחים, והנתונים הנלווים יימחקו לצמיתות.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel disabled={deletingAll}>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAllPsakim}
              disabled={deletingAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingAll ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin ml-2" />
                  מוחק...
                </>
              ) : (
                "כן, מחק הכל"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UploadPsakDinTab;
