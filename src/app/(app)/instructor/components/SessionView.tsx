'use client';

/**
 * SessionView - Main session layout component for instructors.
 * Uses a tabbed interface where instructor can switch between:
 * - Students: Student list + code editor
 * - Problem Setup: Configure the session problem (full width for editor)
 * - AI Walkthrough: Generate AI analysis of submissions
 */

import React, { useState, useCallback } from 'react';
import SessionControls from './SessionControls';
import { SessionStudentPane } from './SessionStudentPane';
import { ProblemSetupPanel } from './ProblemSetupPanel';
import { WalkthroughPanelWrapper } from './WalkthroughPanelWrapper';
import RevisionViewer from './RevisionViewer';
import ProblemLoader from './ProblemLoader';
import { Tabs } from '@/components/ui/Tabs';
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
  /** ID of the currently featured student */
  featuredStudentId?: string | null;
}

type SessionTab = 'students' | 'problem' | 'walkthrough';

/**
 * SessionView provides the main layout for an active instructor session.
 *
 * Layout:
 * - Header: SessionControls (join code, end/leave buttons)
 * - Tabs: Students | Problem Setup | AI Walkthrough
 * - Content: Full-width content for selected tab
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
  featuredStudentId,
}: SessionViewProps) {
  // Tab state
  const [activeTab, setActiveTab] = useState<SessionTab>('students');

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
    <div className="space-y-4" data-testid="session-view">
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

      {/* Tabbed Content Area */}
      <Tabs activeTab={activeTab} onTabChange={(tab) => setActiveTab(tab as SessionTab)}>
        <Tabs.List className="px-1">
          <Tabs.Tab tabId="students">
            Students ({students.length})
          </Tabs.Tab>
          <Tabs.Tab tabId="problem">
            Problem Setup
          </Tabs.Tab>
          <Tabs.Tab tabId="walkthrough">
            AI Walkthrough
          </Tabs.Tab>
        </Tabs.List>

        {/* Students Tab - Student list + code editor */}
        <Tabs.Panel tabId="students" className="pt-4">
          <SessionStudentPane
            students={students}
            realtimeStudents={realtimeStudents}
            sessionProblem={sessionProblem}
            sessionExecutionSettings={sessionExecutionSettings}
            joinCode={joinCode || undefined}
            onShowOnPublicView={onFeatureStudent}
            onViewHistory={handleViewRevisions}
            onExecuteCode={handleExecuteCode}
            featuredStudentId={featuredStudentId}
          />
        </Tabs.Panel>

        {/* Problem Setup Tab - Full width for editor */}
        <Tabs.Panel tabId="problem" className="pt-4">
          <ProblemSetupPanel
            onUpdateProblem={onUpdateProblem}
            initialProblem={sessionProblem}
            initialExecutionSettings={sessionExecutionSettings}
            isFullWidth
          />
        </Tabs.Panel>

        {/* AI Walkthrough Tab */}
        <Tabs.Panel tabId="walkthrough" className="pt-4">
          <WalkthroughPanelWrapper
            sessionId={sessionId}
            onFeatureStudent={onFeatureStudent}
            studentCount={students.length}
            isFullWidth
          />
        </Tabs.Panel>
      </Tabs>

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
