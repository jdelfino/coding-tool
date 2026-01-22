'use client';

/**
 * Layout for authenticated app pages.
 * Provides AppShell with sidebar and header, plus context providers.
 */

import { ActiveSessionProvider } from '@/contexts/ActiveSessionContext';
import { PanelProvider } from '@/contexts/PanelContext';
import { AppShell } from '@/components/layout';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ActiveSessionProvider>
      <PanelProvider pageId="app">
        <AppShell>{children}</AppShell>
      </PanelProvider>
    </ActiveSessionProvider>
  );
}
