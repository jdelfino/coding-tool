/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import InstructorInvitationList from '../InstructorInvitationList';

describe('InstructorInvitationList', () => {
  const mockOnRevoke = jest.fn();
  const mockOnResend = jest.fn();

  const createInvitation = (overrides = {}) => ({
    id: 'inv-1',
    email: 'instructor@example.com',
    namespaceId: 'ns-1',
    targetRole: 'instructor' as const,
    createdAt: '2024-01-15T10:00:00Z',
    expiresAt: '2024-01-22T10:00:00Z',
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock Date to ensure consistent status calculations
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-16T10:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows loading state when loading with no invitations', () => {
    render(
      <InstructorInvitationList
        invitations={[]}
        loading={true}
        onRevoke={mockOnRevoke}
        onResend={mockOnResend}
      />
    );

    expect(screen.getByText(/loading invitations/i)).toBeInTheDocument();
  });

  it('shows empty state when no invitations', () => {
    render(
      <InstructorInvitationList
        invitations={[]}
        loading={false}
        onRevoke={mockOnRevoke}
        onResend={mockOnResend}
      />
    );

    expect(screen.getByText(/no invitations found/i)).toBeInTheDocument();
  });

  it('renders invitation list with correct columns', () => {
    const invitations = [createInvitation()];
    render(
      <InstructorInvitationList
        invitations={invitations}
        loading={false}
        onRevoke={mockOnRevoke}
        onResend={mockOnResend}
      />
    );

    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText('Expires')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('displays pending invitation with resend and revoke buttons', () => {
    const invitations = [createInvitation({ status: 'pending' })];
    render(
      <InstructorInvitationList
        invitations={invitations}
        loading={false}
        onRevoke={mockOnRevoke}
        onResend={mockOnResend}
      />
    );

    expect(screen.getByText('instructor@example.com')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resend/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /revoke/i })).toBeInTheDocument();
  });

  it('displays consumed invitation with Accepted status', () => {
    const invitations = [createInvitation({
      status: 'consumed',
      consumedAt: '2024-01-16T08:00:00Z',
    })];
    render(
      <InstructorInvitationList
        invitations={invitations}
        loading={false}
        onRevoke={mockOnRevoke}
        onResend={mockOnResend}
      />
    );

    expect(screen.getByText('Accepted')).toBeInTheDocument();
    // No action buttons for consumed invitations
    expect(screen.queryByRole('button', { name: /resend/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /revoke/i })).not.toBeInTheDocument();
  });

  it('displays revoked invitation with Revoked status', () => {
    const invitations = [createInvitation({
      status: 'revoked',
      revokedAt: '2024-01-16T08:00:00Z',
    })];
    render(
      <InstructorInvitationList
        invitations={invitations}
        loading={false}
        onRevoke={mockOnRevoke}
        onResend={mockOnResend}
      />
    );

    expect(screen.getByText('Revoked')).toBeInTheDocument();
  });

  it('displays expired invitation with Expired status and resend button', () => {
    const invitations = [createInvitation({
      status: 'expired',
      expiresAt: '2024-01-10T10:00:00Z', // Past date
    })];
    render(
      <InstructorInvitationList
        invitations={invitations}
        loading={false}
        onRevoke={mockOnRevoke}
        onResend={mockOnResend}
      />
    );

    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resend/i })).toBeInTheDocument();
  });

  it('calls onResend when resend button is clicked', async () => {
    mockOnResend.mockResolvedValue(undefined);
    const invitations = [createInvitation({ status: 'pending' })];
    render(
      <InstructorInvitationList
        invitations={invitations}
        loading={false}
        onRevoke={mockOnRevoke}
        onResend={mockOnResend}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /resend/i }));

    await waitFor(() => {
      expect(mockOnResend).toHaveBeenCalledWith('inv-1');
    });
  });

  it('shows confirmation when revoke button is clicked', () => {
    const invitations = [createInvitation({ status: 'pending' })];
    render(
      <InstructorInvitationList
        invitations={invitations}
        loading={false}
        onRevoke={mockOnRevoke}
        onResend={mockOnResend}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /revoke/i }));

    // Should show confirm and cancel buttons
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('calls onRevoke when confirm is clicked after revoke', async () => {
    mockOnRevoke.mockResolvedValue(undefined);
    const invitations = [createInvitation({ status: 'pending' })];
    render(
      <InstructorInvitationList
        invitations={invitations}
        loading={false}
        onRevoke={mockOnRevoke}
        onResend={mockOnResend}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /revoke/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() => {
      expect(mockOnRevoke).toHaveBeenCalledWith('inv-1');
    });
  });

  it('cancels revoke when cancel is clicked', () => {
    const invitations = [createInvitation({ status: 'pending' })];
    render(
      <InstructorInvitationList
        invitations={invitations}
        loading={false}
        onRevoke={mockOnRevoke}
        onResend={mockOnResend}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /revoke/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    // Should be back to resend/revoke buttons
    expect(screen.getByRole('button', { name: /resend/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /revoke/i })).toBeInTheDocument();
    expect(mockOnRevoke).not.toHaveBeenCalled();
  });

  it('shows error message when revoke fails', async () => {
    mockOnRevoke.mockRejectedValue(new Error('Cannot revoke consumed invitation'));
    const invitations = [createInvitation({ status: 'pending' })];
    render(
      <InstructorInvitationList
        invitations={invitations}
        loading={false}
        onRevoke={mockOnRevoke}
        onResend={mockOnResend}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /revoke/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() => {
      expect(screen.getByText(/cannot revoke consumed invitation/i)).toBeInTheDocument();
    });
  });

  it('shows error message when resend fails', async () => {
    mockOnResend.mockRejectedValue(new Error('Failed to send email'));
    const invitations = [createInvitation({ status: 'pending' })];
    render(
      <InstructorInvitationList
        invitations={invitations}
        loading={false}
        onRevoke={mockOnRevoke}
        onResend={mockOnResend}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /resend/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to send email/i)).toBeInTheDocument();
    });
  });

  it('can dismiss error message', async () => {
    mockOnResend.mockRejectedValue(new Error('Failed to send email'));
    const invitations = [createInvitation({ status: 'pending' })];
    render(
      <InstructorInvitationList
        invitations={invitations}
        loading={false}
        onRevoke={mockOnRevoke}
        onResend={mockOnResend}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /resend/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to send email/i)).toBeInTheDocument();
    });

    // Click dismiss button
    fireEvent.click(screen.getByText('×'));

    expect(screen.queryByText(/failed to send email/i)).not.toBeInTheDocument();
  });

  it('renders multiple invitations', () => {
    const invitations = [
      createInvitation({ id: 'inv-1', email: 'user1@example.com', status: 'pending' }),
      createInvitation({ id: 'inv-2', email: 'user2@example.com', status: 'consumed' }),
      createInvitation({ id: 'inv-3', email: 'user3@example.com', status: 'expired' }),
    ];
    render(
      <InstructorInvitationList
        invitations={invitations}
        loading={false}
        onRevoke={mockOnRevoke}
        onResend={mockOnResend}
      />
    );

    expect(screen.getByText('user1@example.com')).toBeInTheDocument();
    expect(screen.getByText('user2@example.com')).toBeInTheDocument();
    expect(screen.getByText('user3@example.com')).toBeInTheDocument();
  });
});
