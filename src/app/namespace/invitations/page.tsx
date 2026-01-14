'use client';

/**
 * Namespace invitation management page.
 * Allows namespace admins to manage instructor invitations.
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useInvitations, InvitationFilter, SerializedInvitation } from '@/hooks/useInvitations';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function InvitationsPageContent() {
  const { user, isLoading: authLoading } = useAuth();
  const {
    invitations,
    loading,
    error,
    filter,
    setFilter,
    fetchInvitations,
    createInvitation,
    revokeInvitation,
    resendInvitation,
    clearError,
  } = useInvitations();

  // Form state
  const [email, setEmail] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal state
  const [modalType, setModalType] = useState<'revoke' | 'resend' | null>(null);
  const [selectedInvitation, setSelectedInvitation] = useState<SerializedInvitation | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Load invitations on mount
  useEffect(() => {
    if (!authLoading && user) {
      fetchInvitations();
    }
  }, [authLoading, user, fetchInvitations]);

  // Filter invitations based on current filter
  const filteredInvitations = filter === 'all'
    ? invitations
    : invitations.filter(inv => inv.status === filter);

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSuccessMessage('');

    const trimmedEmail = email.trim().toLowerCase();

    // Validate email
    if (!trimmedEmail) {
      setFormError('Please enter an email address');
      return;
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setFormError('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);
    try {
      await createInvitation(trimmedEmail, expiresInDays);
      setEmail('');
      setSuccessMessage(`Invitation sent to ${trimmedEmail}`);
      // Auto-clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create invitation';
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = (invitation: SerializedInvitation) => {
    setSelectedInvitation(invitation);
    setModalType('revoke');
  };

  const handleResend = (invitation: SerializedInvitation) => {
    setSelectedInvitation(invitation);
    setModalType('resend');
  };

  const handleConfirmAction = async () => {
    if (!selectedInvitation) return;

    setIsActionLoading(true);
    try {
      if (modalType === 'revoke') {
        await revokeInvitation(selectedInvitation.id);
      } else if (modalType === 'resend') {
        await resendInvitation(selectedInvitation.id);
      }
      closeModal();
    } catch (err) {
      // Error is handled by the hook
    } finally {
      setIsActionLoading(false);
    }
  };

  const closeModal = () => {
    setModalType(null);
    setSelectedInvitation(null);
  };

  const getStatusBadge = (status: string | undefined) => {
    const styles: Record<string, { bg: string; color: string; label: string }> = {
      pending: { bg: '#fff3cd', color: '#856404', label: 'Pending' },
      consumed: { bg: '#d4edda', color: '#155724', label: 'Accepted' },
      revoked: { bg: '#f8d7da', color: '#721c24', label: 'Revoked' },
      expired: { bg: '#e2e3e5', color: '#383d41', label: 'Expired' },
    };
    const style = styles[status || 'pending'] || styles.pending;

    return (
      <span style={{
        display: 'inline-block',
        padding: '0.25rem 0.75rem',
        borderRadius: '12px',
        fontSize: '0.75rem',
        fontWeight: 500,
        backgroundColor: style.bg,
        color: style.color,
      }}>
        {style.label}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (authLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: '#6c757d' }}>
        Loading...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: 0 }}>Manage Invitations</h1>
        <p style={{ color: '#6c757d', marginTop: '0.5rem' }}>
          Invite instructors to join your namespace
        </p>
      </div>

      {/* Global Error */}
      {error && (
        <div style={{
          marginBottom: '1rem',
          padding: '0.75rem',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          borderRadius: '4px',
          border: '1px solid #f5c6cb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>{error}</span>
          <button
            onClick={clearError}
            aria-label="Dismiss"
            style={{
              background: 'none',
              border: 'none',
              color: '#721c24',
              cursor: 'pointer',
              fontSize: '1.25rem',
              padding: '0 0.5rem',
            }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Create Invitation Form */}
      <div style={{
        marginBottom: '2rem',
        padding: '1.5rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #dee2e6',
      }}>
        <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.25rem' }}>
          Send Invitation
        </h2>
        <form onSubmit={handleCreateInvitation} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter email address"
            disabled={isSubmitting}
            autoComplete="email"
            style={{
              flex: '1 1 250px',
              padding: '0.5rem 0.75rem',
              fontSize: '1rem',
              border: '1px solid #ced4da',
              borderRadius: '4px',
            }}
          />
          <select
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(parseInt(e.target.value, 10))}
            disabled={isSubmitting}
            style={{
              padding: '0.5rem 0.75rem',
              border: '1px solid #ced4da',
              borderRadius: '4px',
            }}
          >
            <option value={1}>Expires in 1 day</option>
            <option value={7}>Expires in 7 days</option>
            <option value={14}>Expires in 14 days</option>
            <option value={30}>Expires in 30 days</option>
          </select>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: '0.5rem 1.5rem',
              backgroundColor: isSubmitting ? '#6c757d' : '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
              fontWeight: 500,
            }}
          >
            {isSubmitting ? 'Sending...' : 'Send Invitation'}
          </button>
        </form>

        {formError && (
          <div style={{
            marginTop: '0.75rem',
            padding: '0.5rem',
            backgroundColor: '#f8d7da',
            color: '#721c24',
            borderRadius: '4px',
            fontSize: '0.875rem',
          }}>
            {formError}
          </div>
        )}

        {successMessage && (
          <div style={{
            marginTop: '0.75rem',
            padding: '0.5rem',
            backgroundColor: '#d4edda',
            color: '#155724',
            borderRadius: '4px',
            fontSize: '0.875rem',
          }}>
            {successMessage}
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '1.5rem',
        borderBottom: '2px solid #dee2e6',
      }}>
        {(['all', 'pending', 'consumed', 'revoked'] as InvitationFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: filter === f ? '3px solid #0070f3' : '3px solid transparent',
              color: filter === f ? '#0070f3' : '#6c757d',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: filter === f ? 600 : 400,
              marginBottom: '-2px',
              textTransform: 'capitalize',
            }}
          >
            {f === 'consumed' ? 'Accepted' : f}
          </button>
        ))}
      </div>

      {/* Invitations List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#6c757d' }}>
          Loading...
        </div>
      ) : filteredInvitations.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          color: '#6c757d',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
        }}>
          <p style={{ margin: 0, fontSize: '1.1rem' }}>
            No invitations {filter !== 'all' ? `with status "${filter === 'consumed' ? 'accepted' : filter}"` : 'yet'}
          </p>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem' }}>
            {filter === 'all' ? 'Send an invitation using the form above.' : 'Try selecting a different filter.'}
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #dee2e6' }}>
                <th style={{ textAlign: 'left', padding: '0.75rem', fontWeight: 600 }}>Email</th>
                <th style={{ textAlign: 'left', padding: '0.75rem', fontWeight: 600 }}>Status</th>
                <th style={{ textAlign: 'left', padding: '0.75rem', fontWeight: 600 }}>Created</th>
                <th style={{ textAlign: 'left', padding: '0.75rem', fontWeight: 600 }}>Expires</th>
                <th style={{ textAlign: 'right', padding: '0.75rem', fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvitations.map((invitation) => (
                <tr
                  key={invitation.id}
                  style={{
                    borderBottom: '1px solid #dee2e6',
                    opacity: invitation.status === 'revoked' ? 0.6 : 1,
                  }}
                >
                  <td style={{ padding: '0.75rem' }}>{invitation.email}</td>
                  <td style={{ padding: '0.75rem' }}>{getStatusBadge(invitation.status)}</td>
                  <td style={{ padding: '0.75rem', color: '#6c757d', fontSize: '0.875rem' }}>
                    {formatDate(invitation.createdAt)}
                  </td>
                  <td style={{ padding: '0.75rem', color: '#6c757d', fontSize: '0.875rem' }}>
                    {formatDate(invitation.expiresAt)}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                    {invitation.status === 'pending' && (
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleResend(invitation)}
                          style={{
                            padding: '0.25rem 0.75rem',
                            backgroundColor: '#f8f9fa',
                            color: '#0070f3',
                            border: '1px solid #0070f3',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                          }}
                        >
                          Resend
                        </button>
                        <button
                          onClick={() => handleRevoke(invitation)}
                          style={{
                            padding: '0.25rem 0.75rem',
                            backgroundColor: '#f8f9fa',
                            color: '#dc3545',
                            border: '1px solid #dc3545',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                          }}
                        >
                          Revoke
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirmation Modal */}
      {modalType && selectedInvitation && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={closeModal}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '1.5rem',
              borderRadius: '8px',
              maxWidth: '400px',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>
              {modalType === 'revoke' ? 'Revoke Invitation' : 'Resend Invitation'}
            </h3>
            <p style={{ color: '#6c757d', marginBottom: '1.5rem' }}>
              {modalType === 'revoke'
                ? `Are you sure you want to revoke the invitation for ${selectedInvitation.email}? They won't be able to accept it.`
                : `Are you sure you want to resend the invitation to ${selectedInvitation.email}? A new email will be sent.`}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={closeModal}
                disabled={isActionLoading}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#f8f9fa',
                  color: '#6c757d',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  cursor: isActionLoading ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                disabled={isActionLoading}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: modalType === 'revoke' ? '#dc3545' : '#0070f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isActionLoading ? 'not-allowed' : 'pointer',
                }}
              >
                {isActionLoading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function InvitationsPage() {
  return (
    <ProtectedRoute requiredPermission="user.manage">
      <InvitationsPageContent />
    </ProtectedRoute>
  );
}
