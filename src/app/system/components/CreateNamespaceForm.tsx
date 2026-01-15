'use client';

import React, { useState } from 'react';

interface CreateNamespaceFormProps {
  onSubmit: (id: string, displayName: string) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}

export default function CreateNamespaceForm({ onSubmit, onCancel, loading }: CreateNamespaceFormProps) {
  const [id, setId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [idError, setIdError] = useState('');
  const [displayNameError, setDisplayNameError] = useState('');

  const validateId = (value: string): boolean => {
    const namespaceIdRegex = /^[a-z0-9-]{3,32}$/;
    if (!value) {
      setIdError('Namespace ID is required');
      return false;
    }
    if (!namespaceIdRegex.test(value)) {
      setIdError('ID must be 3-32 characters, lowercase letters, numbers, and hyphens only');
      return false;
    }
    setIdError('');
    return true;
  };

  const validateDisplayName = (value: string): boolean => {
    if (!value.trim()) {
      setDisplayNameError('Display name is required');
      return false;
    }
    setDisplayNameError('');
    return true;
  };

  const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase();
    setId(value);
    if (value) validateId(value);
  };

  const handleDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDisplayName(value);
    if (value) validateDisplayName(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isIdValid = validateId(id);
    const isDisplayNameValid = validateDisplayName(displayName);

    if (!isIdValid || !isDisplayNameValid) {
      return;
    }

    await onSubmit(id, displayName.trim());
  };

  return (
    <div style={{
      padding: '1.5rem',
      background: 'white',
      border: '1px solid #dee2e6',
      borderRadius: '8px'
    }}>
      <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Create New Namespace</h3>

      <form onSubmit={handleSubmit}>
        {/* Namespace ID */}
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="namespace-id" style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontWeight: '500'
          }}>
            Namespace ID *
          </label>
          <input
            id="namespace-id"
            type="text"
            value={id}
            onChange={handleIdChange}
            placeholder="e.g., stanford, mit, company-x"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: `1px solid ${idError ? '#dc3545' : '#dee2e6'}`,
              borderRadius: '4px',
              fontSize: '1rem',
              boxSizing: 'border-box'
            }}
          />
          {idError && (
            <div style={{ marginTop: '0.25rem', color: '#dc3545', fontSize: '0.875rem' }}>
              {idError}
            </div>
          )}
          <div style={{ marginTop: '0.25rem', color: '#666', fontSize: '0.875rem' }}>
            This will be the permanent identifier. Use lowercase, numbers, and hyphens only (3-32 chars).
          </div>
        </div>

        {/* Display Name */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label htmlFor="display-name" style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontWeight: '500'
          }}>
            Display Name *
          </label>
          <input
            id="display-name"
            type="text"
            value={displayName}
            onChange={handleDisplayNameChange}
            placeholder="e.g., Stanford University, MIT, Company X"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: `1px solid ${displayNameError ? '#dc3545' : '#dee2e6'}`,
              borderRadius: '4px',
              fontSize: '1rem',
              boxSizing: 'border-box'
            }}
          />
          {displayNameError && (
            <div style={{ marginTop: '0.25rem', color: '#dc3545', fontSize: '0.875rem' }}>
              {displayNameError}
            </div>
          )}
          <div style={{ marginTop: '0.25rem', color: '#666', fontSize: '0.875rem' }}>
            This is the human-readable name shown to users. Can be changed later.
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="submit"
            disabled={loading || !id || !displayName}
            style={{
              padding: '0.75rem 1.5rem',
              background: loading || !id || !displayName ? '#ccc' : '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading || !id || !displayName ? 'not-allowed' : 'pointer',
              fontWeight: '500',
              fontSize: '1rem'
            }}
          >
            {loading ? 'Creating...' : 'Create Namespace'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'white',
              color: '#6c757d',
              border: '1px solid #6c757d',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '1rem'
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
