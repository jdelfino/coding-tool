import { renderHook, act } from '@testing-library/react';
import useAnalysisGroups from '../useAnalysisGroups';
import { WalkthroughScript, WalkthroughEntry } from '@/server/types/analysis';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

function makeEntry(overrides: Partial<WalkthroughEntry> & { studentId: string; category: WalkthroughEntry['category'] }): WalkthroughEntry {
  return {
    position: 1,
    studentLabel: 'Student A',
    discussionPoints: ['point 1'],
    pedagogicalNote: 'note',
    ...overrides,
  };
}

function makeScript(entries: WalkthroughEntry[]): WalkthroughScript {
  return {
    sessionId: 'session-1',
    entries,
    summary: {
      totalSubmissions: entries.length,
      filteredOut: 0,
      analyzedSubmissions: entries.length,
      commonPatterns: [],
    },
    generatedAt: new Date(),
  };
}

function mockSuccessResponse(script: WalkthroughScript) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ script }),
  });
}

function mockErrorResponse(error: string) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    json: async () => ({ error }),
  });
}

const sampleEntries: WalkthroughEntry[] = [
  makeEntry({ studentId: 's1', category: 'common-error', position: 1, studentLabel: 'Student A' }),
  makeEntry({ studentId: 's2', category: 'edge-case', position: 2, studentLabel: 'Student B' }),
  makeEntry({ studentId: 's3', category: 'interesting-approach', position: 3, studentLabel: 'Student C' }),
  makeEntry({ studentId: 's4', category: 'exemplary', position: 4, studentLabel: 'Student D' }),
  makeEntry({ studentId: 's5', category: 'common-error', position: 5, studentLabel: 'Student E' }),
];

beforeEach(() => {
  mockFetch.mockReset();
});

describe('useAnalysisGroups', () => {
  it('starts in idle state with empty groups', () => {
    const { result } = renderHook(() => useAnalysisGroups());

    expect(result.current.analysisState).toBe('idle');
    expect(result.current.error).toBeNull();
    expect(result.current.script).toBeNull();
    expect(result.current.groups).toEqual([]);
    expect(result.current.activeGroup).toBeNull();
    expect(result.current.activeGroupIndex).toBe(0);
  });

  it('analyze() transitions idle → loading → ready and populates groups', async () => {
    const script = makeScript(sampleEntries);
    mockSuccessResponse(script);

    const { result } = renderHook(() => useAnalysisGroups());

    let analyzePromise: Promise<void>;
    act(() => {
      analyzePromise = result.current.analyze('session-1');
    });

    // Should be loading
    expect(result.current.analysisState).toBe('loading');

    await act(async () => {
      await analyzePromise;
    });

    expect(result.current.analysisState).toBe('ready');
    expect(result.current.script).toEqual(script);
    expect(result.current.groups.length).toBeGreaterThan(0);
    expect(mockFetch).toHaveBeenCalledWith('/api/sessions/session-1/analyze', { method: 'POST' });
  });

  it('groups are ordered: "All Submissions" first, then by category order', async () => {
    const script = makeScript(sampleEntries);
    mockSuccessResponse(script);

    const { result } = renderHook(() => useAnalysisGroups());

    await act(async () => {
      await result.current.analyze('session-1');
    });

    const groupIds = result.current.groups.map(g => g.id);
    expect(groupIds).toEqual([
      'all',
      'common-error',
      'edge-case',
      'interesting-approach',
      'exemplary',
    ]);

    expect(result.current.groups[0].label).toBe('All Submissions');
  });

  it('navigateGroup next/prev updates activeGroupIndex with bounds clamping', async () => {
    const script = makeScript(sampleEntries);
    mockSuccessResponse(script);

    const { result } = renderHook(() => useAnalysisGroups());

    await act(async () => {
      await result.current.analyze('session-1');
    });

    // Start at 0
    expect(result.current.activeGroupIndex).toBe(0);

    // Navigate next
    act(() => { result.current.navigateGroup('next'); });
    expect(result.current.activeGroupIndex).toBe(1);

    act(() => { result.current.navigateGroup('next'); });
    expect(result.current.activeGroupIndex).toBe(2);

    // Navigate prev
    act(() => { result.current.navigateGroup('prev'); });
    expect(result.current.activeGroupIndex).toBe(1);

    // Clamp at 0
    act(() => { result.current.navigateGroup('prev'); });
    expect(result.current.activeGroupIndex).toBe(0);
    act(() => { result.current.navigateGroup('prev'); });
    expect(result.current.activeGroupIndex).toBe(0);

    // Clamp at end
    const lastIndex = result.current.groups.length - 1;
    act(() => { result.current.setActiveGroupIndex(lastIndex); });
    act(() => { result.current.navigateGroup('next'); });
    expect(result.current.activeGroupIndex).toBe(lastIndex);
  });

  it('dismissGroup removes group, clamps activeGroupIndex, cannot dismiss "all"', async () => {
    const script = makeScript(sampleEntries);
    mockSuccessResponse(script);

    const { result } = renderHook(() => useAnalysisGroups());

    await act(async () => {
      await result.current.analyze('session-1');
    });

    const initialGroupCount = result.current.groups.length;

    // Cannot dismiss 'all'
    act(() => { result.current.dismissGroup('all'); });
    expect(result.current.groups.length).toBe(initialGroupCount);

    // Navigate to last group
    const lastIdx = result.current.groups.length - 1;
    act(() => { result.current.setActiveGroupIndex(lastIdx); });
    expect(result.current.activeGroupIndex).toBe(lastIdx);

    // Dismiss last group - should clamp index
    const lastGroupId = result.current.groups[lastIdx].id;
    act(() => { result.current.dismissGroup(lastGroupId); });
    expect(result.current.groups.length).toBe(initialGroupCount - 1);
    expect(result.current.activeGroupIndex).toBe(result.current.groups.length - 1);

    // Dismiss a middle group
    act(() => { result.current.setActiveGroupIndex(1); });
    const middleGroupId = result.current.groups[1].id;
    act(() => { result.current.dismissGroup(middleGroupId); });
    expect(result.current.groups.find(g => g.id === middleGroupId)).toBeUndefined();
  });

  it('re-analyze resets dismissals and index', async () => {
    const script = makeScript(sampleEntries);
    mockSuccessResponse(script);

    const { result } = renderHook(() => useAnalysisGroups());

    await act(async () => {
      await result.current.analyze('session-1');
    });

    // Dismiss a group and navigate
    act(() => { result.current.dismissGroup('common-error'); });
    act(() => { result.current.setActiveGroupIndex(2); });

    const dismissedCount = result.current.groups.length;

    // Re-analyze
    mockSuccessResponse(script);
    await act(async () => {
      await result.current.analyze('session-1');
    });

    expect(result.current.activeGroupIndex).toBe(0);
    expect(result.current.groups.length).toBe(dismissedCount + 1); // restored dismissed group
  });

  it('recommendedStudentId is first entry studentId per group', async () => {
    const script = makeScript(sampleEntries);
    mockSuccessResponse(script);

    const { result } = renderHook(() => useAnalysisGroups());

    await act(async () => {
      await result.current.analyze('session-1');
    });

    const allGroup = result.current.groups.find(g => g.id === 'all')!;
    expect(allGroup.recommendedStudentId).toBeNull();
    expect(allGroup.entries).toEqual([]);
    expect(allGroup.studentIds).toEqual([]);

    const errorGroup = result.current.groups.find(g => g.id === 'common-error')!;
    expect(errorGroup.recommendedStudentId).toBe('s1');
    expect(errorGroup.entries).toHaveLength(2);
    expect(errorGroup.studentIds).toEqual(['s1', 's5']);

    const edgeGroup = result.current.groups.find(g => g.id === 'edge-case')!;
    expect(edgeGroup.recommendedStudentId).toBe('s2');
  });

  it('error state on fetch failure', async () => {
    mockErrorResponse('Server error');

    const { result } = renderHook(() => useAnalysisGroups());

    await act(async () => {
      await result.current.analyze('session-1');
    });

    expect(result.current.analysisState).toBe('error');
    expect(result.current.error).toBe('Server error');
    expect(result.current.groups).toEqual([]);
  });

  it('activeGroup reflects current activeGroupIndex', async () => {
    const script = makeScript(sampleEntries);
    mockSuccessResponse(script);

    const { result } = renderHook(() => useAnalysisGroups());

    await act(async () => {
      await result.current.analyze('session-1');
    });

    expect(result.current.activeGroup).toBe(result.current.groups[0]);

    act(() => { result.current.setActiveGroupIndex(2); });
    expect(result.current.activeGroup).toBe(result.current.groups[2]);
  });
});
