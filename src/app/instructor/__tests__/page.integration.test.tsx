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
jest.mock('@/components/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock CodeViewer to avoid syntax highlighter issues
jest.mock('../components/CodeViewer', () => ({
  __esModule: true,
  default: ({ code }: { code: string }) => <div data-testid="code-viewer">{code}</div>,
}));

// Mock RevisionViewer to avoid complex dependencies
jest.mock('../components/RevisionViewer', () => ({
  __esModule: true,
  default: () => <div data-testid="revision-viewer">Revision Viewer</div>,
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
  });
});
