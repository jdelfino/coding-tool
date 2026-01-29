'use client';

import React from 'react';
import { WalkthroughEntry } from '@/server/types/analysis';
import { categoryStyles } from '../constants/analysis';

interface StudentAnalysisDetailsProps {
  entries: WalkthroughEntry[];
}

export default function StudentAnalysisDetails({ entries }: StudentAnalysisDetailsProps) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        backgroundColor: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '0.75rem 1rem',
      }}
    >
      {entries.map((entry, index) => {
        const style = categoryStyles[entry.category];
        return (
          <React.Fragment key={`${entry.studentId}-${entry.category}-${index}`}>
            {index > 0 && (
              <hr
                style={{
                  border: 'none',
                  borderTop: '1px solid #e5e7eb',
                  margin: '0.5rem 0',
                }}
              />
            )}
            <div>
              <span
                style={{
                  display: 'inline-block',
                  padding: '0.125rem 0.5rem',
                  backgroundColor: style.bg,
                  color: style.text,
                  borderRadius: '9999px',
                  fontSize: '0.7rem',
                  fontWeight: 500,
                  marginBottom: '0.375rem',
                }}
              >
                {style.label}
              </span>
              <ul
                style={{
                  margin: '0.25rem 0',
                  paddingLeft: '1.25rem',
                  color: '#4b5563',
                  fontSize: '0.8125rem',
                  lineHeight: 1.5,
                }}
              >
                {entry.discussionPoints.map((point, i) => (
                  <li key={i} style={{ marginBottom: '0.125rem' }}>
                    {point}
                  </li>
                ))}
              </ul>
              {entry.pedagogicalNote && (
                <p
                  style={{
                    margin: '0.25rem 0 0',
                    fontSize: '0.75rem',
                    color: '#6b7280',
                    fontStyle: 'italic',
                  }}
                >
                  {entry.pedagogicalNote}
                </p>
              )}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
