'use client';

/**
 * Invite Instructor Form for Namespace Admins
 *
 * Simple form to invite instructors to the namespace.
 * Role is fixed to 'instructor' and namespace is automatically determined.
 */

import React, { useState, FormEvent } from 'react';

interface InviteInstructorFormProps {
  onSubmit: (email: string) => Promise<void>;
  loading: boolean;
}

export default function InviteInstructorForm({
  onSubmit,
  loading,
}: InviteInstructorFormProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validate email
    if (!email.trim()) {
      setError('Please enter an email address');
      return;
    }

    if (!validateEmail(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      await onSubmit(email.trim());
      setSuccess(`Invitation sent to ${email.trim()}`);
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        padding: '1.5rem',
        background: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #dee2e6',
      }}
    >
      <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: '600' }}>
        Invite Instructor
      </h3>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label
            htmlFor="invite-email"
            style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}
          >
            Email Address
          </label>
          <input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError('');
              setSuccess('');
            }}
            placeholder="instructor@example.com"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              borderRadius: '4px',
              border: '1px solid #ced4da',
              fontSize: '0.875rem',
              background: loading ? '#e9ecef' : 'white',
            }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '0.5rem 1.5rem',
            background: loading ? '#6c757d' : '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem',
            fontWeight: '500',
            whiteSpace: 'nowrap',
          }}
        >
          {loading ? 'Sending...' : 'Send Invitation'}
        </button>
      </div>

      {error && (
        <div
          style={{
            marginTop: '1rem',
            padding: '0.75rem',
            background: '#fee',
            border: '1px solid #fcc',
            borderRadius: '4px',
            color: '#c33',
            fontSize: '0.875rem',
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            marginTop: '1rem',
            padding: '0.75rem',
            background: '#d4edda',
            border: '1px solid #c3e6cb',
            borderRadius: '4px',
            color: '#155724',
            fontSize: '0.875rem',
          }}
        >
          {success}
        </div>
      )}
    </form>
  );
}
