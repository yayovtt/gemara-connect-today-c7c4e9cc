/**
 * useBatchAnalysis - Hook לניתוח פסקי דין ב-batches קטנים
 * עם שמירת התקדמות והמשכיות אוטומטית
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const BATCH_SIZE = 5;
const DELAY_BETWEEN_ITEMS = 1000; // 1 second between each item
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds between batches
const STORAGE_KEY = 'batch_analysis_progress';

export interface AnalysisProgress {
  sessionId: string;
  psakIds: string[];
  currentIndex: number;
  successCount: number;
  failCount: number;
  startedAt: string;
  lastUpdated: string;
  isPaused: boolean;
  isCompleted: boolean;
}

export interface BatchAnalysisState {
  isRunning: boolean;
  isPaused: boolean;
  progress: AnalysisProgress | null;
  currentPsakTitle: string;
  error: string | null;
}

export function useBatchAnalysis() {
  const [state, setState] = useState<BatchAnalysisState>({
    isRunning: false,
    isPaused: false,
    progress: null,
    currentPsakTitle: '',
    error: null,
  });

  const abortRef = useRef(false);
  const pauseRef = useRef(false);

  // Load saved progress on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const progress = JSON.parse(saved) as AnalysisProgress;
        if (!progress.isCompleted && progress.currentIndex < progress.psakIds.length) {
          setState(prev => ({
            ...prev,
            progress,
            isPaused: progress.isPaused,
          }));
        }
      } catch (e) {
        console.error('Failed to load saved progress:', e);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  // Save progress to localStorage
  const saveProgress = useCallback((progress: AnalysisProgress) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    setState(prev => ({ ...prev, progress }));
  }, []);

  // Clear saved progress
  const clearProgress = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState(prev => ({ ...prev, progress: null }));
  }, []);

  // Get unlinked psak IDs
  const getUnlinkedPsakIds = useCallback(async (): Promise<string[]> => {
    // Get all linked psak IDs
    const linkedIds = new Set<string>();
    let offset = 0;
    const PAGE_SIZE = 1000;

    while (true) {
      const { data } = await supabase
        .from('sugya_psak_links')
        .select('psak_din_id')
        .range(offset, offset + PAGE_SIZE - 1);

      if (!data || data.length === 0) break;
      data.forEach(r => linkedIds.add(r.psak_din_id));
      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    // Get all psak IDs
    const allPsakIds: string[] = [];
    offset = 0;

    while (true) {
      const { data } = await supabase
        .from('psakei_din')
        .select('id')
        .range(offset, offset + PAGE_SIZE - 1);

      if (!data || data.length === 0) break;
      allPsakIds.push(...data.map(p => p.id));
      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    // Filter unlinked
    return allPsakIds.filter(id => !linkedIds.has(id));
  }, []);

  // Analyze a single psak
  const analyzeSinglePsak = useCallback(async (psakId: string): Promise<{ success: boolean; title: string }> => {
    try {
      // Get psak title for display
      const { data: psak } = await supabase
        .from('psakei_din')
        .select('title')
        .eq('id', psakId)
        .maybeSingle();

      const title = psak?.title || 'פסק דין';

      // Call AI analysis
      const { error } = await supabase.functions.invoke('analyze-psak-din', {
        body: { psakId },
      });

      if (error) {
        console.error(`Error analyzing ${psakId}:`, error);
        return { success: false, title };
      }

      return { success: true, title };
    } catch (err) {
      console.error(`Exception analyzing ${psakId}:`, err);
      return { success: false, title: 'שגיאה' };
    }
  }, []);

  // Main batch processing function
  const runBatchAnalysis = useCallback(async (psakIds?: string[]) => {
    // Get IDs to process
    let idsToProcess = psakIds;
    
    if (!idsToProcess) {
      // Resume from saved progress or get new unlinked IDs
      if (state.progress && !state.progress.isCompleted) {
        idsToProcess = state.progress.psakIds;
      } else {
        toast({ title: 'טוען פסקי דין לניתוח...' });
        idsToProcess = await getUnlinkedPsakIds();
      }
    }

    if (!idsToProcess || idsToProcess.length === 0) {
      toast({ title: 'אין פסקי דין לניתוח', description: 'כל הפסקים כבר מקושרים' });
      return;
    }

    // Initialize or resume progress
    const startIndex = state.progress?.currentIndex || 0;
    let progress: AnalysisProgress = state.progress || {
      sessionId: crypto.randomUUID(),
      psakIds: idsToProcess,
      currentIndex: startIndex,
      successCount: state.progress?.successCount || 0,
      failCount: state.progress?.failCount || 0,
      startedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      isPaused: false,
      isCompleted: false,
    };

    // Reset flags
    abortRef.current = false;
    pauseRef.current = false;

    setState(prev => ({
      ...prev,
      isRunning: true,
      isPaused: false,
      error: null,
      progress,
    }));

    toast({ 
      title: startIndex > 0 ? 'ממשיך ניתוח...' : 'מתחיל ניתוח', 
      description: `${idsToProcess.length - startIndex} פסקים לניתוח (5 בכל פעם)` 
    });

    try {
      for (let i = startIndex; i < idsToProcess.length; i++) {
        // Check for abort
        if (abortRef.current) {
          toast({ title: 'הניתוח הופסק', variant: 'destructive' });
          break;
        }

        // Check for pause
        while (pauseRef.current) {
          progress = { ...progress, isPaused: true, lastUpdated: new Date().toISOString() };
          saveProgress(progress);
          setState(prev => ({ ...prev, isPaused: true }));
          await sleep(500);
          
          if (abortRef.current) break;
        }
        
        if (abortRef.current) break;

        const psakId = idsToProcess[i];
        
        // Analyze single psak
        const { success, title } = await analyzeSinglePsak(psakId);
        
        // Update progress
        progress = {
          ...progress,
          currentIndex: i + 1,
          successCount: progress.successCount + (success ? 1 : 0),
          failCount: progress.failCount + (success ? 0 : 1),
          lastUpdated: new Date().toISOString(),
          isPaused: false,
        };

        setState(prev => ({
          ...prev,
          currentPsakTitle: title,
          progress,
          isPaused: false,
        }));

        // Save progress after each item
        saveProgress(progress);

        // Log progress every batch
        if ((i + 1) % BATCH_SIZE === 0) {
          console.log(`Batch complete: ${i + 1}/${idsToProcess.length} (${progress.successCount} success, ${progress.failCount} fail)`);
        }

        // Delay between items (longer delay between batches)
        if (i < idsToProcess.length - 1) {
          const isBatchEnd = (i + 1) % BATCH_SIZE === 0;
          await sleep(isBatchEnd ? DELAY_BETWEEN_BATCHES : DELAY_BETWEEN_ITEMS);
        }
      }

      // Mark as completed
      progress = { ...progress, isCompleted: true, lastUpdated: new Date().toISOString() };
      saveProgress(progress);

      toast({
        title: 'ניתוח הושלם!',
        description: `נותחו ${progress.successCount} פסקים בהצלחה, ${progress.failCount} נכשלו`,
      });

    } catch (err) {
      console.error('Batch analysis error:', err);
      setState(prev => ({ ...prev, error: String(err) }));
      toast({
        title: 'שגיאה בניתוח',
        description: 'ההתקדמות נשמרה, תוכל להמשיך מאוחר יותר',
        variant: 'destructive',
      });
    } finally {
      setState(prev => ({ ...prev, isRunning: false, isPaused: false }));
    }
  }, [state.progress, getUnlinkedPsakIds, analyzeSinglePsak, saveProgress]);

  // Start new analysis
  const startAnalysis = useCallback(async () => {
    clearProgress();
    setState(prev => ({ ...prev, progress: null }));
    await runBatchAnalysis();
  }, [clearProgress, runBatchAnalysis]);

  // Resume existing analysis
  const resumeAnalysis = useCallback(async () => {
    if (!state.progress) {
      toast({ title: 'אין ניתוח להמשיך', variant: 'destructive' });
      return;
    }
    pauseRef.current = false;
    await runBatchAnalysis(state.progress.psakIds);
  }, [state.progress, runBatchAnalysis]);

  // Pause analysis
  const pauseAnalysis = useCallback(() => {
    pauseRef.current = true;
    toast({ title: 'משהה ניתוח...' });
  }, []);

  // Cancel analysis
  const cancelAnalysis = useCallback(() => {
    abortRef.current = true;
    pauseRef.current = false;
    toast({ title: 'מבטל ניתוח...', variant: 'destructive' });
  }, []);

  // Clear and reset
  const resetAnalysis = useCallback(() => {
    abortRef.current = true;
    pauseRef.current = false;
    clearProgress();
    setState({
      isRunning: false,
      isPaused: false,
      progress: null,
      currentPsakTitle: '',
      error: null,
    });
    toast({ title: 'ההתקדמות נמחקה' });
  }, [clearProgress]);

  // Analyze specific IDs
  const analyzeSpecificIds = useCallback(async (ids: string[]) => {
    clearProgress();
    await runBatchAnalysis(ids);
  }, [clearProgress, runBatchAnalysis]);

  return {
    ...state,
    startAnalysis,
    resumeAnalysis,
    pauseAnalysis,
    cancelAnalysis,
    resetAnalysis,
    analyzeSpecificIds,
    hasSavedProgress: !!state.progress && !state.progress.isCompleted,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default useBatchAnalysis;
