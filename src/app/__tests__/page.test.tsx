/**
 * Unit tests for root page routing logic
 * Tests that users are redirected to the correct dashboard based on their role
 * @jest-environment jsdom
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react';
import Home from '../page';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

// Mock dependencies
jest.mock('@/contexts/AuthContext');
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

describe('Home Page - Role-based Routing', () => {
  const mockPush = jest.fn();
  const mockRouter = { push: mockPush };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  describe('when user is authenticated', () => {
    it('redirects admin users to /admin', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: '1', username: 'adam', role: 'namespace-admin' },
        isLoading: false,
      });

      render(<Home />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/admin');
      });
    });

    it('redirects instructor users to /instructor', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: '2', username: 'prof', role: 'instructor' },
        isLoading: false,
      });

      render(<Home />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/instructor');
      });
    });

    it('redirects student users to /student', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: '3', username: 'student1', role: 'student' },
        isLoading: false,
      });

      render(<Home />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/student');
      });
    });
  });

  describe('when user is not authenticated', () => {
    it('redirects to /auth/signin', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        isLoading: false,
      });

      render(<Home />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/auth/signin');
      });
    });
  });

  describe('when auth is loading', () => {
    it('does not redirect while loading', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        isLoading: true,
      });

      render(<Home />);

      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});
