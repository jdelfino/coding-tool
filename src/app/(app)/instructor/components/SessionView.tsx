'use client';

/**
 * SessionView - Main session layout component for instructors.
 * Replaces the tabbed interface with a panel-based layout where:
 * - Left: Student list + code editor (always visible)
 * - Right: Collapsible panels for Problem Setup and AI Walkthrough
 */

import React, { useState, useCallback } from 'react';
import SessionControls from './SessionControls';
import { SessionStudentPane } from './SessionStudentPane';
import { ProblemSetupPanel } from './ProblemSetupPanel';
import { WalkthroughPanelWrapper } from './WalkthroughPanelWrapper';
import RevisionViewer from './RevisionViewer';
import ProblemLoader from './ProblemLoader';
import { RightPanelContainer } from '@/components/layout';
import { Problem, ExecutionSettings } from '@/server/types/problem';

interface Student {
  id: string;
  name: string;
  hasCode: boolean;
  executionSettings?: {
    randomSeed?: number;
    stdin?: string;
    attachedFiles?: Array<{ name: string; content: string }>;
  };
}

interface RealtimeStudent {
  id: string;
  name: string;
  code?: string;
  executionSettings?: {
    randomSeed?: number;
    stdin?: string;
    attachedFiles?: Array<{ name: string; content: string }>;
  };
}

interface SessionContext {
  sectionId: string;
  sectionName: string;
}

interface ExecutionResult {
  success: boolean;
  output: string;
  error: string;
  executionTime: number;
}

interface SessionViewProps {
  /** Current session ID */
  sessionId: string;
  /** Join code for the session */
  joinCode: string | null;
  /** Session context (section info) */
  sessionContext: SessionContext | null;
  /** Derived students from realtime data */
  students: Student[];
  /** Raw realtime students with code */
  realtimeStudents: RealtimeStudent[];
  /** Current session problem */
  sessionProblem: Problem | null;
  /** Session execution settings */
  sessionExecutionSettings: {
    stdin?: string;
    randomSeed?: number;
    attachedFiles?: Array<{ name: string; content: string }>;
  };
  /** Callback to end the session */
  onEndSession: () => Promise<void>;
  /** Callback to leave (but not end) the session */
  onLeaveSession: () => void;
  /** Callback to update problem */
  onUpdateProblem: (
    problem: { title: string; description: string; starterCode: string },
    executionSettings?: {
      stdin?: string;
      randomSeed?: number;
      attachedFiles?: Array<{ name: string; content: string }>;
    }
  ) => Promise<void>;
  /** Callback to feature a student on public view */
  onFeatureStudent: (studentId: string) => Promise<void>;
  /** Callback to execute student code */
  executeCode: (
    studentId: string,
    code: string,
    executionSettings: ExecutionSettings
  ) => Promise<ExecutionResult>;
  /** Callback when problem is loaded from library */
  onProblemLoaded?: (problemId: string) => void;
}

/**
 * SessionView provides the main layout for an active instructor session.
 *
 * Layout:
 * - Header: SessionControls (join code, end/leave buttons)
 * - Main area: SessionStudentPane (student list + code editor)
 * - Right sidebar: Collapsible panels for problem setup and AI walkthrough
 */
export function SessionView({
  sessionId,
  joinCode,
  sessionContext,
  students,
  realtimeStudents,
  sessionProblem,
  sessionExecutionSettings,
  onEndSession,
  onLeaveSession,
  onUpdateProblem,
  onFeatureStudent,
  executeCode,
  onProblemLoaded,
}: SessionViewProps) {
  // Modal states
  const [revisionViewerState, setRevisionViewerState] = useState<{
    studentId: string;
    studentName: string;
  } | null>(null);
  const [showProblemLoader, setShowProblemLoader] = useState(false);

  // Handlers for student pane
  const handleViewRevisions = useCallback((studentId: string, studentName: string) => {
    setRevisionViewerState({ studentId, studentName });
  }, []);

  const handleCloseRevisionViewer = useCallback(() => {
    setRevisionViewerState(null);
  }, []);

  const handleOpenProblemLoader = useCallback(() => {
    setShowProblemLoader(true);
  }, []);

  const handleCloseProblemLoader = useCallback(() => {
    setShowProblemLoader(false);
  }, []);

  const handleProblemLoaded = useCallback((problemId: string) => {
    setShowProblemLoader(false);
    onProblemLoaded?.(problemId);
  }, [onProblemLoaded]);

  const handleExecuteCode = useCallback(async (
    studentId: string,
    code: string,
    settings: ExecutionSettings
  ): Promise<ExecutionResult | undefined> => {
    try {
      return await executeCode(studentId, code, settings);
    } catch (error) {
      console.error('Error executing code:', error);
      return undefined;
    }
  }, [executeCode]);

  return (
    <div className="flex flex-col xl:flex-row gap-6" data-testid="session-view">
      {/* Main content area */}
      <div className="flex-1 space-y-6 min-w-0">
        {/* Session Controls Header */}
        <SessionControls
          sessionId={sessionId}
          sectionName={sessionContext?.sectionName}
          joinCode={joinCode || undefined}
          connectedStudentCount={students.length}
          onEndSession={onEndSession}
          onLeaveSession={onLeaveSession}
          onLoadProblem={handleOpenProblemLoader}
        />

        {/* Student List + Code Editor */}
        <SessionStudentPane
          students={students}
          realtimeStudents={realtimeStudents}
          sessionProblem={sessionProblem}
          sessionExecutionSettings={sessionExecutionSettings}
          joinCode={joinCode || undefined}
          onShowOnPublicView={onFeatureStudent}
          onViewHistory={handleViewRevisions}
          onExecuteCode={handleExecuteCode}
        />
      </div>

      {/* Right Panel Container - Hidden on mobile */}
      <div className="hidden xl:block flex-shrink-0">
        <RightPanelContainer>
          <ProblemSetupPanel
            onUpdateProblem={onUpdateProblem}
            initialProblem={sessionProblem}
            initialExecutionSettings={sessionExecutionSettings}
          />
          <WalkthroughPanelWrapper
            sessionId={sessionId}
            onFeatureStudent={onFeatureStudent}
            studentCount={students.length}
          />
        </RightPanelContainer>
      </div>

      {/* Mobile panels - shown inline on smaller screens */}
      <div className="xl:hidden space-y-4">
        <ProblemSetupPanel
          onUpdateProblem={onUpdateProblem}
          initialProblem={sessionProblem}
          initialExecutionSettings={sessionExecutionSettings}
        />
        <WalkthroughPanelWrapper
          sessionId={sessionId}
          onFeatureStudent={onFeatureStudent}
          studentCount={students.length}
        />
      </div>

      {/* Modals */}
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
