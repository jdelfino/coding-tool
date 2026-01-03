/**
 * Tests for CodeEditor responsive layout
 *
 * Tests the responsive layout behavior added to better utilize screen space on large displays.
 *
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import CodeEditor from '../CodeEditor';

// Mock Monaco Editor
jest.mock('@monaco-editor/react', () => {
  return function MockEditor({ value, onChange }: any) {
    return (
      <textarea
        data-testid="monaco-editor"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  };
});

// Mock ExecutionSettings with inSidebar prop handling
jest.mock('../ExecutionSettings', () => {
  return function MockExecutionSettings({ inSidebar }: { inSidebar?: boolean }) {
    return (
      <div data-testid="execution-settings" data-in-sidebar={inSidebar}>
        Execution Settings {inSidebar ? '(Sidebar)' : '(Bottom)'}
      </div>
    );
  };
});

// Mock useResponsiveLayout hook
jest.mock('@/hooks/useResponsiveLayout', () => ({
  useResponsiveLayout: jest.fn(),
  useSidebarSection: jest.fn(() => ({
    isCollapsed: false,
    toggle: jest.fn(),
  })),
}));

describe('CodeEditor Responsive Layout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Desktop Layout (>= 1024px)', () => {
    beforeEach(() => {
      const { useResponsiveLayout } = require('@/hooks/useResponsiveLayout');
      useResponsiveLayout.mockReturnValue(true); // Desktop
    });

    it('should render execution settings in sidebar on desktop', () => {
      render(
        <CodeEditor
          code="print('hello')"
          onChange={jest.fn()}
        />
      );

      const settings = screen.getByTestId('execution-settings');
      expect(settings).toHaveAttribute('data-in-sidebar', 'true');
      expect(settings).toHaveTextContent('(Sidebar)');
    });

    it('should render collapsible sidebar section header on desktop', () => {
      render(
        <CodeEditor
          code="print('hello')"
          onChange={jest.fn()}
        />
      );

      // Look for the activity bar button
      const sidebarButton = screen.getByRole('button', { name: /execution settings/i });
      expect(sidebarButton).toBeInTheDocument();
    });

    it('should render editor and sidebar in horizontal layout on desktop', () => {
      const { container } = render(
        <CodeEditor
          code="print('hello')"
          onChange={jest.fn()}
        />
      );

      // Check for the activity bar (icon sidebar) which appears on desktop
      const activityBar = container.querySelector('.w-12.bg-gray-800');
      expect(activityBar).toBeInTheDocument();
    });
  });

  describe('Mobile Layout (< 1024px)', () => {
    beforeEach(() => {
      const { useResponsiveLayout } = require('@/hooks/useResponsiveLayout');
      useResponsiveLayout.mockReturnValue(false); // Mobile
    });

    it('should render execution settings at bottom on mobile', () => {
      render(
        <CodeEditor
          code="print('hello')"
          onChange={jest.fn()}
        />
      );

      const settings = screen.getByTestId('execution-settings');
      expect(settings).toHaveAttribute('data-in-sidebar', 'false');
      expect(settings).toHaveTextContent('(Bottom)');
    });

    it('should not render sidebar collapse button on mobile', () => {
      render(
        <CodeEditor
          code="print('hello')"
          onChange={jest.fn()}
        />
      );

      // The activity bar should not exist on mobile
      const sidebarButton = screen.queryByRole('button', { name: /execution settings/i });
      expect(sidebarButton).not.toBeInTheDocument();
    });

    it('should maintain vertical stacking layout on mobile', () => {
      const { container } = render(
        <CodeEditor
          code="print('hello')"
          onChange={jest.fn()}
        />
      );

      // Activity bar should not be rendered on mobile
      const activityBar = container.querySelector('.w-12.bg-gray-800');
      expect(activityBar).not.toBeInTheDocument();
    });

    it('should render execution settings below editor, not to the right on mobile', () => {
      const { container } = render(
        <CodeEditor
          code="print('hello')"
          onChange={jest.fn()}
        />
      );

      // Find the main content area - should have flex-col for vertical stacking
      const mainContent = container.querySelector('.flex.flex-col.flex-1.min-h-0');
      expect(mainContent).toBeInTheDocument();

      // Execution settings should be at the bottom of the layout, not inside flex-row
      const settings = screen.getByTestId('execution-settings');
      expect(settings).toBeInTheDocument();
      expect(settings).toHaveAttribute('data-in-sidebar', 'false');
    });
  });

  describe('Responsive Execution Results', () => {
    const executionResult = {
      success: true,
      output: 'Test output',
      error: '',
      executionTime: 100,
    };

    it('should render execution results below editor on desktop', () => {
      const { useResponsiveLayout } = require('@/hooks/useResponsiveLayout');
      useResponsiveLayout.mockReturnValue(true);

      render(
        <CodeEditor
          code="print('hello')"
          onChange={jest.fn()}
          executionResult={executionResult}
        />
      );

      expect(screen.getByText('✓ Success')).toBeInTheDocument();
      expect(screen.getByText('Test output')).toBeInTheDocument();
    });

    it('should render execution results below editor on mobile', () => {
      const { useResponsiveLayout } = require('@/hooks/useResponsiveLayout');
      useResponsiveLayout.mockReturnValue(false);

      render(
        <CodeEditor
          code="print('hello')"
          onChange={jest.fn()}
          executionResult={executionResult}
        />
      );

      expect(screen.getByText('✓ Success')).toBeInTheDocument();
      expect(screen.getByText('Test output')).toBeInTheDocument();
    });
  });

  describe('Sidebar Collapse State', () => {
    it('should render collapsed sidebar when isCollapsed is true', () => {
      const { useResponsiveLayout, useSidebarSection } = require('@/hooks/useResponsiveLayout');
      useResponsiveLayout.mockReturnValue(true);
      useSidebarSection.mockReturnValue({
        isCollapsed: true,
        toggle: jest.fn(),
      });

      render(
        <CodeEditor
          code="print('hello')"
          onChange={jest.fn()}
        />
      );

      const sidebarButton = screen.getByRole('button', { name: /execution settings/i });
      expect(sidebarButton).toBeInTheDocument();

      // Settings panel should not be rendered when collapsed
      expect(screen.queryByTestId('execution-settings')).not.toBeInTheDocument();
    });

    it('should render expanded sidebar when isCollapsed is false', () => {
      const { useResponsiveLayout, useSidebarSection } = require('@/hooks/useResponsiveLayout');
      useResponsiveLayout.mockReturnValue(true);
      useSidebarSection.mockReturnValue({
        isCollapsed: false,
        toggle: jest.fn(),
      });

      render(
        <CodeEditor
          code="print('hello')"
          onChange={jest.fn()}
        />
      );

      const sidebarButton = screen.getByRole('button', { name: /execution settings/i });
      expect(sidebarButton).toBeInTheDocument();

      // Settings panel should be rendered when expanded
      expect(screen.getByTestId('execution-settings')).toBeInTheDocument();
    });
  });

  describe('Read-only Mode', () => {
    it('should support responsive layout in read-only mode', () => {
      const { useResponsiveLayout } = require('@/hooks/useResponsiveLayout');
      useResponsiveLayout.mockReturnValue(true);

      render(
        <CodeEditor
          code="print('hello')"
          onChange={jest.fn()}
          readOnly={true}
        />
      );

      // Should still render sidebar button in read-only mode
      const sidebarButton = screen.getByRole('button', { name: /execution settings/i });
      expect(sidebarButton).toBeInTheDocument();
    });
  });
});
