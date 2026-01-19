'use client';

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRealtimeSession } from '@/hooks/useRealtimeSession';
import { useSessionOperations } from '@/hooks/useSessionOperations';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import NamespaceHeader from '@/components/NamespaceHeader';
import { ErrorAlert } from '@/components/ErrorAlert';
import ClassList from './components/ClassList';
import SectionView from './components/SectionView';
import SessionControls from './components/SessionControls';
import StudentList from './components/StudentList';
import CodeEditor from '@/app/student/components/CodeEditor';
import { EditorContainer } from '@/app/student/components/EditorContainer';
import OutputPanel from '@/app/student/components/OutputPanel';
import RevisionViewer from './components/RevisionViewer';
import InstructorNav from './components/InstructorNav';
import ProblemLibrary from './components/ProblemLibrary';
import ProblemCreator from './components/ProblemCreator';
import ProblemLoader from './components/ProblemLoader';
import SessionsList from './components/SessionsList';
import SessionDetails from './components/SessionDetails';
import { Problem, ExecutionSettings } from '@/server/types/problem';
import SessionProblemEditor from './components/SessionProblemEditor';
import WalkthroughPanel from './components/WalkthroughPanel';
import { Breadcrumb, BreadcrumbItem } from '@/components/ui/Breadcrumb';

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

type ViewMode = 'classes' | 'sections' | 'problems' | 'sessions' | 'session' | 'details';

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

  // Navigation state - initialize viewMode from URL if present
  const initialView = (searchParams.get('view') as ViewMode) || 'classes';
  const [viewMode, setViewMode] = useState<ViewMode>(initialView);
  const [classContext, setClassContext] = useState<ClassContext | null>(null);
  const [sessionContext, setSessionContext] = useState<SessionContext | null>(null);
  const [problemSubView, setProblemSubView] = useState<'library' | 'creator'>('library');
  const [editingProblemId, setEditingProblemId] = useState<string | null>(null);
  const [detailsSessionId, setDetailsSessionId] = useState<string | null>(null);

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState<string | null>(null);
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

  // Session tab state for instructor session view
  const [sessionTab, setSessionTab] = useState<'problem' | 'students' | 'walkthrough'>('problem');

  // Refresh trigger for SessionsList (increment to force refresh)
  const [sessionsListRefreshTrigger, setSessionsListRefreshTrigger] = useState(0);

  // Session execution settings
  const [sessionProblem, setSessionProblem] = useState<Problem | null>(null);
  const [sessionExecutionSettings, setSessionExecutionSettings] = useState<{
    stdin?: string;
    randomSeed?: number;
    attachedFiles?: Array<{ name: string; content: string }>;
  }>({});

  // Realtime session hook
  const {
    session: realtimeSession,
    students: realtimeStudents,
    featuredStudent,
    isConnected,
    connectionStatus,
    connectionError,
    executeCode,
    featureStudent,
  } = useRealtimeSession({
    sessionId: sessionId || '',
    userId: user?.id,
    userName: user?.username,
  });

  // Session operations hook
  const {
    createSession: apiCreateSession,
    endSession: apiEndSession,
    loadProblem: apiLoadProblem,
    updateProblem: apiUpdateProblem,
    loading: operationsLoading,
    error: operationsError,
  } = useSessionOperations();

  // Derive students array from realtime data
  const students = useMemo(() =>
    realtimeStudents.map(s => ({
      id: s.id,
      name: s.name,
      hasCode: !!s.code,
      executionSettings: {
        randomSeed: s.executionSettings?.randomSeed,
        stdin: s.executionSettings?.stdin,
        attachedFiles: s.executionSettings?.attachedFiles,
      },
    })),
    [realtimeStudents]
  );

  // Build breadcrumb items based on current view and context
  const breadcrumbItems = useMemo((): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [];

    // Handle problem creator view (no breadcrumbs)
    if (viewMode === 'problems' && problemSubView === 'creator') {
      return [];
    }

    // Add Classes as root for class-based navigation
    if (viewMode === 'classes' || viewMode === 'sections' || viewMode === 'session') {
      if (viewMode === 'classes') {
        items.push({ label: 'Classes' });
      } else {
        items.push({ label: 'Classes', href: '/instructor?view=classes' });
      }
    }

    // Add Problems as root for problem library navigation
    if (viewMode === 'problems') {
      items.push({ label: 'Problems' });
    }

    // Add Sessions as root for sessions navigation
    if (viewMode === 'sessions' || viewMode === 'details') {
      if (viewMode === 'sessions') {
        items.push({ label: 'Sessions' });
      } else {
        items.push({ label: 'Sessions', href: '/instructor?view=sessions' });
      }
    }

    // Add class name if we have class context
    if (classContext && (viewMode === 'sections' || viewMode === 'session')) {
      if (viewMode === 'sections') {
        items.push({ label: classContext.className });
      } else {
        items.push({ label: classContext.className, href: '/instructor?view=sections' });
      }
    }

    // Add section name for active session
    if (sessionContext && viewMode === 'session') {
      items.push({ label: sessionContext.sectionName });
    }

    // Add Session Details for details view
    if (viewMode === 'details') {
      items.push({ label: 'Session Details' });
    }

    return items;
  }, [viewMode, classContext, sessionContext, problemSubView]);

  // Update URL when viewMode changes to preserve on refresh
  useEffect(() => {
    if (viewMode && viewMode !== 'session') {
      const url = new URL(window.location.href);
      url.searchParams.set('view', viewMode);
      router.replace(url.pathname + url.search, { scroll: false });
    }
  }, [viewMode, router]);

  // Sync state from Realtime session
  useEffect(() => {
    if (!realtimeSession) return;

    // Update local state from Realtime
    setSessionProblem(realtimeSession.problem || null);
    setSessionExecutionSettings(realtimeSession.problem?.executionSettings || {});
    // Note: joinCode comes from section, not session - already set when creating session
  }, [realtimeSession]);

  // Update selected student code when realtime students change
  useEffect(() => {
    if (!selectedStudentId) return;

    const student = realtimeStudents.find(s => s.id === selectedStudentId);
    if (student) {
      setSelectedStudentCode(student.code || '');
    }
  }, [realtimeStudents, selectedStudentId]);

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

  const handleCreateSession = async (sectionId: string, sectionName: string) => {
    // Check if instructor already has an active session
    if (sessionId) {
      const message = 'You already have an active session running. Please end your current session before starting a new one.';
      alert(message);
      setError(message);
      return;
    }

    setIsCreatingSession(true);
    setSessionContext({ sectionId, sectionName });
    setViewMode('session'); // Switch to session view to show "Creating session..." message

    try {
      const session = await apiCreateSession(sectionId, sectionName);
      setSessionId(session.id);
      setJoinCode(session.joinCode);
      setSessionProblem(session.problem || null);
      setSessionExecutionSettings(session.problem?.executionSettings || {});
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to create session');
      setViewMode(classContext ? 'sections' : 'classes');
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleJoinSession = (sessionId: string) => {
    // With Realtime, just set the sessionId and the hook will subscribe
    setSessionId(sessionId);
    setViewMode('session');
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

  const handleEndSession = async () => {
    if (!sessionId) {
      return;
    }

    // Determine navigation target based on where we came from
    const targetView = viewMode === 'sessions' ? 'sessions' : (classContext ? 'sections' : 'classes');

    try {
      await apiEndSession(sessionId);

      // Clear sessionId from URL and set the correct view parameter
      router.replace(`/instructor?view=${targetView}`);

      // Clear ALL session-related state immediately
      setSessionId(null);
      setJoinCode(null);
      setSelectedStudentId(null);
      setSelectedStudentCode('');
      setExecutionResult(null);
      setRevisionViewerState(null);
      setSessionProblem(null);
      setSessionExecutionSettings({});
      setSessionContext(null);

      // Navigate based on context
      setViewMode(targetView);
    } catch (err: any) {
      setError(err.message || 'Failed to end session');
    }
  };

  const handleOpenProblemLoader = () => {
    setShowProblemLoader(true);
  };

  const handleCloseProblemLoader = () => {
    setShowProblemLoader(false);
  };

  const handleProblemLoaded = (problemId: string) => {
    // The problem will be broadcast via WebSocket PROBLEM_UPDATE message
    // which will update the session state automatically
    setShowProblemLoader(false);
    // Could optionally show a success toast notification here
  };

  const handleUpdateProblem = async (
    problem: { title: string; description: string; starterCode: string },
    executionSettings?: {
      stdin?: string;
      randomSeed?: number;
      attachedFiles?: Array<{ name: string; content: string }>;
    }
  ) => {
    if (!sessionId) return;

    try {
      await apiUpdateProblem(sessionId, problem, executionSettings);
      // State updates automatically via Realtime subscription
    } catch (err: any) {
      setError(err.message || 'Failed to update problem');
    }
  };

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    setExecutionResult(null);
    // Code will be automatically updated from realtimeStudents via useEffect
  };

  const handleExecuteStudentCode = async (executionSettings: ExecutionSettings) => {
    if (!selectedStudentId || !sessionId) return;

    setIsExecutingCode(true);
    setExecutionResult(null);

    try {
      const result = await executeCode(selectedStudentId, selectedStudentCode, executionSettings);
      setExecutionResult(result);
    } catch (err: any) {
      setError(err.message || 'Failed to execute code');
    } finally {
      setIsExecutingCode(false);
    }
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

  const handleShowOnPublicView = async (studentId: string) => {
    if (!sessionId) return;

    try {
      await featureStudent(studentId);
      // State updates automatically via Realtime
    } catch (err: any) {
      setError(err.message || 'Failed to feature student');
    }
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
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <ProblemCreator
              problemId={editingProblemId}
              onProblemCreated={(id) => {
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
        <SessionsList
          refreshTrigger={sessionsListRefreshTrigger}
          onRejoinSession={(sessionIdToJoin) => {
            // With Realtime, just set the sessionId and navigate
            setSessionId(sessionIdToJoin);
            setViewMode('session');
          }}
          onEndSession={async (sessionIdToEnd) => {
            try {
              await apiEndSession(sessionIdToEnd);
              // Trigger refresh of sessions list
              setSessionsListRefreshTrigger(prev => prev + 1);
            } catch (err: any) {
              alert(`Failed to end session: ${err.message || 'Unknown error'}`);
            }
          }}
          onViewDetails={(sessionId) => {
            // Navigate to details view for completed sessions
            setDetailsSessionId(sessionId);
            setViewMode('details');
          }}
        />
      );
    }

    if (viewMode === 'details' && detailsSessionId) {
      return (
        <SessionDetails
          sessionId={detailsSessionId}
          onClose={() => {
            setViewMode('sessions');
            setDetailsSessionId(null);
          }}
        />
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

      // Only render session content once we have sessionId
      if (!sessionId) {
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
            sessionId={sessionId}
            sectionName={sessionContext?.sectionName}
            joinCode={joinCode || undefined}
            connectedStudentCount={students.length}
            onEndSession={handleEndSession}
            onLeaveSession={handleLeaveSession}
            onLoadProblem={handleOpenProblemLoader}
          />

          {/* Tabbed Interface */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* Tab Headers */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setSessionTab('problem')}
                className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                  sessionTab === 'problem'
                    ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                📝 Problem Setup
              </button>
              <button
                onClick={() => setSessionTab('students')}
                className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                  sessionTab === 'students'
                    ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                👥 Student Code {students.length > 0 && `(${students.length})`}
              </button>
              <button
                onClick={() => setSessionTab('walkthrough')}
                className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                  sessionTab === 'walkthrough'
                    ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                🤖 AI Walkthrough
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {sessionTab === 'problem' && (
                <SessionProblemEditor
                  onUpdateProblem={handleUpdateProblem}
                  initialProblem={sessionProblem}
                  initialExecutionSettings={sessionExecutionSettings}
                />
              )}
              {sessionTab === 'students' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <StudentList
                    students={students}
                    onSelectStudent={handleSelectStudent}
                    onShowOnPublicView={handleShowOnPublicView}
                    onViewHistory={handleViewRevisions}
                    joinCode={joinCode || undefined}
                  />

                  {selectedStudentId && (
                    <div>
                      <div style={{ marginBottom: '1rem' }}>
                        <h3 style={{ margin: '0 0 0.5rem 0' }}>
                          {students.find(s => s.id === selectedStudentId)?.name || 'Student'}'s Code
                        </h3>
                      </div>
                      <EditorContainer height="500px">
                        <CodeEditor
                          code={selectedStudentCode}
                          onChange={() => {}} // Read-only for instructor
                          onRun={handleExecuteStudentCode}
                          isRunning={isExecutingCode}
                          exampleInput={sessionExecutionSettings.stdin}
                          randomSeed={students.find(s => s.id === selectedStudentId)?.executionSettings?.randomSeed}
                          attachedFiles={students.find(s => s.id === selectedStudentId)?.executionSettings?.attachedFiles}
                          readOnly
                          problem={sessionProblem}
                        />
                      </EditorContainer>
                      {executionResult && (
                        <div style={{ marginTop: '1rem' }}>
                          <OutputPanel result={executionResult} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {sessionTab === 'walkthrough' && sessionId && (
                <WalkthroughPanel
                  sessionId={sessionId}
                  onFeatureStudent={handleShowOnPublicView}
                  studentCount={students.length}
                />
              )}
            </div>
          </div>

          {revisionViewerState && (
            <RevisionViewer
              sessionId={sessionId}
              studentId={revisionViewerState.studentId}
              studentName={revisionViewerState.studentName}
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
          <div style={{ maxWidth: viewMode === 'problems' && problemSubView === 'creator' ? 'none' : '80rem', margin: '0 auto', padding: '1rem' }}>
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Instructor Dashboard
                </h1>
                <div className="flex items-center gap-3 mt-1">
                  {user && (
                    <p className="text-sm text-gray-600">
                      Signed in as {user.username}
                    </p>
                  )}
                  <NamespaceHeader className="text-sm" />
                </div>
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
        <div style={{ width: '100%', height: 'calc(100vh - 5rem)', display: 'flex', flexDirection: 'column', padding: viewMode === 'problems' && problemSubView === 'creator' ? '0' : '2rem 1rem' }}>
          {/* Navigation */}
          {!(viewMode === 'problems' && problemSubView === 'creator') && (
            <InstructorNav
              currentView={viewMode}
              onNavigate={handleNavigate}
              activeSessionId={sessionId}
              onReturnToSession={() => setViewMode('session')}
            />
          )}

          {/* Breadcrumb navigation */}
          {breadcrumbItems.length > 0 && (
            <Breadcrumb
              items={breadcrumbItems}
              separator="/"
              className="mb-4 px-1"
            />
          )}

          {connectionError && (
            <ErrorAlert
              error={connectionError}
              title="Connection Error"
              variant="warning"
              className="mb-6"
              showHelpText={true}
            />
          )}

          {error && (
            <ErrorAlert
              error={error}
              onDismiss={() => setError(null)}
              className="mb-6"
              showHelpText={true}
            />
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

export default function InstructorPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <InstructorPage />
    </Suspense>
  );
}
