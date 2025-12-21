'use client';

import Editor from '@monaco-editor/react';
import { useEffect, useRef, useState } from 'react';

interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
  onRun: (stdin?: string) => void;
  isRunning?: boolean;
  exampleInput?: string; // Example input from problem specification
}

export default function CodeEditor({ code, onChange, onRun, isRunning = false, exampleInput }: CodeEditorProps) {
  const editorRef = useRef<any>(null);
  const [showInput, setShowInput] = useState(false);
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

      {/* Collapsible Program Input Section */}
      <div style={{
        borderTop: '1px solid #ccc',
        backgroundColor: '#f5f5f5',
      }}>
        <button
          onClick={() => setShowInput(!showInput)}
          style={{
            width: '100%',
            padding: '0.5rem 1rem',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span style={{ 
            transition: 'transform 0.2s',
            transform: showInput ? 'rotate(90deg)' : 'rotate(0deg)',
          }}>
            ▶
          </span>
          Program Input
          {stdin && !showInput && (
            <span style={{ 
              fontSize: '0.85rem', 
              color: '#666',
              fontWeight: 'normal',
              marginLeft: 'auto',
            }}>
              (input provided)
            </span>
          )}
        </button>
        
        {showInput && (
          <div style={{ padding: '0 1rem 1rem 1rem' }}>
            <textarea
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              placeholder={exampleInput ? "Example input loaded. Edit as needed..." : "Enter input for your program (one value per line)"}
              style={{
                width: '100%',
                minHeight: '100px',
                padding: '0.5rem',
                fontSize: '0.9rem',
                fontFamily: 'monospace',
                border: '1px solid #ccc',
                borderRadius: '4px',
                resize: 'vertical',
              }}
            />
            <div style={{ 
              fontSize: '0.85rem', 
              color: '#666',
              marginTop: '0.5rem',
            }}>
              This input will be provided to your program via stdin (e.g., for input() calls)
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
