import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Copy,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  FileText,
  RefreshCw,
  Search,
  Eye,
  BarChart3,
  Settings2,
  Filter,
  Download,
  AlertCircle,
  FileWarning,
  Sparkles,
  Zap,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Types
interface PsakDin {
  id: string;
  title: string;
  summary: string;
  full_text?: string;
  court: string;
  year: number;
  case_number?: string;
  tags?: string[];
  content_hash?: string;
  created_at?: string;
}

interface DuplicateGroup {
  id: string;
  items: PsakDin[];
  similarity: number;
  type: 'exact' | 'title' | 'content' | 'hash';
  originalId?: string;
}

interface QualityIssue {
  id: string;
  psak: PsakDin;
  issues: {
    type: 'short' | 'empty' | 'missing_metadata' | 'ocr_error' | 'low_hebrew' | 'repetitive' | 'suspicious_chars' | 'junk' | 'error_page';
    severity: 'error' | 'warning' | 'info';
    message: string;
    details?: string;
  }[];
  score: number; // 0-100, higher is better quality
}

interface QualityStats {
  total: number;
  healthy: number;
  duplicates: number;
  issues: number;
  byIssueType: Record<string, number>;
  bySeverity: { error: number; warning: number; info: number };
  averageQualityScore: number;
}

interface DataQualityCheckerProps {
  psakeiDin: PsakDin[];
  onRefresh?: () => void;
  isLoading?: boolean;
  compact?: boolean;
}

// Helper Functions
const calculateTextSimilarity = (text1: string, text2: string): number => {
  if (!text1 || !text2) return 0;
  
  const normalize = (t: string) => t.toLowerCase().replace(/[\s\n\r]+/g, ' ').trim();
  const t1 = normalize(text1);
  const t2 = normalize(text2);
  
  // Exact match
  if (t1 === t2) return 1;
  
  // Jaccard similarity on words
  const words1 = new Set(t1.split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(t2.split(/\s+/).filter(w => w.length > 2));
  
  if (words1.size === 0 && words2.size === 0) return 1;
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = [...words1].filter(w => words2.has(w)).length;
  const union = new Set([...words1, ...words2]).size;
  
  return union > 0 ? intersection / union : 0;
};

const calculateTitleSimilarity = (title1: string, title2: string): number => {
  if (!title1 || !title2) return 0;
  
  const normalize = (t: string) => t
    .toLowerCase()
    .replace(/[\u0591-\u05C7]/g, '') // Remove nikud
    .replace(/[^\u0590-\u05FFa-z0-9\s]/g, '')
    .trim();
  
  const t1 = normalize(title1);
  const t2 = normalize(title2);
  
  if (t1 === t2) return 1;
  
  // Levenshtein-based similarity for shorter texts
  const maxLen = Math.max(t1.length, t2.length);
  if (maxLen === 0) return 1;
  
  let distance = 0;
  const matrix: number[][] = [];
  
  for (let i = 0; i <= t1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= t2.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= t1.length; i++) {
    for (let j = 1; j <= t2.length; j++) {
      const cost = t1[i - 1] === t2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  distance = matrix[t1.length][t2.length];
  return 1 - distance / maxLen;
};

// Junk/Spam detection patterns - website error pages, placeholder content
const JUNK_PATTERNS = {
  // Known junk titles - exact matches
  junkTitles: [
    'אתר פסקי דין רבניים',
    'לא נמצא הפריט המבוקש',
    'דף לא נמצא',
    'page not found',
    '404',
    'error',
    'שגיאה',
    'אין תוצאות',
    'no results',
  ],
  // Known junk content patterns - if ANY of these appear in text, it's junk
  junkContent: [
    'לא נמצא הפריט המבוקש',
    'הדף אינו קיים',
    'page not found',
    '404 error',
    'צור קשר אודות',
    'חיפוש מתקדם מאמרים ועיונים',
    'דף בית מפתח פסקי הדין',
    // Specific psakim.org error page fragments
    'אתר פסקי דין רבניים דף בית מפתח',
    'psakim.org',
  ],
  // Website navigation fragments - regex patterns
  navPatterns: [
    /דף בית.*מפתח.*פסקי.*הדין.*חיפוש/i,
    /צור קשר.*אודות.*English/i,
    /psakim\.org/i,
    // Match the exact pattern from the screenshot
    /אתר פסקי דין רבניים.*דף בית.*מפתח/i,
    /בס"?ד.*לא נמצא הפריט/i,
  ]
};

const isJunkContent = (psak: PsakDin): { isJunk: boolean; reason: string } => {
  const title = psak.title?.toLowerCase().trim() || '';
  const text = (psak.full_text || psak.summary || '').toLowerCase();
  
  // Check for junk titles
  for (const junkTitle of JUNK_PATTERNS.junkTitles) {
    if (title.includes(junkTitle.toLowerCase())) {
      return { isJunk: true, reason: `כותרת זבל: "${junkTitle}"` };
    }
  }
  
  // Check for junk content
  for (const junkContent of JUNK_PATTERNS.junkContent) {
    if (text.includes(junkContent.toLowerCase())) {
      return { isJunk: true, reason: `תוכן זבל: "${junkContent}"` };
    }
  }
  
  // Check for navigation patterns
  for (const pattern of JUNK_PATTERNS.navPatterns) {
    if (pattern.test(text)) {
      return { isJunk: true, reason: 'דף ניווט/שגיאה מאתר' };
    }
  }
  
  // Check for very short content with website-like patterns
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  if (wordCount < 30 && (text.includes('psakim.org') || text.includes('english'))) {
    return { isJunk: true, reason: 'תוכן קצר מאוד עם פרטי אתר' };
  }
  
  return { isJunk: false, reason: '' };
};

const analyzeTextQuality = (psak: PsakDin): QualityIssue['issues'] => {
  const issues: QualityIssue['issues'] = [];
  const text = psak.full_text || psak.summary || '';
  
  // FIRST: Check for junk/error page content - highest priority
  const junkCheck = isJunkContent(psak);
  if (junkCheck.isJunk) {
    issues.push({
      type: 'junk',
      severity: 'error',
      message: '🗑️ תוכן זבל / דף שגיאה',
      details: junkCheck.reason
    });
    // Still continue to add other issues for full picture
  }
  
  // Check for empty content
  if (!text || text.trim().length === 0) {
    issues.push({
      type: 'empty',
      severity: 'error',
      message: 'תוכן ריק',
      details: 'פסק הדין לא מכיל תוכן טקסטואלי'
    });
    return issues;
  }
  
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  const charCount = text.replace(/\s/g, '').length;
  const lineCount = text.split('\n').filter(l => l.trim()).length;
  
  // Check for very short content
  if (wordCount < 20) {
    issues.push({
      type: 'short',
      severity: 'error',
      message: `תוכן קצר מאוד (${wordCount} מילים)`,
      details: 'פסק דין צריך להכיל לפחות 20 מילים'
    });
  } else if (wordCount < 50) {
    issues.push({
      type: 'short',
      severity: 'warning',
      message: `תוכן קצר (${wordCount} מילים)`,
      details: 'מומלץ שפסק דין יכיל לפחות 50 מילים'
    });
  }
  
  // Check Hebrew content ratio
  const hebrewChars = (text.match(/[\u0590-\u05FF]/g) || []).length;
  const hebrewRatio = charCount > 0 ? hebrewChars / charCount : 0;
  
  if (hebrewRatio < 0.3 && charCount > 20) {
    issues.push({
      type: 'low_hebrew',
      severity: 'warning',
      message: `מעט תוכן בעברית (${Math.round(hebrewRatio * 100)}%)`,
      details: 'פסק הדין מכיל מעט טקסט בעברית'
    });
  }
  
  // Check for OCR errors (repeated characters)
  if (/(.)\1{8,}/.test(text)) {
    issues.push({
      type: 'ocr_error',
      severity: 'warning',
      message: 'תווים חוזרים רבים',
      details: 'ייתכן שיש בעיית OCR בסריקת הטקסט'
    });
  }
  
  // Check for suspicious character patterns
  const suspiciousPatterns = [
    { pattern: /\?{3,}/g, name: 'סימני שאלה חוזרים' },
    { pattern: /\.{5,}/g, name: 'נקודות חוזרות' },
    { pattern: /_{5,}/g, name: 'קווים תחתונים חוזרים' },
    { pattern: /[#$%&*]{3,}/g, name: 'תווים מיוחדים חוזרים' },
  ];
  
  for (const { pattern, name } of suspiciousPatterns) {
    if (pattern.test(text)) {
      issues.push({
        type: 'suspicious_chars',
        severity: 'info',
        message: name,
        details: 'נמצאו תבניות חשודות בטקסט'
      });
      break;
    }
  }
  
  // Check for repetitive content (same sentence appearing multiple times)
  const sentences = text.split(/[.!?]/).map(s => s.trim()).filter(s => s.length > 20);
  const sentenceCounts = new Map<string, number>();
  for (const sentence of sentences) {
    const normalized = sentence.toLowerCase();
    sentenceCounts.set(normalized, (sentenceCounts.get(normalized) || 0) + 1);
  }
  const hasRepetition = [...sentenceCounts.values()].some(count => count > 2);
  if (hasRepetition) {
    issues.push({
      type: 'repetitive',
      severity: 'warning',
      message: 'תוכן חוזר על עצמו',
      details: 'אותם משפטים מופיעים מספר פעמים'
    });
  }
  
  // Check for missing metadata
  if (!psak.title || psak.title.trim().length < 3) {
    issues.push({
      type: 'missing_metadata',
      severity: 'warning',
      message: 'כותרת חסרה או קצרה',
      details: 'פסק דין צריך כותרת משמעותית'
    });
  }
  
  if (!psak.court || psak.court.trim().length === 0) {
    issues.push({
      type: 'missing_metadata',
      severity: 'info',
      message: 'לא צוין בית משפט',
      details: 'מומלץ לציין את בית המשפט'
    });
  }
  
  const currentYear = new Date().getFullYear();
  if (!psak.year || psak.year < 1900 || psak.year > currentYear + 1) {
    issues.push({
      type: 'missing_metadata',
      severity: 'warning',
      message: 'שנה לא תקינה',
      details: `שנת פסק הדין צריכה להיות בין 1900 ל-${currentYear}`
    });
  }
  
  return issues;
};

const calculateQualityScore = (issues: QualityIssue['issues']): number => {
  let score = 100;
  
  for (const issue of issues) {
    switch (issue.severity) {
      case 'error':
        score -= 30;
        break;
      case 'warning':
        score -= 15;
        break;
      case 'info':
        score -= 5;
        break;
    }
  }
  
  return Math.max(0, Math.min(100, score));
};

// Main Component
export const DataQualityChecker: React.FC<DataQualityCheckerProps> = ({
  psakeiDin,
  onRefresh,
  isLoading = false,
  compact = false,
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [qualityIssues, setQualityIssues] = useState<QualityIssue[]>([]);
  const [stats, setStats] = useState<QualityStats | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'overview' | 'duplicates' | 'issues'>('overview');
  
  // Settings
  const [similarityThreshold, setSimilarityThreshold] = useState(0.8);
  const [minWords, setMinWords] = useState(20);
  const [checkDuplicates, setCheckDuplicates] = useState(true);
  const [checkQuality, setCheckQuality] = useState(true);
  const [sortBy, setSortBy] = useState<'severity' | 'score' | 'date'>('severity');
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'error' | 'warning'>('all');
  
  // New: Analysis range settings
  const [analysisLimit, setAnalysisLimit] = useState<number>(100);
  const [analysisMode, setAnalysisMode] = useState<'all' | 'limited'>('limited');
  
  // Virtual scrolling settings
  const [useVirtualScroll, setUseVirtualScroll] = useState(true);
  const [visibleItemsCount, setVisibleItemsCount] = useState(50);
  
  // Dialog state
  const [previewPsak, setPreviewPsak] = useState<PsakDin | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  // Get psakim to analyze based on settings
  const psakimToAnalyze = useMemo(() => {
    if (analysisMode === 'all') return psakeiDin;
    return psakeiDin.slice(0, analysisLimit);
  }, [psakeiDin, analysisMode, analysisLimit]);
  
  // Run analysis - optimized for speed
  const runAnalysis = useCallback(async () => {
    const targetPsakim = psakimToAnalyze;
    
    if (targetPsakim.length === 0) {
      toast.error('אין פסקי דין לבדיקה');
      return;
    }
    
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    
    const newDuplicates: DuplicateGroup[] = [];
    const newIssues: QualityIssue[] = [];
    
    try {
      const startTime = Date.now();
      
      // Phase 1: Build hash map for fast duplicate detection
      const hashMap = new Map<string, PsakDin[]>();
      const titleMap = new Map<string, PsakDin[]>();
      
      for (const psak of targetPsakim) {
        // Group by content hash
        if (psak.content_hash) {
          const existing = hashMap.get(psak.content_hash) || [];
          existing.push(psak);
          hashMap.set(psak.content_hash, existing);
        }
        
        // Group by normalized title for fast title matching
        const normalizedTitle = psak.title?.toLowerCase().replace(/[\u0591-\u05C7]/g, '').trim();
        if (normalizedTitle && normalizedTitle.length > 5) {
          const existing = titleMap.get(normalizedTitle) || [];
          existing.push(psak);
          titleMap.set(normalizedTitle, existing);
        }
      }
      
      setAnalysisProgress(20);
      
      // Phase 2: Find exact hash duplicates (instant)
      if (checkDuplicates) {
        let dupGroupId = 0;
        
        for (const [hash, items] of hashMap.entries()) {
          if (items.length > 1) {
            const sortedItems = [...items].sort((a, b) => 
              (a.created_at || '').localeCompare(b.created_at || '')
            );
            newDuplicates.push({
              id: `hash-dup-${dupGroupId++}`,
              items: sortedItems,
              similarity: 100,
              type: 'hash',
              originalId: sortedItems[0].id
            });
          }
        }
        
        // Find title duplicates
        for (const [title, items] of titleMap.entries()) {
          if (items.length > 1) {
            // Check if not already in hash duplicates
            const existingHashDup = newDuplicates.find(d => 
              d.items.some(i => items.includes(i)) && d.type === 'hash'
            );
            if (!existingHashDup) {
              const sortedItems = [...items].sort((a, b) => 
                (a.created_at || '').localeCompare(b.created_at || '')
              );
              newDuplicates.push({
                id: `title-dup-${dupGroupId++}`,
                items: sortedItems,
                similarity: 95,
                type: 'title',
                originalId: sortedItems[0].id
              });
            }
          }
        }
      }
      
      setAnalysisProgress(50);
      
      // Phase 3: Quality check (batch process)
      if (checkQuality) {
        const batchSize = 100;
        for (let i = 0; i < targetPsakim.length; i += batchSize) {
          const batch = targetPsakim.slice(i, i + batchSize);
          
          for (const psak of batch) {
            const issues = analyzeTextQuality(psak);
            if (issues.length > 0) {
              newIssues.push({
                id: psak.id,
                psak,
                issues,
                score: calculateQualityScore(issues)
              });
            }
          }
          
          setAnalysisProgress(50 + Math.round((i / targetPsakim.length) * 45));
          
          // Yield to UI every batch
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      
      setAnalysisProgress(95);
      
      // Calculate stats
      const byIssueType: Record<string, number> = {};
      const bySeverity = { error: 0, warning: 0, info: 0 };
      
      for (const issue of newIssues) {
        for (const i of issue.issues) {
          byIssueType[i.type] = (byIssueType[i.type] || 0) + 1;
          bySeverity[i.severity]++;
        }
      }
      
      const avgScore = newIssues.length > 0
        ? newIssues.reduce((sum, i) => sum + i.score, 0) / newIssues.length
        : 100;
      
      const endTime = Date.now();
      
      setStats({
        total: targetPsakim.length,
        healthy: targetPsakim.length - newIssues.length,
        duplicates: newDuplicates.length,
        issues: newIssues.length,
        byIssueType,
        bySeverity,
        averageQualityScore: Math.round(avgScore)
      });
      
      setDuplicateGroups(newDuplicates);
      setQualityIssues(newIssues);
      setSelectedIds(new Set());
      
      toast.success(`הבדיקה הושלמה ב-${((endTime - startTime) / 1000).toFixed(1)} שניות: ${newDuplicates.length} כפילויות, ${newIssues.length} בעיות`);
      
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('שגיאה בניתוח הנתונים');
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress(100);
    }
  }, [psakimToAnalyze, checkDuplicates, checkQuality, similarityThreshold]);
  
  // Delete selected
  const deleteSelected = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.warning('לא נבחרו פריטים');
      return;
    }
    
    if (!confirm(`האם למחוק ${selectedIds.size} פסקי דין?`)) return;
    
    try {
      const { error } = await supabase
        .from('psakei_din')
        .delete()
        .in('id', Array.from(selectedIds));
      
      if (error) throw error;
      
      toast.success(`נמחקו ${selectedIds.size} פסקי דין`);
      setSelectedIds(new Set());
      onRefresh?.();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('שגיאה במחיקה');
    }
  }, [selectedIds, onRefresh]);
  
  // Export report
  const exportReport = useCallback(() => {
    const report = {
      timestamp: new Date().toISOString(),
      stats,
      duplicates: duplicateGroups.map(g => ({
        items: g.items.map(p => ({ id: p.id, title: p.title })),
        similarity: g.similarity,
        type: g.type
      })),
      issues: qualityIssues.map(q => ({
        id: q.psak.id,
        title: q.psak.title,
        issues: q.issues,
        score: q.score
      }))
    };
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quality-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('הדוח יוצא בהצלחה');
  }, [stats, duplicateGroups, qualityIssues]);
  
  // Filtered and sorted issues
  const filteredIssues = useMemo(() => {
    let filtered = [...qualityIssues];
    
    if (filterSeverity !== 'all') {
      filtered = filtered.filter(q => 
        q.issues.some(i => i.severity === filterSeverity)
      );
    }
    
    switch (sortBy) {
      case 'severity':
        filtered.sort((a, b) => {
          const getMaxSeverity = (issues: QualityIssue['issues']) => {
            if (issues.some(i => i.severity === 'error')) return 0;
            if (issues.some(i => i.severity === 'warning')) return 1;
            return 2;
          };
          return getMaxSeverity(a.issues) - getMaxSeverity(b.issues);
        });
        break;
      case 'score':
        filtered.sort((a, b) => a.score - b.score);
        break;
      case 'date':
        filtered.sort((a, b) => 
          (b.psak.created_at || '').localeCompare(a.psak.created_at || '')
        );
        break;
    }
    
    return filtered;
  }, [qualityIssues, filterSeverity, sortBy]);
  
  // Toggle selection
  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };
  
  // Select all duplicates (keep originals)
  const selectAllDuplicates = () => {
    const ids = new Set<string>();
    for (const group of duplicateGroups) {
      for (const item of group.items) {
        if (item.id !== group.originalId) {
          ids.add(item.id);
        }
      }
    }
    setSelectedIds(ids);
  };
  
  // Select all with severe issues
  const selectSevereIssues = () => {
    const ids = new Set<string>();
    for (const issue of qualityIssues) {
      if (issue.issues.some(i => i.severity === 'error') || issue.score < 50) {
        ids.add(issue.id);
      }
    }
    setSelectedIds(ids);
  };
  
  // Select all junk/error page items
  const selectAllJunk = () => {
    const ids = new Set<string>();
    for (const issue of qualityIssues) {
      if (issue.issues.some(i => i.type === 'junk' || i.type === 'error_page')) {
        ids.add(issue.id);
      }
    }
    setSelectedIds(ids);
    if (ids.size > 0) {
      toast.success(`נבחרו ${ids.size} פסקי דין זבל`);
    }
  };
  
  // Count junk items
  const junkCount = useMemo(() => {
    return qualityIssues.filter(issue => 
      issue.issues.some(i => i.type === 'junk' || i.type === 'error_page')
    ).length;
  }, [qualityIssues]);
  
  // Select all issues
  const selectAllIssues = () => {
    const ids = new Set<string>();
    for (const issue of qualityIssues) {
      ids.add(issue.id);
    }
    setSelectedIds(ids);
  };
  
  // Clear selection
  const clearSelection = () => {
    setSelectedIds(new Set());
  };
  
  const getSeverityIcon = (severity: 'error' | 'warning' | 'info') => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <FileWarning className="h-4 w-4 text-blue-500" />;
    }
  };
  
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };
  
  if (compact) {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Sparkles className="h-4 w-4" />
            בדיקת איכות
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              בדיקת איכות נתונים
            </DialogTitle>
            <DialogDescription>
              זיהוי כפילויות, פסקים קצרים, ושגיאות בנתונים
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            <DataQualityContent
              psakeiDin={psakeiDin}
              isAnalyzing={isAnalyzing}
              isLoading={isLoading}
              analysisProgress={analysisProgress}
              stats={stats}
              duplicateGroups={duplicateGroups}
              qualityIssues={filteredIssues}
              selectedIds={selectedIds}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              runAnalysis={runAnalysis}
              deleteSelected={deleteSelected}
              exportReport={exportReport}
              toggleSelection={toggleSelection}
              selectAllDuplicates={selectAllDuplicates}
              selectSevereIssues={selectSevereIssues}
              selectAllIssues={selectAllIssues}
              selectAllJunk={selectAllJunk}
              junkCount={junkCount}
              clearSelection={clearSelection}
              setPreviewPsak={setPreviewPsak}
              getSeverityIcon={getSeverityIcon}
              getScoreColor={getScoreColor}
              filterSeverity={filterSeverity}
              setFilterSeverity={setFilterSeverity}
              sortBy={sortBy}
              setSortBy={setSortBy}
              similarityThreshold={similarityThreshold}
              setSimilarityThreshold={setSimilarityThreshold}
              showSettings={showSettings}
              setShowSettings={setShowSettings}
              compact={true}
              analysisLimit={analysisLimit}
              setAnalysisLimit={setAnalysisLimit}
              analysisMode={analysisMode}
              setAnalysisMode={setAnalysisMode}
              totalPsakim={psakeiDin.length}
              useVirtualScroll={useVirtualScroll}
              setUseVirtualScroll={setUseVirtualScroll}
              visibleItemsCount={visibleItemsCount}
              setVisibleItemsCount={setVisibleItemsCount}
            />
          </div>
        </DialogContent>
        
        {/* Preview Dialog */}
        <PsakPreviewDialog psak={previewPsak} onClose={() => setPreviewPsak(null)} />
      </Dialog>
    );
  }
  
  return (
    <div className="space-y-4" dir="rtl">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-[#b8860b]" />
                בדיקת איכות נתונים
              </CardTitle>
              <CardDescription>
                זיהוי כפילויות, פסקים קצרים, בעיות OCR, ושגיאות בנתונים
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
              >
                <Settings2 className="h-4 w-4" />
              </Button>
              <Button
                onClick={runAnalysis}
                disabled={isAnalyzing || isLoading || psakeiDin.length === 0}
                className="gap-2 bg-[#1e3a5f] hover:bg-[#2a4a6f]"
              >
                {isAnalyzing ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                הפעל בדיקה
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <DataQualityContent
            psakeiDin={psakeiDin}
            isAnalyzing={isAnalyzing}
            analysisProgress={analysisProgress}
            stats={stats}
            duplicateGroups={duplicateGroups}
            qualityIssues={filteredIssues}
            selectedIds={selectedIds}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            runAnalysis={runAnalysis}
            deleteSelected={deleteSelected}
            exportReport={exportReport}
            toggleSelection={toggleSelection}
            selectAllDuplicates={selectAllDuplicates}
            selectSevereIssues={selectSevereIssues}
            selectAllIssues={selectAllIssues}
            selectAllJunk={selectAllJunk}
            junkCount={junkCount}
            clearSelection={clearSelection}
            setPreviewPsak={setPreviewPsak}
            getSeverityIcon={getSeverityIcon}
            getScoreColor={getScoreColor}
            filterSeverity={filterSeverity}
            setFilterSeverity={setFilterSeverity}
            sortBy={sortBy}
            setSortBy={setSortBy}
            similarityThreshold={similarityThreshold}
            setSimilarityThreshold={setSimilarityThreshold}
            showSettings={showSettings}
            setShowSettings={setShowSettings}
            analysisLimit={analysisLimit}
            setAnalysisLimit={setAnalysisLimit}
            analysisMode={analysisMode}
            setAnalysisMode={setAnalysisMode}
            totalPsakim={psakeiDin.length}
            useVirtualScroll={useVirtualScroll}
            setUseVirtualScroll={setUseVirtualScroll}
            visibleItemsCount={visibleItemsCount}
            setVisibleItemsCount={setVisibleItemsCount}
          />
        </CardContent>
      </Card>
      
      {/* Preview Dialog */}
      <PsakPreviewDialog psak={previewPsak} onClose={() => setPreviewPsak(null)} />
    </div>
  );
};

// Content component (shared between compact and full modes)
interface DataQualityContentProps {
  psakeiDin: PsakDin[];
  isAnalyzing: boolean;
  isLoading?: boolean;
  analysisProgress: number;
  stats: QualityStats | null;
  duplicateGroups: DuplicateGroup[];
  qualityIssues: QualityIssue[];
  selectedIds: Set<string>;
  activeTab: 'overview' | 'duplicates' | 'issues';
  setActiveTab: (tab: 'overview' | 'duplicates' | 'issues') => void;
  runAnalysis: () => void;
  deleteSelected: () => void;
  exportReport: () => void;
  toggleSelection: (id: string) => void;
  selectAllDuplicates: () => void;
  selectSevereIssues: () => void;
  selectAllIssues: () => void;
  selectAllJunk: () => void;
  junkCount: number;
  clearSelection: () => void;
  setPreviewPsak: (psak: PsakDin | null) => void;
  getSeverityIcon: (severity: 'error' | 'warning' | 'info') => React.ReactNode;
  getScoreColor: (score: number) => string;
  filterSeverity: 'all' | 'error' | 'warning';
  setFilterSeverity: (s: 'all' | 'error' | 'warning') => void;
  sortBy: 'severity' | 'score' | 'date';
  setSortBy: (s: 'severity' | 'score' | 'date') => void;
  similarityThreshold: number;
  setSimilarityThreshold: (t: number) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  compact?: boolean;
  analysisLimit: number;
  setAnalysisLimit: (limit: number) => void;
  analysisMode: 'all' | 'limited';
  setAnalysisMode: (mode: 'all' | 'limited') => void;
  totalPsakim: number;
  useVirtualScroll: boolean;
  setUseVirtualScroll: (use: boolean) => void;
  visibleItemsCount: number;
  setVisibleItemsCount: (count: number) => void;
}

const DataQualityContent: React.FC<DataQualityContentProps> = ({
  psakeiDin,
  isAnalyzing,
  isLoading = false,
  analysisProgress,
  stats,
  duplicateGroups,
  qualityIssues,
  selectedIds,
  activeTab,
  setActiveTab,
  runAnalysis,
  deleteSelected,
  exportReport,
  toggleSelection,
  selectAllDuplicates,
  selectSevereIssues,
  selectAllIssues,
  selectAllJunk,
  junkCount,
  clearSelection,
  setPreviewPsak,
  getSeverityIcon,
  getScoreColor,
  filterSeverity,
  setFilterSeverity,
  sortBy,
  setSortBy,
  similarityThreshold,
  setSimilarityThreshold,
  showSettings,
  setShowSettings,
  compact = false,
  analysisLimit,
  setAnalysisLimit,
  analysisMode,
  setAnalysisMode,
  totalPsakim,
  useVirtualScroll,
  setUseVirtualScroll,
  visibleItemsCount,
  setVisibleItemsCount,
}) => {
  // State for virtual scrolling pagination
  const [currentPage, setCurrentPage] = useState(1);
  
  // Calculate visible items for virtual scroll
  const getVisibleItems = <T,>(items: T[]) => {
    if (!useVirtualScroll) return items;
    const start = 0;
    const end = currentPage * visibleItemsCount;
    return items.slice(start, end);
  };
  
  const hasMore = (items: unknown[]) => {
    if (!useVirtualScroll) return false;
    return currentPage * visibleItemsCount < items.length;
  };
  
  const loadMore = () => {
    setCurrentPage(prev => prev + 1);
  };
  
  return (
    <div className="space-y-4">
      {/* Analysis Range Selector */}
      {!stats && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">כמות פסקי דין לבדיקה</Label>
                <Badge variant="secondary">{totalPsakim} זמינים</Badge>
              </div>
              
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="mode-limited"
                    checked={analysisMode === 'limited'}
                    onCheckedChange={(checked) => setAnalysisMode(checked ? 'limited' : 'all')}
                  />
                  <Label htmlFor="mode-limited">הגבל כמות</Label>
                </div>
                
                {analysisMode === 'limited' && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={analysisLimit}
                      onChange={(e) => setAnalysisLimit(Math.max(1, Number(e.target.value)))}
                      className="w-24"
                      min={1}
                      max={totalPsakim}
                    />
                    <span className="text-sm text-muted-foreground">פסקים</span>
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="mode-all"
                    checked={analysisMode === 'all'}
                    onCheckedChange={(checked) => setAnalysisMode(checked ? 'all' : 'limited')}
                  />
                  <Label htmlFor="mode-all">בדוק הכל ({totalPsakim})</Label>
                </div>
              </div>
              
              {/* Quick select buttons */}
              {analysisMode === 'limited' && (
                <div className="flex flex-wrap gap-2">
                  {[10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000].filter(n => n <= totalPsakim).map(num => (
                    <Button
                      key={num}
                      variant={analysisLimit === num ? "default" : "outline"}
                      size="sm"
                      onClick={() => setAnalysisLimit(num)}
                    >
                      {num >= 1000 ? `${num / 1000}K` : num}
                    </Button>
                  ))}
                  {totalPsakim > 10000 && (
                    <Button
                      variant={analysisLimit === totalPsakim ? "default" : "outline"}
                      size="sm"
                      onClick={() => setAnalysisLimit(totalPsakim)}
                    >
                      הכל ({totalPsakim})
                    </Button>
                  )}
                </div>
              )}
              
              <Button
                onClick={runAnalysis}
                disabled={isAnalyzing || isLoading}
                className="w-full gap-2 bg-[#1e3a5f] hover:bg-[#2a4a6f]"
              >
                {isAnalyzing ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                {isAnalyzing ? 'מנתח...' : `הפעל בדיקה על ${analysisMode === 'all' ? totalPsakim : analysisLimit} פסקים`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Settings Panel */}
      {showSettings && (
        <Card className="border-dashed">
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Label>סף דמיון:</Label>
                <Input
                  type="number"
                  value={Math.round(similarityThreshold * 100)}
                  onChange={(e) => setSimilarityThreshold(Number(e.target.value) / 100)}
                  className="w-20"
                  min={50}
                  max={100}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <div className="flex items-center gap-2">
                <Label>סינון:</Label>
                <Select value={filterSeverity} onValueChange={(v) => setFilterSeverity(v as 'all' | 'error' | 'warning')}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">הכל</SelectItem>
                    <SelectItem value="error">שגיאות</SelectItem>
                    <SelectItem value="warning">אזהרות</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label>מיון:</Label>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'severity' | 'score' | 'date')}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="severity">חומרה</SelectItem>
                    <SelectItem value="score">ציון</SelectItem>
                    <SelectItem value="date">תאריך</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 border-r pr-4 mr-2">
                <Checkbox
                  id="virtual-scroll"
                  checked={useVirtualScroll}
                  onCheckedChange={(checked) => setUseVirtualScroll(checked === true)}
                />
                <Label htmlFor="virtual-scroll">גלילה וירטואלית</Label>
                {useVirtualScroll && (
                  <Input
                    type="number"
                    value={visibleItemsCount}
                    onChange={(e) => setVisibleItemsCount(Math.max(10, Number(e.target.value)))}
                    className="w-16"
                    min={10}
                  />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Progress */}
      {isAnalyzing && (
        <div className="space-y-2">
          <Progress value={analysisProgress} className="h-2" />
          <p className="text-sm text-center text-muted-foreground">
            מנתח נתונים... {analysisProgress}%
          </p>
        </div>
      )}
      
      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="p-3">
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-sm text-muted-foreground">סה״כ נבדקו</div>
          </Card>
          <Card className="p-3">
            <div className="text-2xl font-bold text-green-600">{stats.healthy}</div>
            <div className="text-sm text-muted-foreground">תקינים</div>
          </Card>
          <Card className="p-3 cursor-pointer hover:bg-orange-50" onClick={selectAllDuplicates}>
            <div className="text-2xl font-bold text-orange-600">{stats.duplicates}</div>
            <div className="text-sm text-muted-foreground">כפילויות (לחץ לבחירה)</div>
          </Card>
          {junkCount > 0 && (
            <Card className="p-3 cursor-pointer hover:bg-red-50 border-red-300" onClick={selectAllJunk}>
              <div className="text-2xl font-bold text-red-600">🗑️ {junkCount}</div>
              <div className="text-sm text-muted-foreground">זבל/שגיאות (לחץ לבחירה)</div>
            </Card>
          )}
          <Card className="p-3 cursor-pointer hover:bg-red-50" onClick={selectSevereIssues}>
            <div className="text-2xl font-bold text-red-600">{stats.issues}</div>
            <div className="text-sm text-muted-foreground">בעייתיים (לחץ לבחירה)</div>
          </Card>
        </div>
      )}
      
      {/* Selection Actions - Enhanced */}
      {selectedIds.size > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-red-700 font-medium">נבחרו {selectedIds.size} פסקים למחיקה</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSelection}
                >
                  בטל בחירה
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={deleteSelected}
                  className="gap-1"
                >
                  <Trash2 className="h-4 w-4" />
                  מחק {selectedIds.size} פסקים
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      {/* Quick Selection Buttons */}
      {stats && stats.issues + stats.duplicates > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground">בחירה מהירה:</span>
          <Button variant="outline" size="sm" onClick={selectAllDuplicates} className="gap-1">
            <Copy className="h-3 w-3" />
            כל הכפילויות ({duplicateGroups.reduce((acc, g) => acc + g.items.length - 1, 0)})
          </Button>
          {junkCount > 0 && (
            <Button variant="outline" size="sm" onClick={selectAllJunk} className="gap-1 text-red-600 border-red-300 hover:bg-red-50">
              <Trash2 className="h-3 w-3" />
              🗑️ זבל/שגיאות ({junkCount})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={selectSevereIssues} className="gap-1">
            <AlertCircle className="h-3 w-3" />
            בעיות חמורות
          </Button>
          <Button variant="outline" size="sm" onClick={selectAllIssues} className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            כל הבעייתיים ({qualityIssues.length})
          </Button>
          {selectedIds.size > 0 && (
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              נקה בחירה
            </Button>
          )}
        </div>
      )}
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'overview' | 'duplicates' | 'issues')}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="overview" className="gap-1">
              <BarChart3 className="h-4 w-4" />
              סקירה
            </TabsTrigger>
            <TabsTrigger value="duplicates" className="gap-1">
              <Copy className="h-4 w-4" />
              כפילויות ({duplicateGroups.length})
            </TabsTrigger>
            <TabsTrigger value="issues" className="gap-1">
              <AlertTriangle className="h-4 w-4" />
              בעיות ({qualityIssues.length})
            </TabsTrigger>
          </TabsList>
          
          {stats && (
            <Button variant="outline" size="sm" onClick={exportReport} className="gap-1">
              <Download className="h-4 w-4" />
              ייצא דוח
            </Button>
          )}
        </div>
        
        <TabsContent value="overview" className="mt-4">
          {stats ? (
            <div className="space-y-4">
              {/* Quality Score */}
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">ציון איכות ממוצע</h4>
                    <p className="text-sm text-muted-foreground">
                      על סמך {stats.issues} פסקים עם בעיות
                    </p>
                  </div>
                  <div className={cn('text-4xl font-bold', getScoreColor(stats.averageQualityScore))}>
                    {stats.averageQualityScore}%
                  </div>
                </div>
                <Progress value={stats.averageQualityScore} className="mt-3" />
              </Card>
              
              {/* Issue Types */}
              <Card className="p-4">
                <h4 className="font-medium mb-3">סוגי בעיות</h4>
                <div className="space-y-2">
                  {Object.entries(stats.byIssueType).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-sm">{getIssueTypeLabel(type)}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                  {Object.keys(stats.byIssueType).length === 0 && (
                    <p className="text-sm text-muted-foreground">לא נמצאו בעיות!</p>
                  )}
                </div>
              </Card>
              
              {/* Severity breakdown */}
              <Card className="p-4">
                <h4 className="font-medium mb-3">לפי חומרה</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <span className="text-sm">שגיאות</span>
                    </div>
                    <Badge variant="destructive">{stats.bySeverity.error}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm">אזהרות</span>
                    </div>
                    <Badge variant="secondary" className="bg-yellow-100">{stats.bySeverity.warning}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileWarning className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">מידע</span>
                    </div>
                    <Badge variant="outline">{stats.bySeverity.info}</Badge>
                  </div>
                </div>
              </Card>
              
              {/* Run again button */}
              <Button
                onClick={runAnalysis}
                variant="outline"
                className="w-full gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                הפעל בדיקה חדשה
              </Button>
            </div>
          ) : null}
        </TabsContent>
        
        <TabsContent value="duplicates" className="mt-4">
          <ScrollArea className="h-[400px]">
            {duplicateGroups.length > 0 ? (
              <div className="space-y-3">
                {getVisibleItems(duplicateGroups).map((group) => (
                  <DuplicateGroupCard
                    key={group.id}
                    group={group}
                    selectedIds={selectedIds}
                    toggleSelection={toggleSelection}
                    onPreview={setPreviewPsak}
                  />
                ))}
                {hasMore(duplicateGroups) && (
                  <div className="py-4 text-center">
                    <Button variant="outline" onClick={loadMore} className="gap-2">
                      <ChevronDown className="h-4 w-4" />
                      טען עוד ({duplicateGroups.length - currentPage * visibleItemsCount} נוספים)
                    </Button>
                  </div>
                )}
                {!useVirtualScroll && duplicateGroups.length > 50 && (
                  <p className="text-xs text-center text-muted-foreground py-2">
                    מציג {duplicateGroups.length} כפילויות. הפעל גלילה וירטואלית לביצועים טובים יותר.
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
                <p>לא נמצאו כפילויות</p>
              </div>
            )}
          </ScrollArea>
        </TabsContent>
        
        <TabsContent value="issues" className="mt-4">
          <ScrollArea className="h-[400px]">
            {qualityIssues.length > 0 ? (
              <div className="space-y-2">
                {getVisibleItems(qualityIssues).map((item) => (
                  <IssueCard
                    key={item.id}
                    item={item}
                    isSelected={selectedIds.has(item.id)}
                    toggleSelection={toggleSelection}
                    onPreview={() => setPreviewPsak(item.psak)}
                    getSeverityIcon={getSeverityIcon}
                    getScoreColor={getScoreColor}
                  />
                ))}
                {hasMore(qualityIssues) && (
                  <div className="py-4 text-center">
                    <Button variant="outline" onClick={loadMore} className="gap-2">
                      <ChevronDown className="h-4 w-4" />
                      טען עוד ({qualityIssues.length - currentPage * visibleItemsCount} נוספים)
                    </Button>
                  </div>
                )}
                {!useVirtualScroll && qualityIssues.length > 50 && (
                  <p className="text-xs text-center text-muted-foreground py-2">
                    מציג {qualityIssues.length} בעיות. הפעל גלילה וירטואלית לביצועים טובים יותר.
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
                <p>כל הפסקים תקינים</p>
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Duplicate Group Card
interface DuplicateGroupCardProps {
  group: DuplicateGroup;
  selectedIds: Set<string>;
  toggleSelection: (id: string) => void;
  onPreview: (psak: PsakDin) => void;
}

const DuplicateGroupCard: React.FC<DuplicateGroupCardProps> = ({
  group,
  selectedIds,
  toggleSelection,
  onPreview,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const typeLabels: Record<DuplicateGroup['type'], string> = {
    exact: 'זהה לחלוטין',
    title: 'כותרת זהה',
    content: 'תוכן דומה',
    hash: 'Hash זהה',
  };
  
  return (
    <Card className={cn('p-3', group.similarity >= 95 && 'border-red-200')}>
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={group.similarity >= 95 ? 'destructive' : 'secondary'}>
              {group.similarity}% דמיון
            </Badge>
            <Badge variant="outline">{typeLabels[group.type]}</Badge>
          </div>
          
          <div className="space-y-2">
            {group.items.slice(0, isExpanded ? undefined : 2).map((psak, i) => (
              <div
                key={psak.id}
                className={cn(
                  'flex items-center gap-2 p-2 rounded border',
                  psak.id === group.originalId ? 'bg-green-50 border-green-200' : 'bg-white',
                  selectedIds.has(psak.id) && 'bg-red-50 border-red-200'
                )}
              >
                <Checkbox
                  checked={selectedIds.has(psak.id)}
                  onCheckedChange={() => toggleSelection(psak.id)}
                  disabled={psak.id === group.originalId}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{psak.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {psak.court} | {psak.year}
                    {psak.id === group.originalId && (
                      <Badge variant="outline" className="mr-2 text-green-600">
                        מקורי
                      </Badge>
                    )}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onPreview(psak)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          
          {group.items.length > 2 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-2 gap-1"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {isExpanded ? 'הסתר' : `עוד ${group.items.length - 2}`}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

// Issue Card
interface IssueCardProps {
  item: QualityIssue;
  isSelected: boolean;
  toggleSelection: (id: string) => void;
  onPreview: () => void;
  getSeverityIcon: (s: 'error' | 'warning' | 'info') => React.ReactNode;
  getScoreColor: (score: number) => string;
}

const IssueCard: React.FC<IssueCardProps> = ({
  item,
  isSelected,
  toggleSelection,
  onPreview,
  getSeverityIcon,
  getScoreColor,
}) => {
  return (
    <div
      className={cn(
        'p-3 rounded-lg border transition-colors cursor-pointer',
        isSelected ? 'bg-red-50 border-red-300' : 'bg-white hover:bg-gray-50'
      )}
      onClick={() => toggleSelection(item.id)}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => toggleSelection(item.id)}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium truncate">{item.psak.title}</span>
            <div className="flex items-center gap-2">
              <span className={cn('text-sm font-bold', getScoreColor(item.score))}>
                {item.score}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onPreview();
                }}
              >
                <Eye className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {item.issues.map((issue, i) => (
              <TooltipProvider key={i}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className={cn(
                        'gap-1 text-xs',
                        issue.severity === 'error' && 'border-red-300 text-red-700',
                        issue.severity === 'warning' && 'border-yellow-300 text-yellow-700',
                        issue.severity === 'info' && 'border-blue-300 text-blue-700'
                      )}
                    >
                      {getSeverityIcon(issue.severity)}
                      {issue.message}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{issue.details}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Psak Preview Dialog
interface PsakPreviewDialogProps {
  psak: PsakDin | null;
  onClose: () => void;
}

const PsakPreviewDialog: React.FC<PsakPreviewDialogProps> = ({ psak, onClose }) => {
  if (!psak) return null;
  
  return (
    <Dialog open={!!psak} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-right">{psak.title}</DialogTitle>
          <div className="flex gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{psak.court}</Badge>
            <span>{psak.year}</span>
            {psak.case_number && <span>| תיק: {psak.case_number}</span>}
          </div>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] mt-4">
          <div className="space-y-4 p-4 text-right" dir="rtl">
            {psak.summary && (
              <div>
                <h4 className="font-semibold mb-2">תקציר</h4>
                <p className="text-sm whitespace-pre-wrap">{psak.summary}</p>
              </div>
            )}
            {psak.full_text && (
              <div>
                <h4 className="font-semibold mb-2">טקסט מלא</h4>
                <p className="text-sm whitespace-pre-wrap">{psak.full_text}</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

// Helper function
const getIssueTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    short: 'תוכן קצר',
    empty: 'תוכן ריק',
    missing_metadata: 'מטא-דאטה חסר',
    ocr_error: 'בעיית OCR',
    low_hebrew: 'מעט עברית',
    repetitive: 'תוכן חוזר',
    suspicious_chars: 'תווים חשודים',
  };
  return labels[type] || type;
};

export default DataQualityChecker;
