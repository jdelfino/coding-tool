'use client';

import Editor from '@monaco-editor/react';
import { useEffect, useRef, useState } from 'react';
import ExecutionSettings from './ExecutionSettings';

interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
  onRun: (stdin?: string) => void;
  isRunning?: boolean;
  exampleInput?: string;
  randomSeed?: number;
  onRandomSeedChange?: (seed: number | undefined) => void;
  attachedFiles?: Array<{ name: string; content: string }>;
  onAttachedFilesChange?: (files: Array<{ name: string; content: string }>) => void;
  readOnly?: boolean;
}

export default function CodeEditor({ 
  code, 
  onChange, 
  onRun, 
  isRunning = false, 
  exampleInput,
  randomSeed,
  onRandomSeedChange,
  attachedFiles,
  onAttachedFilesChange,
  readOnly = false
}: CodeEditorProps) {
  const editorRef = useRef<any>(null);
  const [stdin, setStdin] = useState('');

  // Initialize stdin with example input if provided
  useEffect(() => {
    if (exampleInput) {
      setStdin(exampleInput);
    }
  }, [exampleInput]);

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
    editor.focus();
  };

  const handleRun = () => {
    onRun(stdin || undefined);
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
        <span style={{ fontWeight: 'bold' }}>Your Code</span>
        <button
          onClick={handleRun}
          disabled={isRunning}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: isRunning ? '#6c757d' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isRunning ? 'not-allowed' : 'pointer',
          }}
        >
          {isRunning ? '⏳ Running...' : '▶ Run Code'}
        </button>
      </div>
      
      <Editor
        height="400px"
        defaultLanguage="python"
        value={code}
        onChange={(value) => onChange(value || '')}
        onMount={handleEditorDidMount}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          roundedSelection: false,
          scrollBeyondLastLine: false,
          automaticLayout: true,
        }}
      />

      <ExecutionSettings
        stdin={stdin}
        onStdinChange={setStdin}
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
