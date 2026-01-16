'use client';

import React from 'react';

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
  joinCode?: string;
  isLoading?: boolean;
}

export default function StudentList({ students, onSelectStudent, onShowOnPublicView, onViewHistory, joinCode, isLoading = false }: StudentListProps) {
  return (
    <div style={{ padding: '1rem', border: '1px solid #ccc', marginBottom: '1rem' }}>
      <h3>Connected Students ({students.length})</h3>
      {isLoading ? (
        <div style={{ color: '#666', padding: '1rem 0' }}>
          <p style={{ margin: 0 }}>Loading students...</p>
        </div>
      ) : students.length === 0 ? (
        <div style={{ backgroundColor: '#f8f9fa', padding: '1rem', borderRadius: '4px', marginTop: '0.5rem' }}>
          <p style={{ color: '#666', margin: '0 0 0.5rem 0' }}>
            Waiting for students to join the session.
          </p>
          {joinCode && (
            <p style={{ color: '#444', margin: 0 }}>
              Share this join code with your students:{' '}
              <span style={{
                fontFamily: 'monospace',
                fontWeight: 'bold',
                backgroundColor: '#e9ecef',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                color: '#0070f3'
              }}>
                {joinCode}
              </span>
            </p>
          )}
          {!joinCode && (
            <p style={{ color: '#888', fontSize: '0.9rem', margin: 0 }}>
              Students can join using the session join code displayed in the session controls.
            </p>
          )}
        </div>
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
