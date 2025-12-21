/**
 * Integration tests for instructor page
 * Tests the view mode transitions and navigation flow
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import InstructorPage from '../page';
import { useAuth } from '@/contexts/AuthContext';
import { useWebSocket } from '@/hooks/useWebSocket';

// Mock dependencies
jest.mock('@/contexts/AuthContext');
jest.mock('@/hooks/useWebSocket');

// Mock ProtectedRoute by default for most tests (to simplify testing)
// But we'll unmock it for access control tests
jest.mock('@/components/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock next/navigation for router.push tracking
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock react-syntax-highlighter to avoid import issues
jest.mock('react-syntax-highlighter', () => ({
  Prism: ({ children }: { children: string }) => <pre>{children}</pre>,
}));
jest.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  vscDarkPlus: {},
}));

// Mock ProblemInput to avoid React import issues
jest.mock('../components/ProblemInput', () => ({
  __esModule: true,
  default: () => <div data-testid="problem-input">Problem Input</div>,
}));

// Mock RevisionViewer to avoid complex dependencies
jest.mock('../components/RevisionViewer', () => ({
  __esModule: true,
  default: () => <div data-testid="revision-viewer">Revision Viewer</div>,
}));

// Mock CodeEditor and OutputPanel components
jest.mock('@/app/student/components/CodeEditor', () => ({
  __esModule: true,
  default: ({ code, onRun, isRunning }: any) => (
    <div data-testid="code-editor">
      <div data-testid="code-content">{code}</div>
      <button onClick={() => onRun()} disabled={isRunning} data-testid="run-code-button">
        {isRunning ? '⏳ Running...' : '▶ Run Code'}
      </button>
    </div>
  ),
}));

jest.mock('@/app/student/components/OutputPanel', () => ({
  __esModule: true,
  default: ({ result }: any) => (
    <div data-testid="output-panel">
      {result && <div data-testid="execution-result">{JSON.stringify(result)}</div>}
    </div>
  ),
}));

// Mock fetch
global.fetch = jest.fn();

describe('InstructorPage - Integration Tests', () => {
  const mockUser = {
    id: 'instructor-1',
    username: 'instructor',
    role: 'instructor' as const,
  };

  const mockSignOut = jest.fn();
  const mockSendMessage = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    const mockWebSocketState = {
      isConnected: true,
      connectionStatus: 'connected',
      connectionError: null,
      lastMessage: null,
      sendMessage: mockSendMessage,
    };

    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      signOut: mockSignOut,
    });

    (useWebSocket as jest.Mock).mockReturnValue(mockWebSocketState);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('View Mode Transitions', () => {
    it('should transition from classes → sections when class selected', async () => {
      const mockClasses = [
        { id: 'class-1', name: 'CS101', description: 'Intro to CS' },
      ];

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ classes: mockClasses }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ 
            class: { name: 'CS101' },
            sections: [] 
          }),
        });

      render(<InstructorPage />);

      // Should start in classes view
      await waitFor(() => {
        expect(screen.getByText('CS101')).toBeInTheDocument();
      });

      // Click on class
      fireEvent.click(screen.getByText('CS101'));

      // Should transition to sections view
      await waitFor(() => {
        expect(screen.getByText(/Back to Classes/i)).toBeInTheDocument();
      });
    });

    it('should handle session creation with disconnected WebSocket', async () => {
      const mockClasses = [{ id: 'class-1', name: 'CS101' }];
      const mockSections = [
        { 
          id: 'section-1', 
          name: 'Section A',
          schedule: 'MWF 10am',
          studentCount: 0,
          sessionCount: 0,
          activeSessionCount: 0,
        },
      ];

      // Mock fetch to handle all calls
      (global.fetch as jest.Mock).mockImplementation((url) => {
        console.log('[Test] Fetch called with URL:', url);
        if (url === '/api/classes') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ classes: mockClasses }),
          });
        }
        if (url.includes('/sections')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sections: mockSections }),
          });
        }
        if (url.includes('/api/classes/class-1')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ class: { name: 'CS101' } }),
          });
        }
        return Promise.reject(new Error(`Unexpected fetch to ${url}`));
      });

      // Set WebSocket as disconnected
      const mockWebSocketState = {
        isConnected: false,
        connectionStatus: 'disconnected',
        connectionError: null,
        lastMessage: null,
        sendMessage: mockSendMessage,
      };
      (useWebSocket as jest.Mock).mockReturnValue(mockWebSocketState);

      const { debug } = render(<InstructorPage />);

      // Wait for classes to load
      await waitFor(() => {
        expect(screen.getByText('CS101')).toBeInTheDocument();
      });

      // Click to navigate to sections
      fireEvent.click(screen.getByText('CS101'));

      // Debug what's rendered after click
      console.log('[Test] After clicking CS101, looking for sections...');

      // Wait for sections view to load
      await waitFor(() => {
        const backButton = screen.queryByText(/Back to Classes/i);
        console.log('[Test] Back button found:', !!backButton);
        expect(backButton).toBeInTheDocument();
      }, { timeout: 5000 });

      // Now check if Section A appears
      await waitFor(() => {
        // Log the current HTML to see what's actually rendered
        const body = document.body.innerHTML;
        console.log('[Test] Body HTML:', body.substring(0, 2000));
        console.log('[Test] Body text includes "Classes":', document.body.textContent?.includes('Classes'));
        console.log('[Test] Body text includes "Create Session":', document.body.textContent?.includes('Create Session'));
        
        const sectionA = screen.queryByText('Section A');
        console.log('[Test] Section A found:', !!sectionA);
        expect(sectionA).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('should show loading state while fetching sections', async () => {
      const mockClasses = [{ id: 'class-1', name: 'CS101' }];
      
      let resolveSections: any;
      const sectionsPromise = new Promise((resolve) => {
        resolveSections = resolve;
      });

      (global.fetch as jest.Mock).mockImplementation((url) => {
        if (url === '/api/classes') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ classes: mockClasses }),
          });
        }
        if (url.includes('/sections')) {
          return sectionsPromise.then(() => Promise.resolve({
            ok: true,
            json: async () => ({ sections: [] }),
          }));
        }
        if (url.includes('/api/classes/class-1')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ class: { name: 'CS101' } }),
          });
        }
        return Promise.reject(new Error(`Unexpected fetch to ${url}`));
      });

      render(<InstructorPage />);

      await waitFor(() => {
        expect(screen.getByText('CS101')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('CS101'));

      // Wait for sections view - should see loading spinner while waiting
      await waitFor(() => {
        const spinner = document.querySelector('.animate-spin');
        expect(spinner).toBeInTheDocument();
      });

      // Resolve the sections fetch
      resolveSections();

      // Loading spinner should disappear
      await waitFor(() => {
        expect(document.querySelector('.animate-spin')).not.toBeInTheDocument();
      });
    });

    it('should display empty state when no sections exist', async () => {
      const mockClasses = [{ id: 'class-1', name: 'CS101' }];

      (global.fetch as jest.Mock).mockImplementation((url) => {
        if (url === '/api/classes') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ classes: mockClasses }),
          });
        }
        if (url.includes('/sections')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sections: [] }),
          });
        }
        if (url.includes('/api/classes/class-1')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ class: { name: 'CS101' } }),
          });
        }
        return Promise.reject(new Error(`Unexpected fetch to ${url}`));
      });

      render(<InstructorPage />);

      await waitFor(() => {
        expect(screen.getByText('CS101')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('CS101'));

      // Should show empty state
      await waitFor(() => {
        expect(screen.getByText(/No Sections Yet/i)).toBeInTheDocument();
      });
    });

    it('should display WebSocket connection status', async () => {
      const mockClasses = [{ id: 'class-1', name: 'CS101' }];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ classes: mockClasses }),
      });

      // Test with connected state
      (useWebSocket as jest.Mock).mockReturnValue({
        isConnected: true,
        connectionStatus: 'connected',
        connectionError: null,
        lastMessage: null,
        sendMessage: mockSendMessage,
      });

      const { rerender } = render(<InstructorPage />);

      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument();
      });

      // Test with disconnected state
      (useWebSocket as jest.Mock).mockReturnValue({
        isConnected: false,
        connectionStatus: 'disconnected',
        connectionError: null,
        lastMessage: null,
        sendMessage: mockSendMessage,
      });

      rerender(<InstructorPage />);

      await waitFor(() => {
        expect(screen.getByText(/disconnected/i)).toBeInTheDocument();
      });
    });

    it('should handle fetch error when loading classes', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      render(<InstructorPage />);

      await waitFor(() => {
        expect(screen.getByText(/Network error/i)).toBeInTheDocument();
      });
    });
  });

  describe('WebSocket Student List Updates', () => {
    it('should display students when STUDENT_LIST_UPDATE message is received', async () => {
      const mockClasses = [{ id: 'class-1', name: 'CS101' }];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ classes: mockClasses }),
      });

      // Create a mock WebSocket state with a way to update lastMessage
      let mockWebSocketState = {
        isConnected: true,
        connectionStatus: 'connected' as const,
        connectionError: null,
        lastMessage: null as any,
        sendMessage: mockSendMessage,
      };

      (useWebSocket as jest.Mock).mockReturnValue(mockWebSocketState);

      const { rerender } = render(<InstructorPage />);

      await waitFor(() => {
        expect(screen.getByText('CS101')).toBeInTheDocument();
      });

      // First, simulate session creation to get into session view
      mockWebSocketState = {
        ...mockWebSocketState,
        lastMessage: {
          type: 'SESSION_CREATED',
          payload: {
            sessionId: 'test-session-id',
            joinCode: 'ABC123',
            sectionId: 'section-1',
            sectionName: 'Test Section',
          },
        },
      };
      (useWebSocket as jest.Mock).mockReturnValue(mockWebSocketState);
      rerender(<InstructorPage />);

      // Wait for session view to render
      await waitFor(() => {
        expect(screen.getByText('ABC123')).toBeInTheDocument();
      });

      // Now simulate receiving a STUDENT_LIST_UPDATE message
      const studentListUpdate = {
        type: 'STUDENT_LIST_UPDATE',
        payload: {
          students: [
            { id: '8a099edb-31ec-4a42-9dd2-e5c040ec1fd8', name: 'stu', hasCode: true },
            { id: 'student-2', name: 'Alice', hasCode: false },
          ],
        },
      };

      // Update the mock to return the new message
      mockWebSocketState = {
        ...mockWebSocketState,
        lastMessage: studentListUpdate,
      };
      (useWebSocket as jest.Mock).mockReturnValue(mockWebSocketState);

      // Trigger re-render to simulate WebSocket message arrival
      rerender(<InstructorPage />);

      // Verify students appear in the UI
      await waitFor(() => {
        expect(screen.getByText('stu')).toBeInTheDocument();
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });

      // Verify student count is displayed
      expect(screen.getByText(/Connected Students \(2\)/i)).toBeInTheDocument();
    });

    it('should replace existing students when STUDENT_LIST_UPDATE is received', async () => {
      const mockClasses = [{ id: 'class-1', name: 'CS101' }];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ classes: mockClasses }),
      });

      let mockWebSocketState = {
        isConnected: true,
        connectionStatus: 'connected' as const,
        connectionError: null,
        lastMessage: null as any,
        sendMessage: mockSendMessage,
      };

      (useWebSocket as jest.Mock).mockReturnValue(mockWebSocketState);

      const { rerender } = render(<InstructorPage />);

      await waitFor(() => {
        expect(screen.getByText('CS101')).toBeInTheDocument();
      });

      // First, create a session
      mockWebSocketState = {
        ...mockWebSocketState,
        lastMessage: {
          type: 'SESSION_CREATED',
          payload: {
            sessionId: 'test-session-id',
            joinCode: 'ABC123',
            sectionId: 'section-1',
            sectionName: 'Test Section',
          },
        },
      };
      (useWebSocket as jest.Mock).mockReturnValue(mockWebSocketState);
      rerender(<InstructorPage />);

      await waitFor(() => {
        expect(screen.getByText('ABC123')).toBeInTheDocument();
      });

      // Send a STUDENT_JOINED message
      mockWebSocketState = {
        ...mockWebSocketState,
        lastMessage: {
          type: 'STUDENT_JOINED',
          payload: {
            studentId: 'old-student',
            studentName: 'Old Student',
          },
        },
      };
      (useWebSocket as jest.Mock).mockReturnValue(mockWebSocketState);
      rerender(<InstructorPage />);

      await waitFor(() => {
        expect(screen.getByText('Old Student')).toBeInTheDocument();
      });

      // Now send STUDENT_LIST_UPDATE with different students
      mockWebSocketState = {
        ...mockWebSocketState,
        lastMessage: {
          type: 'STUDENT_LIST_UPDATE',
          payload: {
            students: [
              { id: 'new-student-1', name: 'New Student 1', hasCode: true },
              { id: 'new-student-2', name: 'New Student 2', hasCode: false },
            ],
          },
        },
      };
      (useWebSocket as jest.Mock).mockReturnValue(mockWebSocketState);
      rerender(<InstructorPage />);

      // Old student should be gone, new students should appear
      await waitFor(() => {
        expect(screen.queryByText('Old Student')).not.toBeInTheDocument();
        expect(screen.getByText('New Student 1')).toBeInTheDocument();
        expect(screen.getByText('New Student 2')).toBeInTheDocument();
      });
    });

    it('should show empty state when STUDENT_LIST_UPDATE has no students', async () => {
      const mockClasses = [{ id: 'class-1', name: 'CS101' }];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ classes: mockClasses }),
      });

      let mockWebSocketState = {
        isConnected: true,
        connectionStatus: 'connected' as const,
        connectionError: null,
        lastMessage: null as any,
        sendMessage: mockSendMessage,
      };

      (useWebSocket as jest.Mock).mockReturnValue(mockWebSocketState);

      const { rerender } = render(<InstructorPage />);

      await waitFor(() => {
        expect(screen.getByText('CS101')).toBeInTheDocument();
      });

      // Create a session first
      mockWebSocketState = {
        ...mockWebSocketState,
        lastMessage: {
          type: 'SESSION_CREATED',
          payload: {
            sessionId: 'test-session-id',
            joinCode: 'ABC123',
            sectionId: 'section-1',
            sectionName: 'Test Section',
          },
        },
      };
      (useWebSocket as jest.Mock).mockReturnValue(mockWebSocketState);
      rerender(<InstructorPage />);

      await waitFor(() => {
        expect(screen.getByText('ABC123')).toBeInTheDocument();
      });

      // Send STUDENT_LIST_UPDATE with empty students array
      mockWebSocketState = {
        ...mockWebSocketState,
        lastMessage: {
          type: 'STUDENT_LIST_UPDATE',
          payload: {
            students: [],
          },
        },
      };
      (useWebSocket as jest.Mock).mockReturnValue(mockWebSocketState);
      rerender(<InstructorPage />);

      // Should show "No students connected yet" message
      await waitFor(() => {
        expect(screen.getByText(/No students connected yet/i)).toBeInTheDocument();
      });
    });
  });

  describe('Run Code Button', () => {
    it('should execute student code when Run Code button is clicked', async () => {
      const mockClasses = [
        { id: 'class-1', name: 'CS101', description: 'Intro to CS' },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ classes: mockClasses }),
      });

      let mockWebSocketState = {
        isConnected: true,
        connectionStatus: 'connected' as const,
        connectionError: null,
        lastMessage: null as any,
        sendMessage: mockSendMessage,
      };

      (useWebSocket as jest.Mock).mockReturnValue(mockWebSocketState);

      const { rerender } = render(<InstructorPage />);

      await waitFor(() => {
        expect(screen.getByText('CS101')).toBeInTheDocument();
      });

      // Create a session
      mockWebSocketState = {
        ...mockWebSocketState,
        lastMessage: {
          type: 'SESSION_CREATED',
          payload: {
            sessionId: 'test-session-id',
            joinCode: 'ABC123',
            sectionId: 'section-1',
            sectionName: 'Test Section',
          },
        },
      };
      (useWebSocket as jest.Mock).mockReturnValue(mockWebSocketState);
      rerender(<InstructorPage />);

      await waitFor(() => {
        expect(screen.getByText('ABC123')).toBeInTheDocument();
      });

      // Add a student
      mockWebSocketState = {
        ...mockWebSocketState,
        lastMessage: {
          type: 'STUDENT_JOINED',
          payload: {
            studentId: 'student-1',
            studentName: 'Alice',
          },
        },
      };
      (useWebSocket as jest.Mock).mockReturnValue(mockWebSocketState);
      rerender(<InstructorPage />);

      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });

      // Select the student by clicking "View Code" button
      const viewCodeButton = screen.getByRole('button', { name: /View Code/i });
      fireEvent.click(viewCodeButton);

      // Should send REQUEST_STUDENT_CODE message
      expect(mockSendMessage).toHaveBeenCalledWith('REQUEST_STUDENT_CODE', {
        sessionId: 'test-session-id',
        studentId: 'student-1',
      });

      // Receive student code
      mockWebSocketState = {
        ...mockWebSocketState,
        lastMessage: {
          type: 'STUDENT_CODE',
          payload: {
            studentId: 'student-1',
            code: 'print("Hello, World!")',
          },
        },
      };
      (useWebSocket as jest.Mock).mockReturnValue(mockWebSocketState);
      rerender(<InstructorPage />);

      await waitFor(() => {
        expect(screen.getByText(/Alice's Code/i)).toBeInTheDocument();
      });

      // Click the Run Code button
      const runButton = screen.getByText(/▶ Run Code/i);
      fireEvent.click(runButton);

      // Should send EXECUTE_STUDENT_CODE message
      expect(mockSendMessage).toHaveBeenCalledWith('EXECUTE_STUDENT_CODE', {
        sessionId: 'test-session-id',
        studentId: 'student-1',
      });
    });
  });

  describe('Access Control', () => {
    beforeEach(() => {
      // Reset the mock before each test in this suite
      mockPush.mockClear();
    });

    it('should prevent students from accessing instructor dashboard', async () => {
      // Unmock ProtectedRoute for this test to use the real implementation
      jest.unmock('@/components/ProtectedRoute');
      
      // Import the actual ProtectedRoute after unmocking
      const { ProtectedRoute: RealProtectedRoute } = await import('@/components/ProtectedRoute');
      
      // Create a test component that uses the real ProtectedRoute
      const TestComponent = () => {
        const studentUser = {
          id: 'student-1',
          username: 'student',
          role: 'student' as const,
        };

        (useAuth as jest.Mock).mockReturnValue({
          user: studentUser,
          signOut: mockSignOut,
          isLoading: false,
        });

        return (
          <RealProtectedRoute requiredRole="instructor">
            <div data-testid="instructor-content">Instructor Dashboard</div>
          </RealProtectedRoute>
        );
      };

      render(<TestComponent />);

      // Student should NOT see instructor content
      await waitFor(() => {
        const content = screen.queryByTestId('instructor-content');
        expect(content).not.toBeInTheDocument();
      });

      // Should redirect to /student
      expect(mockPush).toHaveBeenCalledWith('/student');
    });

    it('should allow instructors to access instructor dashboard', async () => {
      const instructorUser = {
        id: 'instructor-1',
        username: 'instructor',
        role: 'instructor' as const,
      };

      (useAuth as jest.Mock).mockReturnValue({
        user: instructorUser,
        signOut: mockSignOut,
        isLoading: false,
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ classes: [] }),
      });

      render(<InstructorPage />);

      // Instructor should see their dashboard
      await waitFor(() => {
        expect(screen.getByText('Instructor Dashboard')).toBeInTheDocument();
      });
      
      // Should NOT redirect
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});
