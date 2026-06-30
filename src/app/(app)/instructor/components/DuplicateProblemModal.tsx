'use client';

/**
 * DuplicateProblemModal
 *
 * Opens when an instructor clicks "Duplicate" on a problem card.
 * Lets the instructor edit the copy title and optionally pick a target class.
 * POSTs to /api/problems/{id}/duplicate then calls onSuccess + onClose.
 */

import React, { useState } from 'react';

interface DuplicateProblemModalProps {
  problem: { id: string; title: string; classId: string };
  classes: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DuplicateProblemModal({
  problem,
  classes,
  onClose,
  onSuccess,
}: DuplicateProblemModalProps) {
  const [title, setTitle] = useState(`Copy of ${problem.title}`);
  const [targetClassId, setTargetClassId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      const body: { title: string; targetClassId?: string } = {
        title: title.trim(),
        ...(targetClassId ? { targetClassId } : {}),
      };

      const response = await fetch(`/api/problems/${problem.id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to duplicate problem');
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate problem');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Duplicate Problem</h2>
            <p className="text-sm text-gray-600 mt-1">
              Original: <span className="font-medium">{problem.title}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={loading}
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label htmlFor="duplicate-title" className="block text-sm font-medium text-gray-700 mb-2">
              Title
            </label>
            <input
              id="duplicate-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          {/* Target class */}
          <div>
            <label htmlFor="duplicate-target-class" className="block text-sm font-medium text-gray-700 mb-2">
              Target Class
            </label>
            <select
              id="duplicate-target-class"
              value={targetClassId}
              onChange={(e) => setTargetClassId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              <option value="">Same class (default)</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Duplicating...' : 'Duplicate'}
          </button>
        </div>
      </div>
    </div>
  );
}
