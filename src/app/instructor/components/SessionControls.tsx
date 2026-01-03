'use client';

import React from 'react';

interface SessionControlsProps {
  sessionId: string;
  sectionName?: string;
  joinCode?: string;
  onEndSession: () => void;
  onLeaveSession: () => void;
  onLoadProblem?: () => void;
}

export default function SessionControls({
  sessionId,
  sectionName,
  joinCode,
  onEndSession,
  onLeaveSession,
  onLoadProblem
}: SessionControlsProps) {
  const handleOpenPublicView = () => {
    const publicViewUrl = `/instructor/public?sessionId=${sessionId}`;
    window.open(publicViewUrl, '_blank', 'width=1200,height=800');
  };

  return (
    <div className="bg-white border-2 border-blue-200 rounded-xl shadow-lg p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Active Session</h2>
          {sectionName && (
            <p className="text-sm text-gray-600">{sectionName}</p>
          )}
          {joinCode && (
            <div className="mt-2 inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 text-sm font-mono font-bold rounded-lg">
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              Join Code: {joinCode}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {onLoadProblem && (
            <button
              onClick={onLoadProblem}
              className="px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-300 rounded-lg hover:bg-green-100 transition-colors"
              title="Load a pre-created problem from your library into this session"
            >
              📚 Load Problem
            </button>
          )}
          <button
            onClick={handleOpenPublicView}
            className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-300 rounded-lg hover:bg-blue-100 transition-colors"
            title="Open public view in a new window to display student code to the class"
          >
            Open Public View
          </button>
          <button
            onClick={onLeaveSession}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Leave Session
          </button>
          <button
            onClick={onEndSession}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          >
            End Session
          </button>
        </div>
      </div>
    </div>
  );
}
