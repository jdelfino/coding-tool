import React from 'react';
import { VariableInspector } from './VariableInspector';
import { CallStackPanel } from './CallStackPanel';

interface DebuggerPanelProps {
  currentStep: number;
  totalSteps: number;
  currentLine: number;
  locals: Record<string, any>;
  globals: Record<string, any>;
  previousLocals: Record<string, any>;
  previousGlobals: Record<string, any>;
  callStack: any[];
  canStepForward: boolean;
  canStepBackward: boolean;
  onStepForward: () => void;
  onStepBackward: () => void;
  onJumpToFirst: () => void;
  onJumpToLast: () => void;
  onExit: () => void;
  truncated?: boolean;
}

export function DebuggerPanel({
  currentStep,
  totalSteps,
  currentLine,
  locals,
  globals,
  previousLocals,
  previousGlobals,
  callStack,
  canStepForward,
  canStepBackward,
  onStepForward,
  onStepBackward,
  onJumpToFirst,
  onJumpToLast,
  onExit,
  truncated
}: DebuggerPanelProps) {
  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header with controls */}
      <div className="bg-white border-b border-gray-300 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">Debugger</h2>
          <button
            onClick={onExit}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50"
          >
            Exit Debug Mode
          </button>
        </div>

        {/* Step counter and truncation warning */}
        <div className="mb-3">
          <div className="text-sm text-gray-600">
            Step {currentStep + 1} of {totalSteps}
            {currentLine > 0 && (
              <span className="ml-2 text-gray-500">
                (Line {currentLine})
              </span>
            )}
          </div>
          {truncated && (
            <div className="mt-2 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
              ⚠️ Program exceeded step limit - trace truncated
            </div>
          )}
        </div>

        {/* Navigation controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onJumpToFirst}
            disabled={!canStepBackward}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            title="First step (Home)"
          >
            ⏮ First
          </button>
          <button
            onClick={onStepBackward}
            disabled={!canStepBackward}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Previous step (← or P)"
          >
            ◀ Prev
          </button>
          <button
            onClick={onStepForward}
            disabled={!canStepForward}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Next step (→ or N)"
          >
            Next ▶
          </button>
          <button
            onClick={onJumpToLast}
            disabled={!canStepForward}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Last step (End)"
          >
            Last ⏭
          </button>
        </div>

        {/* Keyboard shortcuts hint */}
        <div className="mt-2 text-xs text-gray-500">
          Keyboard: ← / → to step, Home / End to jump, Esc to exit
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Variable Inspector */}
        <VariableInspector
          locals={locals}
          globals={globals}
          previousLocals={previousLocals}
          previousGlobals={previousGlobals}
        />

        {/* Call Stack */}
        <CallStackPanel callStack={callStack} />
      </div>
    </div>
  );
}
