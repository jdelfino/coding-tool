'use client';

/**
 * Problem Card Component
 *
 * Displays an individual problem with metadata and action buttons.
 */

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface Problem {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    setShowDeleteConfirm(false);
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

  const hasDescription = !!problem.description?.trim();

  if (viewMode === 'list') {
    return (
      <Card variant="default" className="p-4">
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
              <span>Created {formatDate(problem.createdAt)}</span>
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
              onClick={handleDeleteClick}
              disabled={isDeleting}
              className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
              title="Delete problem"
            >
              {isDeleting ? '...' : 'Delete'}
            </button>
          </div>
        </div>
        <ConfirmDialog
          open={showDeleteConfirm}
          title="Delete Problem"
          message={`Delete "${problem.title}"? This action cannot be undone.`}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleConfirmDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      </Card>
    );
  }

  // Grid view
  return (
    <Card variant="default" className="p-4 flex flex-col">
      <h3 className="text-lg font-semibold text-gray-900 truncate mb-3">
        {problem.title}
      </h3>

      {hasDescription && (
        <p className="text-sm text-gray-600 mb-3 line-clamp-3 flex-1">
          {problem.description}
        </p>
      )}

      <div className="flex items-center gap-3 text-xs text-gray-500 mb-4">
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
          onClick={handleDeleteClick}
          disabled={isDeleting}
          className="col-span-2 px-3 py-2 text-sm text-red-600 border border-red-300 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Problem"
        message={`Delete "${problem.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </Card>
  );
}
