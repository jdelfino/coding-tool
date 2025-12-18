'use client';

import { useState } from 'react';

interface ProblemInputProps {
  onUpdateProblem: (problemText: string) => void;
}

export default function ProblemInput({ onUpdateProblem }: ProblemInputProps) {
  const [problemText, setProblemText] = useState('');

  const handleUpdate = () => {
    onUpdateProblem(problemText);
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
