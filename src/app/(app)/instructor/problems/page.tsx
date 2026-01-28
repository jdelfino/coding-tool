'use client';

/**
 * Instructor Problems Page
 *
 * Displays the problem library for instructors to manage and create problems.
 * Uses the ProblemLibrary component for the main UI.
 */

import React, { Suspense, useState } from 'react';
import ProblemLibrary from '../components/ProblemLibrary';
import ProblemCreator from '../components/ProblemCreator';
import NamespaceHeader from '@/components/NamespaceHeader';

function ProblemsPage() {
  const [showCreator, setShowCreator] = useState(false);
  const [editingProblemId, setEditingProblemId] = useState<string | null>(null);

  const handleCreateNew = () => {
    setEditingProblemId(null);
    setShowCreator(true);
  };

  const handleEdit = (problemId: string) => {
    setEditingProblemId(problemId);
    setShowCreator(true);
  };

  const handleCloseCreator = () => {
    setShowCreator(false);
    setEditingProblemId(null);
  };

  if (showCreator) {
    return (
      <div className="h-full flex flex-col -m-6">
        <ProblemCreator
          problemId={editingProblemId}
          onCancel={handleCloseCreator}
          onProblemCreated={handleCloseCreator}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <NamespaceHeader className="text-sm" />
      </div>

      {/* Main content */}
      <ProblemLibrary
        onCreateNew={handleCreateNew}
        onEdit={handleEdit}
      />
    </div>
  );
}

export default function ProblemsPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <ProblemsPage />
    </Suspense>
  );
}
