'use client';

import { useState, useEffect, useCallback } from 'react';

export interface CodeRevision {
  id: string;
  timestamp: Date;
  code: string;
}

interface UseRevisionHistoryProps {
  sessionId: string | null;
  studentId: string | null;
  sendMessage?: (type: string, payload: any) => void;
  lastMessage?: any;
}

export function useRevisionHistory({
  sessionId,
  studentId,
  sendMessage,
  lastMessage,
}: UseRevisionHistoryProps) {
  const [revisions, setRevisions] = useState<CodeRevision[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load revisions when sessionId or studentId changes
  useEffect(() => {
    if (sessionId && studentId && sendMessage) {
      setLoading(true);
      setError(null);
      sendMessage('GET_REVISIONS', { studentId });
    }
  }, [sessionId, studentId, sendMessage]);

  // Handle incoming revision data
  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === 'REVISIONS_DATA') {
      const { sessionId: msgSessionId, studentId: msgStudentId, revisions: rawRevisions } = lastMessage.payload;
      
      // Only process if it's for the current session/student
      if (msgSessionId === sessionId && msgStudentId === studentId) {
        // Convert timestamp strings to Date objects
        const processedRevisions = rawRevisions.map((rev: any) => ({
          ...rev,
          timestamp: new Date(rev.timestamp),
        }));
        
        setRevisions(processedRevisions);
        setCurrentIndex(processedRevisions.length > 0 ? processedRevisions.length - 1 : 0);
        setLoading(false);
      }
    }
  }, [lastMessage, sessionId, studentId]);

  const goToRevision = useCallback((index: number) => {
    if (index >= 0 && index < revisions.length) {
      setCurrentIndex(index);
    }
  }, [revisions.length]);

  const next = useCallback(() => {
    if (currentIndex < revisions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, revisions.length]);

  const previous = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  const goToFirst = useCallback(() => {
    if (revisions.length > 0) {
      setCurrentIndex(0);
    }
  }, [revisions.length]);

  const goToLast = useCallback(() => {
    if (revisions.length > 0) {
      setCurrentIndex(revisions.length - 1);
    }
  }, [revisions.length]);

  const currentRevision = revisions[currentIndex] || null;

  return {
    revisions,
    currentRevision,
    currentIndex,
    loading,
    error,
    goToRevision,
    next,
    previous,
    goToFirst,
    goToLast,
    hasNext: currentIndex < revisions.length - 1,
    hasPrevious: currentIndex > 0,
    totalRevisions: revisions.length,
  };
}
