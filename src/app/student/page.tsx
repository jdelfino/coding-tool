'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import JoinForm from './components/JoinForm';
import ProblemDisplay from './components/ProblemDisplay';
import CodeEditor from './components/CodeEditor';
import OutputPanel from './components/OutputPanel';

export default function StudentPage() {
  const [joined, setJoined] = useState(false);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [problemText, setProblemText] = useState('');
  const [code, setCode] = useState('');
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);

  const wsUrl = typeof window !== 'undefined' 
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
    : '';
  
  const { isConnected, lastMessage, sendMessage } = useWebSocket(wsUrl);

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    console.log('Received message:', lastMessage.type);

    switch (lastMessage.type) {
      case 'SESSION_JOINED':
        setJoined(true);
        setStudentId(lastMessage.payload.studentId);
        setProblemText(lastMessage.payload.problemText || '');
        break;

      case 'PROBLEM_UPDATE':
        setProblemText(lastMessage.payload.problemText);
        break;

      case 'EXECUTION_RESULT':
        setExecutionResult(lastMessage.payload);
        setIsRunning(false);
        break;

      case 'ERROR':
        alert('Error: ' + lastMessage.payload.error);
        setIsRunning(false);
        break;
    }
  }, [lastMessage]);

  // Debounced code update
  useEffect(() => {
    if (!joined || !studentId) return;

    const timeout = setTimeout(() => {
      sendMessage('CODE_UPDATE', { code });
    }, 500);

    return () => clearTimeout(timeout);
  }, [code, joined, studentId, sendMessage]);

  const handleJoin = (joinCode: string, studentName: string) => {
    sendMessage('JOIN_SESSION', { joinCode, studentName });
  };

  const handleRunCode = () => {
    setIsRunning(true);
    setExecutionResult(null);
    sendMessage('EXECUTE_CODE', { code });
  };

  if (!joined) {
    return (
      <main style={{ padding: '2rem' }}>
        <h1 style={{ textAlign: 'center' }}>Live Coding Classroom</h1>
        <div style={{ 
          textAlign: 'center', 
          marginBottom: '2rem',
          padding: '0.5rem',
          backgroundColor: isConnected ? '#d4edda' : '#f8d7da',
          borderRadius: '4px'
        }}>
          {isConnected ? '● Connected to server' : '○ Connecting...'}
        </div>
        <JoinForm onJoin={handleJoin} />
      </main>
    );
  }

  return (
    <main style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '1rem'
      }}>
        <h1>Live Coding Session</h1>
        <div style={{ 
          padding: '0.5rem 1rem',
          backgroundColor: isConnected ? '#d4edda' : '#f8d7da',
          borderRadius: '4px'
        }}>
          {isConnected ? '● Connected' : '○ Disconnected'}
        </div>
      </div>

      <ProblemDisplay problemText={problemText} />

      <CodeEditor
        code={code}
        onChange={setCode}
        onRun={handleRunCode}
        isRunning={isRunning}
      />

      <OutputPanel result={executionResult} />
    </main>
  );
}
