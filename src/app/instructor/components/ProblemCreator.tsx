'use client';

/**
 * Problem Creator Component
 * 
 * Allows instructors to create or edit programming problems with:
 * - Title and description
 * - Starter code template
 * - Solution code (optional, for reference)
 * - Test cases (added separately via test case UI)
 * - Visibility settings (public/class-specific)
 */

import React, { useState, useEffect } from 'react';
import type { ProblemInput } from '@/server/types/problem';

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
  const [solutionCode, setSolutionCode] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Execution settings
  const [stdin, setStdin] = useState('');
  const [randomSeed, setRandomSeed] = useState<string>('');
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
      setSolutionCode(problem.solutionCode || '');
      setIsPublic(problem.isPublic || false);
      
      // Load execution settings
      const execSettings = problem.executionSettings;
      setStdin(execSettings?.stdin || '');
      setRandomSeed(execSettings?.randomSeed !== undefined ? String(execSettings.randomSeed) : '');
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
        solutionCode: solutionCode.trim(),
        testCases: [], // Test cases added separately
        isPublic,
        classId: classId || undefined,
      };
      
      // Only include executionSettings if at least one field is set
      const execSettings: any = {};
      if (stdin.trim()) execSettings.stdin = stdin.trim();
      if (randomSeed.trim()) execSettings.randomSeed = parseInt(randomSeed.trim(), 10);
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
        setSolutionCode('');
        setIsPublic(false);
        setStdin('');
        setRandomSeed('');
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

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">{isEditMode ? 'Edit Problem' : 'Create New Problem'}</h2>

      {isLoading && (
        <div className="mb-4 p-3 bg-blue-100 border border-blue-400 text-blue-700 rounded">
          Loading problem...
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
            Title *
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Two Sum Problem"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the problem, requirements, and any constraints..."
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">
            Supports Markdown formatting
          </p>
        </div>

        {/* Starter Code */}
        <div>
          <label htmlFor="starterCode" className="block text-sm font-medium text-gray-700 mb-2">
            Starter Code
          </label>
          <textarea
            id="starterCode"
            value={starterCode}
            onChange={(e) => setStarterCode(e.target.value)}
            placeholder="def solution(nums, target):\n    # Your code here\n    pass"
            rows={8}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">
            Template code shown to students
          </p>
        </div>

        {/* Solution Code */}
        <div>
          <label htmlFor="solutionCode" className="block text-sm font-medium text-gray-700 mb-2">
            Solution Code (Optional)
          </label>
          <textarea
            id="solutionCode"
            value={solutionCode}
            onChange={(e) => setSolutionCode(e.target.value)}
            placeholder="def solution(nums, target):\n    seen = {}\n    for i, num in enumerate(nums):\n        complement = target - num\n        if complement in seen:\n            return [seen[complement], i]\n        seen[num] = i\n    return []"
            rows={8}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">
            Reference solution (not shown to students)
          </p>
        </div>

        {/* Execution Settings Section */}
        <div className="pt-4 border-t">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Execution Settings (Optional)</h3>
          <p className="text-sm text-gray-600 mb-4">
            Configure default execution settings for this problem. These can be overridden at the session or student level.
          </p>

          {/* Standard Input (stdin) */}
          <div className="mb-4">
            <label htmlFor="stdin" className="block text-sm font-medium text-gray-700 mb-2">
              Standard Input (stdin)
            </label>
            <textarea
              id="stdin"
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              placeholder="Input data for the program (if needed)..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              Input data that will be provided to the program via stdin
            </p>
          </div>

          {/* Random Seed */}
          <div className="mb-4">
            <label htmlFor="randomSeed" className="block text-sm font-medium text-gray-700 mb-2">
              Random Seed
            </label>
            <input
              id="randomSeed"
              type="number"
              value={randomSeed}
              onChange={(e) => setRandomSeed(e.target.value)}
              placeholder="e.g., 42"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Seed for deterministic random number generation (for reproducible testing)
            </p>
          </div>

          {/* Attached Files */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Attached Files
            </label>
            
            {/* File list */}
            {attachedFiles.length > 0 && (
              <div className="mb-2 space-y-2">
                {attachedFiles.map((file, index) => (
                  <div key={index} className="flex items-start space-x-2 p-2 bg-gray-50 border border-gray-200 rounded">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{file.name}</div>
                      <div className="text-xs text-gray-500 font-mono truncate">{file.content.substring(0, 60)}...</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const newFiles = attachedFiles.filter((_, i) => i !== index);
                        setAttachedFiles(newFiles);
                      }}
                      className="flex-shrink-0 text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add file form */}
            <div className="space-y-2">
              <input
                id="newFileName"
                type="text"
                placeholder="File name (e.g., data.txt)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <textarea
                id="newFileContent"
                placeholder="File content..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  const nameInput = document.getElementById('newFileName') as HTMLInputElement;
                  const contentInput = document.getElementById('newFileContent') as HTMLTextAreaElement;
                  
                  if (nameInput.value.trim() && contentInput.value.trim()) {
                    setAttachedFiles([
                      ...attachedFiles,
                      { name: nameInput.value.trim(), content: contentInput.value }
                    ]);
                    nameInput.value = '';
                    contentInput.value = '';
                  } else {
                    setError('Please provide both file name and content');
                  }
                }}
                className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100"
              >
                + Add File
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Additional files that will be available to the program during execution
            </p>
          </div>
        </div>

        {/* Visibility */}
        <div>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">
              Make this problem public
            </span>
          </label>
          <p className="mt-1 ml-6 text-xs text-gray-500">
            {isPublic
              ? 'Visible to all instructors and students'
              : classId
              ? 'Only visible to your class'
              : 'Only visible to you'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting || isLoading || !title.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Problem' : 'Create Problem')}
          </button>
        </div>
      </form>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> {isEditMode 
            ? 'Test cases are managed separately and are not affected by this update.' 
            : 'After creating the problem, you can add test cases in the next step.'}
        </p>
      </div>
    </div>
  );
}
