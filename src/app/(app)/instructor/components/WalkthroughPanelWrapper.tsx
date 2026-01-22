'use client';

/**
 * WalkthroughPanelWrapper - Collapsible panel wrapper for WalkthroughPanel.
 * Adapts the existing WalkthroughPanel component to the panel system.
 */

import React from 'react';
import { Panel } from '@/components/layout';
import { Card } from '@/components/ui/Card';
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
  /** Whether to render in full-width mode (no panel wrapper) */
  isFullWidth?: boolean;
}

/**
 * WalkthroughPanelWrapper wraps WalkthroughPanel.
 * In panel mode: Uses collapsible Panel component.
 * In full-width mode: Renders content directly for tab-based layouts.
 */
export function WalkthroughPanelWrapper({
  sessionId,
  onFeatureStudent,
  studentCount,
  isLoading = false,
  isFullWidth = false,
}: WalkthroughPanelWrapperProps) {
  const content = (
    <WalkthroughPanel
      sessionId={sessionId}
      onFeatureStudent={onFeatureStudent}
      studentCount={studentCount}
    />
  );

  // Full-width mode: render content in a card without panel chrome
  if (isFullWidth) {
    return (
      <PanelErrorBoundary title="AI Walkthrough">
        <Card variant="default" className="p-6">
          {content}
        </Card>
      </PanelErrorBoundary>
    );
  }

  // Panel mode: wrap in collapsible panel
  return (
    <PanelErrorBoundary title="AI Walkthrough">
      <Panel
        id="ai-walkthrough"
        title="AI Walkthrough"
        icon="Bot"
        isLoading={isLoading}
      >
        <div className="max-h-[400px] overflow-y-auto">
          {content}
        </div>
      </Panel>
    </PanelErrorBoundary>
  );
}
