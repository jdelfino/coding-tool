/**
 * Invitation List Component for System Admin
 *
 * Displays all invitations across namespaces with filtering and actions.
 */

import React, { useState } from 'react';

interface Invitation {
  id: string;
  email: string;
  namespaceId: string;
  targetRole: 'namespace-admin' | 'instructor';
  createdAt: string;
  expiresAt: string;
  consumedAt?: string;
  revokedAt?: string;
  consumedBy?: string;
}

interface Namespace {
  id: string;
  displayName: string;
}

interface InvitationListProps {
  invitations: Invitation[];
  namespaces: Namespace[];
  loading: boolean;
  onRevoke: (id: string) => Promise<void>;
  onResend: (id: string) => Promise<void>;
}

// Get invitation status
function getStatus(invitation: Invitation): 'pending' | 'consumed' | 'revoked' | 'expired' {
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

// Format role for display
function formatRole(role: string): string {
  if (role === 'namespace-admin') return 'Namespace Admin';
  if (role === 'instructor') return 'Instructor';
  return role;
}

// Status badge component
function StatusBadge({ status }: { status: 'pending' | 'consumed' | 'revoked' | 'expired' }) {
  const styles: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    consumed: 'bg-green-100 text-green-800',
    revoked: 'bg-red-100 text-red-800',
    expired: 'bg-gray-100 text-gray-800',
  };

  const labels: Record<string, string> = {
    pending: 'Pending',
    consumed: 'Accepted',
    revoked: 'Revoked',
    expired: 'Expired',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

export default function InvitationList({
  invitations,
  namespaces,
  loading,
  onRevoke,
  onResend,
}: InvitationListProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  // Get namespace display name
  const getNamespaceName = (id: string): string => {
    const ns = namespaces.find((n) => n.id === id);
    return ns?.displayName || id;
  };

  // Handle revoke
  const handleRevoke = async (id: string) => {
    setActionLoading(id);
    try {
      await onRevoke(id);
    } finally {
      setActionLoading(null);
      setConfirmRevoke(null);
    }
  };

  // Handle resend
  const handleResend = async (id: string) => {
    setActionLoading(id);
    try {
      await onResend(id);
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
        No invitations found
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #dee2e6' }}>
            <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: '600', color: '#495057' }}>
              Email
            </th>
            <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: '600', color: '#495057' }}>
              Namespace
            </th>
            <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: '600', color: '#495057' }}>
              Role
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

            return (
              <tr
                key={invitation.id}
                style={{
                  borderBottom: '1px solid #e9ecef',
                  opacity: isLoading ? 0.5 : 1,
                }}
              >
                <td style={{ padding: '12px 16px', fontWeight: '500' }}>{invitation.email}</td>
                <td style={{ padding: '12px 16px', color: '#495057' }}>
                  {getNamespaceName(invitation.namespaceId)}
                </td>
                <td style={{ padding: '12px 16px', color: '#495057' }}>
                  {formatRole(invitation.targetRole)}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <StatusBadge status={status} />
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
  );
}
