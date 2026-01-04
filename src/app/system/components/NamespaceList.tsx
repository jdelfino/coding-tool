'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Namespace } from '@/server/auth/types';

interface NamespaceWithStats extends Namespace {
  userCount: number;
}

interface NamespaceListProps {
  namespaces: NamespaceWithStats[];
  onUpdate: (id: string, updates: { displayName?: string; active?: boolean }) => Promise<Namespace>;
  onDelete: (id: string) => Promise<void>;
  loading: boolean;
}

export default function NamespaceList({ namespaces, onUpdate, onDelete, loading }: NamespaceListProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const handleEdit = (namespace: NamespaceWithStats) => {
    setEditingId(namespace.id);
    setEditDisplayName(namespace.displayName);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editDisplayName.trim()) return;

    setActionLoading(true);
    try {
      await onUpdate(id, { displayName: editDisplayName.trim() });
      setEditingId(null);
    } catch (err) {
      console.error('Failed to update namespace:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditDisplayName('');
  };

  const handleToggleActive = async (namespace: NamespaceWithStats) => {
    setActionLoading(true);
    try {
      await onUpdate(namespace.id, { active: !namespace.active });
    } catch (err) {
      console.error('Failed to toggle namespace:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeletingId(id);
  };

  const handleConfirmDelete = async (id: string) => {
    setActionLoading(true);
    try {
      await onDelete(id);
      setDeletingId(null);
    } catch (err) {
      console.error('Failed to delete namespace:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelDelete = () => {
    setDeletingId(null);
  };

  const handleManageUsers = (namespaceId: string) => {
    router.push(`/system/namespaces/${namespaceId}`);
  };

  if (namespaces.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '3rem',
        background: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #dee2e6'
      }}>
        <p style={{ color: '#666', margin: 0 }}>
          No namespaces found. Create your first namespace to get started.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {namespaces.map(namespace => (
        <div
          key={namespace.id}
          style={{
            padding: '1.5rem',
            background: namespace.active ? 'white' : '#f8f9fa',
            border: '1px solid #dee2e6',
            borderRadius: '8px',
            opacity: namespace.active ? 1 : 0.7
          }}
        >
          {/* Namespace Header */}
          <div style={{ marginBottom: '1rem' }}>
            {editingId === namespace.id ? (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    border: '1px solid #dee2e6',
                    borderRadius: '4px',
                    fontSize: '1.1rem'
                  }}
                  disabled={actionLoading}
                />
                <button
                  onClick={() => handleSaveEdit(namespace.id)}
                  disabled={actionLoading || !editDisplayName.trim()}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: actionLoading ? 'not-allowed' : 'pointer'
                  }}
                >
                  Save
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={actionLoading}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: actionLoading ? 'not-allowed' : 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: 0, marginBottom: '0.25rem', fontSize: '1.25rem' }}>
                      {namespace.displayName}
                    </h3>
                    <div style={{ fontSize: '0.9rem', color: '#666', fontFamily: 'monospace' }}>
                      {namespace.id}
                    </div>
                  </div>
                  {!namespace.active && (
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      background: '#ffc107',
                      color: '#000',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      fontWeight: '500'
                    }}>
                      Inactive
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Namespace Info */}
          <div style={{
            display: 'flex',
            gap: '2rem',
            marginBottom: '1rem',
            paddingBottom: '1rem',
            borderBottom: '1px solid #dee2e6',
            fontSize: '0.9rem',
            color: '#666'
          }}>
            <div>
              <strong>Users:</strong> {namespace.userCount}
            </div>
            <div>
              <strong>Created:</strong> {new Date(namespace.createdAt).toLocaleDateString()}
            </div>
          </div>

          {/* Actions */}
          {deletingId === namespace.id ? (
            <div style={{
              padding: '1rem',
              background: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: '4px'
            }}>
              <p style={{ margin: '0 0 1rem 0', fontWeight: '500' }}>
                Are you sure you want to delete this namespace? This will deactivate it.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => handleConfirmDelete(namespace.id)}
                  disabled={actionLoading}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                    fontWeight: '500'
                  }}
                >
                  {actionLoading ? 'Deleting...' : 'Yes, Delete'}
                </button>
                <button
                  onClick={handleCancelDelete}
                  disabled={actionLoading}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: actionLoading ? 'not-allowed' : 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => handleManageUsers(namespace.id)}
                disabled={loading || actionLoading}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#0070f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: (loading || actionLoading) ? 'not-allowed' : 'pointer',
                  fontWeight: '500'
                }}
              >
                Manage Users
              </button>
              <button
                onClick={() => handleEdit(namespace)}
                disabled={loading || actionLoading}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: (loading || actionLoading) ? 'not-allowed' : 'pointer'
                }}
              >
                Edit Name
              </button>
              <button
                onClick={() => handleToggleActive(namespace)}
                disabled={loading || actionLoading}
                style={{
                  padding: '0.5rem 1rem',
                  background: namespace.active ? '#ffc107' : '#28a745',
                  color: namespace.active ? '#000' : 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: (loading || actionLoading) ? 'not-allowed' : 'pointer'
                }}
              >
                {namespace.active ? 'Deactivate' : 'Activate'}
              </button>
              <button
                onClick={() => handleDeleteClick(namespace.id)}
                disabled={loading || actionLoading}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: (loading || actionLoading) ? 'not-allowed' : 'pointer'
                }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
