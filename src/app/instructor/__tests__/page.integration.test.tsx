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
});
