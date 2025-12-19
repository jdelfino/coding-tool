'use client';

interface Student {
  id: string;
  name: string;
  hasCode: boolean;
}

interface StudentListProps {
  students: Student[];
  onSelectStudent: (studentId: string) => void;
  onShowOnPublicView?: (studentId: string) => void;
  onViewHistory?: (studentId: string, studentName: string) => void;
}

export default function StudentList({ students, onSelectStudent, onShowOnPublicView, onViewHistory }: StudentListProps) {
  return (
    <div style={{ padding: '1rem', border: '1px solid #ccc', marginBottom: '1rem' }}>
      <h3>Connected Students ({students.length})</h3>
      {students.length === 0 ? (
        <p style={{ color: '#666' }}>No students connected yet.</p>
      ) : (
        <div>
          {students.map((student) => (
            <div
              key={student.id}
              style={{
                padding: '0.75rem',
                margin: '0.5rem 0',
                border: '1px solid #ddd',
                borderRadius: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: student.hasCode ? '#f0f8ff' : 'white',
              }}
            >
              <div>
                <strong>{student.name}</strong>
                <span style={{ marginLeft: '1rem', color: '#666' }}>
                  {student.hasCode ? '✓ Has code' : '○ No code yet'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => onSelectStudent(student.id)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#0070f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  View Code
                </button>
                {onViewHistory && (
                  <button
                    onClick={() => onViewHistory(student.id, student.name)}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#8b5cf6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                    title="View code revision history"
                  >
                    View History
                  </button>
                )}
                {onShowOnPublicView && (
                  <button
                    onClick={() => onShowOnPublicView(student.id)}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                    title="Display this submission on the public view"
                  >
                    Show on Public View
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
