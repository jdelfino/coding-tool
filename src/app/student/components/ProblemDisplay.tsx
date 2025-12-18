'use client';

interface ProblemDisplayProps {
  problemText: string;
}

export default function ProblemDisplay({ problemText }: ProblemDisplayProps) {
  if (!problemText) {
    return (
      <div style={{ 
        padding: '1rem', 
        backgroundColor: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: '4px',
        marginBottom: '1rem'
      }}>
        <p style={{ margin: 0, color: '#666' }}>
          Waiting for instructor to set a problem...
        </p>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '1rem', 
      backgroundColor: '#f8f9fa',
      border: '1px solid #dee2e6',
      borderRadius: '4px',
      marginBottom: '1rem'
    }}>
      <h3 style={{ marginTop: 0 }}>Problem:</h3>
      <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'sans-serif' }}>
        {problemText}
      </div>
    </div>
  );
}
