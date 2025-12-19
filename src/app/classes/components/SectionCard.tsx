'use client';

import { useState } from 'react';
import type { Section } from '@/server/classes/types';

interface SectionCardProps {
  section: Section;
  onRegenerateCode?: (sectionId: string) => Promise<string>;
  onAddInstructor?: (sectionId: string, email: string) => Promise<void>;
  onRemoveInstructor?: (sectionId: string, userId: string) => Promise<void>;
  instructorEmails?: Record<string, string>; // userId -> email mapping
}

export default function SectionCard({ 
  section, 
  onRegenerateCode,
  onAddInstructor,
  onRemoveInstructor,
  instructorEmails = {}
}: SectionCardProps) {
  const [showJoinCode, setShowJoinCode] = useState(false);
  const [joinCode, setJoinCode] = useState(section.joinCode);
  const [regenerating, setRegenerating] = useState(false);
  const [addingInstructor, setAddingInstructor] = useState(false);
  const [newInstructorEmail, setNewInstructorEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleRegenerateCode = async () => {
    if (!onRegenerateCode) return;
    
    setRegenerating(true);
    setError(null);
    try {
      const newCode = await onRegenerateCode(section.id);
      setJoinCode(newCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate code');
    } finally {
      setRegenerating(false);
    }
  };

  const handleAddInstructor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddInstructor || !newInstructorEmail.trim()) return;
    
    setError(null);
    try {
      await onAddInstructor(section.id, newInstructorEmail.trim());
      setNewInstructorEmail('');
      setAddingInstructor(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add instructor');
    }
  };

  const handleRemoveInstructor = async (userId: string) => {
    if (!onRemoveInstructor) return;
    
    if (!confirm('Are you sure you want to remove this instructor?')) return;
    
    setError(null);
    try {
      await onRemoveInstructor(section.id, userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove instructor');
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md space-y-4">
      <div>
        <h3 className="text-xl font-semibold text-gray-900">{section.name}</h3>
        {section.semester && (
          <p className="text-sm text-gray-500">{section.semester}</p>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
          {error}
        </div>
      )}

      {/* Join Code */}
      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Join Code</span>
          <button
            onClick={() => setShowJoinCode(!showJoinCode)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            {showJoinCode ? 'Hide' : 'Show'}
          </button>
        </div>
        {showJoinCode && (
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-gray-100 px-3 py-2 rounded font-mono text-lg">
              {joinCode}
            </code>
            {onRegenerateCode && (
              <button
                onClick={handleRegenerateCode}
                disabled={regenerating}
                className="p-2 text-gray-600 hover:text-gray-700 disabled:opacity-50"
                title="Regenerate join code"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Instructors */}
      {onAddInstructor && onRemoveInstructor && (
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Instructors</h4>
          <ul className="space-y-2 mb-3">
            {section.instructorIds.map((instructorId) => (
              <li key={instructorId} className="flex items-center justify-between text-sm">
                <span>{instructorEmails[instructorId] || instructorId}</span>
                {section.instructorIds.length > 1 && (
                  <button
                    onClick={() => handleRemoveInstructor(instructorId)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </li>
            ))}
          </ul>
          
          {addingInstructor ? (
            <form onSubmit={handleAddInstructor} className="flex gap-2">
              <input
                type="email"
                value={newInstructorEmail}
                onChange={(e) => setNewInstructorEmail(e.target.value)}
                placeholder="instructor@example.com"
                className="flex-1 px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <button
                type="submit"
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingInstructor(false);
                  setNewInstructorEmail('');
                }}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              onClick={() => setAddingInstructor(true)}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              + Add Co-Instructor
            </button>
          )}
        </div>
      )}

      {/* Statistics */}
      <div className="border-t pt-4 text-sm text-gray-600">
        <p>Created {new Date(section.createdAt).toLocaleDateString()}</p>
      </div>
    </div>
  );
}
