'use client';

import React from 'react';
import { WalkthroughEntry as WalkthroughEntryType, WalkthroughCategory } from '@/server/types/analysis';

interface WalkthroughEntryProps {
  entry: WalkthroughEntryType;
  isActive: boolean;
  onClick: () => void;
}

const categoryStyles: Record<WalkthroughCategory, { bg: string; text: string; label: string }> = {
  'common-error': { bg: '#fef2f2', text: '#991b1b', label: 'Error' },
  'edge-case': { bg: '#fef9c3', text: '#854d0e', label: 'Edge Case' },
  'interesting-approach': { bg: '#f0fdf4', text: '#166534', label: 'Interesting' },
  'exemplary': { bg: '#eff6ff', text: '#1e40af', label: 'Exemplary' },
};

export default function WalkthroughEntry({ entry, isActive, onClick }: WalkthroughEntryProps) {
  const categoryStyle = categoryStyles[entry.category];

  return (
    <div
      onClick={onClick}
      style={{
        padding: '0.75rem 1rem',
        margin: '0.5rem 0',
        border: isActive ? '2px solid #0070f3' : '1px solid #e5e7eb',
        borderRadius: '8px',
        backgroundColor: isActive ? '#f0f7ff' : 'white',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      {/* Header row with position, label, and category */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            backgroundColor: isActive ? '#0070f3' : '#e5e7eb',
            color: isActive ? 'white' : '#374151',
            borderRadius: '50%',
            fontSize: '0.75rem',
            fontWeight: 600,
          }}
        >
          {entry.position}
        </span>
        <span style={{ fontWeight: 500, color: '#111827' }}>{entry.studentLabel}</span>
        <span
          style={{
            padding: '0.125rem 0.5rem',
            backgroundColor: categoryStyle.bg,
            color: categoryStyle.text,
            borderRadius: '9999px',
            fontSize: '0.7rem',
            fontWeight: 500,
            marginLeft: 'auto',
          }}
        >
          {categoryStyle.label}
        </span>
      </div>

      {/* Discussion points */}
      <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem', color: '#4b5563', fontSize: '0.875rem' }}>
        {entry.discussionPoints.map((point, index) => (
          <li key={index} style={{ marginBottom: '0.25rem' }}>
            {point}
          </li>
        ))}
      </ul>

      {/* Pedagogical note */}
      {entry.pedagogicalNote && (
        <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280', fontStyle: 'italic' }}>
          {entry.pedagogicalNote}
        </p>
      )}
    </div>
  );
}
