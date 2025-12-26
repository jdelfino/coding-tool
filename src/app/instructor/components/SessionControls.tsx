'use client';

import React from 'react';

interface SessionControlsProps {
  sessionId: string;
  joinCode: string;
  sectionName?: string;
  onEndSession: () => void;
  onLeaveSession: () => void;
  onLoadProblem?: () => void;
}

export default function SessionControls({ 
  sessionId, 
  joinCode, 
  sectionName,
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
      
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border-2 border-blue-300">
        <p className="text-sm text-gray-600 mb-2">Student Join Code</p>
        <div className="text-5xl font-bold text-blue-600 font-mono tracking-wider">
          {joinCode}
        </div>
        <p className="text-sm text-gray-600 mt-3">
          Share this code with students so they can join the session
        </p>
      </div>
    </div>
  );
}
