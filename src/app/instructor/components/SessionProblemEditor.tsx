'use client';

/**
 * Session Problem Editor
 * 
 * Provides an editor for creating/editing problems during an active session.
 * Similar to ProblemCreator but designed for live session updates rather than
 * database persistence. Uses Monaco editor and supports execution settings.
 */

import React, { useState, useEffect } from 'react';
import CodeEditor from '@/app/student/components/CodeEditor';
import { Problem } from '@/server/types/problem';

interface SessionProblemEditorProps {
  onUpdateProblem: (
    problem: { title: string; description: string; starterCode: string },
    executionSettings?: {
      stdin?: string;
      randomSeed?: number;
      attachedFiles?: Array<{ name: string; content: string }>;
    }
  ) => void;
  initialProblem?: Problem | { title: string; description: string; starterCode: string } | null;
  initialExecutionSettings?: {
    stdin?: string;
    randomSeed?: number;
    attachedFiles?: Array<{ name: string; content: string }>;
  };
}

export default function SessionProblemEditor({
  onUpdateProblem,
  initialProblem = null,
  initialExecutionSettings = {}
}: SessionProblemEditorProps) {
  const [title, setTitle] = useState(initialProblem?.title || '');
  const [description, setDescription] = useState(initialProblem?.description || '');
  const [starterCode, setStarterCode] = useState(initialProblem?.starterCode || '');
  
  // Execution settings
  const [stdin, setStdin] = useState(initialExecutionSettings?.stdin || '');
  const [randomSeed, setRandomSeed] = useState<number | undefined>(initialExecutionSettings?.randomSeed);
  const [attachedFiles, setAttachedFiles] = useState<Array<{ name: string; content: string }>>(
    initialExecutionSettings?.attachedFiles || []
  );

  // Sync state when initial values change (e.g., when problem is loaded)
  useEffect(() => {
    if (initialProblem) {
      setTitle(initialProblem.title || '');
      setDescription(initialProblem.description || '');
      setStarterCode(initialProblem.starterCode || '');
    }
  }, [initialProblem?.title, initialProblem?.description, initialProblem?.starterCode]);

  useEffect(() => {
    if (initialExecutionSettings) {
      setStdin(initialExecutionSettings.stdin || '');
      setRandomSeed(initialExecutionSettings.randomSeed);
      setAttachedFiles(initialExecutionSettings.attachedFiles || []);
    }
  }, [
    initialExecutionSettings?.stdin,
    initialExecutionSettings?.randomSeed,
    initialExecutionSettings?.attachedFiles
  ]);

  const handleUpdate = () => {
    const problem = {
      title: title.trim(),
      description: description.trim(),
      starterCode: starterCode.trim(),
    };
    
    const executionSettings: any = {};
    if (stdin.trim()) executionSettings.stdin = stdin.trim();
    if (randomSeed !== undefined) executionSettings.randomSeed = randomSeed;
    if (attachedFiles.length > 0) executionSettings.attachedFiles = attachedFiles;
    
    onUpdateProblem(problem, Object.keys(executionSettings).length > 0 ? executionSettings : undefined);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h3 className="text-xl font-bold mb-4 text-gray-800">Problem Setup</h3>

      {/* Title */}
      <div className="mb-4">
        <label htmlFor="session-title" className="block text-sm font-medium text-gray-700 mb-2">
          Title (optional)
        </label>
        <input
          id="session-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Two Sum Problem"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
      </div>

      {/* Description */}
      <div className="mb-4">
        <label htmlFor="session-description" className="block text-sm font-medium text-gray-700 mb-2">
          Description
        </label>
        <textarea
          id="session-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter the problem for students to solve..."
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
        />
      </div>

      {/* Starter Code with Monaco Editor */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Starter Code
        </label>
        <div style={{ height: '400px' }}>
          <CodeEditor
            code={starterCode}
            onChange={setStarterCode}
            useApiExecution={true}
            title="Starter Code"
            exampleInput={stdin}
            onStdinChange={setStdin}
            randomSeed={randomSeed}
            onRandomSeedChange={setRandomSeed}
            attachedFiles={attachedFiles}
            onAttachedFilesChange={setAttachedFiles}
          />
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Template code shown to students. You can test it by clicking "Run Code".
        </p>
      </div>

      {/* Update Button */}
      <div className="flex justify-end pt-4 border-t border-gray-200">
        <button
          onClick={handleUpdate}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          Update Problem
        </button>
      </div>
    </div>
  );
}
