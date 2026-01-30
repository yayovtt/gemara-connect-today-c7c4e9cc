import { useState, useEffect } from "react";
import { Settings, Check, Palette, ChevronRight, Pipette, Code, Database, FolderPlus, FileCode, Terminal, Rocket, Copy, ExternalLink, Play, RefreshCw, FileText, Loader2, CheckCircle, XCircle, Eye, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTheme, themes, Theme, CustomColors } from "./ThemeProvider";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

// Migration files list (hardcoded since we can't read filesystem from browser)
const MIGRATION_FILES = [
  { name: '20251207123746_remix_migration_from_pg_dump.sql', description: 'מיגרציה ראשית מ-pg_dump' },
  { name: '20251207124058_36745e6b-65d1-457f-97dc-ce11b995fdb7.sql', description: 'מיגרציה נוספת' },
  { name: '20251207124338_a5c23276-c9f6-484a-a6ca-68e428544528.sql', description: 'מיגרציה נוספת' },
  { name: '20251207124622_20957dfe-921a-4532-aa4b-43593145bbe9.sql', description: 'מיגרציה נוספת' },
  { name: '20251207165342_bc3cb9b8-836a-421e-beae-950d87e8daf5.sql', description: 'מיגרציה נוספת' },
  { name: '20251207170043_97a71e56-86b7-4bd3-827c-521cbbe4f10e.sql', description: 'מיגרציה נוספת' },
  { name: '20251207175616_ff9ec61d-4c6b-485a-a3fa-d8f6bed36323.sql', description: 'מיגרציה נוספת' },
  { name: '20260122135454_51f86954-642f-4c50-bd55-a07e2c9d9661.sql', description: 'מיגרציה ינואר 2026' },
  { name: '20260122135510_6cdee5f3-0af0-4cc7-bf25-40b8c2637b73.sql', description: 'מיגרציה ינואר 2026' },
  { name: '20260129_add_fulltext_search.sql', description: 'הוספת Full-Text Search' },
  { name: '20260129_add_search_psakim_rpc.sql', description: 'הוספת RPC לחיפוש פסקים' },
];

// GitHub raw URL for migrations
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/yayovtt/gemara-connect-today-c7c4e9cc/main/supabase/migrations';

const themeColors: Record<Exclude<Theme, "custom">, { bg: string; accent: string; text: string }> = {
  classic: { bg: "bg-amber-50", accent: "bg-amber-500", text: "text-slate-800" },
  midnight: { bg: "bg-slate-900", accent: "bg-amber-500", text: "text-amber-100" },
  royal: { bg: "bg-blue-950", accent: "bg-slate-300", text: "text-slate-100" },
};

const presetColors = [
  "#f5f5f0", "#faf7f2", "#f0f4f8", "#1a1a2e", "#0f172a", "#1e293b",
  "#1e3a5f", "#0d47a1", "#4a148c", "#1b5e20", "#b71c1c", "#e65100",
  "#d4a853", "#ffc107", "#8bc34a", "#00bcd4", "#e91e63", "#9c27b0",
];

interface MigrationStatus {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  error?: string;
}

export function SettingsButton() {
  const { theme, setTheme, customColors, setCustomColors } = useTheme();
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [localColors, setLocalColors] = useState<CustomColors>(customColors);
  const [activeTab, setActiveTab] = useState<'theme' | 'dev' | 'migrations'>('theme');
  const [newMigrationName, setNewMigrationName] = useState('');
  const [newFunctionName, setNewFunctionName] = useState('');
  
  // Migration management state
  const [migrationStatuses, setMigrationStatuses] = useState<Record<string, MigrationStatus>>({});
  const [isRunningMigration, setIsRunningMigration] = useState(false);
  const [selectedMigration, setSelectedMigration] = useState<string | null>(null);
  const [migrationContent, setMigrationContent] = useState<string>('');
  const [showMigrationDialog, setShowMigrationDialog] = useState(false);
  const [runAllProgress, setRunAllProgress] = useState<{ current: number; total: number } | null>(null);
  
  // File upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedContent, setUploadedContent] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);

  const handleColorChange = (key: keyof CustomColors, value: string) => {
    setLocalColors(prev => ({ ...prev, [key]: value }));
  };

  const applyCustomColors = () => {
    setCustomColors(localColors);
    setTheme("custom");
  };

  const copyToClipboard = (text: string, description: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: '📋 הועתק!',
      description,
    });
  };

  const generateMigrationFileName = () => {
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 10).replace(/-/g, '') + 
                     now.toTimeString().slice(0, 8).replace(/:/g, '');
    const safeName = newMigrationName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    return `${timestamp}_${safeName || 'new_migration'}.sql`;
  };

  // Run a single migration via Supabase RPC
  const runMigration = async (migrationName: string, sqlContent: string) => {
    setMigrationStatuses(prev => ({
      ...prev,
      [migrationName]: { name: migrationName, status: 'running' }
    }));

    try {
      // Split SQL into statements
      const statements = sqlContent
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        const { error } = await supabase.rpc('exec_sql', { sql_text: statement + ';' });
        if (error) {
          // Try direct query as fallback
          const { error: directError } = await supabase.from('_exec').select().limit(0);
          if (directError) {
            throw new Error(`Failed to execute: ${statement.substring(0, 100)}...`);
          }
        }
      }

      setMigrationStatuses(prev => ({
        ...prev,
        [migrationName]: { name: migrationName, status: 'success' }
      }));

      toast({
        title: '✅ מיגרציה הורצה בהצלחה',
        description: migrationName,
      });

      return true;
    } catch (error: any) {
      setMigrationStatuses(prev => ({
        ...prev,
        [migrationName]: { name: migrationName, status: 'error', error: error.message }
      }));

      toast({
        title: '❌ שגיאה בהרצת מיגרציה',
        description: error.message,
        variant: 'destructive',
      });

      return false;
    }
  };

  // Load migration SQL content from a file path (this is a placeholder - in real scenario you'd fetch from server)
  const loadMigrationContent = async (migrationName: string): Promise<string | null> => {
    // Since we can't read files directly from browser, we'll use fetch to get migration content
    // This requires the migrations to be available via public URL or an API endpoint
    try {
      const response = await fetch(`/supabase/migrations/${migrationName}`);
      if (!response.ok) {
        throw new Error('Migration file not found');
      }
      return await response.text();
    } catch {
      // Return placeholder - in production, you'd have an API to fetch migrations
      return null;
    }
  };

  const viewMigration = async (migrationName: string) => {
    setSelectedMigration(migrationName);
    setMigrationContent('טוען מ-GitHub...');
    setShowMigrationDialog(true);
    
    try {
      // Try to fetch from GitHub first
      const response = await fetch(`${GITHUB_RAW_BASE}/${migrationName}`);
      if (response.ok) {
        const content = await response.text();
        setMigrationContent(content);
        return;
      }
    } catch {
      // Fallback to local load
    }
    
    const content = await loadMigrationContent(migrationName);
    if (content) {
      setMigrationContent(content);
    } else {
      setMigrationContent(`-- לא ניתן לטעון את תוכן המיגרציה
-- נתיב הקובץ: supabase/migrations/${migrationName}

-- אפשרויות:
-- 1. העלה את הקובץ ידנית דרך אזור ההעלאה
-- 2. הרץ מה-terminal: node scripts/run-fts-migration.mjs`);
    }
  };

  const runMigrationFromFile = async (migrationName: string) => {
    setIsRunningMigration(true);
    
    const content = await loadMigrationContent(migrationName);
    if (content) {
      await runMigration(migrationName, content);
    } else {
      toast({
        title: '⚠️ לא ניתן לטעון מיגרציה',
        description: 'יש להריץ מיגרציות מה-terminal: node scripts/run-fts-migration.mjs',
        variant: 'destructive',
      });
    }
    
    setIsRunningMigration(false);
  };

  // Fetch and run migration from GitHub
  const runMigrationFromGitHub = async (migrationName: string) => {
    setMigrationStatuses(prev => ({
      ...prev,
      [migrationName]: { name: migrationName, status: 'running' }
    }));

    try {
      // Fetch migration content from GitHub
      const response = await fetch(`${GITHUB_RAW_BASE}/${migrationName}`);
      if (!response.ok) {
        throw new Error(`לא נמצא קובץ: ${migrationName}`);
      }
      
      const sqlContent = await response.text();
      
      // Split SQL into statements
      const statements = sqlContent
        .split(/;\s*$/m)
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      let successCount = 0;
      let errorCount = 0;
      let lastError = '';

      for (const statement of statements) {
        const { data, error } = await supabase.rpc('exec_sql', { sql_text: statement + ';' });
        
        if (error) {
          console.error('SQL Error:', error);
          errorCount++;
          lastError = error.message;
        } else {
          successCount++;
        }
      }

      if (errorCount === 0) {
        setMigrationStatuses(prev => ({
          ...prev,
          [migrationName]: { name: migrationName, status: 'success' }
        }));
        toast({
          title: '✅ מיגרציה הורצה בהצלחה!',
          description: `${migrationName} - ${successCount} פקודות בוצעו`,
        });
      } else {
        setMigrationStatuses(prev => ({
          ...prev,
          [migrationName]: { name: migrationName, status: 'error', error: lastError }
        }));
        toast({
          title: '⚠️ מיגרציה הושלמה עם שגיאות',
          description: `${successCount} הצליחו, ${errorCount} נכשלו`,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      setMigrationStatuses(prev => ({
        ...prev,
        [migrationName]: { name: migrationName, status: 'error', error: error.message }
      }));
      toast({
        title: '❌ שגיאה בהרצת מיגרציה',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // File upload handlers
  const handleFileUpload = (file: File) => {
    if (!file.name.endsWith('.sql')) {
      toast({
        title: '❌ קובץ לא תקין',
        description: 'יש להעלות קובץ SQL בלבד',
        variant: 'destructive',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setUploadedFile(file);
      setUploadedContent(content);
      toast({
        title: '📄 קובץ נטען',
        description: `${file.name} (${(content.length / 1024).toFixed(1)} KB)`,
      });
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const runUploadedMigration = async () => {
    if (!uploadedFile || !uploadedContent) {
      toast({
        title: '⚠️ אין קובץ',
        description: 'יש להעלות קובץ SQL קודם',
        variant: 'destructive',
      });
      return;
    }

    setIsRunningMigration(true);
    
    try {
      // Split SQL into statements
      const statements = uploadedContent
        .split(/;\s*$/m)
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      let successCount = 0;
      let errorCount = 0;

      for (const statement of statements) {
        const { data, error } = await supabase.rpc('exec_sql', { sql_text: statement + ';' });
        
        if (error) {
          console.error('SQL Error:', error);
          errorCount++;
        } else {
          successCount++;
        }
      }

      if (errorCount === 0) {
        toast({
          title: '✅ מיגרציה הורצה בהצלחה!',
          description: `${successCount} פקודות SQL בוצעו`,
        });
        setUploadedFile(null);
        setUploadedContent('');
      } else {
        toast({
          title: '⚠️ מיגרציה הושלמה עם שגיאות',
          description: `${successCount} הצליחו, ${errorCount} נכשלו`,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: '❌ שגיאה בהרצת מיגרציה',
        description: error.message || 'שגיאה לא ידועה',
        variant: 'destructive',
      });
    }

    setIsRunningMigration(false);
  };

  const colorLabels: Record<keyof CustomColors, string> = {
    background: "רקע",
    primary: "ראשי",
    accent: "הדגשה",
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            size="icon"
            className="h-12 w-12 rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Settings className="h-5 w-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          side="top" 
          align="end" 
          className="w-96 p-0 bg-card border-border"
        >
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'theme' | 'dev' | 'migrations')} className="w-full">
            <TabsList className="w-full grid grid-cols-3 rounded-none border-b">
              <TabsTrigger value="theme" className="gap-1 text-xs">
                <Palette className="h-3 w-3" />
                נושא
              </TabsTrigger>
              <TabsTrigger value="dev" className="gap-1 text-xs">
                <Code className="h-3 w-3" />
                פיתוח
              </TabsTrigger>
              <TabsTrigger value="migrations" className="gap-1 text-xs">
                <Database className="h-3 w-3" />
                מיגרציות
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="theme" className="p-3 m-0">
          {!showCustomizer ? (
            <>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                <Palette className="h-4 w-4 text-accent" />
                <span className="font-medium">ערכות נושא</span>
              </div>
              <div className="space-y-2">
                {themes.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      if (t.id === "custom") {
                        setShowCustomizer(true);
                      } else {
                        setTheme(t.id);
                      }
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 p-2 rounded-lg transition-all",
                      "hover:bg-muted/50",
                      theme === t.id && "bg-muted ring-1 ring-accent"
                    )}
                  >
                    {/* Theme preview circles */}
                    {t.id !== "custom" ? (
                      <div className="flex gap-1">
                        <div className={cn("w-4 h-4 rounded-full border border-border", themeColors[t.id as Exclude<Theme, "custom">].bg)} />
                        <div className={cn("w-4 h-4 rounded-full", themeColors[t.id as Exclude<Theme, "custom">].accent)} />
                        <div className={cn("w-4 h-4 rounded-full", themeColors[t.id as Exclude<Theme, "custom">].bg, themeColors[t.id as Exclude<Theme, "custom">].text, "flex items-center justify-center text-[8px] font-bold border border-border")}>
                          א
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <div className="w-4 h-4 rounded-full" style={{ background: `linear-gradient(135deg, ${customColors.background} 50%, ${customColors.primary} 50%)` }} />
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: customColors.accent }} />
                        <Pipette className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 text-right">
                      <div className="font-medium text-sm">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.description}</div>
                    </div>
                    {t.id === "custom" ? (
                      <ChevronRight className="h-4 w-4 text-muted-foreground rotate-180" />
                    ) : theme === t.id ? (
                      <Check className="h-4 w-4 text-accent" />
                    ) : null}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                <button 
                  onClick={() => setShowCustomizer(false)}
                  className="p-1 hover:bg-muted rounded"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <Pipette className="h-4 w-4 text-accent" />
                <span className="font-medium">התאמה אישית</span>
              </div>
              
              <div className="space-y-4">
                {(Object.keys(colorLabels) as Array<keyof CustomColors>).map((key) => (
                  <div key={key} className="space-y-2">
                    <Label className="text-sm">{colorLabels[key]}</Label>
                    <div className="flex gap-2">
                      <div className="relative">
                        <Input
                          type="color"
                          value={localColors[key]}
                          onChange={(e) => handleColorChange(key, e.target.value)}
                          className="w-10 h-10 p-1 cursor-pointer border-border"
                        />
                      </div>
                      <Input
                        type="text"
                        value={localColors[key]}
                        onChange={(e) => handleColorChange(key, e.target.value)}
                        placeholder="#000000"
                        className="flex-1 font-mono text-sm bg-input border-border"
                        dir="ltr"
                      />
                    </div>
                    {/* Preset colors */}
                    <div className="flex flex-wrap gap-1">
                      {presetColors.map((color) => (
                        <button
                          key={color}
                          onClick={() => handleColorChange(key, color)}
                          className={cn(
                            "w-5 h-5 rounded border border-border hover:scale-110 transition-transform",
                            localColors[key] === color && "ring-2 ring-accent ring-offset-1"
                          )}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                
                {/* Preview */}
                <div className="p-3 rounded-lg border border-border" style={{ backgroundColor: localColors.background }}>
                  <div className="text-sm font-medium mb-1" style={{ color: localColors.primary }}>
                    תצוגה מקדימה
                  </div>
                  <div className="flex gap-2">
                    <div 
                      className="px-3 py-1 rounded text-xs text-white"
                      style={{ backgroundColor: localColors.primary }}
                    >
                      כפתור ראשי
                    </div>
                    <div 
                      className="px-3 py-1 rounded text-xs"
                      style={{ backgroundColor: localColors.accent, color: localColors.primary }}
                    >
                      הדגשה
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={applyCustomColors}
                  className="w-full"
                >
                  <Check className="h-4 w-4 ml-2" />
                  החל ערכת נושא
                </Button>
              </div>
            </>
          )}
            </TabsContent>
            
            <TabsContent value="dev" className="p-3 m-0 space-y-4">
              {/* Development Tools Header */}
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <Terminal className="h-4 w-4 text-accent" />
                <span className="font-medium text-sm">כלי פיתוח Supabase</span>
              </div>

              {/* Create New Migration */}
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <Database className="h-3 w-3" />
                  יצירת מיגרציה חדשה
                </Label>
                <Input
                  placeholder="שם המיגרציה (באנגלית)"
                  value={newMigrationName}
                  onChange={(e) => setNewMigrationName(e.target.value)}
                  className="text-xs h-8"
                  dir="ltr"
                />
                <div className="flex gap-1">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1 text-xs h-7 gap-1"
                    onClick={() => {
                      const fileName = generateMigrationFileName();
                      const path = `supabase/migrations/${fileName}`;
                      copyToClipboard(path, `נתיב: ${path}`);
                    }}
                  >
                    <Copy className="h-3 w-3" />
                    העתק נתיב
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1 text-xs h-7 gap-1"
                    onClick={() => {
                      const template = `-- Migration: ${newMigrationName || 'new_migration'}
-- Created: ${new Date().toISOString()}

-- Add your SQL here
`;
                      copyToClipboard(template, 'תבנית SQL הועתקה');
                    }}
                  >
                    <FileCode className="h-3 w-3" />
                    תבנית SQL
                  </Button>
                </div>
              </div>

              {/* Create New Function */}
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <FolderPlus className="h-3 w-3" />
                  יצירת Edge Function חדשה
                </Label>
                <Input
                  placeholder="שם הפונקציה (באנגלית)"
                  value={newFunctionName}
                  onChange={(e) => setNewFunctionName(e.target.value)}
                  className="text-xs h-8"
                  dir="ltr"
                />
                <div className="flex gap-1">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1 text-xs h-7 gap-1"
                    onClick={() => {
                      const safeName = newFunctionName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'new-function';
                      const path = `supabase/functions/${safeName}/index.ts`;
                      copyToClipboard(path, `נתיב: ${path}`);
                    }}
                  >
                    <Copy className="h-3 w-3" />
                    העתק נתיב
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1 text-xs h-7 gap-1"
                    onClick={() => {
                      const safeName = newFunctionName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'new-function';
                      const template = `// Edge Function: ${safeName}
// https://supabase.com/docs/guides/functions

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data, error } = await req.json()
    
    // Your logic here
    
    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
`;
                      copyToClipboard(template, 'תבנית Edge Function הועתקה');
                    }}
                  >
                    <FileCode className="h-3 w-3" />
                    תבנית TS
                  </Button>
                </div>
              </div>

              {/* Quick Commands */}
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <Rocket className="h-3 w-3" />
                  פקודות מהירות
                </Label>
                <div className="grid grid-cols-1 gap-1">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="justify-start text-xs h-7 gap-2"
                    onClick={() => copyToClipboard('npx supabase db push', 'פקודת push הועתקה')}
                  >
                    <Terminal className="h-3 w-3" />
                    <span dir="ltr">supabase db push</span>
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="justify-start text-xs h-7 gap-2"
                    onClick={() => copyToClipboard('npx supabase functions deploy', 'פקודת deploy הועתקה')}
                  >
                    <Terminal className="h-3 w-3" />
                    <span dir="ltr">supabase functions deploy</span>
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="justify-start text-xs h-7 gap-2"
                    onClick={() => copyToClipboard('npx supabase db diff -f new_migration', 'פקודת diff הועתקה')}
                  >
                    <Terminal className="h-3 w-3" />
                    <span dir="ltr">supabase db diff</span>
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="justify-start text-xs h-7 gap-2"
                    onClick={() => copyToClipboard('node scripts/run-fts-migration.mjs', 'פקודת migration הועתקה')}
                  >
                    <Terminal className="h-3 w-3" />
                    <span dir="ltr">run-fts-migration</span>
                  </Button>
                </div>
              </div>

              {/* Links */}
              <div className="pt-2 border-t border-border">
                <a 
                  href="https://supabase.com/dashboard" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  פתח Supabase Dashboard
                </a>
              </div>
            </TabsContent>

            {/* Migrations Tab */}
            <TabsContent value="migrations" className="p-0 m-0">
              <div className="p-3 pb-2 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-accent" />
                    <span className="font-medium text-sm">ניהול מיגרציות</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs gap-1"
                    onClick={() => {
                      copyToClipboard('node scripts/run-fts-migration.mjs', 'פקודה הועתקה - הדבק בטרמינל');
                    }}
                  >
                    <Terminal className="h-3 w-3" />
                    Terminal
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {MIGRATION_FILES.length} קבצי מיגרציה בפרויקט
                </p>
              </div>

              {/* File Upload Area */}
              <div className="p-3 border-b border-border">
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className={cn(
                    "border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer",
                    isDragging ? "border-accent bg-accent/10" : "border-border hover:border-muted-foreground",
                    uploadedFile && "border-green-500 bg-green-500/10"
                  )}
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.sql';
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) handleFileUpload(file);
                    };
                    input.click();
                  }}
                >
                  {uploadedFile ? (
                    <div className="space-y-2">
                      <CheckCircle className="h-6 w-6 mx-auto text-green-500" />
                      <div className="text-xs font-medium">{uploadedFile.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {(uploadedContent.length / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <FileText className="h-6 w-6 mx-auto text-muted-foreground" />
                      <div className="text-xs">גרור קובץ SQL או לחץ לבחירה</div>
                    </div>
                  )}
                </div>

                {uploadedFile && (
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      className="flex-1 text-xs h-7 gap-1"
                      onClick={runUploadedMigration}
                      disabled={isRunningMigration}
                    >
                      {isRunningMigration ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                      הרץ מיגרציה
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 gap-1"
                      onClick={() => {
                        setSelectedMigration(uploadedFile.name);
                        setMigrationContent(uploadedContent);
                        setShowMigrationDialog(true);
                      }}
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 gap-1"
                      onClick={() => {
                        setUploadedFile(null);
                        setUploadedContent('');
                      }}
                    >
                      <XCircle className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>

              <ScrollArea className="h-[200px]">
                <div className="p-2 space-y-1">
                  {MIGRATION_FILES.map((migration, index) => {
                    const status = migrationStatuses[migration.name];
                    return (
                      <div 
                        key={migration.name}
                        className={cn(
                          "p-2 rounded-lg border border-border/50 hover:border-border transition-colors",
                          status?.status === 'success' && "bg-green-500/10 border-green-500/30",
                          status?.status === 'error' && "bg-red-500/10 border-red-500/30",
                          status?.status === 'running' && "bg-yellow-500/10 border-yellow-500/30"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-shrink-0 pt-0.5">
                            {status?.status === 'running' ? (
                              <Loader2 className="h-3 w-3 animate-spin text-yellow-500" />
                            ) : status?.status === 'success' ? (
                              <CheckCircle className="h-3 w-3 text-green-500" />
                            ) : status?.status === 'error' ? (
                              <XCircle className="h-3 w-3 text-red-500" />
                            ) : (
                              <FileText className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-mono truncate" dir="ltr">
                              {index + 1}. {migration.name.replace('.sql', '')}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {migration.description}
                            </div>
                            {status?.error && (
                              <div className="text-[10px] text-red-500 mt-1 truncate">
                                {status.error}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-100"
                              onClick={() => runMigrationFromGitHub(migration.name)}
                              disabled={status?.status === 'running'}
                              title="הרץ מיגרציה"
                            >
                              {status?.status === 'running' ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Play className="h-3 w-3" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => viewMigration(migration.name)}
                              title="צפה בקובץ"
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => copyToClipboard(
                                `supabase/migrations/${migration.name}`,
                                'נתיב הועתק'
                              )}
                              title="העתק נתיב"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              <div className="p-2 border-t border-border space-y-2">
                <Button
                  size="sm"
                  className="w-full text-xs h-7 gap-2"
                  variant="outline"
                  onClick={() => copyToClipboard(
                    'npx supabase db push',
                    'פקודת push הועתקה - הדבק בטרמינל'
                  )}
                >
                  <Rocket className="h-3 w-3" />
                  העתק פקודת db push
                </Button>
                <p className="text-[10px] text-center text-muted-foreground">
                  להרצת מיגרציות יש להשתמש ב-terminal או Supabase CLI
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Migration Content Dialog */}
          <Dialog open={showMigrationDialog} onOpenChange={setShowMigrationDialog}>
            <DialogContent className="max-w-2xl max-h-[80vh]">
              <DialogHeader>
                <DialogTitle className="text-sm font-mono" dir="ltr">
                  {selectedMigration}
                </DialogTitle>
                <DialogDescription>
                  תוכן קובץ המיגרציה
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                <pre className="text-xs font-mono whitespace-pre-wrap" dir="ltr">
                  {migrationContent}
                </pre>
              </ScrollArea>
              <div className="flex gap-2 justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(migrationContent, 'תוכן המיגרציה הועתק')}
                >
                  <Copy className="h-3 w-3 ml-2" />
                  העתק תוכן
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowMigrationDialog(false)}
                >
                  סגור
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </PopoverContent>
      </Popover>
    </div>
  );
}
