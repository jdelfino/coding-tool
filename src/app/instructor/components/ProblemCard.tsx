'use client';

/**
 * Problem Card Component
 * 
 * Displays an individual problem with metadata and action buttons.
 */

import React, { useState } from 'react';

interface Problem {
  id: string;
  title: string;
  description?: string;
  testCases?: any[];
  createdAt: string;
  updatedAt: string;
  authorId: string;
}

interface ProblemCardProps {
  problem: Problem;
  viewMode: 'list' | 'grid';
  onView: (problemId: string) => void;
  onEdit: (problemId: string) => void;
  onDelete: (problemId: string, title: string) => void;
  onCreateSession: (problemId: string) => void;
}

export default function ProblemCard({
  problem,
  viewMode,
  onView,
  onEdit,
  onDelete,
  onCreateSession,
}: ProblemCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Delete "${problem.title}"? This action cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete(problem.id, problem.title);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const testCaseCount = problem.testCases?.length || 0;
  const hasDescription = !!problem.description?.trim();

  if (viewMode === 'list') {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 truncate mb-2">
              {problem.title}
            </h3>

            {hasDescription && (
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                {problem.description}
              </p>
            )}

            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                {testCaseCount} test{testCaseCount !== 1 ? 's' : ''}
              </span>
              <span>Created {formatDate(problem.createdAt)}</span>
              {problem.updatedAt !== problem.createdAt && (
                <span>Updated {formatDate(problem.updatedAt)}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onView(problem.id)}
              className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="View problem"
            >
              View
            </button>
            <button
              onClick={() => onEdit(problem.id)}
              className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Edit problem"
            >
              Edit
            </button>
            <button
              onClick={() => onCreateSession(problem.id)}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
              title="Create session"
            >
              Create Session
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
              title="Delete problem"
            >
              {isDeleting ? '...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow flex flex-col">
      <h3 className="text-lg font-semibold text-gray-900 truncate mb-3">
        {problem.title}
      </h3>

      {hasDescription && (
        <p className="text-sm text-gray-600 mb-3 line-clamp-3 flex-1">
          {problem.description}
        </p>
      )}

      <div className="flex items-center gap-3 text-xs text-gray-500 mb-4">
        <span className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          {testCaseCount}
        </span>
        <span>{formatDate(problem.createdAt)}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onView(problem.id)}
          className="px-3 py-2 text-sm text-blue-600 border border-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          View
        </button>
        <button
          onClick={() => onEdit(problem.id)}
          className="px-3 py-2 text-sm text-gray-700 border border-gray-300 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Edit
        </button>
        <button
          onClick={() => onCreateSession(problem.id)}
          className="col-span-2 px-3 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
        >
          Create Session
        </button>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="col-span-2 px-3 py-2 text-sm text-red-600 border border-red-300 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  );
}
