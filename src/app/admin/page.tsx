'use client';

/**
 * Admin panel for system administration and user management.
 * Admins have full access, instructors have limited access.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import UserList from './components/UserList';
import AddInstructorForm from './components/AddInstructorForm';
import type { User, UserRole } from '@/server/auth/types';

interface SystemStats {
  users: {
    total: number;
    byRole: {
      admin: number;
      instructor: number;
      student: number;
    };
  };
  classes: { total: number };
  sections: { total: number };
  sessions: { active: number };
}

function AdminPage() {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'instructors' | 'students'>('overview');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [instructors, setInstructors] = useState<User[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [roleChangeLoading, setRoleChangeLoading] = useState<string | null>(null);

  // Admin page requires authenticated user with role
  if (!user) return null;
  const isAdmin = user.role === 'admin';

  const loadStats = async () => {
    if (!isAdmin) return;
    
    try {
      const res = await fetch('/api/admin/stats', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const loadUsers = async () => {
    setIsLoading(true);
    setError('');
    try {
      if (isAdmin) {
        // Admins can see all users including other admins
        const res = await fetch('/api/admin/users', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load users');
        const data = await res.json();
        const users = data.users || [];
        setAllUsers(users);
        setInstructors(users.filter((u: User) => u.role === 'instructor'));
        setStudents(users.filter((u: User) => u.role === 'student'));
      } else {
        // Instructors can only see instructors and students
        const [instructorsRes, studentsRes] = await Promise.all([
          fetch('/api/admin/users?role=instructor', { credentials: 'include' }),
          fetch('/api/admin/users?role=student', { credentials: 'include' })
        ]);

        if (!instructorsRes.ok || !studentsRes.ok) {
          throw new Error('Failed to load users');
        }

        const instructorsData = await instructorsRes.json();
        const studentsData = await studentsRes.json();

        setInstructors(instructorsData.users || []);
        setStudents(studentsData.users || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    loadStats();
  }, [isAdmin]);

  const handleAddInstructor = async (username: string) => {
    const response = await fetch('/api/admin/instructors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
      credentials: 'include'
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to create instructor');
    }

    // Reload users
    await loadUsers();
    await loadStats();
  };

  const handleChangeRole = async (userId: string, newRole: UserRole) => {
    if (!isAdmin) return;
    
    setRoleChangeLoading(userId);
    setError('');
    
    try {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
        credentials: 'include'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to change role');
      }

      // Reload users and stats
      await loadUsers();
      await loadStats();
    } catch (err: any) {
      setError(err.message || 'Failed to change user role');
    } finally {
      setRoleChangeLoading(null);
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to delete user');
    }

    // Reload users
    await loadUsers();
    await loadStats();
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
      setIsSigningOut(false);
    }
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'admin': return '#dc3545';
      case 'instructor': return '#0070f3';
      case 'student': return '#28a745';
    }
  };

  return (
    <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '2rem'
      }}>
        <h1 style={{ margin: 0 }}>{isAdmin ? 'System Administration' : 'Admin Panel'}</h1>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '1rem',
          padding: '0.5rem 1rem',
          backgroundColor: '#f8f9fa',
          borderRadius: '4px',
          border: '1px solid #dee2e6'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{user.username}</span>
            <span style={{ 
              fontSize: '0.75rem', 
              color: getRoleBadgeColor(user.role),
              fontWeight: '500',
              textTransform: 'capitalize'
            }}>{user.role}</span>
          </div>
          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isSigningOut ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem',
              opacity: isSigningOut ? 0.6 : 1
            }}
          >
            {isSigningOut ? 'Signing out...' : 'Sign Out'}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          marginBottom: '1rem',
          padding: '0.75rem',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          borderRadius: '4px',
          border: '1px solid #f5c6cb'
        }}>
          {error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: '1rem', 
        marginBottom: '2rem',
        borderBottom: '2px solid #dee2e6'
      }}>
        {isAdmin && (
          <button
            onClick={() => setActiveTab('overview')}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'overview' ? '3px solid #0070f3' : '3px solid transparent',
              color: activeTab === 'overview' ? '#0070f3' : '#6c757d',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: activeTab === 'overview' ? 600 : 400,
              marginBottom: '-2px'
            }}
          >
            Overview
          </button>
        )}
        {isAdmin && (
          <button
            onClick={() => setActiveTab('users')}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'users' ? '3px solid #0070f3' : '3px solid transparent',
              color: activeTab === 'users' ? '#0070f3' : '#6c757d',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: activeTab === 'users' ? 600 : 400,
              marginBottom: '-2px'
            }}
          >
            All Users ({allUsers.length})
          </button>
        )}
        <button
          onClick={() => setActiveTab('instructors')}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'instructors' ? '3px solid #0070f3' : '3px solid transparent',
            color: activeTab === 'instructors' ? '#0070f3' : '#6c757d',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: activeTab === 'instructors' ? 600 : 400,
            marginBottom: '-2px'
          }}
        >
          Instructors ({instructors.length})
        </button>
        <button
          onClick={() => setActiveTab('students')}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'students' ? '3px solid #0070f3' : '3px solid transparent',
            color: activeTab === 'students' ? '#0070f3' : '#6c757d',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: activeTab === 'students' ? 600 : 400,
            marginBottom: '-2px'
          }}
        >
          Students ({students.length})
        </button>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#6c757d' }}>
          Loading...
        </div>
      ) : (
        <>
          {/* Overview Tab (Admin Only) */}
          {activeTab === 'overview' && isAdmin && stats && (
            <div>
              <h2 style={{ marginBottom: '1.5rem' }}>System Overview</h2>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                marginBottom: '2rem'
              }}>
                <div style={{ 
                  padding: '1.5rem', 
                  backgroundColor: '#f8f9fa', 
                  borderRadius: '8px',
                  border: '1px solid #dee2e6'
                }}>
                  <div style={{ fontSize: '0.875rem', color: '#6c757d', marginBottom: '0.5rem' }}>
                    Total Users
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                    {stats.users.total}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6c757d', marginTop: '0.5rem' }}>
                    {stats.users.byRole.admin} admin · {stats.users.byRole.instructor} instructors · {stats.users.byRole.student} students
                  </div>
                </div>
                
                <div style={{ 
                  padding: '1.5rem', 
                  backgroundColor: '#f8f9fa', 
                  borderRadius: '8px',
                  border: '1px solid #dee2e6'
                }}>
                  <div style={{ fontSize: '0.875rem', color: '#6c757d', marginBottom: '0.5rem' }}>
                    Classes
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                    {stats.classes.total}
                  </div>
                </div>
                
                <div style={{ 
                  padding: '1.5rem', 
                  backgroundColor: '#f8f9fa', 
                  borderRadius: '8px',
                  border: '1px solid #dee2e6'
                }}>
                  <div style={{ fontSize: '0.875rem', color: '#6c757d', marginBottom: '0.5rem' }}>
                    Sections
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                    {stats.sections.total}
                  </div>
                </div>
                
                <div style={{ 
                  padding: '1.5rem', 
                  backgroundColor: '#d4edda', 
                  borderRadius: '8px',
                  border: '1px solid #c3e6cb'
                }}>
                  <div style={{ fontSize: '0.875rem', color: '#155724', marginBottom: '0.5rem' }}>
                    Active Sessions
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#155724' }}>
                    {stats.sessions.active}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* All Users Tab (Admin Only) */}
          {activeTab === 'users' && isAdmin && (
            <div>
              <h2 style={{ marginBottom: '1rem' }}>All Users</h2>
              <p style={{ color: '#6c757d', marginBottom: '1.5rem' }}>
                Manage all users in the system. You can change user roles or delete users.
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #dee2e6' }}>
                      <th style={{ textAlign: 'left', padding: '0.75rem', fontWeight: 600 }}>Username</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem', fontWeight: 600 }}>Role</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem', fontWeight: 600 }}>Created</th>
                      <th style={{ textAlign: 'right', padding: '0.75rem', fontWeight: 600 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allUsers.map((u) => (
                      <tr key={u.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                        <td style={{ padding: '0.75rem' }}>{u.username}</td>
                        <td style={{ padding: '0.75rem' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            backgroundColor: getRoleBadgeColor(u.role) + '20',
                            color: getRoleBadgeColor(u.role),
                            textTransform: 'capitalize'
                          }}>
                            {u.role}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem', color: '#6c757d', fontSize: '0.875rem' }}>
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                          {u.id !== user?.id && (
                            <select
                              value={u.role}
                              onChange={(e) => handleChangeRole(u.id, e.target.value as UserRole)}
                              disabled={roleChangeLoading === u.id}
                              style={{
                                marginRight: '0.5rem',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '4px',
                                border: '1px solid #dee2e6',
                                fontSize: '0.875rem',
                                cursor: roleChangeLoading === u.id ? 'not-allowed' : 'pointer'
                              }}
                            >
                              <option value="student">Student</option>
                              <option value="instructor">Instructor</option>
                              <option value="admin">Admin</option>
                            </select>
                          )}
                          {u.id === user?.id && (
                            <span style={{ fontSize: '0.875rem', color: '#6c757d' }}>
                              (You)
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Instructors Tab */}
          {activeTab === 'instructors' && (
            <div>
              <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ marginBottom: '1rem' }}>Add New Instructor</h2>
                <AddInstructorForm onAdd={handleAddInstructor} />
              </div>
              
              <h2 style={{ marginBottom: '1rem' }}>Instructors</h2>
              <UserList 
                users={instructors}
                currentUserId={user.id}
                onDelete={handleDeleteUser}
                showActions={true}
              />
            </div>
          )}

          {/* Students Tab */}
          {activeTab === 'students' && (
            <div>
              <h2 style={{ marginBottom: '1rem' }}>Students</h2>
              <p style={{ color: '#6c757d', marginBottom: '1rem' }}>
                Students are created automatically when they sign in for the first time.
              </p>
              <UserList 
                users={students}
                currentUserId={user.id}
                showActions={false}
              />
            </div>
          )}
        </>
      )}
    </main>
  );
}

export default function AdminPageWrapper() {
  return (
    <ProtectedRoute requiredRole="instructor">
      <AdminPage />
    </ProtectedRoute>
  );
}
