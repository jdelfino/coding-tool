'use client';

/**
 * User list component with actions.
 */

import { useState } from 'react';
import type { User } from '@/server/auth/types';

interface UserListProps {
  users: User[];
  currentUserId: string;
  onDelete?: (userId: string, username: string) => Promise<void>;
  showActions?: boolean;
}

export default function UserList({ users, currentUserId, onDelete, showActions = false }: UserListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDelete = async (userId: string, username: string) => {
    if (!onDelete) return;

    setDeletingId(userId);
    try {
      await onDelete(userId, username);
      setConfirmDeleteId(null);
    } catch (error) {
      console.error('Delete error:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (users.length === 0) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        color: '#6c757d',
        backgroundColor: '#f8f9fa',
        borderRadius: '4px'
      }}>
        No users found
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ 
        width: '100%', 
        borderCollapse: 'collapse',
        backgroundColor: 'white',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <thead>
          <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
            <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Username</th>
            <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Role</th>
            <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Created</th>
            <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Last Login</th>
            {showActions && <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600 }}>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} style={{ borderBottom: '1px solid #dee2e6' }}>
              <td style={{ padding: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {user.displayName || user.email}
                  {user.id === currentUserId && (
                    <span style={{
                      fontSize: '0.75rem',
                      padding: '0.125rem 0.5rem',
                      backgroundColor: '#0070f3',
                      color: 'white',
                      borderRadius: '4px'
                    }}>You</span>
                  )}
                </div>
              </td>
              <td style={{ padding: '0.75rem' }}>
                <span style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  backgroundColor: user.role === 'instructor' ? '#e7f3ff' : '#e8f5e9',
                  color: user.role === 'instructor' ? '#0070f3' : '#28a745'
                }}>
                  {user.role}
                </span>
              </td>
              <td style={{ padding: '0.75rem', fontSize: '0.9rem', color: '#6c757d' }}>
                {formatDate(user.createdAt)}
              </td>
              <td style={{ padding: '0.75rem', fontSize: '0.9rem', color: '#6c757d' }}>
                {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}
              </td>
              {showActions && (
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                  {user.id === currentUserId ? (
                    <span style={{ fontSize: '0.85rem', color: '#6c757d' }}>-</span>
                  ) : confirmDeleteId === user.id ? (
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <button
                        onClick={() => handleDelete(user.id, user.displayName || user.email)}
                        disabled={deletingId === user.id}
                        style={{
                          padding: '0.25rem 0.75rem',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.85rem'
                        }}
                      >
                        {deletingId === user.id ? 'Deleting...' : 'Confirm'}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        disabled={deletingId === user.id}
                        style={{
                          padding: '0.25rem 0.75rem',
                          backgroundColor: '#6c757d',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.85rem'
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(user.id)}
                      style={{
                        padding: '0.25rem 0.75rem',
                        backgroundColor: 'transparent',
                        color: '#dc3545',
                        border: '1px solid #dc3545',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85rem'
                      }}
                    >
                      Delete
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
