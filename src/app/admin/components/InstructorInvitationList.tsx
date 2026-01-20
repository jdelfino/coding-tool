'use client';

/**
 * Instructor Invitation List for Namespace Admins
 *
 * Displays pending instructor invitations with actions to resend or revoke.
 * Simplified from the system admin version - no namespace column needed.
 */

import React, { useState } from 'react';

interface Invitation {
  id: string;
  email: string;
  namespaceId: string;
  targetRole: 'instructor';
  createdAt: string;
  expiresAt: string;
  consumedAt?: string;
  revokedAt?: string;
  consumedBy?: string;
  status?: 'pending' | 'consumed' | 'revoked' | 'expired';
}

interface InstructorInvitationListProps {
  invitations: Invitation[];
  loading: boolean;
  onRevoke: (id: string) => Promise<void>;
  onResend: (id: string) => Promise<void>;
}

// Get invitation status
function getStatus(invitation: Invitation): 'pending' | 'consumed' | 'revoked' | 'expired' {
  if (invitation.status) return invitation.status;
  if (invitation.revokedAt) return 'revoked';
  if (invitation.consumedAt) return 'consumed';
  if (new Date(invitation.expiresAt) < new Date()) return 'expired';
  return 'pending';
}

// Format date for display
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Status badge styles
const statusStyles: Record<string, { background: string; color: string }> = {
  pending: { background: '#fff3cd', color: '#856404' },
  consumed: { background: '#d4edda', color: '#155724' },
  revoked: { background: '#f8d7da', color: '#721c24' },
  expired: { background: '#e9ecef', color: '#495057' },
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  consumed: 'Accepted',
  revoked: 'Revoked',
  expired: 'Expired',
};

export default function InstructorInvitationList({
  invitations,
  loading,
  onRevoke,
  onResend,
}: InstructorInvitationListProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRevoke = async (id: string) => {
    setActionLoading(id);
    setError(null);
    try {
      await onRevoke(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke invitation');
    } finally {
      setActionLoading(null);
      setConfirmRevoke(null);
    }
  };

  const handleResend = async (id: string) => {
    setActionLoading(id);
    setError(null);
    try {
      await onResend(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend invitation');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && invitations.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
        Loading invitations...
      </div>
    );
  }

  if (invitations.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '2rem',
          color: '#666',
          background: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #dee2e6',
        }}
      >
        No invitations found. Use the form above to invite instructors.
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.75rem',
            background: '#fee',
            border: '1px solid #fcc',
            borderRadius: '4px',
            color: '#c33',
            fontSize: '0.875rem',
          }}
        >
          {error}
          <button
            onClick={() => setError(null)}
            style={{
              marginLeft: '0.5rem',
              background: 'none',
              border: 'none',
              color: '#c33',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            &times;
          </button>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #dee2e6' }}>
              <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: '600', color: '#495057' }}>
                Email
              </th>
              <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: '600', color: '#495057' }}>
                Status
              </th>
              <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: '600', color: '#495057' }}>
                Created
              </th>
              <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: '600', color: '#495057' }}>
                Expires
              </th>
              <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: '600', color: '#495057' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {invitations.map((invitation) => {
              const status = getStatus(invitation);
              const isLoading = actionLoading === invitation.id;
              const isConfirming = confirmRevoke === invitation.id;
              const style = statusStyles[status];

              return (
                <tr
                  key={invitation.id}
                  style={{
                    borderBottom: '1px solid #e9ecef',
                    opacity: isLoading ? 0.5 : 1,
                  }}
                >
                  <td style={{ padding: '12px 16px', fontWeight: '500' }}>{invitation.email}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        background: style.background,
                        color: style.color,
                      }}
                    >
                      {statusLabels[status]}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#6c757d', fontSize: '0.875rem' }}>
                    {formatDate(invitation.createdAt)}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#6c757d', fontSize: '0.875rem' }}>
                    {formatDate(invitation.expiresAt)}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    {status === 'pending' && (
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        {isConfirming ? (
                          <>
                            <button
                              onClick={() => handleRevoke(invitation.id)}
                              disabled={isLoading}
                              style={{
                                padding: '4px 12px',
                                fontSize: '0.875rem',
                                background: '#dc3545',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {isLoading ? 'Revoking...' : 'Confirm'}
                            </button>
                            <button
                              onClick={() => setConfirmRevoke(null)}
                              disabled={isLoading}
                              style={{
                                padding: '4px 12px',
                                fontSize: '0.875rem',
                                background: '#6c757d',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                              }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleResend(invitation.id)}
                              disabled={isLoading}
                              style={{
                                padding: '4px 12px',
                                fontSize: '0.875rem',
                                background: '#0070f3',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {isLoading ? 'Sending...' : 'Resend'}
                            </button>
                            <button
                              onClick={() => setConfirmRevoke(invitation.id)}
                              disabled={isLoading}
                              style={{
                                padding: '4px 12px',
                                fontSize: '0.875rem',
                                background: 'white',
                                color: '#dc3545',
                                border: '1px solid #dc3545',
                                borderRadius: '4px',
                                cursor: 'pointer',
                              }}
                            >
                              Revoke
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    {status === 'expired' && (
                      <button
                        onClick={() => handleResend(invitation.id)}
                        disabled={isLoading}
                        style={{
                          padding: '4px 12px',
                          fontSize: '0.875rem',
                          background: '#0070f3',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: isLoading ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {isLoading ? 'Sending...' : 'Resend'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
