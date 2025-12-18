'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { MessageType } from '@/server/types';
import CodeEditor from '@/app/student/components/CodeEditor';
import OutputPanel from '@/app/student/components/OutputPanel';

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
  const [problemText, setProblemText] = useState('');
  const [code, setCode] = useState('');
  const [hasFeaturedSubmission, setHasFeaturedSubmission] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  useEffect(() => {
    if (!sessionId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log('Public view connected to WebSocket');
      websocket.send(JSON.stringify({
        type: MessageType.JOIN_PUBLIC_VIEW,
        payload: { sessionId },
      }));
    };

    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case MessageType.PUBLIC_SUBMISSION_UPDATE:
          if (message.payload.joinCode !== undefined) {
            setJoinCode(message.payload.joinCode);
          }
          if (message.payload.problemText !== undefined) {
            setProblemText(message.payload.problemText);
          }
          if (message.payload.code !== undefined) {
            setCode(message.payload.code);
          }
          if (message.payload.hasFeaturedSubmission !== undefined) {
            setHasFeaturedSubmission(message.payload.hasFeaturedSubmission);
          }
          break;
          
        case MessageType.EXECUTION_RESULT:
          setIsExecuting(false);
          setExecutionResult(message.payload);
          break;
          
        case MessageType.PROBLEM_UPDATE:
          setProblemText(message.payload.problemText);
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

  const handleRun = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    
    setIsExecuting(true);
    setExecutionResult(null);
    
    ws.send(JSON.stringify({
      type: MessageType.PUBLIC_EXECUTE_CODE,
      payload: { code },
    }));
  };

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">No Session</h1>
          <p className="text-gray-600">Please provide a sessionId in the URL.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header with Join Code */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Public Display</h1>
              <p className="text-gray-600 mt-2">This view is for classroom display</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 mb-1">Join Code</p>
              <p className="text-4xl font-bold text-blue-600 font-mono">{joinCode || '------'}</p>
            </div>
          </div>
        </div>

        {/* Problem Display */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Problem</h2>
          {problemText ? (
            <div className="prose max-w-none">
              <pre className="whitespace-pre-wrap text-gray-700 font-sans">{problemText}</pre>
            </div>
          ) : (
            <p className="text-gray-400 italic">No problem set yet</p>
          )}
        </div>

        {/* Featured Submission */}
        {hasFeaturedSubmission ? (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Featured Submission</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Code</h3>
                <CodeEditor
                  code={code}
                  onChange={handleCodeChange}
                  onRun={handleRun}
                  isRunning={isExecuting}
                />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Output</h3>
                <OutputPanel result={executionResult} />
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-400 text-lg italic">
              No submission selected for display
            </p>
            <p className="text-gray-500 text-sm mt-2">
              Select a student submission from the instructor dashboard
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PublicInstructorView() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    }>
      <PublicViewContent />
    </Suspense>
  );
}
