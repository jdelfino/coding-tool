'use client';

/**
 * Admin panel for user management.
 * Instructors only.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import UserList from './components/UserList';
import AddInstructorForm from './components/AddInstructorForm';
import type { User } from '@/server/auth/types';

function AdminPage() {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<'instructors' | 'students'>('instructors');
  const [instructors, setInstructors] = useState<User[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSigningOut, setIsSigningOut] = useState(false);

  const loadUsers = async () => {
    setIsLoading(true);
    setError('');
    try {
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
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

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

  return (
    <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '2rem'
      }}>
        <h1 style={{ margin: 0 }}>Admin Panel</h1>
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
            <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{user?.username}</span>
            <span style={{ 
              fontSize: '0.75rem', 
              color: '#0070f3',
              fontWeight: '500'
            }}>Admin</span>
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
          Loading users...
        </div>
      ) : (
        <>
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
                currentUserId={user?.id || ''}
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
                currentUserId={user?.id || ''}
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
