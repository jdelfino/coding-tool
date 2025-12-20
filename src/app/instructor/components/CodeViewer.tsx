'use client';

import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeViewerProps {
  code: string;
  studentName?: string;
  executionResult?: {
    success: boolean;
    output: string;
    error: string;
    executionTime: number;
  };
  onRunCode: () => void;
}

export default function CodeViewer({ code, studentName, executionResult, onRunCode }: CodeViewerProps) {
  if (!code) {
    return (
      <div style={{ padding: '1rem', border: '1px solid #ccc' }}>
        <p style={{ color: '#666' }}>Select a student to view their code.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem', border: '1px solid #ccc' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3>{studentName ? `${studentName}'s Code` : "Student's Code"}</h3>
        <button
          onClick={onRunCode}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          ▶ Run Code
        </button>
      </div>

      <SyntaxHighlighter
        language="python"
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          borderRadius: '4px',
        }}
      >
        {code}
      </SyntaxHighlighter>

      {executionResult && (
        <div style={{ marginTop: '1rem' }}>
          <h4>Execution Result:</h4>
          <div
            style={{
              padding: '1rem',
              backgroundColor: executionResult.success ? '#d4edda' : '#f8d7da',
              border: `1px solid ${executionResult.success ? '#c3e6cb' : '#f5c6cb'}`,
              borderRadius: '4px',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
            }}
          >
            {executionResult.output && (
              <div>
                <strong>Output:</strong>
                <pre style={{ margin: '0.5rem 0' }}>{executionResult.output}</pre>
              </div>
            )}
            {executionResult.error && (
              <div>
                <strong>Error:</strong>
                <pre style={{ margin: '0.5rem 0', color: '#721c24' }}>{executionResult.error}</pre>
              </div>
            )}
            <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
              Execution time: {executionResult.executionTime}ms
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
