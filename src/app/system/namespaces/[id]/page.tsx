'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useNamespaces } from '@/hooks/useNamespaces';
import { User } from '@/server/auth/types';
import { Namespace } from '@/server/auth/types';

/**
 * Namespace User Management Page
 *
 * Allows system admins to manage users within a specific namespace.
 */
export default function NamespaceUsersPage() {
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const namespaceId = params.id as string;

  const {
    loading,
    error,
    getNamespaceUsers,
    createUser,
    updateUserRole,
    deleteUser,
  } = useNamespaces();

  const [namespace, setNamespace] = useState<Namespace | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'namespace-admin' | 'instructor' | 'student'>('student');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<'namespace-admin' | 'instructor' | 'student'>('student');
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Redirect if not system admin
  useEffect(() => {
    if (!authLoading && (!currentUser || currentUser.role !== 'system-admin')) {
      router.push('/');
    }
  }, [currentUser, authLoading, router]);

  // Fetch namespace and users
  useEffect(() => {
    if (currentUser?.role === 'system-admin' && namespaceId) {
      fetchData();
    }
  }, [currentUser, namespaceId]);

  const fetchData = async () => {
    try {
      // Fetch namespace details
      const nsResponse = await fetch(`/api/system/namespaces/${namespaceId}`);
      if (nsResponse.ok) {
        const nsData = await nsResponse.json();
        setNamespace(nsData.namespace);
      }

      // Fetch users
      const fetchedUsers = await getNamespaceUsers(namespaceId);
      setUsers(fetchedUsers);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);

    if (!newEmail.trim() || !newUsername.trim() || !newPassword.trim()) return;

    try {
      await createUser(namespaceId, newEmail.trim(), newUsername.trim(), newPassword, newUserRole);
      await fetchData();
      setNewEmail('');
      setNewUsername('');
      setNewPassword('');
      setNewUserRole('student');
      setShowCreateForm(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create user');
    }
  };

  const handleUpdateRole = async (userId: string) => {
    setActionError(null);
    try {
      await updateUserRole(userId, editingRole);
      await fetchData();
      setEditingUserId(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update user');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setActionError(null);
    try {
      await deleteUser(userId);
      await fetchData();
      setDeletingUserId(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  // Show loading state
  if (authLoading || !currentUser) {
    return (
      <main style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Loading...</h1>
      </main>
    );
  }

  // Verify system admin role
  if (currentUser.role !== 'system-admin') {
    return null; // Will redirect
  }

  return (
    <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <button
          onClick={() => router.push('/system')}
          style={{
            padding: '0.5rem 1rem',
            background: 'white',
            color: '#0070f3',
            border: '1px solid #0070f3',
            borderRadius: '4px',
            cursor: 'pointer',
            marginBottom: '1rem'
          }}
        >
          ← Back to System Admin
        </button>

        <h1 style={{ marginBottom: '0.5rem' }}>
          {namespace?.displayName || namespaceId}
        </h1>
        <p style={{ color: '#666', margin: 0, fontFamily: 'monospace' }}>
          {namespaceId}
        </p>
      </div>

      {/* Actions */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem'
      }}>
        <h2 style={{ margin: 0 }}>Users ({users.length})</h2>
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
          {showCreateForm ? 'Cancel' : 'Create New User'}
        </button>
      </div>

      {/* Error Display */}
      {(error || actionError) && (
        <div style={{
          padding: '1rem',
          background: '#fee',
          border: '1px solid #fcc',
          borderRadius: '4px',
          color: '#c33',
          marginBottom: '2rem'
        }}>
          <strong>Error:</strong> {error || actionError}
        </div>
      )}

      {/* Create User Form */}
      {showCreateForm && (
        <div style={{
          padding: '1.5rem',
          background: 'white',
          border: '1px solid #dee2e6',
          borderRadius: '8px',
          marginBottom: '2rem'
        }}>
          <h3 style={{ marginTop: 0 }}>Create New User</h3>
          <form onSubmit={handleCreateUser}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Email
              </label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Enter email"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Username
              </label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Enter username"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter password"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Role
              </label>
              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as any)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  fontSize: '1rem'
                }}
              >
                <option value="student">Student</option>
                <option value="instructor">Instructor</option>
                <option value="namespace-admin">Namespace Admin</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="submit"
                disabled={loading || !newEmail.trim() || !newUsername.trim() || !newPassword.trim()}
                style={{
                  padding: '0.5rem 1rem',
                  background: loading || !newEmail.trim() || !newUsername.trim() || !newPassword.trim() ? '#ccc' : '#0070f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading || !newEmail.trim() || !newUsername.trim() || !newPassword.trim() ? 'not-allowed' : 'pointer',
                  fontWeight: '500'
                }}
              >
                {loading ? 'Creating...' : 'Create User'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewEmail('');
                  setNewUsername('');
                  setNewPassword('');
                  setNewUserRole('student');
                }}
                disabled={loading}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* User List */}
      {loading && users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
          Loading users...
        </div>
      ) : users.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          background: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #dee2e6'
        }}>
          <p style={{ color: '#666', margin: 0 }}>
            No users in this namespace. Create a user to get started.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {users.map(user => (
            <div
              key={user.id}
              style={{
                padding: '1.5rem',
                background: 'white',
                border: '1px solid #dee2e6',
                borderRadius: '8px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, marginBottom: '0.5rem' }}>{user.username}</h3>

                  {editingUserId === user.id ? (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <select
                        value={editingRole}
                        onChange={(e) => setEditingRole(e.target.value as any)}
                        disabled={loading}
                        style={{
                          padding: '0.25rem 0.5rem',
                          border: '1px solid #dee2e6',
                          borderRadius: '4px'
                        }}
                      >
                        <option value="student">Student</option>
                        <option value="instructor">Instructor</option>
                        <option value="namespace-admin">Namespace Admin</option>
                      </select>
                      <button
                        onClick={() => handleUpdateRole(user.id)}
                        disabled={loading}
                        style={{
                          padding: '0.25rem 0.75rem',
                          background: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          fontSize: '0.875rem'
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingUserId(null)}
                        disabled={loading}
                        style={{
                          padding: '0.25rem 0.75rem',
                          background: '#6c757d',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          fontSize: '0.875rem'
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        background: user.role === 'namespace-admin' ? '#ffc107' :
                                   user.role === 'instructor' ? '#0070f3' : '#6c757d',
                        color: user.role === 'namespace-admin' ? '#000' : 'white',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                        fontWeight: '500'
                      }}>
                        {user.role}
                      </span>
                    </div>
                  )}

                  <div style={{ fontSize: '0.875rem', color: '#666' }}>
                    Created: {new Date(user.createdAt).toLocaleString()}
                  </div>
                </div>

                {/* User Actions */}
                {deletingUserId === user.id ? (
                  <div style={{
                    padding: '1rem',
                    background: '#fff3cd',
                    border: '1px solid #ffc107',
                    borderRadius: '4px'
                  }}>
                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem' }}>
                      Delete this user?
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        disabled={loading}
                        style={{
                          padding: '0.25rem 0.75rem',
                          background: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          fontSize: '0.875rem'
                        }}
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setDeletingUserId(null)}
                        disabled={loading}
                        style={{
                          padding: '0.25rem 0.75rem',
                          background: '#6c757d',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          fontSize: '0.875rem'
                        }}
                      >
                        No
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => {
                        setEditingUserId(user.id);
                        setEditingRole(user.role as any);
                      }}
                      disabled={loading}
                      style={{
                        padding: '0.5rem 1rem',
                        background: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: '0.875rem'
                      }}
                    >
                      Change Role
                    </button>
                    <button
                      onClick={() => setDeletingUserId(user.id)}
                      disabled={loading}
                      style={{
                        padding: '0.5rem 1rem',
                        background: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: '0.875rem'
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
