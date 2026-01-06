/**
 * Unit tests for the public instructor view component
 * Tests behavior of the public display page including:
 * - Clearing execution output when new code is sent
 * - WebSocket message handling
 * - State updates
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MessageType } from '@/server/types';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useSearchParams: jest.fn(() => ({
    get: jest.fn((key: string) => (key === 'sessionId' ? 'test-session-id' : null))
  })),
}));

// Mock the useDebugger hook
jest.mock('@/hooks/useDebugger', () => ({
  useDebugger: jest.fn(() => ({
    isLoading: false,
    error: null,
    trace: null,
    setTrace: jest.fn(),
    setError: jest.fn(),
    clearTrace: jest.fn(),
  })),
}));

// Mock CodeEditor component
jest.mock('@/app/student/components/CodeEditor', () => {
  return function MockCodeEditor({ code, executionResult }: any) {
    return (
      <div data-testid="code-editor">
        <div data-testid="code-content">{code}</div>
        {executionResult && (
          <div data-testid="execution-result">
            <div>{executionResult.success ? 'Success' : 'Error'}</div>
            <div>{executionResult.output}</div>
          </div>
        )}
        {!executionResult && <div data-testid="no-output">No output</div>}
      </div>
    );
  };
});

// We need to mock React for the component's JSX
jest.mock('react', () => {
  const actualReact = jest.requireActual('react');
  return {
    ...actualReact,
    default: actualReact,
  };
});

describe('PublicInstructorView', () => {
  let mockWebSocket: any;

  beforeEach(() => {
    // Mock WebSocket
    mockWebSocket = {
      send: jest.fn(),
      close: jest.fn(),
      readyState: 1, // OPEN
      onopen: null as any,
      onmessage: null as any,
      onerror: null as any,
      onclose: null as any,
    };

    // Mock the WebSocket constructor
    global.WebSocket = jest.fn().mockImplementation(() => {
      // Trigger onopen asynchronously
      setTimeout(() => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen(new Event('open'));
        }
      }, 0);
      return mockWebSocket;
    }) as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('clears execution output when new code is sent to public view', async () => {
    // Import the component after mocks are set up
    const PublicInstructorView = require('../page').default;

    render(<PublicInstructorView />);

    // Wait for WebSocket to be initialized
    await waitFor(() => {
      expect(global.WebSocket).toHaveBeenCalled();
    });

    // Simulate initial code with execution result
    const initialMessage = {
      data: JSON.stringify({
        type: MessageType.PUBLIC_SUBMISSION_UPDATE,
        payload: {
          code: 'print("Hello, World!")',
          problem: {
            title: 'Test Problem',
            description: 'A test problem',
            starterCode: '',
          },
          hasFeaturedSubmission: true,
          executionSettings: {
            stdin: '',
          },
        },
      }),
    };

    if (mockWebSocket.onmessage) {
      mockWebSocket.onmessage(initialMessage);
    }

    // Wait for code to be displayed
    await waitFor(() => {
      expect(screen.getByTestId('code-content')).toHaveTextContent('print("Hello, World!")');
    });

    // Simulate execution result (old output)
    const executionMessage = {
      data: JSON.stringify({
        type: MessageType.EXECUTION_RESULT,
        payload: {
          success: true,
          output: 'Hello, World!\n',
          error: '',
          executionTime: 100,
        },
      }),
    };

    if (mockWebSocket.onmessage) {
      mockWebSocket.onmessage(executionMessage);
    }

    // Verify execution result is displayed
    await waitFor(() => {
      expect(screen.getByTestId('execution-result')).toBeInTheDocument();
      expect(screen.getByText('Success')).toBeInTheDocument();
      expect(screen.getByText('Hello, World!')).toBeInTheDocument();
    });

    // Now send new code to public view
    const newCodeMessage = {
      data: JSON.stringify({
        type: MessageType.PUBLIC_SUBMISSION_UPDATE,
        payload: {
          code: 'def sum_array(arr):\n    return sum(arr)',
          hasFeaturedSubmission: true,
        },
      }),
    };

    if (mockWebSocket.onmessage) {
      mockWebSocket.onmessage(newCodeMessage);
    }

    // Verify that:
    // 1. New code is displayed
    // 2. Old execution output is CLEARED
    await waitFor(() => {
      expect(screen.getByTestId('code-content')).toHaveTextContent('def sum_array(arr)');
      expect(screen.queryByTestId('execution-result')).not.toBeInTheDocument();
      expect(screen.getByTestId('no-output')).toBeInTheDocument();
    });
  });

  test('preserves execution output when code is not updated', async () => {
    const PublicInstructorView = require('../page').default;

    render(<PublicInstructorView />);

    await waitFor(() => {
      expect(global.WebSocket).toHaveBeenCalled();
    });

    // Send initial code
    const initialMessage = {
      data: JSON.stringify({
        type: MessageType.PUBLIC_SUBMISSION_UPDATE,
        payload: {
          code: 'print("Test")',
          problem: {
            title: 'Test',
            description: '',
            starterCode: '',
          },
          hasFeaturedSubmission: true,
        },
      }),
    };

    if (mockWebSocket.onmessage) {
      mockWebSocket.onmessage(initialMessage);
    }

    await waitFor(() => {
      expect(screen.getByTestId('code-content')).toHaveTextContent('print("Test")');
    });

    // Send execution result
    const executionMessage = {
      data: JSON.stringify({
        type: MessageType.EXECUTION_RESULT,
        payload: {
          success: true,
          output: 'Test\n',
          error: '',
          executionTime: 50,
        },
      }),
    };

    if (mockWebSocket.onmessage) {
      mockWebSocket.onmessage(executionMessage);
    }

    await waitFor(() => {
      expect(screen.getByTestId('execution-result')).toBeInTheDocument();
    });

    // Send update without code change (e.g., just updating execution settings)
    const updateMessage = {
      data: JSON.stringify({
        type: MessageType.PUBLIC_SUBMISSION_UPDATE,
        payload: {
          executionSettings: {
            stdin: 'new input',
          },
        },
      }),
    };

    if (mockWebSocket.onmessage) {
      mockWebSocket.onmessage(updateMessage);
    }

    // Execution result should still be present since code wasn't updated
    await waitFor(() => {
      expect(screen.getByTestId('execution-result')).toBeInTheDocument();
    });
  });
});
