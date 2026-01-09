'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useNamespaces } from '@/hooks/useNamespaces';
import NamespaceList from './components/NamespaceList';
import CreateNamespaceForm from './components/CreateNamespaceForm';

/**
 * System Administration Dashboard
 *
 * Only accessible to system-admin role.
 * Provides namespace management and high-level statistics.
 */
export default function SystemAdminPage() {
  const { user, isLoading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const {
    namespaces,
    loading,
    error,
    fetchNamespaces,
    createNamespace,
    updateNamespace,
    deleteNamespace,
  } = useNamespaces();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

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

  // Redirect if not system admin
  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'system-admin')) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  // Fetch namespaces on mount
  useEffect(() => {
    if (user?.role === 'system-admin') {
      fetchNamespaces(includeInactive);
    }
  }, [user, includeInactive, fetchNamespaces]);

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
  const activeNamespaces = namespaces.filter(ns => ns.active).length;
  const totalUsers = namespaces.reduce((sum, ns) => sum + ns.userCount, 0);

  const handleCreateNamespace = async (id: string, displayName: string) => {
    try {
      await createNamespace(id, displayName);
      setShowCreateForm(false);
    } catch (err) {
      // Error is handled by the hook
      console.error('Failed to create namespace:', err);
    }
  };

  return (
    <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ marginBottom: '0.5rem' }}>System Administration</h1>
          <p style={{ color: '#666', margin: 0 }}>
            Manage namespaces and users across the system
          </p>
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
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div style={{
          padding: '1.5rem',
          background: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #dee2e6'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#0070f3' }}>
            {totalNamespaces}
          </div>
          <div style={{ color: '#666', marginTop: '0.5rem' }}>
            Total Namespaces
          </div>
        </div>

        <div style={{
          padding: '1.5rem',
          background: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #dee2e6'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#28a745' }}>
            {activeNamespaces}
          </div>
          <div style={{ color: '#666', marginTop: '0.5rem' }}>
            Active Namespaces
          </div>
        </div>

        <div style={{
          padding: '1.5rem',
          background: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #dee2e6'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#6c757d' }}>
            {totalUsers}
          </div>
          <div style={{ color: '#666', marginTop: '0.5rem' }}>
            Total Users
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem'
      }}>
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
            onClick={() => setShowCreateForm(!showCreateForm)}
            style={{
              padding: '0.5rem 1rem',
              background: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            {showCreateForm ? 'Cancel' : 'Create New Namespace'}
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div style={{ marginBottom: '2rem' }}>
          <CreateNamespaceForm
            onSubmit={handleCreateNamespace}
            onCancel={() => setShowCreateForm(false)}
            loading={loading}
          />
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div style={{
          padding: '1rem',
          background: '#fee',
          border: '1px solid #fcc',
          borderRadius: '4px',
          color: '#c33',
          marginBottom: '2rem'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Namespace List */}
      {loading && namespaces.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
          Loading namespaces...
        </div>
      ) : (
        <NamespaceList
          namespaces={namespaces}
          onUpdate={updateNamespace}
          onDelete={deleteNamespace}
          loading={loading}
        />
      )}
    </main>
  );
}
