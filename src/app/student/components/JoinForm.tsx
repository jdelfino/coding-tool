'use client';

import React, { useState } from 'react';

interface JoinFormProps {
  onJoin: (joinCode: string) => void;
  username: string;
  isJoining?: boolean;
  disabled?: boolean;
}

export default function JoinForm({ onJoin, username, isJoining = false, disabled = false }: JoinFormProps) {
  const [joinCode, setJoinCode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode.trim()) {
      onJoin(joinCode.trim().toUpperCase());
    }
  };

  return (
    <div style={{ 
      maxWidth: '400px', 
      margin: '4rem auto', 
      padding: '2rem', 
      border: '1px solid #ccc',
      borderRadius: '8px'
    }}>
      <h2 style={{ marginBottom: '1.5rem' }}>Join Coding Session</h2>
      <div style={{ 
        marginBottom: '1.5rem',
        padding: '0.75rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '4px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '0.85rem', color: '#6c757d', marginBottom: '0.25rem' }}>Joining as</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#28a745' }}>{username}</div>
      </div>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            Join Code:
          </label>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={6}
            style={{
              width: '100%',
              padding: '0.5rem',
              fontSize: '1.5rem',
              fontWeight: 'bold',
              textAlign: 'center',
              border: '1px solid #ccc',
              borderRadius: '4px',
              letterSpacing: '0.2em',
            }}
            required
          />
        </div>

        <button
          type="submit"
          disabled={disabled || isJoining}
          style={{
            width: '100%',
            padding: '0.75rem',
            fontSize: '1.1rem',
            backgroundColor: disabled || isJoining ? '#6c757d' : '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: disabled || isJoining ? 'not-allowed' : 'pointer',
            opacity: disabled || isJoining ? 0.6 : 1,
          }}
        >
          {isJoining ? 'Joining...' : disabled ? 'Server Unavailable' : 'Join Session'}
        </button>
      </form>
    </div>
  );
}
