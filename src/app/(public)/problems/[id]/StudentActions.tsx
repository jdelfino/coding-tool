'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface StudentActionsProps {
  problemId: string;
  classId: string;
}

interface Section {
  id: string;
  classId: string;
  name: string;
  role: 'student' | 'instructor';
}

export default function StudentActions({ problemId, classId }: StudentActionsProps) {
  const { user, isLoading } = useAuth();
  const [studentSections, setStudentSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const router = useRouter();

  // Fetch student's sections for this class
  useEffect(() => {
    if (isLoading || !user) return;

    const fetchSections = async () => {
      try {
        const response = await fetch('/api/sections/my');
        if (!response.ok) {
          throw new Error('Failed to load sections');
        }
        const data = await response.json();
        const sections: Section[] = data.sections || [];

        // Filter to only sections where user is a student in this class
        const filtered = sections.filter(
          (section) => section.classId === classId && section.role === 'student'
        );

        setStudentSections(filtered);
      } catch (err) {
        console.error('Error fetching sections:', err);
        setStudentSections([]);
      }
    };

    fetchSections();
  }, [isLoading, user, classId]);

  // Don't render if loading or not authenticated
  if (isLoading || !user) return null;

  // Don't render if user has no student sections in this class
  if (studentSections.length === 0) return null;

  const handlePracticeClick = () => {
    // If only one section, auto-start
    if (studentSections.length === 1) {
      startPractice(studentSections[0].id);
    } else {
      // Show section picker
      setShowPicker(true);
    }
  };

  const startPractice = async (sectionId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/problems/${problemId}/practice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start practice session');
      }

      const { sessionId } = await response.json();
      router.push(`/student?sessionId=${sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start practice session');
    } finally {
      setLoading(false);
    }
  };

  const handleSectionSelect = (sectionId: string) => {
    setSelectedSectionId(sectionId);
  };

  const handleStartPractice = () => {
    if (selectedSectionId) {
      setShowPicker(false);
      startPractice(selectedSectionId);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={handlePracticeClick}
          disabled={loading}
          className="px-4 py-2 text-sm bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Starting...
            </span>
          ) : (
            'Practice'
          )}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 mb-4">{error}</p>
      )}

      {showPicker && (
        <div className="mb-6 p-4 border border-gray-300 rounded-lg bg-white">
          <h3 className="text-lg font-semibold mb-3">Select Section</h3>
          <div className="space-y-2">
            {studentSections.map((section) => (
              <label key={section.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="section"
                  value={section.id}
                  checked={selectedSectionId === section.id}
                  onChange={() => handleSectionSelect(section.id)}
                  className="w-4 h-4"
                />
                <span className="text-sm">{section.name}</span>
              </label>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleStartPractice}
              disabled={!selectedSectionId}
              className="px-4 py-2 text-sm bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Practice
            </button>
            <button
              onClick={() => setShowPicker(false)}
              className="px-4 py-2 text-sm bg-gray-200 text-gray-800 hover:bg-gray-300 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
