/**
 * Tests for StudentActions component
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import StudentActions from '../StudentActions';
import { useAuth } from '@/contexts/AuthContext';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// Mock fetch globally
global.fetch = jest.fn();

describe('StudentActions', () => {
  const mockRouter = {
    push: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (global.fetch as jest.Mock).mockClear();
  });

  describe('visibility', () => {
    it('should not render when user is loading', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        isLoading: true,
      });

      const { container } = render(
        <StudentActions problemId="prob-1" classId="class-1" />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should not render when user is not authenticated', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        isLoading: false,
      });

      const { container } = render(
        <StudentActions problemId="prob-1" classId="class-1" />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should not render when user has no student sections in this class', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: 'user-1', email: 'test@example.com', role: 'student' },
        isLoading: false,
      });

      // Mock API response - no sections for this class
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sections: [
            { id: 'sec-1', classId: 'other-class', role: 'student', name: 'Section 1' },
          ],
        }),
      });

      const { container } = render(
        <StudentActions problemId="prob-1" classId="class-1" />
      );

      // Wait for API call and render
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/sections/my');
      });

      // Should not render if no matching sections
      expect(container.firstChild).toBeNull();
    });

    it('should render Practice button when user is a student in a section of this class', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: 'user-1', email: 'test@example.com', role: 'student' },
        isLoading: false,
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sections: [
            { id: 'sec-1', classId: 'class-1', role: 'student', name: 'Section 1' },
          ],
        }),
      });

      render(<StudentActions problemId="prob-1" classId="class-1" />);

      await waitFor(() => {
        expect(screen.getByText('Practice')).toBeInTheDocument();
      });
    });

    it('should render Practice button when user is instructor in one class but student in this class', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: 'user-1', email: 'test@example.com', role: 'instructor' },
        isLoading: false,
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sections: [
            { id: 'sec-1', classId: 'other-class', role: 'instructor', name: 'Section 1' },
            { id: 'sec-2', classId: 'class-1', role: 'student', name: 'Section 2' },
          ],
        }),
      });

      render(<StudentActions problemId="prob-1" classId="class-1" />);

      await waitFor(() => {
        expect(screen.getByText('Practice')).toBeInTheDocument();
      });
    });
  });

  describe('practice session creation', () => {
    it('should auto-start practice with single section', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: 'user-1', email: 'test@example.com', role: 'student' },
        isLoading: false,
      });

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            sections: [
              { id: 'sec-1', classId: 'class-1', role: 'student', name: 'Section 1' },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sessionId: 'session-123' }),
        });

      render(<StudentActions problemId="prob-1" classId="class-1" />);

      const practiceButton = await screen.findByText('Practice');
      await userEvent.click(practiceButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/problems/prob-1/practice',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sectionId: 'sec-1' }),
          })
        );
      });

      expect(mockRouter.push).toHaveBeenCalledWith('/student?sessionId=session-123');
    });

    it('should show section picker with multiple sections', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: 'user-1', email: 'test@example.com', role: 'student' },
        isLoading: false,
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sections: [
            { id: 'sec-1', classId: 'class-1', role: 'student', name: 'Section 1' },
            { id: 'sec-2', classId: 'class-1', role: 'student', name: 'Section 2' },
          ],
        }),
      });

      render(<StudentActions problemId="prob-1" classId="class-1" />);

      const practiceButton = await screen.findByText('Practice');
      await userEvent.click(practiceButton);

      // Should show section picker
      await waitFor(() => {
        expect(screen.getByText('Select Section')).toBeInTheDocument();
      });

      expect(screen.getByText('Section 1')).toBeInTheDocument();
      expect(screen.getByText('Section 2')).toBeInTheDocument();
    });

    it('should create practice session after selecting section from picker', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: 'user-1', email: 'test@example.com', role: 'student' },
        isLoading: false,
      });

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            sections: [
              { id: 'sec-1', classId: 'class-1', role: 'student', name: 'Section 1' },
              { id: 'sec-2', classId: 'class-1', role: 'student', name: 'Section 2' },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sessionId: 'session-456' }),
        });

      render(<StudentActions problemId="prob-1" classId="class-1" />);

      const practiceButton = await screen.findByText('Practice');
      await userEvent.click(practiceButton);

      // Wait for picker to appear
      const section2Option = await screen.findByText('Section 2');
      await userEvent.click(section2Option);

      // Click Start Practice button in picker
      const startButton = screen.getByText('Start Practice');
      await userEvent.click(startButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/problems/prob-1/practice',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ sectionId: 'sec-2' }),
          })
        );
      });

      expect(mockRouter.push).toHaveBeenCalledWith('/student?sessionId=session-456');
    });

    it('should show loading state during session creation', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: 'user-1', email: 'test@example.com', role: 'student' },
        isLoading: false,
      });

      let resolveFetch: any;
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve;
      });

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            sections: [
              { id: 'sec-1', classId: 'class-1', role: 'student', name: 'Section 1' },
            ],
          }),
        })
        .mockReturnValueOnce(fetchPromise);

      render(<StudentActions problemId="prob-1" classId="class-1" />);

      const practiceButton = await screen.findByText('Practice');
      await userEvent.click(practiceButton);

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText('Starting...')).toBeInTheDocument();
      });

      // Complete the request
      resolveFetch({
        ok: true,
        json: async () => ({ sessionId: 'session-123' }),
      });

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalled();
      });
    });

    it('should handle API errors gracefully', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: 'user-1', email: 'test@example.com', role: 'student' },
        isLoading: false,
      });

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            sections: [
              { id: 'sec-1', classId: 'class-1', role: 'student', name: 'Section 1' },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'Not enrolled' }),
        });

      render(<StudentActions problemId="prob-1" classId="class-1" />);

      const practiceButton = await screen.findByText('Practice');
      await userEvent.click(practiceButton);

      await waitFor(() => {
        expect(screen.getByText(/Not enrolled/)).toBeInTheDocument();
      });
    });

    it('should handle sections API failure gracefully', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: 'user-1', email: 'test@example.com', role: 'student' },
        isLoading: false,
      });

      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const { container } = render(<StudentActions problemId="prob-1" classId="class-1" />);

      // Wait for API call to fail
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/sections/my');
      });

      // Should not render if sections fetch fails
      expect(container.firstChild).toBeNull();
    });

    it('should close section picker when Cancel is clicked', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: 'user-1', email: 'test@example.com', role: 'student' },
        isLoading: false,
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sections: [
            { id: 'sec-1', classId: 'class-1', role: 'student', name: 'Section 1' },
            { id: 'sec-2', classId: 'class-1', role: 'student', name: 'Section 2' },
          ],
        }),
      });

      render(<StudentActions problemId="prob-1" classId="class-1" />);

      const practiceButton = await screen.findByText('Practice');
      await userEvent.click(practiceButton);

      // Wait for picker to appear
      await waitFor(() => {
        expect(screen.getByText('Select Section')).toBeInTheDocument();
      });

      // Click Cancel button
      const cancelButton = screen.getByText('Cancel');
      await userEvent.click(cancelButton);

      // Picker should be hidden
      await waitFor(() => {
        expect(screen.queryByText('Select Section')).not.toBeInTheDocument();
      });
    });
  });
});
