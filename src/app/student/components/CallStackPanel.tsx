import React from 'react';
import { CallFrame } from '@/server/types';

interface CallStackPanelProps {
  callStack: CallFrame[];
}

export function CallStackPanel({ callStack }: CallStackPanelProps) {
  if (callStack.length === 0) {
    return (
      <div className="bg-white border border-gray-300 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Call Stack</h3>
        <div className="text-sm text-gray-500 italic">
          No active calls
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
      <div className="bg-gray-100 px-4 py-2 border-b border-gray-300">
        <h3 className="text-sm font-semibold text-gray-700">Call Stack</h3>
      </div>

      <div className="divide-y divide-gray-200">
        {callStack.map((frame, index) => {
          const isCurrentFrame = index === callStack.length - 1;
          return (
            <div
              key={index}
              className={`flex items-center px-4 py-2 text-sm ${
                isCurrentFrame ? 'bg-blue-50 font-semibold' : ''
              }`}
            >
              {isCurrentFrame && (
                <span className="mr-2 text-blue-600">→</span>
              )}
              <span className="font-mono text-gray-900">
                {frame.functionName === '<module>' ? '<main program>' : frame.functionName}
              </span>
              <span className="mx-2 text-gray-400">:</span>
              <span className="font-mono text-gray-600">
                {frame.line}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
