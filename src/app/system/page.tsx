'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { useNamespaces } from '@/hooks/useNamespaces';
import NamespaceList from './components/NamespaceList';
import CreateNamespaceForm from './components/CreateNamespaceForm';
import InvitationList from './components/InvitationList';
import CreateInvitationForm from './components/CreateInvitationForm';

// Invitation type
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

// Filters for invitations
interface InvitationFilters {
  namespaceId: string;
  targetRole: 'namespace-admin' | 'instructor' | 'all';
  status: 'pending' | 'consumed' | 'revoked' | 'expired' | 'all';
}

// Loading fallback for Suspense boundary
function LoadingFallback() {
  return (
    <main style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Loading...</h1>
    </main>
  );
}

/**
 * System Administration Dashboard
 *
 * Only accessible to system-admin role.
 * Provides namespace and invitation management.
 */
export default function SystemAdminPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <SystemAdminContent />
    </Suspense>
  );
}

function SystemAdminContent() {
  const { user, isLoading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Tab state
  const initialTab = searchParams.get('tab') || 'namespaces';
  const [activeTab, setActiveTab] = useState<'namespaces' | 'invitations'>(
    initialTab === 'invitations' ? 'invitations' : 'namespaces'
  );

  // Namespace state
  const {
    namespaces,
    loading: namespacesLoading,
    error: namespacesError,
    fetchNamespaces,
    createNamespace,
    updateNamespace,
    deleteNamespace,
  } = useNamespaces();

  const [showCreateNamespaceForm, setShowCreateNamespaceForm] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Invitation state
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [invitationsError, setInvitationsError] = useState<string | null>(null);
  const [showCreateInvitationForm, setShowCreateInvitationForm] = useState(false);
  const [invitationFilters, setInvitationFilters] = useState<InvitationFilters>({
    namespaceId: 'all',
    targetRole: 'all',
    status: 'all',
  });

  // Fetch invitations
  const fetchInvitations = useCallback(async () => {
    setInvitationsLoading(true);
    setInvitationsError(null);

    try {
      const params = new URLSearchParams();
      if (invitationFilters.namespaceId !== 'all') {
        params.set('namespaceId', invitationFilters.namespaceId);
      }
      if (invitationFilters.targetRole !== 'all') {
        params.set('targetRole', invitationFilters.targetRole);
      }
      if (invitationFilters.status !== 'all') {
        params.set('status', invitationFilters.status);
      }

      const response = await fetch(`/api/system/invitations?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch invitations');
      }

      const data = await response.json();
      setInvitations(data.invitations);
    } catch (error) {
      console.error('Failed to fetch invitations:', error);
      setInvitationsError('Failed to load invitations');
    } finally {
      setInvitationsLoading(false);
    }
  }, [invitationFilters]);

  // Create invitation
  const createInvitation = async (
    email: string,
    namespaceId: string,
    targetRole: 'namespace-admin' | 'instructor'
  ) => {
    const response = await fetch('/api/system/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, namespaceId, targetRole }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to create invitation');
    }

    // Refresh list
    await fetchInvitations();
    setShowCreateInvitationForm(false);
  };

  // Revoke invitation
  const revokeInvitation = async (id: string) => {
    const response = await fetch(`/api/system/invitations/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to revoke invitation');
    }

    // Refresh list
    await fetchInvitations();
  };

  // Resend invitation
  const resendInvitation = async (id: string) => {
    const response = await fetch(`/api/system/invitations/${id}/resend`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to resend invitation');
    }

    // Refresh list
    await fetchInvitations();
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      router.push('/auth/signin');
    } catch (err) {
      console.error('Sign out error:', err);
      setIsSigningOut(false);
    }
  };

  // Update URL when tab changes
  const handleTabChange = (tab: 'namespaces' | 'invitations') => {
    setActiveTab(tab);
    router.push(`/system?tab=${tab}`, { scroll: false });
  };

  // Redirect if not system admin
  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'system-admin')) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  // Fetch namespaces on mount (needed for both tabs)
  useEffect(() => {
    if (user?.role === 'system-admin') {
      fetchNamespaces(includeInactive);
    }
  }, [user, includeInactive, fetchNamespaces]);

  // Fetch invitations when tab is active or filters change
  useEffect(() => {
    if (user?.role === 'system-admin' && activeTab === 'invitations') {
      fetchInvitations();
    }
  }, [user, activeTab, fetchInvitations]);

  // Show loading state
  if (authLoading || !user) {
    return (
      <main style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Loading...</h1>
      </main>
    );
  }

  // Verify system admin role
  if (user.role !== 'system-admin') {
    return null; // Will redirect
  }

  // Calculate statistics
  const totalNamespaces = namespaces.length;
  const activeNamespaces = namespaces.filter((ns) => ns.active).length;
  const totalUsers = namespaces.reduce((sum, ns) => sum + ns.userCount, 0);
  const pendingInvitations = invitations.filter(
    (inv) => !inv.consumedAt && !inv.revokedAt && new Date(inv.expiresAt) > new Date()
  ).length;

  const handleCreateNamespace = async (id: string, displayName: string) => {
    try {
      await createNamespace(id, displayName);
      setShowCreateNamespaceForm(false);
    } catch (err) {
      console.error('Failed to create namespace:', err);
    }
  };

  // Prepare namespace options for dropdowns
  const namespaceOptions = namespaces.map((ns) => ({
    id: ns.id,
    displayName: ns.displayName,
  }));

  return (
    <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          marginBottom: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <h1 style={{ marginBottom: '0.5rem' }}>System Administration</h1>
          <p style={{ color: '#666', margin: 0 }}>Manage namespaces and users across the system</p>
        </div>
        <button
          onClick={handleSignOut}
          disabled={isSigningOut}
          style={{
            padding: '0.5rem 1rem',
            background: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isSigningOut ? 'not-allowed' : 'pointer',
            opacity: isSigningOut ? 0.7 : 1,
          }}
        >
          {isSigningOut ? 'Signing out...' : 'Sign Out'}
        </button>
      </div>

      {/* Statistics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        <div
          style={{
            padding: '1.5rem',
            background: '#f8f9fa',
            borderRadius: '8px',
            border: '1px solid #dee2e6',
          }}
        >
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#0070f3' }}>{totalNamespaces}</div>
          <div style={{ color: '#666', marginTop: '0.5rem' }}>Total Namespaces</div>
        </div>

        <div
          style={{
            padding: '1.5rem',
            background: '#f8f9fa',
            borderRadius: '8px',
            border: '1px solid #dee2e6',
          }}
        >
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#28a745' }}>{activeNamespaces}</div>
          <div style={{ color: '#666', marginTop: '0.5rem' }}>Active Namespaces</div>
        </div>

        <div
          style={{
            padding: '1.5rem',
            background: '#f8f9fa',
            borderRadius: '8px',
            border: '1px solid #dee2e6',
          }}
        >
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#6c757d' }}>{totalUsers}</div>
          <div style={{ color: '#666', marginTop: '0.5rem' }}>Total Users</div>
        </div>

        <div
          style={{
            padding: '1.5rem',
            background: '#f8f9fa',
            borderRadius: '8px',
            border: '1px solid #dee2e6',
          }}
        >
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fd7e14' }}>{pendingInvitations}</div>
          <div style={{ color: '#666', marginTop: '0.5rem' }}>Pending Invitations</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div
        style={{
          display: 'flex',
          gap: '0',
          marginBottom: '2rem',
          borderBottom: '2px solid #dee2e6',
        }}
      >
        <button
          onClick={() => handleTabChange('namespaces')}
          style={{
            padding: '0.75rem 1.5rem',
            background: 'transparent',
            color: activeTab === 'namespaces' ? '#0070f3' : '#6c757d',
            border: 'none',
            borderBottom: activeTab === 'namespaces' ? '2px solid #0070f3' : '2px solid transparent',
            marginBottom: '-2px',
            cursor: 'pointer',
            fontWeight: activeTab === 'namespaces' ? '600' : '400',
            fontSize: '1rem',
          }}
        >
          Namespaces
        </button>
        <button
          onClick={() => handleTabChange('invitations')}
          style={{
            padding: '0.75rem 1.5rem',
            background: 'transparent',
            color: activeTab === 'invitations' ? '#0070f3' : '#6c757d',
            border: 'none',
            borderBottom: activeTab === 'invitations' ? '2px solid #0070f3' : '2px solid transparent',
            marginBottom: '-2px',
            cursor: 'pointer',
            fontWeight: activeTab === 'invitations' ? '600' : '400',
            fontSize: '1rem',
          }}
        >
          Invitations
        </button>
      </div>

      {/* Namespaces Tab */}
      {activeTab === 'namespaces' && (
        <>
          {/* Actions */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem',
            }}
          >
            <h2 style={{ margin: 0 }}>Namespaces</h2>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={includeInactive}
                  onChange={(e) => setIncludeInactive(e.target.checked)}
                />
                <span>Show inactive</span>
              </label>
              <button
                onClick={() => setShowCreateNamespaceForm(!showCreateNamespaceForm)}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#0070f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: '500',
                }}
              >
                {showCreateNamespaceForm ? 'Cancel' : 'Create New Namespace'}
              </button>
            </div>
          </div>

          {/* Create Form */}
          {showCreateNamespaceForm && (
            <div style={{ marginBottom: '2rem' }}>
              <CreateNamespaceForm
                onSubmit={handleCreateNamespace}
                onCancel={() => setShowCreateNamespaceForm(false)}
                loading={namespacesLoading}
              />
            </div>
          )}

          {/* Error Display */}
          {namespacesError && (
            <div
              style={{
                padding: '1rem',
                background: '#fee',
                border: '1px solid #fcc',
                borderRadius: '4px',
                color: '#c33',
                marginBottom: '2rem',
              }}
            >
              <strong>Error:</strong> {namespacesError}
            </div>
          )}

          {/* Namespace List */}
          {namespacesLoading && namespaces.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>Loading namespaces...</div>
          ) : (
            <NamespaceList
              namespaces={namespaces}
              onUpdate={updateNamespace}
              onDelete={deleteNamespace}
              loading={namespacesLoading}
            />
          )}
        </>
      )}

      {/* Invitations Tab */}
      {activeTab === 'invitations' && (
        <>
          {/* Actions */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <h2 style={{ margin: 0 }}>Invitations</h2>
            <button
              onClick={() => setShowCreateInvitationForm(!showCreateInvitationForm)}
              style={{
                padding: '0.5rem 1rem',
                background: '#0070f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '500',
              }}
            >
              {showCreateInvitationForm ? 'Cancel' : 'Create Invitation'}
            </button>
          </div>

          {/* Create Form */}
          {showCreateInvitationForm && (
            <div style={{ marginBottom: '2rem' }}>
              <CreateInvitationForm
                namespaces={namespaceOptions}
                onSubmit={createInvitation}
                onCancel={() => setShowCreateInvitationForm(false)}
                loading={invitationsLoading}
              />
            </div>
          )}

          {/* Filters */}
          <div
            style={{
              display: 'flex',
              gap: '1rem',
              marginBottom: '1.5rem',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <div>
              <label
                htmlFor="filter-namespace"
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  color: '#6c757d',
                  marginBottom: '0.25rem',
                }}
              >
                Namespace
              </label>
              <select
                id="filter-namespace"
                value={invitationFilters.namespaceId}
                onChange={(e) =>
                  setInvitationFilters((f) => ({ ...f, namespaceId: e.target.value }))
                }
                style={{
                  padding: '0.5rem',
                  borderRadius: '4px',
                  border: '1px solid #ced4da',
                  minWidth: '150px',
                }}
              >
                <option value="all">All Namespaces</option>
                {namespaceOptions.map((ns) => (
                  <option key={ns.id} value={ns.id}>
                    {ns.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="filter-role"
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  color: '#6c757d',
                  marginBottom: '0.25rem',
                }}
              >
                Role
              </label>
              <select
                id="filter-role"
                value={invitationFilters.targetRole}
                onChange={(e) =>
                  setInvitationFilters((f) => ({
                    ...f,
                    targetRole: e.target.value as 'namespace-admin' | 'instructor' | 'all',
                  }))
                }
                style={{
                  padding: '0.5rem',
                  borderRadius: '4px',
                  border: '1px solid #ced4da',
                  minWidth: '150px',
                }}
              >
                <option value="all">All Roles</option>
                <option value="namespace-admin">Namespace Admin</option>
                <option value="instructor">Instructor</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="filter-status"
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  color: '#6c757d',
                  marginBottom: '0.25rem',
                }}
              >
                Status
              </label>
              <select
                id="filter-status"
                value={invitationFilters.status}
                onChange={(e) =>
                  setInvitationFilters((f) => ({
                    ...f,
                    status: e.target.value as 'pending' | 'consumed' | 'revoked' | 'expired' | 'all',
                  }))
                }
                style={{
                  padding: '0.5rem',
                  borderRadius: '4px',
                  border: '1px solid #ced4da',
                  minWidth: '150px',
                }}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="consumed">Accepted</option>
                <option value="revoked">Revoked</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>

          {/* Error Display */}
          {invitationsError && (
            <div
              style={{
                padding: '1rem',
                background: '#fee',
                border: '1px solid #fcc',
                borderRadius: '4px',
                color: '#c33',
                marginBottom: '2rem',
              }}
            >
              <strong>Error:</strong> {invitationsError}
            </div>
          )}

          {/* Invitation List */}
          <InvitationList
            invitations={invitations}
            namespaces={namespaceOptions}
            loading={invitationsLoading}
            onRevoke={revokeInvitation}
            onResend={resendInvitation}
          />
        </>
      )}
    </main>
  );
}
