import React, { useState } from 'react';

interface VariableInspectorProps {
  locals: Record<string, any>;
  globals: Record<string, any>;
  previousLocals?: Record<string, any>;
  previousGlobals?: Record<string, any>;
}

export function VariableInspector({ 
  locals, 
  globals,
  previousLocals = {},
  previousGlobals = {}
}: VariableInspectorProps) {
  const [showLocals, setShowLocals] = useState(true);
  const [showGlobals, setShowGlobals] = useState(true);

  const formatValue = (value: any): string => {
    if (value === null) return 'None';
    if (typeof value === 'string') return `'${value}'`;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return JSON.stringify(value);
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const hasChanged = (name: string, value: any, previous: Record<string, any>): boolean => {
    if (!(name in previous)) return true; // New variable
    return JSON.stringify(value) !== JSON.stringify(previous[name]);
  };

  const renderVariables = (
    vars: Record<string, any>,
    previous: Record<string, any>,
    label: string
  ) => {
    const entries = Object.entries(vars);
    
    if (entries.length === 0) {
      return (
        <div className="text-sm text-gray-500 italic p-2">
          No {label.toLowerCase()} variables
        </div>
      );
    }

    return (
      <div className="divide-y divide-gray-200">
        {entries.map(([name, value]) => {
          const changed = hasChanged(name, value, previous);
          return (
            <div
              key={name}
              className={`flex items-start p-2 text-sm ${
                changed ? 'bg-yellow-50' : ''
              }`}
            >
              <span className="font-mono font-semibold text-gray-700 mr-3 min-w-[100px]">
                {name}
              </span>
              <span className="font-mono text-gray-900 break-all flex-1">
                {formatValue(value)}
              </span>
              {changed && (
                <span className="ml-2 text-xs text-yellow-600">●</span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
      <div className="bg-gray-100 px-4 py-2 border-b border-gray-300">
        <h3 className="text-sm font-semibold text-gray-700">Variables</h3>
      </div>

      {/* Local Variables */}
      <div className="border-b border-gray-200">
        <button
          onClick={() => setShowLocals(!showLocals)}
          className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <span>▼ Local Variables</span>
          <span className="text-xs text-gray-500">
            {Object.keys(locals).length} vars
          </span>
        </button>
        {showLocals && renderVariables(locals, previousLocals, 'Local')}
      </div>

      {/* Global Variables */}
      <div>
        <button
          onClick={() => setShowGlobals(!showGlobals)}
          className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <span>▼ Global Variables</span>
          <span className="text-xs text-gray-500">
            {Object.keys(globals).length} vars
          </span>
        </button>
        {showGlobals && renderVariables(globals, previousGlobals, 'Global')}
      </div>
    </div>
  );
}
