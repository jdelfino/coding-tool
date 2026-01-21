/**
 * Tests for Namespace Invitations Page
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import InvitationsPage from '../page';
import { useAuth } from '@/contexts/AuthContext';
import { useInvitations } from '@/hooks/useInvitations';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock AuthContext
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// Mock useInvitations hook
jest.mock('@/hooks/useInvitations', () => ({
  useInvitations: jest.fn(),
}));

// Mock ProtectedRoute to just render children
jest.mock('@/components/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('InvitationsPage', () => {
  const mockPush = jest.fn();
  const mockFetchInvitations = jest.fn();
  const mockCreateInvitation = jest.fn();
  const mockRevokeInvitation = jest.fn();
  const mockResendInvitation = jest.fn();
  const mockSetFilter = jest.fn();
  const mockClearError = jest.fn();

  const mockUser = {
    id: 'user-1',
    role: 'namespace-admin' as const,
    namespaceId: 'test-namespace',
  };

  const mockPendingInvitation = {
    id: 'inv-1',
    email: 'pending@example.com',
    targetRole: 'instructor',
    namespaceId: 'test-namespace',
    createdBy: 'user-1',
    createdAt: '2024-01-01T00:00:00Z',
    expiresAt: '2024-01-08T00:00:00Z',
    status: 'pending',
  };

  const mockConsumedInvitation = {
    id: 'inv-2',
    email: 'consumed@example.com',
    targetRole: 'instructor',
    namespaceId: 'test-namespace',
    createdBy: 'user-1',
    createdAt: '2024-01-01T00:00:00Z',
    expiresAt: '2024-01-08T00:00:00Z',
    consumedAt: '2024-01-02T00:00:00Z',
    status: 'consumed',
  };

  const mockRevokedInvitation = {
    id: 'inv-3',
    email: 'revoked@example.com',
    targetRole: 'instructor',
    namespaceId: 'test-namespace',
    createdBy: 'user-1',
    createdAt: '2024-01-01T00:00:00Z',
    expiresAt: '2024-01-08T00:00:00Z',
    revokedAt: '2024-01-03T00:00:00Z',
    status: 'revoked',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser, isLoading: false });
    (useInvitations as jest.Mock).mockReturnValue({
      invitations: [],
      loading: false,
      error: null,
      filter: 'all',
      setFilter: mockSetFilter,
      fetchInvitations: mockFetchInvitations,
      createInvitation: mockCreateInvitation,
      revokeInvitation: mockRevokeInvitation,
      resendInvitation: mockResendInvitation,
      clearError: mockClearError,
    });
  });

  describe('Rendering', () => {
    it('renders page title', () => {
      render(<InvitationsPage />);
      expect(screen.getByRole('heading', { name: /manage invitations/i })).toBeInTheDocument();
    });

    it('renders loading skeleton initially', () => {
      (useInvitations as jest.Mock).mockReturnValue({
        invitations: [],
        loading: true,
        error: null,
        filter: 'all',
        setFilter: mockSetFilter,
        fetchInvitations: mockFetchInvitations,
        createInvitation: mockCreateInvitation,
        revokeInvitation: mockRevokeInvitation,
        resendInvitation: mockResendInvitation,
        clearError: mockClearError,
      });

      render(<InvitationsPage />);
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('renders filter tabs', () => {
      render(<InvitationsPage />);
      expect(screen.getByRole('button', { name: /all/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /pending/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /accepted/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /revoked/i })).toBeInTheDocument();
    });

    it('renders create invitation form', () => {
      render(<InvitationsPage />);
      expect(screen.getByPlaceholderText(/email address/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send invitation/i })).toBeInTheDocument();
    });

    it('calls fetchInvitations on mount', () => {
      render(<InvitationsPage />);
      expect(mockFetchInvitations).toHaveBeenCalled();
    });
  });

  describe('Invitations List', () => {
    it('displays invitations list after load', () => {
      (useInvitations as jest.Mock).mockReturnValue({
        invitations: [mockPendingInvitation, mockConsumedInvitation],
        loading: false,
        error: null,
        filter: 'all',
        setFilter: mockSetFilter,
        fetchInvitations: mockFetchInvitations,
        createInvitation: mockCreateInvitation,
        revokeInvitation: mockRevokeInvitation,
        resendInvitation: mockResendInvitation,
        clearError: mockClearError,
      });

      render(<InvitationsPage />);

      expect(screen.getByText('pending@example.com')).toBeInTheDocument();
      expect(screen.getByText('consumed@example.com')).toBeInTheDocument();
    });

    it('shows empty state when no invitations', () => {
      (useInvitations as jest.Mock).mockReturnValue({
        invitations: [],
        loading: false,
        error: null,
        filter: 'all',
        setFilter: mockSetFilter,
        fetchInvitations: mockFetchInvitations,
        createInvitation: mockCreateInvitation,
        revokeInvitation: mockRevokeInvitation,
        resendInvitation: mockResendInvitation,
        clearError: mockClearError,
      });

      render(<InvitationsPage />);

      expect(screen.getByText(/no invitations/i)).toBeInTheDocument();
    });

    it('displays status badges correctly', () => {
      (useInvitations as jest.Mock).mockReturnValue({
        invitations: [mockPendingInvitation, mockConsumedInvitation, mockRevokedInvitation],
        loading: false,
        error: null,
        filter: 'all',
        setFilter: mockSetFilter,
        fetchInvitations: mockFetchInvitations,
        createInvitation: mockCreateInvitation,
        revokeInvitation: mockRevokeInvitation,
        resendInvitation: mockResendInvitation,
        clearError: mockClearError,
      });

      render(<InvitationsPage />);

      // Check for status indicators
      const pendingBadge = screen.getByText(/pending/i, { selector: 'span' });
      expect(pendingBadge).toBeInTheDocument();
    });
  });

  describe('Filter Tabs', () => {
    it('filters invitations by status', () => {
      render(<InvitationsPage />);

      const pendingTab = screen.getByRole('button', { name: /pending/i });
      fireEvent.click(pendingTab);

      expect(mockSetFilter).toHaveBeenCalledWith('pending');
    });

    it('highlights active filter tab', () => {
      (useInvitations as jest.Mock).mockReturnValue({
        invitations: [],
        loading: false,
        error: null,
        filter: 'pending',
        setFilter: mockSetFilter,
        fetchInvitations: mockFetchInvitations,
        createInvitation: mockCreateInvitation,
        revokeInvitation: mockRevokeInvitation,
        resendInvitation: mockResendInvitation,
        clearError: mockClearError,
      });

      render(<InvitationsPage />);

      const pendingTab = screen.getByRole('button', { name: /pending/i });
      expect(pendingTab).toHaveStyle({ borderBottom: expect.stringContaining('#0070f3') });
    });
  });

  describe('Create Invitation', () => {
    it('creates new invitation', async () => {
      mockCreateInvitation.mockResolvedValue(mockPendingInvitation);

      render(<InvitationsPage />);

      const emailInput = screen.getByPlaceholderText(/email address/i);
      const submitButton = screen.getByRole('button', { name: /send invitation/i });

      fireEvent.change(emailInput, { target: { value: 'new@example.com' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockCreateInvitation).toHaveBeenCalledWith('new@example.com', 7);
      });
    });

    it('shows error for invalid email', async () => {
      render(<InvitationsPage />);

      const emailInput = screen.getByPlaceholderText(/email address/i);
      const submitButton = screen.getByRole('button', { name: /send invitation/i });

      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/valid email address/i)).toBeInTheDocument();
      });

      expect(mockCreateInvitation).not.toHaveBeenCalled();
    });

    it('shows error for duplicate invitation', async () => {
      mockCreateInvitation.mockRejectedValue(new Error('An invitation has already been sent to this email'));

      render(<InvitationsPage />);

      const emailInput = screen.getByPlaceholderText(/email address/i);
      const submitButton = screen.getByRole('button', { name: /send invitation/i });

      fireEvent.change(emailInput, { target: { value: 'existing@example.com' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/already been sent/i)).toBeInTheDocument();
      });
    });

    it('clears email input after successful creation', async () => {
      mockCreateInvitation.mockResolvedValue(mockPendingInvitation);

      render(<InvitationsPage />);

      const emailInput = screen.getByPlaceholderText(/email address/i) as HTMLInputElement;
      const submitButton = screen.getByRole('button', { name: /send invitation/i });

      fireEvent.change(emailInput, { target: { value: 'new@example.com' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(emailInput.value).toBe('');
      });
    });

    it('shows success message after creating invitation', async () => {
      mockCreateInvitation.mockResolvedValue(mockPendingInvitation);

      render(<InvitationsPage />);

      const emailInput = screen.getByPlaceholderText(/email address/i);
      const submitButton = screen.getByRole('button', { name: /send invitation/i });

      fireEvent.change(emailInput, { target: { value: 'new@example.com' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/invitation sent/i)).toBeInTheDocument();
      });
    });
  });

  describe('Row Actions', () => {
    it('shows revoke button for pending invitations', () => {
      (useInvitations as jest.Mock).mockReturnValue({
        invitations: [mockPendingInvitation],
        loading: false,
        error: null,
        filter: 'all',
        setFilter: mockSetFilter,
        fetchInvitations: mockFetchInvitations,
        createInvitation: mockCreateInvitation,
        revokeInvitation: mockRevokeInvitation,
        resendInvitation: mockResendInvitation,
        clearError: mockClearError,
      });

      render(<InvitationsPage />);

      // Use exact match to avoid matching the "revoked" filter tab
      expect(screen.getByRole('button', { name: 'Revoke' })).toBeInTheDocument();
    });

    it('shows resend button for pending invitations', () => {
      (useInvitations as jest.Mock).mockReturnValue({
        invitations: [mockPendingInvitation],
        loading: false,
        error: null,
        filter: 'all',
        setFilter: mockSetFilter,
        fetchInvitations: mockFetchInvitations,
        createInvitation: mockCreateInvitation,
        revokeInvitation: mockRevokeInvitation,
        resendInvitation: mockResendInvitation,
        clearError: mockClearError,
      });

      render(<InvitationsPage />);

      expect(screen.getByRole('button', { name: 'Resend' })).toBeInTheDocument();
    });

    it('hides action buttons for consumed invitations', () => {
      (useInvitations as jest.Mock).mockReturnValue({
        invitations: [mockConsumedInvitation],
        loading: false,
        error: null,
        filter: 'all',
        setFilter: mockSetFilter,
        fetchInvitations: mockFetchInvitations,
        createInvitation: mockCreateInvitation,
        revokeInvitation: mockRevokeInvitation,
        resendInvitation: mockResendInvitation,
        clearError: mockClearError,
      });

      render(<InvitationsPage />);

      // Use exact match to avoid matching the "revoked" filter tab
      expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Resend' })).not.toBeInTheDocument();
    });

    it('hides action buttons for revoked invitations', () => {
      (useInvitations as jest.Mock).mockReturnValue({
        invitations: [mockRevokedInvitation],
        loading: false,
        error: null,
        filter: 'all',
        setFilter: mockSetFilter,
        fetchInvitations: mockFetchInvitations,
        createInvitation: mockCreateInvitation,
        revokeInvitation: mockRevokeInvitation,
        resendInvitation: mockResendInvitation,
        clearError: mockClearError,
      });

      render(<InvitationsPage />);

      // Use exact match to avoid matching the "revoked" filter tab
      expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Resend' })).not.toBeInTheDocument();
    });
  });

  describe('Revoke Flow', () => {
    it('shows confirmation modal when revoking', async () => {
      (useInvitations as jest.Mock).mockReturnValue({
        invitations: [mockPendingInvitation],
        loading: false,
        error: null,
        filter: 'all',
        setFilter: mockSetFilter,
        fetchInvitations: mockFetchInvitations,
        createInvitation: mockCreateInvitation,
        revokeInvitation: mockRevokeInvitation,
        resendInvitation: mockResendInvitation,
        clearError: mockClearError,
      });

      render(<InvitationsPage />);

      const revokeButton = screen.getByRole('button', { name: 'Revoke' });
      fireEvent.click(revokeButton);

      await waitFor(() => {
        expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
      });
    });

    it('revokes invitation on confirmation', async () => {
      mockRevokeInvitation.mockResolvedValue(mockRevokedInvitation);

      (useInvitations as jest.Mock).mockReturnValue({
        invitations: [mockPendingInvitation],
        loading: false,
        error: null,
        filter: 'all',
        setFilter: mockSetFilter,
        fetchInvitations: mockFetchInvitations,
        createInvitation: mockCreateInvitation,
        revokeInvitation: mockRevokeInvitation,
        resendInvitation: mockResendInvitation,
        clearError: mockClearError,
      });

      render(<InvitationsPage />);

      const revokeButton = screen.getByRole('button', { name: 'Revoke' });
      fireEvent.click(revokeButton);

      await waitFor(() => {
        const confirmButton = screen.getByRole('button', { name: /confirm/i });
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(mockRevokeInvitation).toHaveBeenCalledWith('inv-1');
      });
    });

    it('closes modal on cancel', async () => {
      (useInvitations as jest.Mock).mockReturnValue({
        invitations: [mockPendingInvitation],
        loading: false,
        error: null,
        filter: 'all',
        setFilter: mockSetFilter,
        fetchInvitations: mockFetchInvitations,
        createInvitation: mockCreateInvitation,
        revokeInvitation: mockRevokeInvitation,
        resendInvitation: mockResendInvitation,
        clearError: mockClearError,
      });

      render(<InvitationsPage />);

      const revokeButton = screen.getByRole('button', { name: 'Revoke' });
      fireEvent.click(revokeButton);

      await waitFor(() => {
        const cancelButton = screen.getByRole('button', { name: /cancel/i });
        fireEvent.click(cancelButton);
      });

      await waitFor(() => {
        expect(screen.queryByText(/are you sure/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Resend Flow', () => {
    it('shows confirmation modal when resending', async () => {
      (useInvitations as jest.Mock).mockReturnValue({
        invitations: [mockPendingInvitation],
        loading: false,
        error: null,
        filter: 'all',
        setFilter: mockSetFilter,
        fetchInvitations: mockFetchInvitations,
        createInvitation: mockCreateInvitation,
        revokeInvitation: mockRevokeInvitation,
        resendInvitation: mockResendInvitation,
        clearError: mockClearError,
      });

      render(<InvitationsPage />);

      const resendButton = screen.getByRole('button', { name: /resend/i });
      fireEvent.click(resendButton);

      await waitFor(() => {
        expect(screen.getByText(/resend invitation/i)).toBeInTheDocument();
      });
    });

    it('resends invitation on confirmation', async () => {
      mockResendInvitation.mockResolvedValue(mockPendingInvitation);

      (useInvitations as jest.Mock).mockReturnValue({
        invitations: [mockPendingInvitation],
        loading: false,
        error: null,
        filter: 'all',
        setFilter: mockSetFilter,
        fetchInvitations: mockFetchInvitations,
        createInvitation: mockCreateInvitation,
        revokeInvitation: mockRevokeInvitation,
        resendInvitation: mockResendInvitation,
        clearError: mockClearError,
      });

      render(<InvitationsPage />);

      const resendButton = screen.getByRole('button', { name: /resend/i });
      fireEvent.click(resendButton);

      await waitFor(() => {
        const confirmButton = screen.getByRole('button', { name: /confirm/i });
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(mockResendInvitation).toHaveBeenCalledWith('inv-1');
      });
    });
  });

  describe('Error States', () => {
    it('displays error message from hook', () => {
      (useInvitations as jest.Mock).mockReturnValue({
        invitations: [],
        loading: false,
        error: 'Failed to load invitations. Please refresh.',
        filter: 'all',
        setFilter: mockSetFilter,
        fetchInvitations: mockFetchInvitations,
        createInvitation: mockCreateInvitation,
        revokeInvitation: mockRevokeInvitation,
        resendInvitation: mockResendInvitation,
        clearError: mockClearError,
      });

      render(<InvitationsPage />);

      expect(screen.getByText(/failed to load invitations/i)).toBeInTheDocument();
    });

    it('allows dismissing error', () => {
      (useInvitations as jest.Mock).mockReturnValue({
        invitations: [],
        loading: false,
        error: 'Some error',
        filter: 'all',
        setFilter: mockSetFilter,
        fetchInvitations: mockFetchInvitations,
        createInvitation: mockCreateInvitation,
        revokeInvitation: mockRevokeInvitation,
        resendInvitation: mockResendInvitation,
        clearError: mockClearError,
      });

      render(<InvitationsPage />);

      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      fireEvent.click(dismissButton);

      expect(mockClearError).toHaveBeenCalled();
    });
  });

  describe('Auth Loading', () => {
    it('shows loading when auth is loading', () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: true });

      render(<InvitationsPage />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
  });
});
