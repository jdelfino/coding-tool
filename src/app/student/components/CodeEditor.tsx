'use client';

import Editor from '@monaco-editor/react';
import React, { useEffect, useRef, useState } from 'react';
import ExecutionSettings from './ExecutionSettings';

interface ExecutionResult {
  success: boolean;
  output: string;
  error: string;
  executionTime: number;
}

interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
  onRun?: (stdin?: string) => void;
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
          stdin: stdin || undefined,
          randomSeed,
          attachedFiles,
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
      onRun(stdin || undefined);
    }
  };

  return (
    <div style={{ border: '1px solid #ccc', borderRadius: '4px' }}>
      <div style={{ 
        padding: '0.5rem 1rem', 
        backgroundColor: '#f5f5f5',
        borderBottom: '1px solid #ccc',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{ fontWeight: 'bold' }}>{title}</span>
        {showRunButton && (
          <button
            onClick={handleRun}
            disabled={effectiveIsRunning || readOnly}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: effectiveIsRunning ? '#6c757d' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: effectiveIsRunning || readOnly ? 'not-allowed' : 'pointer',
            }}
          >
            {effectiveIsRunning ? '⏳ Running...' : '▶ Run Code'}
          </button>
        )}
      </div>
      
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
        <div style={{
          padding: '1rem',
          backgroundColor: effectiveResult.success ? '#d4edda' : '#f8d7da',
          borderTop: '1px solid #ccc',
          borderBottom: '1px solid #ccc',
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '0.5rem',
          }}>
            <span style={{ 
              fontWeight: 'bold',
              color: effectiveResult.success ? '#155724' : '#721c24',
            }}>
              {effectiveResult.success ? '✓ Success' : '✗ Error'}
            </span>
            <span style={{ 
              fontSize: '0.875rem',
              color: effectiveResult.success ? '#155724' : '#721c24',
            }}>
              Execution time: {effectiveResult.executionTime}ms
            </span>
          </div>
          
          {effectiveResult.output && (
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ 
                fontWeight: 'bold', 
                fontSize: '0.875rem',
                color: effectiveResult.success ? '#155724' : '#721c24',
              }}>
                Output:
              </div>
              <pre style={{
                backgroundColor: 'white',
                padding: '0.5rem',
                borderRadius: '4px',
                border: '1px solid #ccc',
                overflowX: 'auto',
                fontSize: '0.875rem',
                fontFamily: 'monospace',
                marginTop: '0.25rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {effectiveResult.output}
              </pre>
            </div>
          )}
          
          {effectiveResult.error && (
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ 
                fontWeight: 'bold', 
                fontSize: '0.875rem',
                color: '#721c24',
              }}>
                Error:
              </div>
              <pre style={{
                backgroundColor: 'white',
                padding: '0.5rem',
                borderRadius: '4px',
                border: '1px solid #ccc',
                overflowX: 'auto',
                fontSize: '0.875rem',
                fontFamily: 'monospace',
                marginTop: '0.25rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                color: '#721c24',
              }}>
                {effectiveResult.error}
              </pre>
            </div>
          )}
        </div>
      )}

      <ExecutionSettings
        stdin={stdin}
        onStdinChange={handleStdinChange}
        randomSeed={randomSeed}
        onRandomSeedChange={onRandomSeedChange}
        attachedFiles={attachedFiles}
        onAttachedFilesChange={onAttachedFilesChange}
        exampleInput={exampleInput}
        readOnly={readOnly}
      />
    </div>
  );
}
