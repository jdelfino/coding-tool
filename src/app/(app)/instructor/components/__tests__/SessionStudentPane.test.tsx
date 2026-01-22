/**
 * Tests for SessionStudentPane component
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SessionStudentPane } from '../SessionStudentPane';

// Mock the CodeEditor component since it depends on Monaco
jest.mock('@/app/(fullscreen)/student/components/CodeEditor', () => {
  return function MockCodeEditor({ code, readOnly }: { code: string; readOnly?: boolean }) {
    return (
      <div data-testid="code-editor" data-readonly={readOnly}>
        <pre>{code}</pre>
      </div>
    );
  };
});

// Mock EditorContainer
jest.mock('@/app/(fullscreen)/student/components/EditorContainer', () => ({
  EditorContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="editor-container">{children}</div>
  ),
}));

describe('SessionStudentPane', () => {
  const mockStudents = [
    { id: 'student-1', name: 'Alice', hasCode: true, executionSettings: {} },
    { id: 'student-2', name: 'Bob', hasCode: false, executionSettings: {} },
    { id: 'student-3', name: 'Carol', hasCode: true, executionSettings: { randomSeed: 42 } },
  ];

  const mockRealtimeStudents = [
    { id: 'student-1', name: 'Alice', code: 'print("Hello from Alice")' },
    { id: 'student-2', name: 'Bob', code: '' },
    { id: 'student-3', name: 'Carol', code: 'def main():\n  pass' },
  ];

  const defaultProps = {
    students: mockStudents,
    realtimeStudents: mockRealtimeStudents,
    sessionProblem: null,
    sessionExecutionSettings: {},
    joinCode: 'ABC123',
  };

  describe('initial rendering', () => {
    it('renders the session student pane', () => {
      render(<SessionStudentPane {...defaultProps} />);

      expect(screen.getByTestId('session-student-pane')).toBeInTheDocument();
    });

    it('displays all students in the list', () => {
      render(<SessionStudentPane {...defaultProps} />);

      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Carol')).toBeInTheDocument();
    });

    it('shows "no student selected" placeholder initially', () => {
      render(<SessionStudentPane {...defaultProps} />);

      expect(screen.getByTestId('no-student-selected')).toBeInTheDocument();
      expect(screen.getByText(/select a student to view their code/i)).toBeInTheDocument();
    });
  });

  describe('student selection', () => {
    it('displays code editor when student is selected', async () => {
      render(<SessionStudentPane {...defaultProps} />);

      // Click "View Code" button for Alice
      const viewCodeButtons = screen.getAllByRole('button', { name: /view code/i });
      fireEvent.click(viewCodeButtons[0]);

      // Wait for code editor to appear
      await waitFor(() => {
        expect(screen.getByTestId('code-editor')).toBeInTheDocument();
      });

      // Should not show the placeholder
      expect(screen.queryByTestId('no-student-selected')).not.toBeInTheDocument();
    });

    it('displays the selected student\'s code', async () => {
      render(<SessionStudentPane {...defaultProps} />);

      // Select Alice
      const viewCodeButtons = screen.getAllByRole('button', { name: /view code/i });
      fireEvent.click(viewCodeButtons[0]);

      // Check Alice's code is shown
      await waitFor(() => {
        expect(screen.getByText('print("Hello from Alice")')).toBeInTheDocument();
      });
    });

    it('shows student name in the code editor header', async () => {
      render(<SessionStudentPane {...defaultProps} />);

      // Select Alice
      const viewCodeButtons = screen.getAllByRole('button', { name: /view code/i });
      fireEvent.click(viewCodeButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/Alice's Code/i)).toBeInTheDocument();
      });
    });

    it('calls onSelectStudent callback when student is selected', () => {
      const mockOnSelectStudent = jest.fn();
      render(
        <SessionStudentPane
          {...defaultProps}
          onSelectStudent={mockOnSelectStudent}
        />
      );

      const viewCodeButtons = screen.getAllByRole('button', { name: /view code/i });
      fireEvent.click(viewCodeButtons[0]);

      expect(mockOnSelectStudent).toHaveBeenCalledWith('student-1');
    });

    it('switches between students correctly', async () => {
      render(<SessionStudentPane {...defaultProps} />);

      // Select Alice first
      const viewCodeButtons = screen.getAllByRole('button', { name: /view code/i });
      fireEvent.click(viewCodeButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('print("Hello from Alice")')).toBeInTheDocument();
      });

      // Now select Carol
      fireEvent.click(viewCodeButtons[2]);

      await waitFor(() => {
        // Carol's code contains "def main():" even if split across DOM nodes
        expect(screen.getByText(/def main\(\)/)).toBeInTheDocument();
        expect(screen.queryByText('print("Hello from Alice")')).not.toBeInTheDocument();
      });
    });
  });

  describe('code editor', () => {
    it('renders the code editor in read-only mode', async () => {
      render(<SessionStudentPane {...defaultProps} />);

      const viewCodeButtons = screen.getAllByRole('button', { name: /view code/i });
      fireEvent.click(viewCodeButtons[0]);

      await waitFor(() => {
        const editor = screen.getByTestId('code-editor');
        expect(editor).toHaveAttribute('data-readonly', 'true');
      });
    });
  });

  describe('optional callbacks', () => {
    it('shows "Show on Public View" button when onShowOnPublicView is provided', () => {
      const mockShowOnPublicView = jest.fn();
      render(
        <SessionStudentPane
          {...defaultProps}
          onShowOnPublicView={mockShowOnPublicView}
        />
      );

      expect(screen.getAllByRole('button', { name: /show on public view/i })).toHaveLength(3);
    });

    it('calls onShowOnPublicView with correct student ID', () => {
      const mockShowOnPublicView = jest.fn();
      render(
        <SessionStudentPane
          {...defaultProps}
          onShowOnPublicView={mockShowOnPublicView}
        />
      );

      const buttons = screen.getAllByRole('button', { name: /show on public view/i });
      fireEvent.click(buttons[1]); // Click for Bob (second student)

      expect(mockShowOnPublicView).toHaveBeenCalledWith('student-2');
    });

    it('shows "View History" button when onViewHistory is provided', () => {
      const mockViewHistory = jest.fn();
      render(
        <SessionStudentPane
          {...defaultProps}
          onViewHistory={mockViewHistory}
        />
      );

      expect(screen.getAllByRole('button', { name: /view history/i })).toHaveLength(3);
    });

    it('calls onViewHistory with correct student ID and name', () => {
      const mockViewHistory = jest.fn();
      render(
        <SessionStudentPane
          {...defaultProps}
          onViewHistory={mockViewHistory}
        />
      );

      const buttons = screen.getAllByRole('button', { name: /view history/i });
      fireEvent.click(buttons[2]); // Click for Carol

      expect(mockViewHistory).toHaveBeenCalledWith('student-3', 'Carol');
    });
  });

  describe('realtime code updates', () => {
    it('updates displayed code when realtimeStudents changes', async () => {
      const { rerender } = render(<SessionStudentPane {...defaultProps} />);

      // Select Alice
      const viewCodeButtons = screen.getAllByRole('button', { name: /view code/i });
      fireEvent.click(viewCodeButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('print("Hello from Alice")')).toBeInTheDocument();
      });

      // Update realtime data with new code for Alice
      const updatedRealtimeStudents = [
        { ...mockRealtimeStudents[0], code: 'print("Updated code!")' },
        ...mockRealtimeStudents.slice(1),
      ];

      rerender(
        <SessionStudentPane
          {...defaultProps}
          realtimeStudents={updatedRealtimeStudents}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('print("Updated code!")')).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('shows appropriate message when no students', () => {
      render(
        <SessionStudentPane
          {...defaultProps}
          students={[]}
          realtimeStudents={[]}
        />
      );

      expect(screen.getByText(/waiting for students to join/i)).toBeInTheDocument();
    });

    it('displays join code in empty state', () => {
      render(
        <SessionStudentPane
          {...defaultProps}
          students={[]}
          realtimeStudents={[]}
          joinCode="XYZ789"
        />
      );

      expect(screen.getByText('XYZ789')).toBeInTheDocument();
    });
  });
});
