import { useState, useCallback, useMemo } from 'react';
import { WalkthroughScript, WalkthroughEntry, WalkthroughCategory } from '@/server/types/analysis';
import { categoryStyles } from '../constants/analysis';

export interface AnalysisGroup {
  id: string;
  label: string;
  entries: WalkthroughEntry[];
  studentIds: string[];
  recommendedStudentId: string | null;
}

/** Ordered list of categories for consistent group ordering */
const CATEGORY_ORDER: WalkthroughCategory[] = [
  'common-error',
  'edge-case',
  'interesting-approach',
  'exemplary',
];

export default function useAnalysisGroups() {
  const [analysisState, setAnalysisState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [script, setScript] = useState<WalkthroughScript | null>(null);
  const [dismissedCategories, setDismissedCategories] = useState<Set<string>>(new Set());
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);

  const groups = useMemo(() => {
    if (!script) return [];

    const allGroup: AnalysisGroup = {
      id: 'all',
      label: 'All Submissions',
      entries: [],
      studentIds: [],
      recommendedStudentId: null,
    };

    const categoryGroups: AnalysisGroup[] = [];

    for (const category of CATEGORY_ORDER) {
      const entries = script.entries.filter(e => e.category === category);
      if (entries.length === 0) continue;

      categoryGroups.push({
        id: category,
        label: categoryStyles[category].label,
        entries,
        studentIds: entries.map(e => e.studentId),
        recommendedStudentId: entries[0].studentId,
      });
    }

    return [allGroup, ...categoryGroups].filter(g => !dismissedCategories.has(g.id));
  }, [script, dismissedCategories]);

  const activeGroup = groups.length > 0 ? groups[activeGroupIndex] ?? null : null;

  const analyze = useCallback(async (sessionId: string) => {
    setAnalysisState('loading');
    setError(null);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/analyze`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze code');
      }

      setScript(data.script);
      setDismissedCategories(new Set());
      setActiveGroupIndex(0);
      setAnalysisState('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setAnalysisState('error');
    }
  }, []);

  const navigateGroup = useCallback((direction: 'prev' | 'next') => {
    setActiveGroupIndex(prev => {
      if (direction === 'next') {
        return Math.min(prev + 1, Math.max(groups.length - 1, 0));
      }
      return Math.max(prev - 1, 0);
    });
  }, [groups.length]);

  const dismissGroup = useCallback((groupId: string) => {
    if (groupId === 'all') return;

    setDismissedCategories(prev => {
      const next = new Set(prev);
      next.add(groupId);
      return next;
    });

    // Clamp activeGroupIndex after dismissal.
    // We need to compute new group count: current groups minus the dismissed one.
    setActiveGroupIndex(prev => {
      const newGroupCount = groups.filter(g => g.id !== groupId).length;
      if (prev >= newGroupCount) {
        return Math.max(newGroupCount - 1, 0);
      }
      return prev;
    });
  }, [groups]);

  return {
    analysisState,
    error,
    script,
    groups,
    activeGroup,
    activeGroupIndex,
    analyze,
    navigateGroup,
    setActiveGroupIndex,
    dismissGroup,
  };
}
