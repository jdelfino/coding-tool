'use client';

/**
 * SessionStudentPane - Combined student list and code editor pane.
 * Displays the student list on the left and selected student's code on the right.
 */

import React, { useState, useEffect } from 'react';
import StudentList from './StudentList';
import CodeEditor from '@/app/(fullscreen)/student/components/CodeEditor';
import { EditorContainer } from '@/app/(fullscreen)/student/components/EditorContainer';
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

interface ExecutionResult {
  success: boolean;
  output: string;
  error: string;
  executionTime: number;
}

interface SessionStudentPaneProps {
  /** List of students in the session (derived from realtimeStudents) */
  students: Student[];
  /** Raw realtime students for code access */
  realtimeStudents: RealtimeStudent[];
  /** Current session problem */
  sessionProblem: Problem | null;
  /** Session execution settings */
  sessionExecutionSettings: {
    stdin?: string;
    randomSeed?: number;
    attachedFiles?: Array<{ name: string; content: string }>;
  };
  /** Join code for the session */
  joinCode?: string;
  /** Callback when a student is selected */
  onSelectStudent?: (studentId: string) => void;
  /** Callback to show student on public view */
  onShowOnPublicView?: (studentId: string) => void;
  /** Callback to view student history */
  onViewHistory?: (studentId: string, studentName: string) => void;
  /** Callback to execute student code */
  onExecuteCode?: (studentId: string, code: string, settings: ExecutionSettings) => Promise<ExecutionResult | undefined>;
}

/**
 * SessionStudentPane displays students and their code in a two-column layout.
 * Left: Student list with actions
 * Right: Read-only code editor showing selected student's code
 */
export function SessionStudentPane({
  students,
  realtimeStudents,
  sessionProblem,
  sessionExecutionSettings,
  joinCode,
  onSelectStudent,
  onShowOnPublicView,
  onViewHistory,
  onExecuteCode,
}: SessionStudentPaneProps) {
  // Local state for student selection and code
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedStudentCode, setSelectedStudentCode] = useState<string>('');
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [isExecutingCode, setIsExecutingCode] = useState(false);

  // Update selected student code when realtime data changes
  useEffect(() => {
    if (!selectedStudentId) return;

    const student = realtimeStudents.find(s => s.id === selectedStudentId);
    if (student) {
      setSelectedStudentCode(student.code || '');
    }
  }, [realtimeStudents, selectedStudentId]);

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    setExecutionResult(null);
    onSelectStudent?.(studentId);
  };

  const handleExecuteStudentCode = async (executionSettings: ExecutionSettings) => {
    if (!selectedStudentId || !onExecuteCode) return;

    setIsExecutingCode(true);
    setExecutionResult(null);

    try {
      const result = await onExecuteCode(selectedStudentId, selectedStudentCode, executionSettings);
      if (result) {
        setExecutionResult(result);
      }
    } finally {
      setIsExecutingCode(false);
    }
  };

  const selectedStudent = students.find(s => s.id === selectedStudentId);

  return (
    <div className="flex flex-col lg:flex-row gap-4" data-testid="session-student-pane">
      {/* Student List - Left Panel */}
      <div className="lg:w-1/3 flex-shrink-0">
        <StudentList
          students={students}
          onSelectStudent={handleSelectStudent}
          onShowOnPublicView={onShowOnPublicView}
          onViewHistory={onViewHistory}
          joinCode={joinCode}
        />
      </div>

      {/* Code Editor - Right Panel */}
      <div className="lg:w-2/3 flex-1">
        {selectedStudentId ? (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
              <h3 className="text-sm font-medium text-gray-900 m-0">
                {selectedStudent?.name || 'Student'}'s Code
              </h3>
            </div>
            <EditorContainer height="500px">
              <CodeEditor
                code={selectedStudentCode}
                onChange={() => {}} // Read-only for instructor
                onRun={handleExecuteStudentCode}
                isRunning={isExecutingCode}
                exampleInput={sessionExecutionSettings.stdin}
                randomSeed={selectedStudent?.executionSettings?.randomSeed}
                attachedFiles={selectedStudent?.executionSettings?.attachedFiles}
                readOnly
                problem={sessionProblem}
                executionResult={executionResult}
              />
            </EditorContainer>
          </div>
        ) : (
          <div
            className="bg-gray-50 border border-gray-200 rounded-lg shadow-sm p-8 flex items-center justify-center min-h-[500px]"
            data-testid="no-student-selected"
          >
            <div className="text-center text-gray-500">
              <svg
                className="h-12 w-12 mx-auto mb-4 text-gray-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z"
                />
              </svg>
              <p className="text-lg font-medium">Select a student to view their code</p>
              <p className="text-sm mt-1">
                Click "View Code" next to a student's name in the list
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
