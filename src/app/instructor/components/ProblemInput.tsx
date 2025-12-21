'use client';

import React, { useState } from 'react';

interface ProblemInputProps {
  onUpdateProblem: (problemText: string, exampleInput?: string) => void;
}

export default function ProblemInput({ onUpdateProblem }: ProblemInputProps) {
  const [problemText, setProblemText] = useState('');
  const [exampleInput, setExampleInput] = useState('');
  const [showExampleInput, setShowExampleInput] = useState(false);

  const handleUpdate = () => {
    onUpdateProblem(problemText, showExampleInput ? exampleInput : undefined);
  };

  return (
    <div style={{ padding: '1rem', border: '1px solid #ccc', marginBottom: '1rem' }}>
      <h3>Problem Statement</h3>
      <textarea
        value={problemText}
        onChange={(e) => setProblemText(e.target.value)}
        placeholder="Enter the problem for students to solve..."
        style={{
          width: '100%',
          minHeight: '150px',
          padding: '0.5rem',
          fontSize: '1rem',
          fontFamily: 'monospace',
          marginBottom: '0.5rem',
        }}
      />
      
      {/* Optional Example Input Section */}
      <div style={{ marginBottom: '0.5rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showExampleInput}
            onChange={(e) => setShowExampleInput(e.target.checked)}
          />
          <span>Include example input for students (optional)</span>
        </label>
      </div>
      
      {showExampleInput && (
        <div style={{ marginBottom: '0.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem', color: '#666' }}>
            Example Input:
          </label>
          <textarea
            value={exampleInput}
            onChange={(e) => setExampleInput(e.target.value)}
            placeholder="Enter example input (one value per line)..."
            style={{
              width: '100%',
              minHeight: '80px',
              padding: '0.5rem',
              fontSize: '0.9rem',
              fontFamily: 'monospace',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          />
          <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
            This input will be pre-loaded for students when they open the program input section.
          </div>
        </div>
      )}
      
      <button
        onClick={handleUpdate}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        Update Problem
      </button>
    </div>
  );
}
