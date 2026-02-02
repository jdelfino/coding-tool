/**
 * Tests for CodeEditor outputCollapsible prop
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

// Mock ExecutionSettings
jest.mock('../ExecutionSettings', () => {
  return function MockExecutionSettings() {
    return <div data-testid="execution-settings">Settings</div>;
  };
});

// Mock useResponsiveLayout hook - default to desktop
jest.mock('@/hooks/useResponsiveLayout', () => ({
  useResponsiveLayout: jest.fn(() => true),
  useSidebarSection: jest.fn(() => ({
    isCollapsed: true,
    toggle: jest.fn(),
    setCollapsed: jest.fn(),
  })),
  useMobileViewport: jest.fn(() => ({
    isMobile: false,
    isTablet: false,
    isVerySmall: false,
    isDesktop: true,
    width: 1200,
  })),
}));

describe('CodeEditor outputCollapsible prop', () => {
  it('shows collapse toggle when outputCollapsible is true and outputPosition is right', () => {
    render(
      <CodeEditor
        code="print('hello')"
        onChange={jest.fn()}
        outputCollapsible={true}
        outputPosition="right"
        forceDesktop={true}
      />
    );

    expect(screen.getByTestId('output-collapse-toggle')).toBeInTheDocument();
  });

  it('does not show collapse toggle when outputCollapsible is false', () => {
    render(
      <CodeEditor
        code="print('hello')"
        onChange={jest.fn()}
        outputCollapsible={false}
        outputPosition="right"
        forceDesktop={true}
      />
    );

    expect(screen.queryByTestId('output-collapse-toggle')).not.toBeInTheDocument();
  });

  it('does not show collapse toggle when outputCollapsible is omitted', () => {
    render(
      <CodeEditor
        code="print('hello')"
        onChange={jest.fn()}
        outputPosition="right"
        forceDesktop={true}
      />
    );

    expect(screen.queryByTestId('output-collapse-toggle')).not.toBeInTheDocument();
  });

  it('does not show collapse toggle when outputPosition is bottom', () => {
    render(
      <CodeEditor
        code="print('hello')"
        onChange={jest.fn()}
        outputCollapsible={true}
        outputPosition="bottom"
        forceDesktop={true}
      />
    );

    expect(screen.queryByTestId('output-collapse-toggle')).not.toBeInTheDocument();
  });
});
