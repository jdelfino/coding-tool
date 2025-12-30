'use client';

import Editor from '@monaco-editor/react';
import React, { useEffect, useRef, useState } from 'react';
import ExecutionSettingsComponent from './ExecutionSettings';
import type { ExecutionSettings } from '@/server/types/problem';
import { useResponsiveLayout, useSidebarSection } from '@/hooks/useResponsiveLayout';
import type { Problem } from '@/server/types/problem';

interface ExecutionResult {
  success: boolean;
  output: string;
  error: string;
  executionTime: number;
}

interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
  onRun?: (executionSettings: ExecutionSettings) => void;
  isRunning?: boolean;
  exampleInput?: string;
  onStdinChange?: (stdin: string) => void;
  randomSeed?: number;
  onRandomSeedChange?: (seed: number | undefined) => void;
  attachedFiles?: Array<{ name: string; content: string }>;
  onAttachedFilesChange?: (files: Array<{ name: string; content: string }>) => void;
  readOnly?: boolean;
  executionResult?: ExecutionResult | null;
  useApiExecution?: boolean;
  title?: string;
  showRunButton?: boolean;
  problem?: Problem | null;
  onLoadStarterCode?: (starterCode: string) => void;
}

export default function CodeEditor({ 
  code, 
  onChange, 
  onRun, 
  isRunning = false, 
  exampleInput,
  onStdinChange,
  randomSeed,
  onRandomSeedChange,
  attachedFiles,
  onAttachedFilesChange,
  readOnly = false,
  executionResult = null,
  useApiExecution = false,
  title = 'Your Code',
  showRunButton = true,
  problem = null,
  onLoadStarterCode,
}: CodeEditorProps) {
  const editorRef = useRef<any>(null);
  const [stdin, setStdin] = useState('');
  const [localIsRunning, setLocalIsRunning] = useState(false);
  const [localExecutionResult, setLocalExecutionResult] = useState<ExecutionResult | null>(null);
  
  // Responsive layout detection
  const isDesktop = useResponsiveLayout(1024);
  const { isCollapsed: isSettingsCollapsed, toggle: toggleSettings, setCollapsed: setSettingsCollapsed } = useSidebarSection('execution-settings', false);
  const { isCollapsed: isProblemCollapsed, toggle: toggleProblem, setCollapsed: setProblemCollapsed } = useSidebarSection('problem-panel', true);

  // Ensure only one sidebar is open at a time
  const handleToggleProblem = () => {
    if (isProblemCollapsed) {
      // Opening problem panel - close settings
      setSettingsCollapsed(true);
    }
    toggleProblem();
  };

  const handleToggleSettings = () => {
    if (isSettingsCollapsed) {
      // Opening settings panel - close problem
      setProblemCollapsed(true);
    }
    toggleSettings();
  };

  // Wrapper to call both internal state and parent callback
  const handleStdinChange = (value: string) => {
    setStdin(value);
    onStdinChange?.(value);
  };

  // Use local state for API execution, or passed props for WebSocket execution
  const effectiveIsRunning = useApiExecution ? localIsRunning : isRunning;
  const effectiveResult = useApiExecution ? localExecutionResult : executionResult;

  // Initialize stdin with example input if provided
  useEffect(() => {
    if (exampleInput) {
      setStdin(exampleInput);
    }
  }, [exampleInput]);

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
    if (!readOnly) {
      editor.focus();
    }
  };

  const handleRunViaApi = async () => {
    if (!code || code.trim().length === 0) {
      setLocalExecutionResult({
        success: false,
        output: '',
        error: 'Please write some code before running',
        executionTime: 0,
      });
      return;
    }

    setLocalIsRunning(true);
    setLocalExecutionResult(null);

    try {
      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          executionSettings: {
            stdin: stdin || undefined,
            randomSeed,
            attachedFiles,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to execute code');
      }

      const result = await response.json();
      setLocalExecutionResult(result);
    } catch (error: any) {
      setLocalExecutionResult({
        success: false,
        output: '',
        error: error.message || 'Failed to execute code',
        executionTime: 0,
      });
    } finally {
      setLocalIsRunning(false);
    }
  };

  const handleRun = () => {
    if (useApiExecution) {
      handleRunViaApi();
    } else if (onRun) {
      onRun({ stdin: stdin || undefined, randomSeed, attachedFiles });
    }
  };

  return (
    <div className="border border-gray-300 rounded flex flex-col" style={{ height: '100%' }}>
      {/* Header */}
      <div className="px-4 py-2 bg-gray-100 border-b border-gray-300 flex justify-between items-center flex-shrink-0">
        <span className="font-bold">{title}</span>
        {showRunButton && (
          <button
            onClick={handleRun}
            disabled={effectiveIsRunning}
            className={`px-4 py-2 rounded text-white ${
              effectiveIsRunning
                ? 'bg-gray-500 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 cursor-pointer'
            }`}
          >
            {effectiveIsRunning ? '⏳ Running...' : '▶ Run Code'}
          </button>
        )}
      </div>

      {/* Main Content Area - Responsive Layout */}
      <div className="flex flex-row flex-1 min-h-0">
        {/* Left Sidebar (Desktop only) - VS Code style */}
        {isDesktop && (
          <div className="flex flex-row flex-shrink-0 h-full">
            {/* Activity Bar (Icon bar) */}
            <div className="w-12 bg-gray-800 flex flex-col items-center py-2 gap-1 h-full">
              {/* Problem icon (only show if problem exists) */}
              {problem && (
                <button
                  onClick={handleToggleProblem}
                  className={`w-10 h-10 flex items-center justify-center rounded transition-colors ${
                    !isProblemCollapsed 
                      ? 'bg-gray-700 text-white' 
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                  aria-label="Problem"
                  title="Problem"
                >
                  {/* Document/Problem icon */}
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </button>
              )}
              
              {/* Settings icon */}
              <button
                onClick={handleToggleSettings}
                className={`w-10 h-10 flex items-center justify-center rounded transition-colors ${
                  !isSettingsCollapsed 
                    ? 'bg-gray-700 text-white' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
                aria-label="Execution Settings"
                title="Execution Settings"
              >
                {/* Settings/Sliders icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="4" y1="21" x2="4" y2="14" />
                  <line x1="4" y1="10" x2="4" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12" y2="3" />
                  <line x1="20" y1="21" x2="20" y2="16" />
                  <line x1="20" y1="12" x2="20" y2="3" />
                  <line x1="1" y1="14" x2="7" y2="14" />
                  <line x1="9" y1="8" x2="15" y2="8" />
                  <line x1="17" y1="16" x2="23" y2="16" />
                </svg>
              </button>
              {/* Future icons will go here */}
            </div>

            {/* Side Panel (expands when active) */}
            {(!isProblemCollapsed && problem) && (
              <div className="w-80 bg-gray-800 text-gray-200 border-r border-gray-700 flex flex-col flex-shrink-0 h-full">
                <div className="px-4 py-2 bg-gray-900 border-b border-gray-700 font-bold flex items-center justify-between flex-shrink-0">
                  <span>Problem</span>
                  <button
                    onClick={toggleProblem}
                    className="text-gray-400 hover:text-gray-100 text-xl leading-none"
                    aria-label="Close panel"
                  >
                    ×
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <h2 className="text-xl font-bold mb-4">{problem.title}</h2>
                  {problem.description && (
                    <div className="prose prose-invert prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap text-gray-300 text-sm font-sans">
                        {problem.description}
                      </pre>
                    </div>
                  )}
                  {problem.starterCode && onLoadStarterCode && (
                    <button
                      onClick={() => onLoadStarterCode(problem.starterCode || '')}
                      className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                    >
                      Load Starter Code
                    </button>
                  )}
                </div>
              </div>
            )}
            
            {!isSettingsCollapsed && (
              <div className="w-80 bg-gray-800 text-gray-200 border-r border-gray-700 flex flex-col flex-shrink-0 h-full">
                <div className="px-4 py-2 bg-gray-900 border-b border-gray-700 font-bold flex items-center justify-between flex-shrink-0">
                  <span>Execution Settings</span>
                  <button
                    onClick={toggleSettings}
                    className="text-gray-400 hover:text-gray-100 text-xl leading-none"
                    aria-label="Close panel"
                  >
                    ×
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <ExecutionSettingsComponent
                    stdin={stdin}
                    onStdinChange={handleStdinChange}
                    randomSeed={randomSeed}
                    onRandomSeedChange={onRandomSeedChange}
                    attachedFiles={attachedFiles}
                    onAttachedFilesChange={onAttachedFilesChange}
                    exampleInput={exampleInput}
                    readOnly={readOnly}
                    inSidebar={true}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main Editor Area */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Code Editor */}
          <Editor
            height="100%"
            defaultLanguage="python"
            value={code}
            onChange={(value) => !readOnly && onChange(value || '')}
            onMount={handleEditorDidMount}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              roundedSelection: false,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              readOnly,
            }}
          />

          {/* Execution Results */}
          {effectiveResult && (
            <div className={`p-4 border-t border-gray-300 ${
              effectiveResult.success ? 'bg-green-100' : 'bg-red-100'
            }`}>
              <div className="flex justify-between items-center mb-2">
                <span className={`font-bold ${
                  effectiveResult.success ? 'text-green-800' : 'text-red-800'
                }`}>
                  {effectiveResult.success ? '✓ Success' : '✗ Error'}
                </span>
                <span className={`text-sm ${
                  effectiveResult.success ? 'text-green-800' : 'text-red-800'
                }`}>
                  Execution time: {effectiveResult.executionTime}ms
                </span>
              </div>
              
              {effectiveResult.output && (
                <div className="mt-2">
                  <div className={`font-bold text-sm ${
                    effectiveResult.success ? 'text-green-800' : 'text-red-800'
                  }`}>
                    Output:
                  </div>
                  <pre className="bg-white p-2 rounded border border-gray-300 overflow-x-auto text-sm font-mono mt-1 whitespace-pre-wrap break-words">
                    {effectiveResult.output}
                  </pre>
                </div>
              )}
              
              {effectiveResult.error && (
                <div className="mt-2">
                  <div className="font-bold text-sm text-red-800">
                    Error:
                  </div>
                  <pre className="bg-white p-2 rounded border border-gray-300 overflow-x-auto text-sm font-mono mt-1 whitespace-pre-wrap break-words text-red-800">
                    {effectiveResult.error}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile: Bottom Execution Settings */}
        {!isDesktop && (
          <div className="border-t border-gray-300">
            <ExecutionSettingsComponent
              stdin={stdin}
              onStdinChange={handleStdinChange}
              randomSeed={randomSeed}
              onRandomSeedChange={onRandomSeedChange}
              attachedFiles={attachedFiles}
              onAttachedFilesChange={onAttachedFilesChange}
              exampleInput={exampleInput}
              readOnly={readOnly}
              inSidebar={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
