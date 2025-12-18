'use client';

import { useState, useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import SessionControls from './components/SessionControls';
import ProblemInput from './components/ProblemInput';
import StudentList from './components/StudentList';
import CodeViewer from './components/CodeViewer';

interface Student {
  id: string;
  name: string;
  hasCode: boolean;
}

export default function InstructorPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedStudentCode, setSelectedStudentCode] = useState<string>('');
  const [executionResult, setExecutionResult] = useState<any>(null);

  const wsUrl = typeof window !== 'undefined' 
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
    : '';
  
  const { isConnected, lastMessage, sendMessage } = useWebSocket(wsUrl);

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    console.log('Received message:', lastMessage.type);

    switch (lastMessage.type) {
      case 'SESSION_CREATED':
        setSessionId(lastMessage.payload.sessionId);
        setJoinCode(lastMessage.payload.joinCode);
        break;

      case 'STUDENT_LIST_UPDATE':
        setStudents(lastMessage.payload.students);
        break;

      case 'STUDENT_CODE':
        setSelectedStudentCode(lastMessage.payload.code);
        break;

      case 'EXECUTION_RESULT':
        setExecutionResult(lastMessage.payload);
        break;

      case 'ERROR':
        alert('Error: ' + lastMessage.payload.error);
        break;
    }
  }, [lastMessage]);

  const handleCreateSession = () => {
    sendMessage('CREATE_SESSION', {});
  };

  const handleUpdateProblem = (problemText: string) => {
    sendMessage('UPDATE_PROBLEM', { problemText });
  };

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    setExecutionResult(null);
    sendMessage('REQUEST_STUDENT_CODE', { studentId });
  };

  const handleRunCode = () => {
    if (selectedStudentId) {
      sendMessage('EXECUTE_STUDENT_CODE', { studentId: selectedStudentId });
    }
  };

  const selectedStudent = students.find(s => s.id === selectedStudentId);

  return (
    <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Instructor Dashboard</h1>
      
      <div style={{ 
        padding: '0.5rem 1rem', 
        backgroundColor: isConnected ? '#d4edda' : '#f8d7da',
        borderRadius: '4px',
        marginBottom: '1rem'
      }}>
        {isConnected ? '● Connected' : '○ Disconnected'}
      </div>

      <SessionControls 
        sessionId={sessionId}
        joinCode={joinCode}
        onCreateSession={handleCreateSession}
      />

      {sessionId && (
        <>
          <ProblemInput onUpdateProblem={handleUpdateProblem} />
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <StudentList 
              students={students}
              onSelectStudent={handleSelectStudent}
            />
            
            <CodeViewer
              code={selectedStudentCode}
              studentName={selectedStudent?.name}
              executionResult={executionResult}
              onRunCode={handleRunCode}
            />
          </div>
        </>
      )}
    </main>
  );
}
