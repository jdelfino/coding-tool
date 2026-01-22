'use client';

/**
 * Layout for fullscreen pages (student code editor).
 * Provides AppShell with collapsed sidebar and no right panels.
 */

import { ActiveSessionProvider } from '@/contexts/ActiveSessionContext';
import { PanelProvider } from '@/contexts/PanelContext';
import { AppShell } from '@/components/layout';

export default function FullscreenLayout({ children }: { children: React.ReactNode }) {
  return (
    <ActiveSessionProvider>
      <PanelProvider pageId="fullscreen">
        <AppShell sidebarCollapsed={true} showRightPanels={false}>
          {children}
        </AppShell>
      </PanelProvider>
    </ActiveSessionProvider>
  );
}
