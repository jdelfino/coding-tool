'use client';

/**
 * Problem Creator Component
 *
 * Allows instructors to create or edit programming problems with:
 * - Title and description
 * - Starter code template (with Monaco editor and run capability)
 * - Test cases (added separately via test case UI)
 * - Visibility settings (public/class-specific)
 */

import React, { useState, useEffect } from 'react';
import type { ProblemInput } from '@/server/types/problem';
import CodeEditor from '@/app/student/components/CodeEditor';
import { useDebugger } from '@/hooks/useDebugger';
import { useWebSocket } from '@/hooks/useWebSocket';

interface ProblemCreatorProps {
  problemId?: string | null;
  onProblemCreated?: (problemId: string) => void;
  onCancel?: () => void;
  classId?: string | null;
}

export default function ProblemCreator({
  problemId = null,
  onProblemCreated,
  onCancel,
  classId = null,
}: ProblemCreatorProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [starterCode, setStarterCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Execution settings
  const [stdin, setStdin] = useState('');
  const [randomSeed, setRandomSeed] = useState<number | undefined>(undefined);
  const [attachedFiles, setAttachedFiles] = useState<Array<{ name: string; content: string }>>([]);

  const isEditMode = !!problemId;

  // Load problem data when editing
  useEffect(() => {
    if (problemId) {
      loadProblem(problemId);
    }
  }, [problemId]);

  const loadProblem = async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/problems/${id}`);
      if (!response.ok) {
        throw new Error('Failed to load problem');
      }
      const { problem } = await response.json();
      setTitle(problem.title || '');
      setDescription(problem.description || '');
      setStarterCode(problem.starterCode || '');

      // Load execution settings
      const execSettings = problem.executionSettings;
      setStdin(execSettings?.stdin || '');
      setRandomSeed(execSettings?.randomSeed);
      setAttachedFiles(execSettings?.attachedFiles || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load problem');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setIsSubmitting(true);

    try {
      const problemInput: Partial<ProblemInput> = {
        title: title.trim(),
        description: description.trim(),
        starterCode: starterCode.trim(),
        testCases: [], // Test cases added separately
        classId: classId || undefined,
      };

      // Only include executionSettings if at least one field is set
      const execSettings: any = {};
      if (stdin.trim()) execSettings.stdin = stdin.trim();
      if (randomSeed !== undefined) execSettings.randomSeed = randomSeed;
      if (attachedFiles.length > 0) execSettings.attachedFiles = attachedFiles;

      if (Object.keys(execSettings).length > 0) {
        problemInput.executionSettings = execSettings;
      }

      let response;
      if (isEditMode) {
        // Update existing problem
        response = await fetch(`/api/problems/${problemId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(problemInput),
        });
      } else {
        // Create new problem
        response = await fetch('/api/problems', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(problemInput),
        });
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Failed to ${isEditMode ? 'update' : 'create'} problem`);
      }

      const { problem } = await response.json();

      if (!isEditMode) {
        // Reset form only when creating
        setTitle('');
        setDescription('');
        setStarterCode('');
        setStdin('');
        setRandomSeed(undefined);
        setAttachedFiles([]);
      }

      // Notify parent
      onProblemCreated?.(problem.id);
    } catch (err: any) {
      setError(err.message || `Failed to ${isEditMode ? 'update' : 'create'} problem`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Setup debugger
  const [wsUrl, setWsUrl] = useState('');
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      setWsUrl(`${protocol}//${host}/ws`);
    }
  }, []);
  const { sendMessage } = useWebSocket(wsUrl);
  const debuggerHook = useDebugger(sendMessage);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Compact header bar matching student view style */}
      <div style={{ 
        flexShrink: 0, 
        padding: '0.75rem 1rem', 
        backgroundColor: '#f8f9fa',
        borderBottom: '1px solid #dee2e6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: '3rem'
      }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#212529' }}>
          {isEditMode ? 'Edit Problem' : 'Create New Problem'}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: '#6c757d',
                backgroundColor: '#e9ecef',
                border: 'none',
                borderRadius: '0.25rem',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.5 : 1
              }}
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || isLoading || !title.trim()}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'white',
              backgroundColor: '#0d6efd',
              border: 'none',
              borderRadius: '0.25rem',
              cursor: (isSubmitting || isLoading || !title.trim()) ? 'not-allowed' : 'pointer',
              opacity: (isSubmitting || isLoading || !title.trim()) ? 0.5 : 1
            }}
          >
            {isSubmitting ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Problem' : 'Create Problem')}
          </button>
        </div>
      </div>

      {isLoading && (
        <div style={{ padding: '0.75rem 1rem', backgroundColor: '#cfe2ff', borderBottom: '1px solid #9ec5fe', color: '#084298' }}>
          Loading problem...
        </div>
      )}

      {error && (
        <div style={{ padding: '0.75rem 1rem', backgroundColor: '#f8d7da', borderBottom: '1px solid #f5c2c7', color: '#842029' }}>
          {error}
        </div>
      )}

      {/* Full-width code editor */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <CodeEditor
          code={starterCode}
          onChange={setStarterCode}
          useApiExecution={true}
          title="Starter Code"
          exampleInput={stdin}
          onStdinChange={setStdin}
          randomSeed={randomSeed}
          onRandomSeedChange={setRandomSeed}
          attachedFiles={attachedFiles}
          onAttachedFilesChange={setAttachedFiles}
          problem={{ title, description, starterCode }}
          onLoadStarterCode={setStarterCode}
          debugger={debuggerHook}
          onProblemEdit={(updates) => {
            if (updates.title !== undefined) setTitle(updates.title);
            if (updates.description !== undefined) setDescription(updates.description);
          }}
          editableProblem={true}
        />
      </div>

    </div>
  );
}
