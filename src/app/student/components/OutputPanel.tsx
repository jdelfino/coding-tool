'use client';

import React from 'react';

interface ExecutionResult {
  success: boolean;
  output: string;
  error: string;
  executionTime: number;
  stdin?: string; // Input provided to the program
}

interface OutputPanelProps {
  result: ExecutionResult | null;
}

export default function OutputPanel({ result }: OutputPanelProps) {
  if (!result) {
    return (
      <div style={{ 
        padding: '1rem',
        backgroundColor: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: '4px',
        marginTop: '1rem',
        minHeight: '150px'
      }}>
        <h4 style={{ marginTop: 0 }}>Output</h4>
        <p style={{ color: '#666', fontStyle: 'italic' }}>
          Run your code to see the output here.
        </p>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '1rem',
      backgroundColor: result.success ? '#d4edda' : '#f8d7da',
      border: `1px solid ${result.success ? '#c3e6cb' : '#f5c6cb'}`,
      borderRadius: '4px',
      marginTop: '1rem',
      minHeight: '150px'
    }}>
      <h4 style={{ marginTop: 0 }}>Output</h4>
      
      {/* Display input if it was provided */}
      {result.stdin && (
        <div style={{ marginBottom: '1rem' }}>
          <strong style={{ color: '#666' }}>Input provided:</strong>
          <pre style={{ 
            margin: '0.5rem 0',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            backgroundColor: '#f5f5f5',
            padding: '0.5rem',
            borderRadius: '4px',
            border: '1px solid #ccc',
          }}>
            {result.stdin}
          </pre>
        </div>
      )}

      {result.output && (
        <div style={{ marginBottom: '1rem' }}>
          <pre style={{ 
            margin: 0,
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word'
          }}>
            {result.output}
          </pre>
        </div>
      )}

      {result.error && (
        <div style={{ marginBottom: '1rem' }}>
          <strong style={{ color: '#721c24' }}>Error:</strong>
          <pre style={{ 
            margin: '0.5rem 0 0 0',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            color: '#721c24'
          }}>
            {result.error}
          </pre>
        </div>
      )}

      <div style={{ 
        fontSize: '0.9rem', 
        color: '#666',
        marginTop: '0.5rem'
      }}>
        Execution time: {result.executionTime}ms
      </div>
    </div>
  );
}
