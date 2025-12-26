'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useWebSocket } from '@/hooks/useWebSocket';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import ClassList from './components/ClassList';
import SectionView from './components/SectionView';
import SessionControls from './components/SessionControls';
import ProblemInput from './components/ProblemInput';
import StudentList from './components/StudentList';
import CodeEditor from '@/app/student/components/CodeEditor';
import OutputPanel from '@/app/student/components/OutputPanel';
import RevisionViewer from './components/RevisionViewer';
import InstructorNav from './components/InstructorNav';
import ProblemLibrary from './components/ProblemLibrary';
import ProblemCreator from './components/ProblemCreator';
import ProblemLoader from './components/ProblemLoader';

interface Student {
  id: string;
  name: string;
  hasCode: boolean;
  randomSeed?: number; // For backward compatibility, kept here for display
  attachedFiles?: Array<{ name: string; content: string }>; // For backward compatibility
  executionSettings?: {
    randomSeed?: number;
    stdin?: string;
    attachedFiles?: Array<{ name: string; content: string }>;
  };
}

type ViewMode = 'classes' | 'sections' | 'problems' | 'sessions' | 'session';

interface ClassContext {
  classId: string;
  className: string;
}

interface SessionContext {
  sectionId: string;
  sectionName: string;
}

function InstructorPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Navigation state
  const [viewMode, setViewMode] = useState<ViewMode>('classes');
  const [classContext, setClassContext] = useState<ClassContext | null>(null);
  const [sessionContext, setSessionContext] = useState<SessionContext | null>(null);
  const [problemSubView, setProblemSubView] = useState<'library' | 'creator'>('library');
  const [editingProblemId, setEditingProblemId] = useState<string | null>(null);
  
  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedStudentCode, setSelectedStudentCode] = useState<string>('');
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [isExecutingCode, setIsExecutingCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [revisionViewerState, setRevisionViewerState] = useState<{
    studentId: string;
    studentName: string;
  } | null>(null);
  const [showProblemLoader, setShowProblemLoader] = useState(false);
  
  // Session execution settings
  const [sessionProblem, setSessionProblem] = useState<{ title: string; description: string; starterCode: string } | null>(null);
  const [sessionExecutionSettings, setSessionExecutionSettings] = useState<{
    stdin?: string;
    randomSeed?: number;
    attachedFiles?: Array<{ name: string; content: string }>;
  }>({});

  // Construct WebSocket URL
  const [wsUrl, setWsUrl] = useState('');
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const url = `${protocol}//${host}/ws`;
      setWsUrl(url);
    }
  }, []);
  
  const { isConnected, connectionStatus, connectionError, lastMessage, sendMessage } = useWebSocket(wsUrl);

  //Auto-join session from URL params (e.g., after creating session from problem)
  useEffect(() => {
    const sessionIdParam = searchParams.get('sessionId');
    if (sessionIdParam && isConnected && !sessionId) {
      console.log('[Auto-join] Attempting to join session from URL:', sessionIdParam);
      
      if (!isConnected) {
        console.log('[Auto-join] WebSocket not connected, skipping');
        return;
      }
      
      console.log('[Auto-join] Sending JOIN_EXISTING_SESSION message');
      sendMessage('JOIN_EXISTING_SESSION', { sessionId: sessionIdParam });
      
      // Clear URL params after initiating join
      const timer = setTimeout(() => {
        router.replace('/instructor');
      }, 500); // Delay to ensure message is sent
      return () => clearTimeout(timer);
    }
  }, [searchParams, isConnected, sessionId, router, sendMessage]);

  // Debug: Log state changes
  useEffect(() => {
    console.log('[State] sessionId:', sessionId, 'viewMode:', viewMode, 'joinCode:', joinCode);
  }, [sessionId, viewMode, joinCode]);

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    console.log('[WebSocket] Received message:', lastMessage.type, lastMessage.payload);

    switch (lastMessage.type) {
      case 'SESSION_CREATED':
        console.log('[SESSION_CREATED] Setting session state');
        setSessionId(lastMessage.payload.sessionId);
        setJoinCode(lastMessage.payload.joinCode);
        setSessionContext({
          sectionId: lastMessage.payload.sectionId,
          sectionName: lastMessage.payload.sectionName,
        });
        // Restore execution settings from session
        setSessionProblem(lastMessage.payload.problem || null);
        setSessionExecutionSettings(lastMessage.payload.executionSettings || {});
        setViewMode('session');
        setIsCreatingSession(false);
        setError(null);
        break;

      case 'SESSION_JOINED':
        setSessionId(lastMessage.payload.sessionId);
        setJoinCode(lastMessage.payload.joinCode);
        // Restore execution settings when rejoining existing session
        setSessionProblem(lastMessage.payload.problem || null);
        setSessionExecutionSettings(lastMessage.payload.executionSettings || {});
        setViewMode('session');
        setError(null);
        break;

      case 'SESSION_ENDED':
        console.log('[SESSION_ENDED] Message received:', lastMessage.payload);
        console.log('[SESSION_ENDED] Current sessionId:', sessionId);
        if (lastMessage.payload.sessionId === sessionId) {
          console.log('[SESSION_ENDED] Received for current session, clearing ALL state');
          // Clear ALL session-related state
          setSessionId(null);
          setJoinCode(null);
          setStudents([]);
          setSelectedStudentId(null);
          setSelectedStudentCode('');
          setExecutionResult(null);
          setRevisionViewerState(null);
          setSessionProblem(null);
          setSessionExecutionSettings({});
          setSessionContext(null);
          
          // Navigate to dashboard based on context
          const targetView = classContext ? 'sections' : 'classes';
          console.log('[SESSION_ENDED] Setting viewMode to:', targetView);
          setViewMode(targetView);
          console.log('[SESSION_ENDED] State clearing complete');
        } else {
          console.log('[SESSION_ENDED] Ignoring - different session');
        }
        break;

      case 'STUDENT_LIST_UPDATE':
        console.log('[STUDENT_LIST_UPDATE] Updating students list');
        setStudents(lastMessage.payload.students || []);
        break;

      case 'STUDENT_JOINED':
        setStudents(prev => {
          const exists = prev.find(s => s.id === lastMessage.payload.studentId);
          if (exists) return prev;
          
          return [...prev, {
            id: lastMessage.payload.studentId,
            name: lastMessage.payload.studentName,
            hasCode: false,
          }];
        });
        break;

      case 'STUDENT_LEFT':
        setStudents(prev => 
          prev.filter(s => s.id !== lastMessage.payload.studentId)
        );
        if (selectedStudentId === lastMessage.payload.studentId) {
          setSelectedStudentId(null);
          setSelectedStudentCode('');
        }
        break;

      case 'CODE_UPDATE':
        setStudents(prev => 
          prev.map(s => 
            s.id === lastMessage.payload.studentId 
              ? { 
                  ...s, 
                  hasCode: true,
                  randomSeed: lastMessage.payload.randomSeed !== undefined ? lastMessage.payload.randomSeed : s.randomSeed,
                  attachedFiles: lastMessage.payload.attachedFiles !== undefined ? lastMessage.payload.attachedFiles : s.attachedFiles,
                }
              : s
          )
        );
        
        if (selectedStudentId === lastMessage.payload.studentId) {
          setSelectedStudentCode(lastMessage.payload.code);
        }
        break;

      case 'STUDENT_CODE':
        if (lastMessage.payload.studentId === selectedStudentId) {
          setSelectedStudentCode(lastMessage.payload.code);
          // Update student's execution settings in the students array
          setStudents(prev => 
            prev.map(s => 
              s.id === lastMessage.payload.studentId
                ? { 
                    ...s, 
                    executionSettings: lastMessage.payload.executionSettings,
                  }
                : s
            )
          );
        }
        break;

      case 'EXECUTION_RESULT':
        setExecutionResult(lastMessage.payload);
        setIsExecutingCode(false);
        break;

      case 'PROBLEM_UPDATED':
        // Problem update acknowledged
        break;

      case 'ERROR':
        setError(lastMessage.payload.message);
        setIsCreatingSession(false);
        break;
    }
  }, [lastMessage, sessionId, selectedStudentId]);

  // Navigation handlers
  const handleSelectClass = async (classId: string) => {
    try {
      const response = await fetch(`/api/classes/${classId}`);
      if (!response.ok) throw new Error('Failed to load class');
      const data = await response.json();
      
      setClassContext({
        classId,
        className: data.class.name,
      });
      setViewMode('sections');
    } catch (err) {
      console.error('Error loading class:', err);
      setError('Failed to load class');
    }
  };

  const handleBackToClasses = () => {
    setClassContext(null);
    setViewMode('classes');
  };

  const handleNavigate = (view: 'classes' | 'problems' | 'sessions') => {
    if (view === 'problems') {
      setViewMode('problems');
      setProblemSubView('library'); // Reset to library view when navigating to problems
      setEditingProblemId(null); // Clear any editing state
    } else if (view === 'classes') {
      setClassContext(null);
      setViewMode('classes');
    } else if (view === 'sessions') {
      setViewMode('sessions');
    }
  };

  const handleCreateSession = (sectionId: string, sectionName: string) => {
    console.log('[handleCreateSession] Called', { sectionId, sectionName, isConnected });
    
    if (!isConnected) {
      console.error('[handleCreateSession] WebSocket not connected');
      alert('Not connected to server. Please wait for connection or refresh the page.');
      return;
    }

    console.log('[handleCreateSession] Setting state and sending message');
    setIsCreatingSession(true);
    setSessionContext({ sectionId, sectionName });
    setViewMode('session'); // Switch to session view to show "Creating session..." message
    sendMessage('CREATE_SESSION', { sectionId });
    console.log('[handleCreateSession] Message sent');
  };

  const handleJoinSession = (sessionId: string) => {
    if (!isConnected) {
      setError('Not connected to server');
      return;
    }

    sendMessage('JOIN_EXISTING_SESSION', { sessionId });
  };

  const handleLeaveSession = () => {
    // Navigate away from session view without ending the session
    // Session continues running in the background
    setSelectedStudentId(null);
    setSelectedStudentCode('');
    setExecutionResult(null);
    setRevisionViewerState(null);
    
    // Navigate based on context
    if (classContext) {
      setViewMode('sections');
    } else {
      setViewMode('classes');
    }
  };

  const handleEndSession = () => {
    if (!sessionId) {
      console.log('[handleEndSession] No sessionId, returning');
      return;
    }
    
    if (confirm('Are you sure you want to end this session? Students will be disconnected.')) {
      console.log('[handleEndSession] User confirmed, ending session:', sessionId);
      console.log('[handleEndSession] Current viewMode:', viewMode);
      console.log('[handleEndSession] classContext:', classContext);
      
      sendMessage('END_SESSION', { sessionId });
      
      // Determine navigation target
      const targetView = classContext ? 'sections' : 'classes';
      console.log('[handleEndSession] Target viewMode:', targetView);
      
      // Clear ALL session-related state immediately
      console.log('[handleEndSession] Clearing session state...');
      setSessionId(null);
      setJoinCode(null);
      setStudents([]);
      setSelectedStudentId(null);
      setSelectedStudentCode('');
      setExecutionResult(null);
      setRevisionViewerState(null);
      setSessionProblem(null);
      setSessionExecutionSettings({});
      setSessionContext(null);
      
      // Navigate based on context
      console.log('[handleEndSession] Setting viewMode to:', targetView);
      setViewMode(targetView);
      console.log('[handleEndSession] handleEndSession complete');
    } else {
      console.log('[handleEndSession] User cancelled');
    }
  };

  const handleOpenProblemLoader = () => {
    setShowProblemLoader(true);
  };

  const handleCloseProblemLoader = () => {
    setShowProblemLoader(false);
  };

  const handleProblemLoaded = (problemId: string) => {
    console.log('Problem loaded:', problemId);
    // The problem will be broadcast via WebSocket PROBLEM_UPDATE message
    // which will update the session state automatically
    setShowProblemLoader(false);
    // Could optionally show a success toast notification here
  };

  const handleUpdateProblem = (
    problem: { title: string; description: string; starterCode: string },
    executionSettings?: {
      stdin?: string;
      randomSeed?: number;
      attachedFiles?: Array<{ name: string; content: string }>;
    }
  ) => {
    if (!sessionId) return;
    // Update local state to keep in sync with server
    setSessionProblem(problem);
    setSessionExecutionSettings(executionSettings || {});
    sendMessage('UPDATE_PROBLEM', { sessionId, problem, executionSettings });
  };

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    setExecutionResult(null);
    
    sendMessage('REQUEST_STUDENT_CODE', {
      sessionId,
      studentId,
    });
  };

  const handleExecuteStudentCode = (stdin?: string) => {
    if (!selectedStudentId || !sessionId) return;
    
    setIsExecutingCode(true);
    setExecutionResult(null);
    
    sendMessage('EXECUTE_STUDENT_CODE', {
      sessionId,
      studentId: selectedStudentId,
      stdin,
    });
  };

  const handleViewRevisions = (studentId: string, studentName: string) => {
    setRevisionViewerState({
      studentId,
      studentName,
    });
  };

  const handleCloseRevisionViewer = () => {
    setRevisionViewerState(null);
  };

  const handleShowOnPublicView = (studentId: string) => {
    if (!sessionId) return;
    sendMessage('SELECT_SUBMISSION_FOR_PUBLIC', {
      sessionId,
      studentId,
    });
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
    } catch (err) {
      console.error('Sign out error:', err);
      setIsSigningOut(false);
    }
  };

  // Render different views based on mode
  const renderContent = () => {
    if (viewMode === 'classes') {
      return <ClassList onSelectClass={handleSelectClass} />;
    }

    if (viewMode === 'sections' && classContext) {
      return (
        <SectionView
          classId={classContext.classId}
          className={classContext.className}
          onBack={handleBackToClasses}
          onCreateSession={handleCreateSession}
          onJoinSession={handleJoinSession}
        />
      );
    }

    // Problems view with library/creator sub-views
    if (viewMode === 'problems') {
      if (problemSubView === 'creator') {
        return (
          <div className="max-w-4xl mx-auto">
            <button
              onClick={() => {
                setProblemSubView('library');
                setEditingProblemId(null);
              }}
              className="mb-4 text-blue-600 hover:text-blue-700 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Problem Library
            </button>
            <ProblemCreator
              problemId={editingProblemId}
              onProblemCreated={(id) => {
                console.log('Problem created:', id);
                setProblemSubView('library');
                setEditingProblemId(null);
              }}
              onCancel={() => {
                setProblemSubView('library');
                setEditingProblemId(null);
              }}
            />
          </div>
        );
      }

      return (
        <ProblemLibrary 
          onCreateNew={() => {
            setEditingProblemId(null);
            setProblemSubView('creator');
          }}
          onEdit={(problemId) => {
            setEditingProblemId(problemId);
            setProblemSubView('creator');
          }}
        />
      );
    }

    if (viewMode === 'sessions') {
      return (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <div className="max-w-md mx-auto">
            <span className="text-6xl mb-4 block">🎯</span>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">All Sessions</h2>
            <p className="text-gray-600 mb-6">
              View and manage all coding sessions across all your classes and sections.
            </p>
            <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4">
              <p className="font-semibold mb-2">Coming soon:</p>
              <ul className="text-left space-y-1">
                <li>• View all active sessions</li>
                <li>• Browse session history</li>
                <li>• Filter by class or section</li>
                <li>• Rejoin past sessions</li>
                <li>• Export session data</li>
              </ul>
            </div>
          </div>
        </div>
      );
    }

    if (viewMode === 'session') {
      // Show loading state while creating session
      if (isCreatingSession) {
        return (
          <div className="text-center py-12">
            <div className="inline-flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
              <div className="text-left">
                <p className="font-semibold text-blue-900">Creating session...</p>
                <p className="text-sm text-blue-700 mt-1">
                  {sessionContext?.sectionName || 'Setting up your session'}
                </p>
              </div>
            </div>
          </div>
        );
      }

      // Only render session content once we have sessionId and joinCode
      if (!sessionId || !joinCode) {
        return (
          <div className="text-center py-12">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-md mx-auto">
              <p className="font-semibold text-yellow-900">Waiting for session...</p>
              <p className="text-sm text-yellow-700 mt-2">
                If this persists, please refresh the page.
              </p>
            </div>
          </div>
        );
      }

      return (
        <div className="space-y-6">
          <SessionControls
            joinCode={joinCode}
            sessionId={sessionId}
            sectionName={sessionContext?.sectionName}
            onEndSession={handleEndSession}
            onLeaveSession={handleLeaveSession}
            onLoadProblem={handleOpenProblemLoader}
          />

          <ProblemInput
            onUpdateProblem={handleUpdateProblem}
            initialProblem={sessionProblem}
            initialExecutionSettings={sessionExecutionSettings}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <StudentList
              students={students}
              onSelectStudent={handleSelectStudent}
              onShowOnPublicView={handleShowOnPublicView}
              onViewHistory={handleViewRevisions}
            />

            {selectedStudentId && (
              <div>
                <div style={{ marginBottom: '1rem' }}>
                  <h3 style={{ margin: '0 0 0.5rem 0' }}>
                    {students.find(s => s.id === selectedStudentId)?.name || 'Student'}'s Code
                  </h3>
                </div>
                <CodeEditor
                  code={selectedStudentCode}
                  onChange={() => {}} // Read-only for instructor
                  onRun={handleExecuteStudentCode}
                  isRunning={isExecutingCode}
                  exampleInput={sessionExecutionSettings.stdin}
                  randomSeed={students.find(s => s.id === selectedStudentId)?.executionSettings?.randomSeed}
                  attachedFiles={students.find(s => s.id === selectedStudentId)?.executionSettings?.attachedFiles}
                  readOnly
                />
                {executionResult && (
                  <div style={{ marginTop: '1rem' }}>
                    <OutputPanel result={executionResult} />
                  </div>
                )}
              </div>
            )}
          </div>

          {revisionViewerState && (
            <RevisionViewer
              sessionId={sessionId}
              studentId={revisionViewerState.studentId}
              studentName={revisionViewerState.studentName}
              sendMessage={sendMessage}
              lastMessage={lastMessage}
              onClose={handleCloseRevisionViewer}
            />
          )}
          
          {showProblemLoader && (
            <ProblemLoader
              sessionId={sessionId}
              onProblemLoaded={handleProblemLoaded}
              onClose={handleCloseProblemLoader}
            />
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <ProtectedRoute requiredRole="instructor">
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Instructor Dashboard
                </h1>
                {user && (
                  <p className="text-sm text-gray-600 mt-1">
                    Signed in as {user.username}
                  </p>
                )}
              </div>
              
              <div className="flex items-center gap-4">
                {/* Connection status */}
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    isConnected ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                  <span className="text-sm text-gray-600">
                    {connectionStatus}
                  </span>
                </div>

                <button
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSigningOut ? 'Signing out...' : 'Sign Out'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Navigation */}
          <InstructorNav 
            currentView={viewMode}
            onNavigate={handleNavigate}
            activeSessionId={sessionId}
            onReturnToSession={() => setViewMode('session')}
          />

          {connectionError && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              <p className="font-semibold">Connection Error</p>
              <p className="text-sm">{connectionError}</p>
            </div>
          )}

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">Error</p>
                  <p className="text-sm">{error}</p>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="text-red-500 hover:text-red-700"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {isCreatingSession && (
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-700">
              <div className="flex items-center gap-3">
                <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                <span>Creating session...</span>
              </div>
            </div>
          )}

          {renderContent()}
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default InstructorPage;
