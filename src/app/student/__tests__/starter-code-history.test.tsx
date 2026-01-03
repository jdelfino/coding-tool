/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import StudentPage from '../page';
import { useAuth } from '@/contexts/AuthContext';
import { useSessionHistory } from '@/hooks/useSessionHistory';
import { useWebSocket } from '@/hooks/useWebSocket';

// Mock dependencies
jest.mock('@/contexts/AuthContext');
jest.mock('@/hooks/useSessionHistory');
jest.mock('@/hooks/useWebSocket');
jest.mock('@/components/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: any) => <div>{children}</div>,
}));

// Mock Monaco Editor with executeEdits support
jest.mock('@monaco-editor/react', () => {
  return function MockEditor({ onMount }: any) {
    React.useEffect(() => {
      if (onMount) {
        const mockModel = {
          getFullModelRange: jest.fn(() => ({
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: 10,
            endColumn: 20,
          })),
        };

        const mockEditor = {
          focus: jest.fn(),
          getModel: jest.fn(() => mockModel),
          executeEdits: jest.fn((source, edits) => {
            // Store the edit for verification
            (mockEditor as any).lastEdit = { source, edits };
            return true;
          }),
          deltaDecorations: jest.fn().mockReturnValue([]),
          lastEdit: null as { source: string; edits: any[] } | null,
        };

        // Expose editor for test access
        (window as any).__mockEditor = mockEditor;

        onMount(mockEditor);
      }
    }, [onMount]);
    return <div data-testid="monaco-editor">Monaco Editor</div>;
  };
});

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseSessionHistory = useSessionHistory as jest.MockedFunction<typeof useSessionHistory>;
const mockUseWebSocket = useWebSocket as jest.MockedFunction<typeof useWebSocket>;

describe('StudentPage - Starter Code with Edit History', () => {
  let mockSendMessage: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSendMessage = jest.fn();
    localStorage.clear();
    (window as any).__mockEditor = null;

    mockUseAuth.mockReturnValue({
      user: {
        id: 'student1',
        username: 'TestStudent',
        role: 'student',
        createdAt: new Date().toISOString() as any,
      },
      sessionId: null,
      isAuthenticated: true,
      isLoading: false,
      signIn: jest.fn(),
      signOut: jest.fn(),
      refreshUser: jest.fn(),
    });

    mockUseSessionHistory.mockReturnValue({
      sessions: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      reconnectToSession: jest.fn(),
    });

    mockUseWebSocket.mockReturnValue({
      isConnected: true,
      connectionStatus: 'connected',
      connectionError: null,
      lastMessage: null,
      sendMessage: mockSendMessage,
    });
  });

  it('should preserve edit history when loading starter code into empty editor', async () => {
    const { rerender } = render(<StudentPage />);

    // Join a session with a problem
    const problem = {
      title: 'Test Problem',
      description: 'Test description',
      starterCode: 'def solution():\n    return 42',
      executionSettings: {},
    };

    mockUseWebSocket.mockReturnValue({
      isConnected: true,
      connectionStatus: 'connected',
      connectionError: null,
      lastMessage: {
        type: 'SESSION_JOINED',
        payload: {
          sessionId: 'session1',
          studentId: 'student1',
          problem,
          sessionExecutionSettings: {},
          studentExecutionSettings: null,
          code: '',
        },
      },
      sendMessage: mockSendMessage,
    });

    rerender(<StudentPage />);

    // Wait for the session to be joined
    await waitFor(() => {
      expect(screen.getByText('Restore Starter Code')).toBeInTheDocument();
    });

    // Get reference to mock editor
    const mockEditor = (window as any).__mockEditor;
    expect(mockEditor).toBeTruthy();

    // Clear previous calls
    mockEditor.executeEdits.mockClear();

    // Click the "Restore Starter Code" button
    const loadButton = screen.getByText('Restore Starter Code');
    fireEvent.click(loadButton);

    // Verify that executeEdits was called with the correct parameters
    await waitFor(() => {
      expect(mockEditor.executeEdits).toHaveBeenCalledWith(
        'load-starter-code',
        [{
          range: expect.objectContaining({
            startLineNumber: 1,
            startColumn: 1,
          }),
          text: problem.starterCode,
        }]
      );
    });

    // Verify the edit source is properly labeled
    const lastEdit = mockEditor.lastEdit;
    expect(lastEdit.source).toBe('load-starter-code');
    expect(lastEdit.edits[0].text).toBe(problem.starterCode);
  });

  it('should preserve edit history when replacing existing code with confirmation', async () => {
    // Mock window.confirm to return true
    const originalConfirm = window.confirm;
    window.confirm = jest.fn(() => true);

    const { rerender } = render(<StudentPage />);

    // Join a session with a problem and existing code
    const problem = {
      title: 'Test Problem',
      description: 'Test description',
      starterCode: 'def solution():\n    return 42',
      executionSettings: {},
    };

    mockUseWebSocket.mockReturnValue({
      isConnected: true,
      connectionStatus: 'connected',
      connectionError: null,
      lastMessage: {
        type: 'SESSION_JOINED',
        payload: {
          sessionId: 'session1',
          studentId: 'student1',
          problem,
          sessionExecutionSettings: {},
          studentExecutionSettings: null,
          code: '# Existing student code\nprint("hello")',
        },
      },
      sendMessage: mockSendMessage,
    });

    rerender(<StudentPage />);

    // Wait for the session to be joined
    await waitFor(() => {
      expect(screen.getByText('Restore Starter Code')).toBeInTheDocument();
    });

    // Get reference to mock editor
    const mockEditor = (window as any).__mockEditor;
    expect(mockEditor).toBeTruthy();

    // Clear previous calls
    mockEditor.executeEdits.mockClear();

    // Click the "Restore Starter Code" button
    const loadButton = screen.getByText('Restore Starter Code');
    fireEvent.click(loadButton);

    // Verify confirm was called
    expect(window.confirm).toHaveBeenCalledWith(
      'This will replace your current code. Are you sure?'
    );

    // Verify that executeEdits was called (not setCode)
    await waitFor(() => {
      expect(mockEditor.executeEdits).toHaveBeenCalledWith(
        'load-starter-code',
        [{
          range: expect.any(Object),
          text: problem.starterCode,
        }]
      );
    });

    // Restore original confirm
    window.confirm = originalConfirm;
  });

  it('should not replace code when user cancels confirmation', async () => {
    // Mock window.confirm to return false
    const originalConfirm = window.confirm;
    window.confirm = jest.fn(() => false);

    const { rerender } = render(<StudentPage />);

    // Join a session with a problem and existing code
    const problem = {
      title: 'Test Problem',
      description: 'Test description',
      starterCode: 'def solution():\n    return 42',
      executionSettings: {},
    };

    mockUseWebSocket.mockReturnValue({
      isConnected: true,
      connectionStatus: 'connected',
      connectionError: null,
      lastMessage: {
        type: 'SESSION_JOINED',
        payload: {
          sessionId: 'session1',
          studentId: 'student1',
          problem,
          sessionExecutionSettings: {},
          studentExecutionSettings: null,
          code: '# Existing student code\nprint("hello")',
        },
      },
      sendMessage: mockSendMessage,
    });

    rerender(<StudentPage />);

    // Wait for the session to be joined
    await waitFor(() => {
      expect(screen.getByText('Restore Starter Code')).toBeInTheDocument();
    });

    // Get reference to mock editor
    const mockEditor = (window as any).__mockEditor;
    expect(mockEditor).toBeTruthy();

    // Clear previous calls
    mockEditor.executeEdits.mockClear();

    // Click the "Restore Starter Code" button
    const loadButton = screen.getByText('Restore Starter Code');
    fireEvent.click(loadButton);

    // Verify confirm was called
    expect(window.confirm).toHaveBeenCalledWith(
      'This will replace your current code. Are you sure?'
    );

    // Verify that executeEdits was NOT called (user cancelled)
    expect(mockEditor.executeEdits).not.toHaveBeenCalled();

    // Restore original confirm
    window.confirm = originalConfirm;
  });

  it('should use Monaco API for undo functionality after loading starter code', async () => {
    const { rerender } = render(<StudentPage />);

    // Join a session with a problem
    const problem = {
      title: 'Test Problem',
      description: 'Test description',
      starterCode: 'def solution():\n    return 42',
      executionSettings: {},
    };

    mockUseWebSocket.mockReturnValue({
      isConnected: true,
      connectionStatus: 'connected',
      connectionError: null,
      lastMessage: {
        type: 'SESSION_JOINED',
        payload: {
          sessionId: 'session1',
          studentId: 'student1',
          problem,
          sessionExecutionSettings: {},
          studentExecutionSettings: null,
          code: '',
        },
      },
      sendMessage: mockSendMessage,
    });

    rerender(<StudentPage />);

    // Wait for the session to be joined
    await waitFor(() => {
      expect(screen.getByText('Restore Starter Code')).toBeInTheDocument();
    });

    // Get reference to mock editor
    const mockEditor = (window as any).__mockEditor;

    // Load starter code
    const loadButton = screen.getByText('Restore Starter Code');
    fireEvent.click(loadButton);

    // Verify executeEdits was used (this enables undo)
    await waitFor(() => {
      expect(mockEditor.executeEdits).toHaveBeenCalled();
    });

    // The fact that executeEdits was used means:
    // 1. The edit is part of the editor's undo stack
    // 2. Ctrl+Z will undo the starter code load
    // 3. Edit history is preserved
    const lastCall = mockEditor.executeEdits.mock.calls[0];
    expect(lastCall[0]).toBe('load-starter-code'); // Named operation
    expect(lastCall[1][0]).toHaveProperty('range'); // Uses range-based edit
    expect(lastCall[1][0]).toHaveProperty('text', problem.starterCode);
  });
});
