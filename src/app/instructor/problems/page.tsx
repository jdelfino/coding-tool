'use client';

/**
 * Instructor Problems Page
 * 
 * Main page for managing programming problems.
 * Displays the problem library with search, filtering, and CRUD operations.
 */

import React, { useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import ProblemLibrary from '../components/ProblemLibrary';
import ProblemCreator from '../components/ProblemCreator';

function ProblemsPage() {
  const [showCreator, setShowCreator] = useState(false);

  const handleProblemCreated = (problemId: string) => {
    console.log('Problem created:', problemId);
    setShowCreator(false);
    // Reload will happen via ProblemLibrary when it remounts
    window.location.reload();
  };

  const handleCancel = () => {
    setShowCreator(false);
  };

  if (showCreator) {
    return (
      <ProtectedRoute requiredRole="instructor">
        <div className="min-h-screen bg-gray-50 p-6">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Problem Library
              </button>
            </div>
            <ProblemCreator
              onProblemCreated={handleProblemCreated}
              onCancel={handleCancel}
            />
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRole="instructor">
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <ProblemLibrary onCreateNew={() => setShowCreator(true)} />
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default ProblemsPage;
