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
import { useDebugger } from '@/hooks/useDebugger';
import { useWebSocket } from '@/hooks/useWebSocket';

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

  // Setup debugger
  const [wsUrl, setWsUrl] = useState('');
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      setWsUrl(`${protocol}//${host}/ws`);
    }
  }, []);
  const { sendMessage } = useWebSocket(wsUrl);
  const debuggerHook = useDebugger(sendMessage);

  return (
    <div className="h-full flex flex-col bg-white rounded-lg shadow-md">
      {/* Header with update button */}
      <div className="flex-shrink-0 px-6 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-800">Problem Setup</h3>
          <button
            onClick={handleUpdate}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Update Problem
          </button>
        </div>
      </div>

      {/* Full-width code editor */}
      <div className="flex-1 min-h-0">
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
          problem={{ title, description, starterCode }}
          onLoadStarterCode={setStarterCode}
          debugger={debuggerHook}
          onProblemEdit={(updates) => {
            if (updates.title !== undefined) setTitle(updates.title);
            if (updates.description !== undefined) setDescription(updates.description);
          }}
          editableProblem={true}
        />
      </div>
    </div>
  );
}
