import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  X, Maximize2, Minimize2, Download, ExternalLink,
  Type, AlignRight, AlignCenter, AlignLeft, AlignJustify,
  AArrowUp, AArrowDown, Bold, Italic, Underline, Highlighter,
  Palette, RotateCcw, BookOpen, FileText, ZoomIn, ZoomOut,
  Columns, Minus, Sun, Moon, Copy, Check, ChevronDown,
  Sparkles, Loader2, Code, Eye, Edit3, Save, XCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import RichTextEditor from "./RichTextEditor";

const VIEWER_SETTINGS_KEY = 'advanced-viewer-settings';

const FONTS = [
  { value: 'font-sans', label: 'אריאל', sample: 'Aa' },
  { value: 'font-serif', label: 'טיימס', sample: 'Aa' },
  { value: 'font-david', label: 'דוד', sample: 'Aa' },
  { value: 'font-frank', label: 'פרנק רוהל', sample: 'Aa' },
  { value: 'font-heebo', label: 'חיבו', sample: 'Aa' },
  { value: 'font-rubik', label: 'רוביק', sample: 'Aa' },
  { value: 'font-noto-serif', label: 'נוטו סריף', sample: 'Aa' },
];

const TEXT_COLORS = [
  { value: 'inherit', label: 'ברירת מחדל', color: 'currentColor' },
  { value: '#1a1a1a', label: 'שחור עמוק', color: '#1a1a1a' },
  { value: '#3b3b3b', label: 'אפור כהה', color: '#3b3b3b' },
  { value: '#1e40af', label: 'כחול עמוק', color: '#1e40af' },
  { value: '#064e3b', label: 'ירוק כהה', color: '#064e3b' },
  { value: '#7c2d12', label: 'חום', color: '#7c2d12' },
];

const BG_COLORS = [
  { value: 'transparent', label: 'שקוף', color: 'transparent' },
  { value: '#fefce8', label: 'קרם', color: '#fefce8' },
  { value: '#f0fdf4', label: 'מנטה', color: '#f0fdf4' },
  { value: '#eff6ff', label: 'תכלת', color: '#eff6ff' },
  { value: '#fdf2f8', label: 'ורוד בהיר', color: '#fdf2f8' },
  { value: '#f5f5f4', label: 'אפור בהיר', color: '#f5f5f4' },
];

const LINE_HEIGHTS = [
  { value: 1.4, label: 'צפוף' },
  { value: 1.6, label: 'רגיל' },
  { value: 1.8, label: 'מרווח' },
  { value: 2.0, label: 'מאוד מרווח' },
];

interface ViewerSettings {
  fontSize: number;
  fontFamily: string;
  textAlign: 'right' | 'center' | 'left' | 'justify';
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  textColor: string;
  bgColor: string;
  lineHeight: number;
  letterSpacing: number;
  columnMode: 'single' | 'double';
  theme: 'light' | 'dark' | 'sepia';
  zoom: number;
}

const defaultSettings: ViewerSettings = {
  fontSize: 18,
  fontFamily: 'font-serif',
  textAlign: 'justify',
  isBold: false,
  isItalic: false,
  isUnderline: false,
  textColor: 'inherit',
  bgColor: 'transparent',
  lineHeight: 1.6,
  letterSpacing: 0,
  columnMode: 'single',
  theme: 'light',
  zoom: 100,
};

interface AdvancedDocumentViewerProps {
  psak: {
    id?: string;
    title: string;
    court?: string;
    year?: number;
    case_number?: string;
    caseNumber?: string;
    summary: string;
    full_text?: string;
    fullText?: string;
    source_url?: string;
    sourceUrl?: string;
    tags?: string[];
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
}

const AdvancedDocumentViewer = ({ psak, open, onOpenChange, onSave }: AdvancedDocumentViewerProps) => {
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [copied, setCopied] = useState(false);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [viewMode, setViewMode] = useState<'rendered' | 'source'>('rendered');
  
  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [editedSummary, setEditedSummary] = useState('');
  
  const [settings, setSettings] = useState<ViewerSettings>(() => {
    const saved = localStorage.getItem(VIEWER_SETTINGS_KEY);
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  });

  const sourceUrl = psak?.source_url || psak?.sourceUrl;
  
  // Detect file type
  const getFileType = (url: string | undefined): string => {
    if (!url) return 'text';
    const lower = url.toLowerCase();
    if (lower.includes('.pdf')) return 'pdf';
    if (lower.includes('.doc') || lower.includes('.docx')) return 'doc';
    if (lower.includes('.txt')) return 'txt';
    if (lower.includes('.json')) return 'json';
    if (lower.includes('.html') || lower.includes('.htm')) return 'html';
    if (lower.includes('.xml')) return 'xml';
    return 'text';
  };

  const fileType = getFileType(sourceUrl);

  // Load file content for text-based files
  useEffect(() => {
    if (!open || !sourceUrl) return;
    if (['txt', 'json', 'html', 'xml'].includes(fileType)) {
      setLoadingFile(true);
      fetch(sourceUrl)
        .then(res => res.text())
        .then(text => {
          setFileContent(text);
          setLoadingFile(false);
        })
        .catch(() => {
          setFileContent(null);
          setLoadingFile(false);
        });
    }
  }, [open, sourceUrl, fileType]);

  // Initialize edit values when psak changes or dialog opens
  useEffect(() => {
    if (open && psak) {
      // For HTML files, use the loaded content as initial edit text
      const initialText = fileContent || psak.full_text || psak.fullText || '';
      setEditedText(initialText);
      setEditedSummary(psak.summary || '');
      setIsEditing(false);
    }
  }, [open, psak, fileContent]);

  useEffect(() => {
    localStorage.setItem(VIEWER_SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSetting = useCallback(<K extends keyof ViewerSettings>(key: K, value: ViewerSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetSettings = () => setSettings(defaultSettings);

  const handleCopyText = async () => {
    const text = fileContent || psak?.full_text || psak?.fullText || psak?.summary || '';
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('הטקסט הועתק');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    if (!psak?.id) {
      toast.error('לא ניתן לשמור - חסר מזהה');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('psakei_din')
        .update({
          full_text: editedText.trim() || null,
          summary: editedSummary.trim(),
        })
        .eq('id', psak.id);

      if (error) throw error;

      toast.success('השינויים נשמרו בהצלחה');
      setIsEditing(false);
      onSave?.();
    } catch (error: any) {
      console.error('Error saving:', error);
      toast.error('שגיאה בשמירה');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedText(psak?.full_text || psak?.fullText || '');
    setEditedSummary(psak?.summary || '');
    setIsEditing(false);
  };

  if (!psak) return null;

  const fullText = psak.full_text || psak.fullText;
  const caseNumber = psak.case_number || psak.caseNumber;

  const getThemeStyles = () => {
    switch (settings.theme) {
      case 'dark':
        return 'bg-[#1a1a2e] text-[#e0e0e0]';
      case 'sepia':
        return 'bg-[#f4ecd8] text-[#5c4a32]';
      default:
        return 'bg-white text-[#1a1a1a]';
    }
  };

  const getAlignClass = () => {
    switch (settings.textAlign) {
      case 'center': return 'text-center';
      case 'left': return 'text-left';
      case 'justify': return 'text-justify';
      default: return 'text-right';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "flex flex-col p-0 gap-0 border-0 overflow-hidden",
          isFullscreen 
            ? "max-w-[100vw] max-h-[100vh] w-[100vw] h-[100vh] rounded-none" 
            : "max-w-6xl max-h-[95vh] w-[95vw] rounded-xl"
        )}
      >
        {/* Compact Header with Metadata */}
        <div 
          className={cn(
            "flex-shrink-0 px-4 py-2 border-b transition-all duration-300",
            settings.theme === 'dark' ? 'bg-[#0f0f1a] border-[#2a2a4a]' : 
            settings.theme === 'sepia' ? 'bg-[#e8dcc8] border-[#d4c4a8]' : 
            'bg-gradient-to-r from-muted/80 to-muted/40 border-border'
          )}
        >
          <div className="flex items-center justify-between gap-3">
            {/* Title & Meta - Compact */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center",
                  settings.theme === 'dark' ? 'bg-primary/20' : 'bg-primary/10'
                )}>
                  <BookOpen className="w-4 h-4 text-primary" />
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <h2 className={cn(
                  "text-sm font-bold truncate",
                  settings.theme === 'dark' ? 'text-white' : 'text-foreground'
                )}>
                  {psak.title}
                </h2>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {psak.court && <span>{psak.court}</span>}
                  {psak.court && psak.year && <span>•</span>}
                  {psak.year && <span>{psak.year}</span>}
                  {caseNumber && <span>• {caseNumber}</span>}
                </div>
              </div>

              {/* Tags - Compact */}
              {psak.tags && psak.tags.length > 0 && (
                <div className="hidden md:flex gap-1">
                  {psak.tags.slice(0, 3).map((tag, idx) => (
                    <Badge key={idx} variant="secondary" className="text-[10px] px-1.5 py-0">
                      {tag}
                    </Badge>
                  ))}
                  {psak.tags.length > 3 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      +{psak.tags.length - 3}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1">
              {/* Edit/Save buttons */}
              {isEditing ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-destructive hover:text-destructive"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    ביטול
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="h-7 gap-1"
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {isSaving ? 'שומר...' : 'שמור'}
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1"
                  onClick={() => setIsEditing(true)}
                  disabled={!psak.id}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  עריכה
                </Button>
              )}

              <div className="w-px h-5 bg-border mx-1" />

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleCopyText}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
              
              {sourceUrl && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    asChild
                  >
                    <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    asChild
                  >
                    <a href={sourceUrl} download>
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  </Button>
                </>
              )}

              <div className="w-px h-5 bg-border mx-1" />

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onOpenChange(false)}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Advanced Toolbar */}
        <div 
          className={cn(
            "flex-shrink-0 px-3 py-1.5 border-b transition-all duration-300 overflow-x-auto",
            settings.theme === 'dark' ? 'bg-[#12121f] border-[#2a2a4a]' : 
            settings.theme === 'sepia' ? 'bg-[#efe5d5] border-[#d4c4a8]' : 
            'bg-muted/30 border-border'
          )}
        >
          <div className="flex items-center gap-1 min-w-max">
            {/* Font Size */}
            <div className="flex items-center gap-0.5 px-2 border-l border-border/50">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => updateSetting('fontSize', Math.max(12, settings.fontSize - 2))}
              >
                <AArrowDown className="w-3.5 h-3.5" />
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs font-mono">
                    {settings.fontSize}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-3" align="start">
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground mb-2">גודל גופן</div>
                    <Slider
                      value={[settings.fontSize]}
                      onValueChange={([v]) => updateSetting('fontSize', v)}
                      min={12}
                      max={36}
                      step={1}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>12</span>
                      <span>36</span>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => updateSetting('fontSize', Math.min(36, settings.fontSize + 2))}
              >
                <AArrowUp className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Font Family */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 gap-1 px-2">
                  <Type className="w-3.5 h-3.5" />
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40">
                {FONTS.map(font => (
                  <DropdownMenuItem
                    key={font.value}
                    onClick={() => updateSetting('fontFamily', font.value)}
                    className={cn("gap-2", font.value)}
                  >
                    <span className="w-6 text-center opacity-60">{font.sample}</span>
                    <span>{font.label}</span>
                    {settings.fontFamily === font.value && <Check className="w-3 h-3 mr-auto" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="w-px h-5 bg-border/50" />

            {/* Text Alignment */}
            <div className="flex items-center gap-0.5">
              {[
                { align: 'right', icon: AlignRight, label: 'ימין' },
                { align: 'center', icon: AlignCenter, label: 'מרכז' },
                { align: 'justify', icon: AlignJustify, label: 'מלא' },
                { align: 'left', icon: AlignLeft, label: 'שמאל' },
              ].map(({ align, icon: Icon, label }) => (
                <Button
                  key={align}
                  variant={settings.textAlign === align ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => updateSetting('textAlign', align as any)}
                  title={label}
                >
                  <Icon className="w-3.5 h-3.5" />
                </Button>
              ))}
            </div>

            <div className="w-px h-5 bg-border/50" />

            {/* Text Styling */}
            <div className="flex items-center gap-0.5">
              <Button
                variant={settings.isBold ? 'secondary' : 'ghost'}
                size="icon"
                className="h-7 w-7"
                onClick={() => updateSetting('isBold', !settings.isBold)}
              >
                <Bold className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant={settings.isItalic ? 'secondary' : 'ghost'}
                size="icon"
                className="h-7 w-7"
                onClick={() => updateSetting('isItalic', !settings.isItalic)}
              >
                <Italic className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant={settings.isUnderline ? 'secondary' : 'ghost'}
                size="icon"
                className="h-7 w-7"
                onClick={() => updateSetting('isUnderline', !settings.isUnderline)}
              >
                <Underline className="w-3.5 h-3.5" />
              </Button>
            </div>

            <div className="w-px h-5 bg-border/50" />

            {/* Colors */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Palette className="w-3.5 h-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-44 p-3" align="start">
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-muted-foreground mb-2">צבע טקסט</div>
                    <div className="grid grid-cols-6 gap-1">
                      {TEXT_COLORS.map(c => (
                        <button
                          key={c.value}
                          onClick={() => updateSetting('textColor', c.value)}
                          className={cn(
                            "w-6 h-6 rounded border-2 transition-all",
                            settings.textColor === c.value ? 'border-primary scale-110' : 'border-border'
                          )}
                          style={{ backgroundColor: c.color === 'currentColor' ? '#888' : c.color }}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Highlighter className="w-3.5 h-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-44 p-3" align="start">
                <div>
                  <div className="text-xs text-muted-foreground mb-2">צבע רקע</div>
                  <div className="grid grid-cols-6 gap-1">
                    {BG_COLORS.map(c => (
                      <button
                        key={c.value}
                        onClick={() => updateSetting('bgColor', c.value)}
                        className={cn(
                          "w-6 h-6 rounded border-2 transition-all",
                          settings.bgColor === c.value ? 'border-primary scale-110' : 'border-border',
                          c.value === 'transparent' && 'bg-[repeating-conic-gradient(#ccc_0_25%,white_0_50%)] bg-[length:8px_8px]'
                        )}
                        style={{ backgroundColor: c.value !== 'transparent' ? c.color : undefined }}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <div className="w-px h-5 bg-border/50" />

            {/* Line Height */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Minus className="w-3.5 h-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-40 p-3" align="start">
                <div className="text-xs text-muted-foreground mb-2">גובה שורה</div>
                <div className="space-y-1">
                  {LINE_HEIGHTS.map(lh => (
                    <button
                      key={lh.value}
                      onClick={() => updateSetting('lineHeight', lh.value)}
                      className={cn(
                        "w-full text-right px-2 py-1 rounded text-sm transition-colors",
                        settings.lineHeight === lh.value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                      )}
                    >
                      {lh.label}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Column Mode */}
            <Button
              variant={settings.columnMode === 'double' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-7 w-7"
              onClick={() => updateSetting('columnMode', settings.columnMode === 'single' ? 'double' : 'single')}
              title="שתי עמודות"
            >
              <Columns className="w-3.5 h-3.5" />
            </Button>

            <div className="w-px h-5 bg-border/50" />

            {/* Zoom */}
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => updateSetting('zoom', Math.max(50, settings.zoom - 10))}
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </Button>
              <span className="text-xs w-10 text-center">{settings.zoom}%</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => updateSetting('zoom', Math.min(200, settings.zoom + 10))}
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </Button>
            </div>

            <div className="w-px h-5 bg-border/50" />

            {/* Theme */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  {settings.theme === 'dark' ? <Moon className="w-3.5 h-3.5" /> : 
                   settings.theme === 'sepia' ? <Sparkles className="w-3.5 h-3.5" /> :
                   <Sun className="w-3.5 h-3.5" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => updateSetting('theme', 'light')}>
                  <Sun className="w-4 h-4 ml-2" /> בהיר
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateSetting('theme', 'sepia')}>
                  <Sparkles className="w-4 h-4 ml-2" /> ספיה
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateSetting('theme', 'dark')}>
                  <Moon className="w-4 h-4 ml-2" /> כהה
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Reset */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={resetSettings}
              title="איפוס הגדרות"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Document Content */}
        <div 
          className={cn(
            "flex-1 overflow-y-auto overflow-x-hidden transition-colors duration-300",
            getThemeStyles()
          )}
          style={{ 
            transform: `scale(${settings.zoom / 100})`,
            transformOrigin: 'top center',
            minHeight: settings.zoom > 100 ? `${100 / settings.zoom * 100}%` : undefined
          }}
        >
          {loadingFile ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : isEditing ? (
            /* Edit Mode with Rich Text Editor */
            <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4" dir="rtl">
              <div className="space-y-2">
                <label className="text-sm font-semibold opacity-70">תקציר</label>
                <Textarea
                  value={editedSummary}
                  onChange={(e) => setEditedSummary(e.target.value)}
                  placeholder="הזן תקציר..."
                  className="min-h-[80px] resize-none"
                />
              </div>
              
              <div className="space-y-2 flex-1">
                <label className="text-sm font-semibold opacity-70">טקסט מלא (עורך עשיר)</label>
                <RichTextEditor
                  content={editedText}
                  onChange={setEditedText}
                  placeholder="התחל לכתוב את הטקסט המלא..."
                  className="min-h-[55vh]"
                />
              </div>
              
              <div className="text-xs text-muted-foreground text-center pt-2 border-t border-current/10">
                השתמש בסרגל הכלים לעיצוב הטקסט • לחץ "שמור" בסרגל העליון לשמירת השינויים
              </div>
            </div>
          ) : fileType === 'pdf' && sourceUrl ? (
            <iframe
              src={`${sourceUrl}#toolbar=1&navpanes=1&scrollbar=1`}
              className="w-full h-full min-h-[80vh]"
              title="PDF Viewer"
            />
          ) : fileType === 'html' && fileContent ? (
            <div className="h-full">
              {/* Toggle for HTML view mode */}
              <div className="flex gap-2 p-2 border-b border-current/10 bg-black/5">
                <Button 
                  variant={viewMode === 'rendered' ? 'secondary' : 'ghost'} 
                  size="sm"
                  onClick={() => setViewMode('rendered')}
                  className="gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  תצוגה מעובדת
                </Button>
                <Button 
                  variant={viewMode === 'source' ? 'secondary' : 'ghost'} 
                  size="sm"
                  onClick={() => setViewMode('source')}
                  className="gap-1"
                >
                  <Code className="w-3.5 h-3.5" />
                  קוד מקור
                </Button>
              </div>
              {viewMode === 'rendered' ? (
                <iframe
                  srcDoc={fileContent}
                  className="w-full h-full min-h-[70vh] bg-white"
                  title="HTML Preview"
                  sandbox="allow-same-origin"
                />
              ) : (
                <pre 
                  className="p-6 whitespace-pre-wrap font-mono text-sm overflow-auto" 
                  dir="ltr"
                  style={{ fontSize: `${settings.fontSize}px` }}
                >
                  {fileContent}
                </pre>
              )}
            </div>
          ) : fileType === 'json' && fileContent ? (
            <div className="h-full">
              {/* Toggle for JSON view mode */}
              <div className="flex gap-2 p-2 border-b border-current/10 bg-black/5">
                <Button 
                  variant={viewMode === 'rendered' ? 'secondary' : 'ghost'} 
                  size="sm"
                  onClick={() => setViewMode('rendered')}
                  className="gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  מעוצב
                </Button>
                <Button 
                  variant={viewMode === 'source' ? 'secondary' : 'ghost'} 
                  size="sm"
                  onClick={() => setViewMode('source')}
                  className="gap-1"
                >
                  <Code className="w-3.5 h-3.5" />
                  גולמי
                </Button>
              </div>
              <div className="p-6 overflow-auto">
                {viewMode === 'rendered' ? (
                  <pre 
                    className="whitespace-pre-wrap font-mono text-sm" 
                    dir="ltr"
                    style={{ fontSize: `${settings.fontSize}px` }}
                  >
                    {JSON.stringify(JSON.parse(fileContent), null, 2)}
                  </pre>
                ) : (
                  <pre 
                    className="whitespace-pre-wrap font-mono text-sm" 
                    dir="ltr"
                    style={{ fontSize: `${settings.fontSize}px` }}
                  >
                    {fileContent}
                  </pre>
                )}
              </div>
            </div>
          ) : (fileType === 'txt' || fileType === 'xml') && fileContent ? (
            <div 
              className={cn(
                "max-w-4xl mx-auto p-6 md:p-10 lg:p-16",
                settings.fontFamily,
                getAlignClass(),
                settings.isBold && 'font-bold',
                settings.isItalic && 'italic',
                settings.isUnderline && 'underline',
                settings.columnMode === 'double' && 'md:columns-2 md:gap-8'
              )}
              style={{
                fontSize: `${settings.fontSize}px`,
                lineHeight: settings.lineHeight,
                letterSpacing: `${settings.letterSpacing}px`,
                color: settings.textColor !== 'inherit' ? settings.textColor : undefined,
                backgroundColor: settings.bgColor !== 'transparent' ? settings.bgColor : undefined,
              }}
              dir="rtl"
            >
              <div className="whitespace-pre-wrap leading-relaxed">
                {fileContent}
              </div>
            </div>
          ) : (
            /* View Mode - No file content */
            <div 
              className={cn(
                "max-w-4xl mx-auto p-6 md:p-10 lg:p-16",
                settings.fontFamily,
                getAlignClass(),
                settings.isBold && 'font-bold',
                settings.isItalic && 'italic',
                settings.isUnderline && 'underline',
                settings.columnMode === 'double' && 'md:columns-2 md:gap-8'
              )}
              style={{
                fontSize: `${settings.fontSize}px`,
                lineHeight: settings.lineHeight,
                letterSpacing: `${settings.letterSpacing}px`,
                color: settings.textColor !== 'inherit' ? settings.textColor : undefined,
                backgroundColor: settings.bgColor !== 'transparent' ? settings.bgColor : undefined,
              }}
              dir="rtl"
            >
              {/* Summary Section */}
              {psak.summary && (
                <div className="mb-8 pb-8 border-b border-current/10">
                  <h3 className="text-lg font-bold mb-3 opacity-70">תקציר</h3>
                  <p className="leading-relaxed">{psak.summary}</p>
                </div>
              )}

              {/* Full Text */}
              {fullText ? (
                <div className="whitespace-pre-wrap leading-relaxed">
                  {fullText}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 opacity-50">
                  <FileText className="w-16 h-16 mb-4" />
                  <p>אין טקסט מלא זמין - לחץ על "עריכה" להוספת טקסט</p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdvancedDocumentViewer;
