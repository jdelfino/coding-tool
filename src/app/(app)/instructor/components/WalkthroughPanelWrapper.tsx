'use client';

/**
 * WalkthroughPanelWrapper - Collapsible panel wrapper for WalkthroughPanel.
 * Adapts the existing WalkthroughPanel component to the panel system.
 */

import React from 'react';
import { Panel } from '@/components/layout';
import { PanelErrorBoundary } from './PanelError';
import WalkthroughPanel from './WalkthroughPanel';

interface WalkthroughPanelWrapperProps {
  /** Current session ID */
  sessionId: string;
  /** Callback to feature a student on the public view */
  onFeatureStudent: (studentId: string) => Promise<void>;
  /** Number of students in the session */
  studentCount: number;
  /** Whether the panel is loading */
  isLoading?: boolean;
}

/**
 * WalkthroughPanelWrapper wraps WalkthroughPanel in a collapsible panel.
 * Shows "AI Walkthrough" as the panel title.
 */
export function WalkthroughPanelWrapper({
  sessionId,
  onFeatureStudent,
  studentCount,
  isLoading = false,
}: WalkthroughPanelWrapperProps) {
  return (
    <PanelErrorBoundary title="AI Walkthrough">
      <Panel
        id="ai-walkthrough"
        title="AI Walkthrough"
        icon="Bot"
        isLoading={isLoading}
      >
        <div className="max-h-[400px] overflow-y-auto">
          <WalkthroughPanel
            sessionId={sessionId}
            onFeatureStudent={onFeatureStudent}
            studentCount={studentCount}
          />
        </div>
      </Panel>
    </PanelErrorBoundary>
  );
}
