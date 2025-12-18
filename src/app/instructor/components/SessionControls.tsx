'use client';

interface SessionControlsProps {
  sessionId: string | null;
  joinCode: string | null;
  onCreateSession: () => void;
  isCreating?: boolean;
  disabled?: boolean;
}

export default function SessionControls({ 
  sessionId, 
  joinCode, 
  onCreateSession,
  isCreating = false,
  disabled = false
}: SessionControlsProps) {
  return (
    <div style={{ padding: '1rem', border: '1px solid #ccc', marginBottom: '1rem' }}>
      {!sessionId ? (
        <button
          onClick={onCreateSession}
          disabled={disabled || isCreating}
          style={{
            padding: '1rem 2rem',
            fontSize: '1.2rem',
            backgroundColor: disabled || isCreating ? '#6c757d' : '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: disabled || isCreating ? 'not-allowed' : 'pointer',
            opacity: disabled || isCreating ? 0.6 : 1,
          }}
        >
          {isCreating ? 'Creating Session...' : disabled ? 'Server Unavailable' : 'Create Session'}
        </button>
      ) : (
        <div>
          <h2>Session Active</h2>
          <div style={{ fontSize: '3rem', fontWeight: 'bold', margin: '1rem 0' }}>
            Join Code: {joinCode}
          </div>
          <p style={{ color: '#666' }}>
            Share this code with students so they can join the session.
          </p>
        </div>
      )}
    </div>
  );
}
