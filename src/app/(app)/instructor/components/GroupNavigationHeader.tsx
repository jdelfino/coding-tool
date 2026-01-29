'use client';

import React from 'react';
import { AnalysisGroup } from '../hooks/useAnalysisGroups';

interface GroupNavigationHeaderProps {
  groups: AnalysisGroup[];
  activeGroupIndex: number;
  onNavigate: (direction: 'prev' | 'next') => void;
  onDismiss: (groupId: string) => void;
  commonPatterns?: string[];
}

export default function GroupNavigationHeader({
  groups,
  activeGroupIndex,
  onNavigate,
  onDismiss,
  commonPatterns,
}: GroupNavigationHeaderProps) {
  const activeGroup = groups[activeGroupIndex];
  if (!activeGroup) return null;

  const isFirst = activeGroupIndex === 0;
  const isLast = activeGroupIndex === groups.length - 1;
  const isAll = activeGroup.id === 'all';
  const studentCount = activeGroup.studentIds.length;

  return (
    <div>
      <div className="flex items-center justify-center gap-2">
        <button
          aria-label="Previous group"
          disabled={isFirst}
          onClick={() => onNavigate('prev')}
          className="p-1 rounded text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex items-center gap-1.5 text-sm">
          <span className="font-medium text-gray-900">{activeGroup.label}</span>
          <span className="text-gray-500">({studentCount} {studentCount === 1 ? 'student' : 'students'})</span>
          <span className="text-gray-400">·</span>
          <span className="text-gray-500">{activeGroupIndex + 1} of {groups.length}</span>
        </div>

        {!isAll && (
          <button
            aria-label="Dismiss group"
            onClick={() => onDismiss(activeGroup.id)}
            className="p-1 rounded text-gray-400 hover:text-gray-600"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        <button
          aria-label="Next group"
          disabled={isLast}
          onClick={() => onNavigate('next')}
          className="p-1 rounded text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {isAll && commonPatterns && commonPatterns.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-gray-500">
          {commonPatterns.map((pattern, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-gray-400 shrink-0" />
              {pattern}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
