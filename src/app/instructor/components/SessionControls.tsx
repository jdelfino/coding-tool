'use client';

import React from 'react';

interface SessionControlsProps {
  sessionId: string;
  joinCode: string;
  sectionName?: string;
  onEndSession: () => void;
  onLeaveSession: () => void;
}

export default function SessionControls({ 
  sessionId, 
  joinCode, 
  sectionName,
  onEndSession,
  onLeaveSession
}: SessionControlsProps) {
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
