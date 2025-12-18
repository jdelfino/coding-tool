'use client';

/**
 * Form for adding new instructor accounts.
 */

import { useState } from 'react';

interface AddInstructorFormProps {
  onAdd: (username: string) => Promise<void>;
}

export default function AddInstructorForm({ onAdd }: AddInstructorFormProps) {
  const [username, setUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await onAdd(username.trim());
      setSuccess(`Instructor "${username}" created successfully`);
      setUsername('');
    } catch (err: any) {
      setError(err.message || 'Failed to create instructor');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ marginBottom: '2rem' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username for new instructor"
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '0.5rem',
              fontSize: '1rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          />
        </div>
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
            fontSize: '1rem',
            whiteSpace: 'nowrap'
          }}
        >
          {isSubmitting ? 'Adding...' : '+ Add Instructor'}
        </button>
      </form>

      {error && (
        <div style={{
          marginTop: '0.5rem',
          padding: '0.5rem',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          borderRadius: '4px',
          fontSize: '0.9rem'
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          marginTop: '0.5rem',
          padding: '0.5rem',
          backgroundColor: '#d4edda',
          color: '#155724',
          borderRadius: '4px',
          fontSize: '0.9rem'
        }}>
          {success}
        </div>
      )}
    </div>
  );
}
