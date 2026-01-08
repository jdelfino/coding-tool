'use client';

import React, { useState, useCallback } from 'react';
import { WalkthroughScript } from '@/server/types/analysis';
import WalkthroughEntry from './WalkthroughEntry';

interface WalkthroughPanelProps {
  sessionId: string;
  onFeatureStudent: (studentId: string) => Promise<void>;
  studentCount: number;
}

type PanelState = 'idle' | 'loading' | 'ready' | 'error';

export default function WalkthroughPanel({
  sessionId,
  onFeatureStudent,
  studentCount,
}: WalkthroughPanelProps) {
  const [state, setState] = useState<PanelState>('idle');
  const [script, setScript] = useState<WalkthroughScript | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);

  const handleAnalyze = useCallback(async () => {
    setState('loading');
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
      setCurrentIndex(0);
      setState('ready');

      // Auto-show first entry if there are any
      if (data.script.entries.length > 0) {
        await onFeatureStudent(data.script.entries[0].studentId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setState('error');
    }
  }, [sessionId, onFeatureStudent]);

  const handleEntryClick = useCallback(
    async (index: number) => {
      if (!script || isNavigating) return;

      setIsNavigating(true);
      try {
        setCurrentIndex(index);
        await onFeatureStudent(script.entries[index].studentId);
      } finally {
        setIsNavigating(false);
      }
    },
    [script, onFeatureStudent, isNavigating]
  );

  const handlePrevious = useCallback(async () => {
    if (!script || currentIndex === 0 || isNavigating) return;
    await handleEntryClick(currentIndex - 1);
  }, [script, currentIndex, isNavigating, handleEntryClick]);

  const handleNext = useCallback(async () => {
    if (!script || currentIndex >= script.entries.length - 1 || isNavigating) return;
    await handleEntryClick(currentIndex + 1);
  }, [script, currentIndex, isNavigating, handleEntryClick]);

  // Idle state - show analyze button
  if (state === 'idle') {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <h3 style={{ margin: '0 0 1rem 0', color: '#374151' }}>AI Code Analysis</h3>
        <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
          Analyze student submissions to generate a discussion walkthrough.
        </p>
        <button
          onClick={handleAnalyze}
          disabled={studentCount === 0}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: studentCount === 0 ? '#d1d5db' : '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: studentCount === 0 ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            fontWeight: 500,
          }}
        >
          Analyze {studentCount} Submission{studentCount !== 1 ? 's' : ''}
        </button>
        {studentCount === 0 && (
          <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginTop: '1rem' }}>
            No students have submitted code yet.
          </p>
        )}
      </div>
    );
  }

  // Loading state
  if (state === 'loading') {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <div
          style={{
            display: 'inline-block',
            width: '40px',
            height: '40px',
            border: '3px solid #e5e7eb',
            borderTopColor: '#0070f3',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ color: '#6b7280', marginTop: '1rem' }}>Analyzing student code...</p>
        <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>This may take a few seconds.</p>
      </div>
    );
  }

  // Error state
  if (state === 'error') {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '48px',
            height: '48px',
            backgroundColor: '#fef2f2',
            borderRadius: '50%',
            marginBottom: '1rem',
          }}
        >
          <span style={{ fontSize: '1.5rem' }}>!</span>
        </div>
        <h3 style={{ margin: '0 0 0.5rem 0', color: '#991b1b' }}>Analysis Failed</h3>
        <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>{error}</p>
        <button
          onClick={handleAnalyze}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  // Ready state - show walkthrough
  if (!script) return null;

  const hasEntries = script.entries.length > 0;

  return (
    <div>
      {/* Summary header */}
      <div
        style={{
          padding: '1rem',
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          marginBottom: '1rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontWeight: 500, color: '#374151' }}>
              {script.summary.analyzedSubmissions} of {script.summary.totalSubmissions} analyzed
            </span>
            {script.summary.filteredOut > 0 && (
              <span style={{ color: '#9ca3af', fontSize: '0.875rem', marginLeft: '0.5rem' }}>
                ({script.summary.filteredOut} filtered)
              </span>
            )}
          </div>
          <button
            onClick={handleAnalyze}
            style={{
              padding: '0.375rem 0.75rem',
              backgroundColor: 'white',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Re-analyze
          </button>
        </div>

        {/* Warning message */}
        {script.summary.warning && (
          <p
            style={{
              margin: '0.75rem 0 0 0',
              padding: '0.5rem 0.75rem',
              backgroundColor: '#fef9c3',
              color: '#854d0e',
              borderRadius: '4px',
              fontSize: '0.875rem',
            }}
          >
            {script.summary.warning}
          </p>
        )}

        {/* Common patterns */}
        {script.summary.commonPatterns.length > 0 && (
          <div style={{ marginTop: '0.75rem' }}>
            <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 }}>
              Common patterns:
            </p>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#4b5563' }}>
              {script.summary.commonPatterns.map((pattern, i) => (
                <li key={i}>{pattern}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Navigation controls */}
      {hasEntries && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.75rem',
            backgroundColor: '#f3f4f6',
            borderRadius: '8px',
            marginBottom: '1rem',
          }}
        >
          <button
            onClick={handlePrevious}
            disabled={currentIndex === 0 || isNavigating}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: currentIndex === 0 ? '#e5e7eb' : 'white',
              color: currentIndex === 0 ? '#9ca3af' : '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            Prev
          </button>
          <span style={{ color: '#374151', fontWeight: 500 }}>
            {currentIndex + 1} of {script.entries.length}
          </span>
          <button
            onClick={handleNext}
            disabled={currentIndex >= script.entries.length - 1 || isNavigating}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: currentIndex >= script.entries.length - 1 ? '#e5e7eb' : 'white',
              color: currentIndex >= script.entries.length - 1 ? '#9ca3af' : '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: currentIndex >= script.entries.length - 1 ? 'not-allowed' : 'pointer',
            }}
          >
            Next
          </button>
        </div>
      )}

      {/* Entry list */}
      {hasEntries ? (
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {script.entries.map((entry, index) => (
            <WalkthroughEntry
              key={entry.studentId}
              entry={entry}
              isActive={index === currentIndex}
              onClick={() => handleEntryClick(index)}
            />
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
          <p>No submissions worth discussing were found.</p>
          <p style={{ fontSize: '0.875rem' }}>
            Try again after students have made more progress.
          </p>
        </div>
      )}
    </div>
  );
}
