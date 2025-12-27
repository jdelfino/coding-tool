'use client';

/**
 * Problem Loader Component
 * 
 * Allows instructors to:
 * - Browse available problems
 * - Preview problem details
 * - Load a problem into an active session
 */

import { useState, useEffect } from 'react';
import type { ProblemMetadata, Problem } from '@/server/types/problem';

interface ProblemLoaderProps {
  sessionId: string;
  onProblemLoaded?: (problemId: string) => void;
  onClose?: () => void;
}

export default function ProblemLoader({
  sessionId,
  onProblemLoaded,
  onClose,
}: ProblemLoaderProps) {
  const [problems, setProblems] = useState<ProblemMetadata[]>([]);
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingProblem, setIsLoadingProblem] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProblems();
  }, []);

  const loadProblems = async () => {
    try {
      const response = await fetch('/api/problems?sortBy=created&sortOrder=desc');
      if (!response.ok) {
        throw new Error('Failed to load problems');
      }
      const data = await response.json();
      setProblems(data.problems);
    } catch (err: any) {
      setError(err.message || 'Failed to load problems');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectProblem = async (problemId: string) => {
    setIsLoadingProblem(true);
    setError(null);

    try {
      const response = await fetch(`/api/problems/${problemId}`);
      if (!response.ok) {
        throw new Error('Failed to load problem details');
      }
      const data = await response.json();
      setSelectedProblem(data.problem);
    } catch (err: any) {
      setError(err.message || 'Failed to load problem');
    } finally {
      setIsLoadingProblem(false);
    }
  };

  const handleLoadProblem = async () => {
    if (!selectedProblem) return;

    setIsLoadingProblem(true);
    setError(null);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/load-problem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          problemId: selectedProblem.id,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load problem');
      }

      const data = await response.json();
      
      // Notify parent component of success
      onProblemLoaded?.(selectedProblem.id);
      onClose?.();
    } catch (err: any) {
      setError(err.message || 'Failed to load problem into session');
    } finally {
      setIsLoadingProblem(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold">Load Problem into Session</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Problem List */}
          <div className="w-1/3 border-r overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-gray-500">Loading problems...</div>
            ) : problems.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No problems available. Create one first!
              </div>
            ) : (
              <div className="divide-y">
                {problems.map((problem) => (
                  <button
                    key={problem.id}
                    onClick={() => handleSelectProblem(problem.id)}
                    className={`w-full p-4 text-left hover:bg-gray-50 ${
                      selectedProblem?.id === problem.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                    }`}
                  >
                    <h3 className="font-medium text-gray-900">{problem.title}</h3>
                    <div className="mt-1 text-xs text-gray-500">
                      {problem.testCaseCount} test cases
                      {problem.classId && ' • Class'}
                    </div>
                    <div className="mt-1 text-xs text-gray-400">
                      by {problem.authorName}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Problem Preview */}
          <div className="flex-1 overflow-y-auto p-6">
            {isLoadingProblem ? (
              <div className="text-center text-gray-500">Loading...</div>
            ) : selectedProblem ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-2xl font-bold mb-2">{selectedProblem.title}</h3>
                  <div className="text-sm text-gray-500">
                    Created {new Date(selectedProblem.createdAt).toLocaleDateString()}
                  </div>
                </div>

                {selectedProblem.description && (
                  <div>
                    <h4 className="font-semibold mb-2">Description</h4>
                    <div className="text-gray-700 whitespace-pre-wrap">
                      {selectedProblem.description}
                    </div>
                  </div>
                )}

                {selectedProblem.starterCode && (
                  <div>
                    <h4 className="font-semibold mb-2">Starter Code</h4>
                    <pre className="bg-gray-50 p-3 rounded border text-sm overflow-x-auto">
                      <code>{selectedProblem.starterCode}</code>
                    </pre>
                  </div>
                )}

                <div>
                  <h4 className="font-semibold mb-2">Test Cases</h4>
                  <div className="text-sm text-gray-600">
                    {selectedProblem.testCases?.length || 0} test case(s)
                  </div>
                </div>

                {selectedProblem.classId && (
                  <div className="flex items-center space-x-2 text-sm">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                      Class Problem
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-500">
                Select a problem to preview
              </div>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-100 border-t border-red-400 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleLoadProblem}
            disabled={!selectedProblem || isLoadingProblem}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoadingProblem ? 'Loading...' : 'Load Problem'}
          </button>
        </div>
      </div>
    </div>
  );
}
