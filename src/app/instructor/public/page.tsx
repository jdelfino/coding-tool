'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { MessageType } from '@/server/types';
import { ExecutionSettings, Problem } from '@/server/types/problem';
import CodeEditor from '@/app/student/components/CodeEditor';

interface ExecutionResult {
  success: boolean;
  output: string;
  error: string;
  executionTime: number;
}

function PublicViewContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [problem, setProblem] = useState<Problem | null>(null);
  const [problemText, setProblemText] = useState('');
  const [code, setCode] = useState('');
  const [hasFeaturedSubmission, setHasFeaturedSubmission] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [exampleInput, setExampleInput] = useState('');
  const [randomSeed, setRandomSeed] = useState<number | undefined>(undefined);
  const [attachedFiles, setAttachedFiles] = useState<Array<{ name: string; content: string }>>([]);

  useEffect(() => {
    if (!sessionId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      // Small delay to ensure connection is fully established
      setTimeout(() => {
        websocket.send(JSON.stringify({
          type: MessageType.JOIN_PUBLIC_VIEW,
          payload: { sessionId },
        }));
      }, 100);
    };

    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case MessageType.PUBLIC_SUBMISSION_UPDATE:
          if (message.payload.joinCode !== undefined) {
            setJoinCode(message.payload.joinCode);
          }
          if (message.payload.problem !== undefined) {
            setProblem(message.payload.problem);
            setProblemText(message.payload.problem.description || '');
          }
          if (message.payload.code !== undefined) {
            setCode(message.payload.code);
          }
          if (message.payload.hasFeaturedSubmission !== undefined) {
            setHasFeaturedSubmission(message.payload.hasFeaturedSubmission);
          }
          // Extract execution settings from either featured submission settings or problem defaults
          if (message.payload.executionSettings !== undefined || message.payload.problem !== undefined) {
            const effectiveSettings = message.payload.executionSettings || message.payload.problem?.executionSettings;
            setExampleInput(effectiveSettings?.stdin || '');
            setRandomSeed(effectiveSettings?.randomSeed);
            setAttachedFiles(effectiveSettings?.attachedFiles || []);
          }
          break;
          
        case MessageType.EXECUTION_RESULT:
          setIsExecuting(false);
          setExecutionResult(message.payload);
          break;
          
          case MessageType.PROBLEM_UPDATE:
          setProblemText(message.payload.problemText);
          setExampleInput(message.payload.exampleInput || '');
          setRandomSeed(message.payload.randomSeed);
          setAttachedFiles(message.payload.attachedFiles || []);
          break;
          
        case MessageType.ERROR:
          console.error('Error:', message.payload.error);
          break;
      }
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    websocket.onclose = () => {
      console.log('Public view disconnected from WebSocket');
    };

    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, [sessionId]);

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: MessageType.PUBLIC_CODE_EDIT,
        payload: { code: newCode },
      }));
    }
  };

  const handleRun = (executionSettings: ExecutionSettings) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    
    setIsExecuting(true);
    setExecutionResult(null);
    
    ws.send(JSON.stringify({
      type: MessageType.PUBLIC_EXECUTE_CODE,
      payload: { code, executionSettings },
    }));
  };

  if (!sessionId) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: '#f9fafb', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <div style={{ 
          backgroundColor: 'white', 
          padding: '2rem', 
          border: '1px solid #ccc',
          borderRadius: '4px' 
        }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>No Session</h1>
          <p style={{ color: '#666' }}>Please provide a sessionId in the URL.</p>
        </div>
      </div>
    );
  }

  return (
    <main style={{ padding: '1rem', width: '100%', minHeight: '100vh', boxSizing: 'border-box' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Public Display</h1>
      
      {/* Header with Join Code */}
      <div style={{ 
        padding: '1.5rem', 
        border: '1px solid #ccc', 
        borderRadius: '4px',
        marginBottom: '1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <p style={{ color: '#666', marginBottom: '0.5rem' }}>This view is for classroom display</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.25rem' }}>Join Code</p>
          <p style={{ 
            fontSize: '2.5rem', 
            fontWeight: 'bold', 
            color: '#0070f3',
            fontFamily: 'monospace'
          }}>
            {joinCode || '------'}
          </p>
        </div>
      </div>

      {/* Problem Display */}
      <div style={{ 
        padding: '1rem', 
        border: '1px solid #ccc',
        borderRadius: '4px',
        marginBottom: '1rem'
      }}>
        <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>Problem</h2>
        {problemText ? (
          <pre style={{ 
            whiteSpace: 'pre-wrap', 
            color: '#333',
            fontFamily: 'inherit'
          }}>
            {problemText}
          </pre>
        ) : (
          <p style={{ color: '#999', fontStyle: 'italic' }}>No problem set yet</p>
        )}
      </div>

      {/* Featured Submission */}
      {hasFeaturedSubmission ? (
        <div style={{ 
          padding: '1rem', 
          border: '1px solid #ccc',
          borderRadius: '4px'
        }}>
          <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>Featured Submission</h2>
          <CodeEditor
            code={code}
            onChange={handleCodeChange}
            onRun={handleRun}
            isRunning={isExecuting}
            exampleInput={exampleInput}
            randomSeed={randomSeed}
            attachedFiles={attachedFiles}
            executionResult={executionResult}
            problem={problem}
          />
        </div>
      ) : (
        <div style={{ 
          padding: '3rem', 
          border: '1px solid #ccc',
          borderRadius: '4px',
          textAlign: 'center'
        }}>
          <p style={{ color: '#999', fontSize: '1.125rem', fontStyle: 'italic', marginBottom: '0.5rem' }}>
            No submission selected for display
          </p>
          <p style={{ color: '#666', fontSize: '0.875rem' }}>
            Select a student submission from the instructor dashboard
          </p>
        </div>
      )}
    </main>
  );
}

export default function PublicInstructorView() {
  return (
    <Suspense fallback={
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: '#f9fafb', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <div style={{ fontSize: '1.25rem', color: '#666' }}>Loading...</div>
      </div>
    }>
      <PublicViewContent />
    </Suspense>
  );
}
