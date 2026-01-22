'use client';

/**
 * ProblemSetupPanel - Collapsible panel wrapper for SessionProblemEditor.
 * Uses the Panel component from the layout system.
 */

import React from 'react';
import { Panel } from '@/components/layout';
import { PanelErrorBoundary } from './PanelError';
import SessionProblemEditor from './SessionProblemEditor';
import { Problem } from '@/server/types/problem';

interface ProblemSetupPanelProps {
  /** Callback when problem is updated */
  onUpdateProblem: (
    problem: { title: string; description: string; starterCode: string },
    executionSettings?: {
      stdin?: string;
      randomSeed?: number;
      attachedFiles?: Array<{ name: string; content: string }>;
    }
  ) => void;
  /** Initial problem data */
  initialProblem?: Problem | null;
  /** Initial execution settings */
  initialExecutionSettings?: {
    stdin?: string;
    randomSeed?: number;
    attachedFiles?: Array<{ name: string; content: string }>;
  };
  /** Whether the panel is loading */
  isLoading?: boolean;
}

/**
 * ProblemSetupPanel wraps SessionProblemEditor in a collapsible panel.
 * Shows "Problem Setup" as the panel title with the problem title as subtitle when collapsed.
 */
export function ProblemSetupPanel({
  onUpdateProblem,
  initialProblem,
  initialExecutionSettings,
  isLoading = false,
}: ProblemSetupPanelProps) {
  return (
    <PanelErrorBoundary title="Problem Setup">
      <Panel
        id="problem-setup"
        title="Problem Setup"
        icon="FileText"
        isLoading={isLoading}
      >
        <div className="space-y-4">
          {/* Show problem title when available */}
          {initialProblem?.title && (
            <div className="text-sm text-gray-600 pb-2 border-b border-gray-100">
              <span className="font-medium">Current: </span>
              {initialProblem.title}
            </div>
          )}
          <SessionProblemEditor
            onUpdateProblem={onUpdateProblem}
            initialProblem={initialProblem}
            initialExecutionSettings={initialExecutionSettings}
          />
        </div>
      </Panel>
    </PanelErrorBoundary>
  );
}
