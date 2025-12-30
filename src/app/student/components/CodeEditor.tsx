'use client';

import Editor from '@monaco-editor/react';
import React, { useEffect, useRef, useState } from 'react';
import ExecutionSettingsComponent from './ExecutionSettings';
import type { ExecutionSettings } from '@/server/types/problem';
import { useResponsiveLayout, useSidebarSection } from '@/hooks/useResponsiveLayout';

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
}: CodeEditorProps) {
  const editorRef = useRef<any>(null);
  const [stdin, setStdin] = useState('');
  const [localIsRunning, setLocalIsRunning] = useState(false);
  const [localExecutionResult, setLocalExecutionResult] = useState<ExecutionResult | null>(null);
  
  // Responsive layout detection
  const isDesktop = useResponsiveLayout(1024);
  const { isCollapsed: isSettingsCollapsed, toggle: toggleSettings } = useSidebarSection('execution-settings', false);

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
    <div className="border border-gray-300 rounded">
      {/* Header */}
      <div className="px-4 py-2 bg-gray-100 border-b border-gray-300 flex justify-between items-center">
        <span className="font-bold">{title}</span>
        {showRunButton && (
          <button
            onClick={handleRun}
            disabled={effectiveIsRunning || readOnly}
            className={`px-4 py-2 rounded text-white ${
              effectiveIsRunning || readOnly
                ? 'bg-gray-500 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 cursor-pointer'
            }`}
          >
            {effectiveIsRunning ? '⏳ Running...' : '▶ Run Code'}
          </button>
        )}
      </div>

      {/* Main Content Area - Responsive Layout */}
      <div className="lg:flex lg:flex-row">
        {/* Left Column: Editor + Results (Desktop) or Full Width (Mobile) */}
        <div className={`flex flex-col ${isDesktop && !isSettingsCollapsed ? 'lg:flex-[7]' : 'flex-1'}`}>
          {/* Code Editor */}
          <Editor
            height="400px"
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

        {/* Right Sidebar (Desktop) or Below (Mobile) */}
        {isDesktop ? (
          /* Desktop: Collapsible Sidebar Section */
          !isSettingsCollapsed ? (
            <div className="lg:flex-[3] lg:border-l border-gray-300 bg-gray-50">
              <button
                onClick={toggleSettings}
                className="w-full px-4 py-2 bg-transparent border-none cursor-pointer text-left font-bold flex items-center justify-between hover:bg-gray-100"
                aria-expanded={!isSettingsCollapsed}
                aria-label="Toggle execution settings"
              >
                <div className="flex items-center gap-2">
                  <span className="inline-block transition-transform duration-200 rotate-90">
                    ▶
                  </span>
                  Execution Settings
                </div>
              </button>
              
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
                  inSidebar={true}
                />
              </div>
            </div>
          ) : (
            <div className="lg:border-l border-gray-300 bg-gray-50" style={{ flexBasis: '40px', flexShrink: 0 }}>
              <button
                onClick={toggleSettings}
                className="w-full h-full px-2 py-2 bg-transparent border-none cursor-pointer text-left font-bold flex items-center justify-center hover:bg-gray-100"
                aria-expanded={!isSettingsCollapsed}
                aria-label="Toggle execution settings"
                style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
              >
                <div className="flex items-center gap-2">
                  <span className="inline-block transition-transform duration-200">
                    ▶
                  </span>
                  Execution Settings
                </div>
              </button>
            </div>
          )
        ) : (
          /* Mobile: Traditional Bottom Section */
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
