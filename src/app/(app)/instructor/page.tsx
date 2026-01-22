'use client';

/**
 * Instructor Page
 *
 * Main instructor dashboard with navigation between:
 * - Classes (default view)
 * - Sections (within a class)
 * - Problems library
 * - Sessions list
 * - Session details
 * - Active session view (using SessionView component)
 */

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRealtimeSession } from '@/hooks/useRealtimeSession';
import { useSessionOperations } from '@/hooks/useSessionOperations';
import { useAuth } from '@/contexts/AuthContext';
import NamespaceHeader from '@/components/NamespaceHeader';
import { ErrorAlert } from '@/components/ErrorAlert';
import ClassList from './components/ClassList';
import SectionView from './components/SectionView';
import ProblemLibrary from './components/ProblemLibrary';
import ProblemCreator from './components/ProblemCreator';
import SessionsList from './components/SessionsList';
import SessionDetails from './components/SessionDetails';
import { SessionView } from './components/SessionView';
import { Problem, ExecutionSettings } from '@/server/types/problem';
import { Breadcrumb, BreadcrumbItem } from '@/components/ui/Breadcrumb';

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
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Navigation state - sync with URL searchParams
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (searchParams.get('view') as ViewMode) || 'classes';
  });

  // Sync viewMode when URL changes (e.g., from sidebar navigation)
  useEffect(() => {
    const urlView = (searchParams.get('view') as ViewMode) || 'classes';
    if (urlView !== viewMode) {
      setViewMode(urlView);
    }
  }, [searchParams]);
  const [classContext, setClassContext] = useState<ClassContext | null>(null);
  const [sessionContext, setSessionContext] = useState<SessionContext | null>(null);
  const [problemSubView, setProblemSubView] = useState<'library' | 'creator'>('library');
  const [editingProblemId, setEditingProblemId] = useState<string | null>(null);
  const [detailsSessionId, setDetailsSessionId] = useState<string | null>(null);

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  // Refresh trigger for SessionsList
  const [sessionsListRefreshTrigger, setSessionsListRefreshTrigger] = useState(0);

  // Session problem state (synced from realtime)
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
    isConnected,
    connectionStatus,
    connectionError,
    executeCode,
    featureStudent,
  } = useRealtimeSession({
    sessionId: sessionId || '',
    userId: user?.id,
    userName: user?.displayName || user?.email,
  });

  // Session operations hook
  const {
    createSession: apiCreateSession,
    endSession: apiEndSession,
    updateProblem: apiUpdateProblem,
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

  // Build breadcrumb items
  const breadcrumbItems = useMemo((): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [];

    if (viewMode === 'problems' && problemSubView === 'creator') {
      return [];
    }

    if (viewMode === 'classes' || viewMode === 'sections' || viewMode === 'session') {
      if (viewMode === 'classes') {
        items.push({ label: 'Classes' });
      } else {
        items.push({ label: 'Classes', href: '/instructor?view=classes' });
      }
    }

    if (viewMode === 'problems') {
      items.push({ label: 'Problems' });
    }

    if (viewMode === 'sessions' || viewMode === 'details') {
      if (viewMode === 'sessions') {
        items.push({ label: 'Sessions' });
      } else {
        items.push({ label: 'Sessions', href: '/instructor?view=sessions' });
      }
    }

    if (classContext && (viewMode === 'sections' || viewMode === 'session')) {
      if (viewMode === 'sections') {
        items.push({ label: classContext.className });
      } else {
        items.push({ label: classContext.className, href: '/instructor?view=sections' });
      }
    }

    if (sessionContext && viewMode === 'session') {
      items.push({ label: sessionContext.sectionName });
    }

    if (viewMode === 'details') {
      items.push({ label: 'Session Details' });
    }

    return items;
  }, [viewMode, classContext, sessionContext, problemSubView]);

  // Update URL when viewMode changes
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
    setSessionProblem(realtimeSession.problem || null);
    setSessionExecutionSettings(realtimeSession.problem?.executionSettings || {});
  }, [realtimeSession]);

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

  const handleCreateSession = async (sectionId: string, sectionName: string) => {
    if (sessionId) {
      const message = 'You already have an active session running. Please end your current session before starting a new one.';
      alert(message);
      setError(message);
      return;
    }

    setIsCreatingSession(true);
    setSessionContext({ sectionId, sectionName });
    setViewMode('session');

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

  const handleJoinSession = (sessionIdToJoin: string) => {
    setSessionId(sessionIdToJoin);
    setViewMode('session');
  };

  const handleLeaveSession = () => {
    if (classContext) {
      setViewMode('sections');
    } else {
      setViewMode('classes');
    }
  };

  const handleEndSession = async () => {
    if (!sessionId) return;

    const targetView = viewMode === 'sessions' ? 'sessions' : (classContext ? 'sections' : 'classes');

    try {
      await apiEndSession(sessionId);
      router.replace(`/instructor?view=${targetView}`);

      setSessionId(null);
      setJoinCode(null);
      setSessionProblem(null);
      setSessionExecutionSettings({});
      setSessionContext(null);
      setViewMode(targetView);
    } catch (err: any) {
      setError(err.message || 'Failed to end session');
    }
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
    } catch (err: any) {
      setError(err.message || 'Failed to update problem');
    }
  };

  const handleFeatureStudent = async (studentId: string) => {
    if (!sessionId) return;

    try {
      await featureStudent(studentId);
    } catch (err: any) {
      setError(err.message || 'Failed to feature student');
    }
  };

  const handleExecuteCode = async (
    studentId: string,
    code: string,
    executionSettings: ExecutionSettings
  ) => {
    return executeCode(studentId, code, executionSettings);
  };

  // Render content based on view mode
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

    if (viewMode === 'problems') {
      if (problemSubView === 'creator') {
        // Use calc to fill available height (viewport - header 56px - main padding 48px)
        return (
          <div style={{ width: '100%', height: 'calc(100vh - 104px)', display: 'flex', flexDirection: 'column' }}>
            <ProblemCreator
              problemId={editingProblemId}
              onProblemCreated={() => {
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
            setSessionId(sessionIdToJoin);
            setViewMode('session');
          }}
          onEndSession={async (sessionIdToEnd) => {
            try {
              await apiEndSession(sessionIdToEnd);
              setSessionsListRefreshTrigger(prev => prev + 1);
            } catch (err: any) {
              alert(`Failed to end session: ${err.message || 'Unknown error'}`);
            }
          }}
          onViewDetails={(id) => {
            setDetailsSessionId(id);
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
        <SessionView
          sessionId={sessionId}
          joinCode={joinCode}
          sessionContext={sessionContext}
          students={students}
          realtimeStudents={realtimeStudents}
          sessionProblem={sessionProblem}
          sessionExecutionSettings={sessionExecutionSettings}
          onEndSession={handleEndSession}
          onLeaveSession={handleLeaveSession}
          onUpdateProblem={handleUpdateProblem}
          onFeatureStudent={handleFeatureStudent}
          executeCode={handleExecuteCode}
        />
      );
    }

    return null;
  };

  return (
    <div className="space-y-6" style={{ padding: viewMode === 'problems' && problemSubView === 'creator' ? '0' : undefined }}>
      {/* Page header */}
      {!(viewMode === 'problems' && problemSubView === 'creator') && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <NamespaceHeader className="text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-600">{connectionStatus}</span>
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      {breadcrumbItems.length > 0 && (
        <Breadcrumb items={breadcrumbItems} separator="/" className="px-1" />
      )}

      {/* Errors */}
      {connectionError && (
        <ErrorAlert error={connectionError} title="Connection Error" variant="warning" showHelpText={true} />
      )}

      {error && (
        <ErrorAlert error={error} onDismiss={() => setError(null)} showHelpText={true} />
      )}

      {isCreatingSession && viewMode !== 'session' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-700">
          <div className="flex items-center gap-3">
            <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
            <span>Creating session...</span>
          </div>
        </div>
      )}

      {renderContent()}
    </div>
  );
}

export default function InstructorPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <InstructorPage />
    </Suspense>
  );
}
