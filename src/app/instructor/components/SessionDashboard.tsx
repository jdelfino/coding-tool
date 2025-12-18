'use client';

interface SessionInfo {
  id: string;
  joinCode: string;
  problemText: string;
  studentCount: number;
  createdAt: string;
  lastActivity: string;
}

interface SessionDashboardProps {
  sessions: SessionInfo[];
  onCreateSession: () => void;
  onJoinSession: (sessionId: string) => void;
  onEndSession: (sessionId: string) => void;
  isCreating: boolean;
  disabled: boolean;
}

export default function SessionDashboard({
  sessions,
  onCreateSession,
  onJoinSession,
  onEndSession,
  isCreating,
  disabled,
}: SessionDashboardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  return (
    <div style={{ marginBottom: '2rem' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '1rem'
      }}>
        <h2 style={{ margin: 0 }}>Your Sessions</h2>
        <button
          onClick={onCreateSession}
          disabled={disabled || isCreating}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: disabled || isCreating ? '#ccc' : '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: disabled || isCreating ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
          }}
        >
          {isCreating ? 'Creating...' : '+ Create New Session'}
        </button>
      </div>

      {sessions.length === 0 ? (
        <div style={{
          padding: '3rem',
          textAlign: 'center',
          backgroundColor: '#f5f5f5',
          borderRadius: '8px',
          color: '#666'
        }}>
          <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No sessions yet</p>
          <p style={{ fontSize: '0.9rem', margin: 0 }}>Create a new session to get started</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gap: '1rem',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))'
        }}>
          {sessions.map(session => (
            <div
              key={session.id}
              style={{
                padding: '1.5rem',
                backgroundColor: 'white',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: 'bold',
                  color: '#0070f3',
                  marginBottom: '0.25rem'
                }}>
                  {session.joinCode}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#666' }}>
                  {session.studentCount} student{session.studentCount !== 1 ? 's' : ''}
                </div>
              </div>

              {session.problemText && (
                <div style={{
                  fontSize: '0.9rem',
                  color: '#444',
                  marginBottom: '1rem',
                  maxHeight: '3rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}>
                  {session.problemText}
                </div>
              )}

              <div style={{
                fontSize: '0.8rem',
                color: '#999',
                marginBottom: '1rem'
              }}>
                Last activity: {formatDate(session.lastActivity)}
              </div>

              <div style={{
                display: 'flex',
                gap: '0.5rem'
              }}>
                <button
                  onClick={() => onJoinSession(session.id)}
                  disabled={disabled}
                  style={{
                    flex: 1,
                    padding: '0.6rem 1rem',
                    backgroundColor: disabled ? '#ccc' : '#0070f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    fontWeight: '500',
                  }}
                >
                  Rejoin
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`End session ${session.joinCode}? This will disconnect all students.`)) {
                      onEndSession(session.id);
                    }
                  }}
                  disabled={disabled}
                  style={{
                    padding: '0.6rem 1rem',
                    backgroundColor: 'transparent',
                    color: disabled ? '#ccc' : '#dc3545',
                    border: `1px solid ${disabled ? '#ccc' : '#dc3545'}`,
                    borderRadius: '4px',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    fontWeight: '500',
                  }}
                >
                  End
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
