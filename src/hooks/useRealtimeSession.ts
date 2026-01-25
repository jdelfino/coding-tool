'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useRealtime } from './useRealtime';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { Session, Student, ExecutionResult } from '@/server/types';
import { ExecutionSettings } from '@/server/types/problem';

/**
 * Debounce function
 */
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Fetch with retry logic
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok || res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404) {
        // Don't retry client errors or successful responses
        return res;
      }
      // Server error - retry
      if (i === retries - 1) {
        return res;
      }
    } catch (e) {
      if (i === retries - 1) {
        throw e;
      }
      // Exponential backoff
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error('Fetch failed after retries');
}

export interface UseRealtimeSessionOptions {
  sessionId: string;
  userId?: string;
  userName?: string;
}

export interface FeaturedStudent {
  studentId?: string;
  code?: string;
}

/**
 * High-level hook for managing session state with Supabase Realtime
 *
 * Features:
 * - Loads initial session state from API
 * - Subscribes to Broadcast events for real-time updates (student_joined, student_code_updated,
 *   session_ended, featured_student_changed, problem_updated)
 * - Falls back to polling (every 2s) when broadcast is disconnected
 * - Provides debounced code updates (300ms)
 * - Handles errors with retry logic
 * - Tracks online users via presence (using useRealtime hook)
 */
export function useRealtimeSession({
  sessionId,
  userId,
  userName,
}: UseRealtimeSessionOptions) {
  // Local state
  const [session, setSession] = useState<Partial<Session> | null>(null);
  const [students, setStudents] = useState<Map<string, Student>>(new Map());
  const [featuredStudent, setFeaturedStudent] = useState<FeaturedStudent>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Broadcast connection state
  const [isBroadcastConnected, setIsBroadcastConnected] = useState(false);
  const broadcastChannelRef = useRef<RealtimeChannel | null>(null);

  // Track if initial state has been loaded
  const initialLoadRef = useRef(false);

  // Realtime connection (used for presence tracking)
  const {
    isConnected,
    connectionStatus,
    connectionError,
    onlineUsers,
    reconnectAttempt,
    maxReconnectAttempts,
    connectionStartTime,
    isReconnecting,
    reconnect,
  } = useRealtime({
    sessionId,
    userId,
    presenceData: userName ? { user_name: userName } : {},
  });

  /**
   * Load initial session state from API
   */
  useEffect(() => {
    if (!sessionId || initialLoadRef.current) {
      return;
    }

    const loadState = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetchWithRetry(`/api/sessions/${sessionId}/state`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: 'Failed to load session' }));
          throw new Error(errorData.error || 'Failed to load session');
        }

        const data = await res.json();

        // Set session data
        setSession(data.session);

        // Convert students array to Map (API returns 'id' but we use 'userId' internally)
        const studentsMap = new Map<string, Student>();
        data.students.forEach((student: any) => {
          studentsMap.set(student.id, {
            userId: student.id,
            name: student.name,
            code: student.code || '',
            lastUpdate: new Date(student.lastUpdate),
            executionSettings: student.executionSettings,
          });
        });
        setStudents(studentsMap);

        // Set featured student
        setFeaturedStudent(data.featuredStudent || {});

        initialLoadRef.current = true;
      } catch (e: any) {
        console.error('[useRealtimeSession] Failed to load state:', e);
        setError(e.message || 'Failed to load session state');
      } finally {
        setLoading(false);
      }
    };

    loadState();
  }, [sessionId]);

  /**
   * Fetch session state (used for initial load and polling fallback)
   */
  const fetchState = useCallback(async () => {
    if (!sessionId) return;

    try {
      const res = await fetchWithRetry(`/api/sessions/${sessionId}/state`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to load session' }));
        throw new Error(errorData.error || 'Failed to load session');
      }

      const data = await res.json();

      // Set session data
      setSession(data.session);

      // Convert students array to Map (API returns 'id' but we use 'userId' internally)
      const studentsMap = new Map<string, Student>();
      data.students.forEach((student: any) => {
        studentsMap.set(student.id, {
          userId: student.id,
          name: student.name,
          code: student.code || '',
          lastUpdate: new Date(student.lastUpdate),
          executionSettings: student.executionSettings,
        });
      });
      setStudents(studentsMap);

      // Set featured student
      setFeaturedStudent(data.featuredStudent || {});
      setError(null);
    } catch (e: any) {
      console.error('[useRealtimeSession] Failed to fetch state:', e);
      setError(e.message || 'Failed to fetch session state');
    }
  }, [sessionId]);

  /**
   * Subscribe to Broadcast channel for faster real-time updates
   * Broadcast is more reliable than postgres_changes (recommended by Supabase)
   */
  useEffect(() => {
    if (!sessionId) return;

    const supabase = getSupabaseBrowserClient();
    const channelName = `session:${sessionId}`;

    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'student_joined' }, (payload) => {
        if (payload.payload?.student) {
          const { student } = payload.payload;
          setStudents(prev => {
            const updated = new Map(prev);
            updated.set(student.userId, {
              userId: student.userId,
              name: student.name,
              code: student.code || '',
              lastUpdate: new Date(),
              executionSettings: student.executionSettings,
            });
            return updated;
          });
        }
      })
      .on('broadcast', { event: 'student_code_updated' }, (payload) => {
        if (payload.payload) {
          const { studentId, code, executionSettings, lastUpdate } = payload.payload;
          setStudents(prev => {
            const updated = new Map(prev);
            const student = updated.get(studentId);
            if (student) {
              updated.set(studentId, {
                ...student,
                code: code || '',
                lastUpdate: lastUpdate ? new Date(lastUpdate) : new Date(),
                executionSettings: executionSettings ?? student.executionSettings,
              });
            }
            return updated;
          });
        }
      })
      .on('broadcast', { event: 'session_ended' }, (payload) => {
        if (payload.payload) {
          const { endedAt } = payload.payload;
          setSession(prev => prev ? {
            ...prev,
            status: 'completed',
            endedAt: endedAt ? new Date(endedAt) : new Date(),
          } : prev);
        }
      })
      .on('broadcast', { event: 'featured_student_changed' }, (payload) => {
        if (payload.payload) {
          const { featuredStudentId, featuredCode } = payload.payload;
          setSession(prev => prev ? {
            ...prev,
            featuredStudentId,
            featuredCode,
          } : prev);
          setFeaturedStudent({
            studentId: featuredStudentId,
            code: featuredCode,
          });
        }
      })
      .on('broadcast', { event: 'problem_updated' }, (payload) => {
        if (payload.payload) {
          const { problem } = payload.payload;
          setSession(prev => prev ? {
            ...prev,
            problem,
          } : prev);
        }
      })
      .subscribe((status) => {
        setIsBroadcastConnected(status === 'SUBSCRIBED');
      });

    broadcastChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      broadcastChannelRef.current = null;
    };
  }, [sessionId]);

  /**
   * Polling fallback: Poll for updates every 2 seconds when broadcast is disconnected
   * This compensates for Realtime connection issues
   * Only poll when not loading (initial load complete)
   */
  useEffect(() => {
    if (!sessionId || isBroadcastConnected || loading) return;

    const pollInterval = setInterval(() => {
      fetchState();
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [sessionId, isBroadcastConnected, loading, fetchState]);

  /**
   * Update student code (debounced)
   */
  const updateCodeImmediate = useCallback(async (
    studentId: string,
    code: string,
    executionSettings?: ExecutionSettings
  ) => {
    try {
      const res = await fetchWithRetry(`/api/sessions/${sessionId}/code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId,
          code,
          executionSettings,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to save code' }));
        throw new Error(errorData.error || 'Failed to save code');
      }

      // Optimistically update local state
      setStudents(prev => {
        const updated = new Map(prev);
        const student = updated.get(studentId);
        if (student) {
          updated.set(studentId, {
            ...student,
            code,
            lastUpdate: new Date(),
            executionSettings: executionSettings || student.executionSettings,
          });
        }
        return updated;
      });
    } catch (e: any) {
      console.error('[useRealtimeSession] Failed to update code:', e);
      setError(e.message || 'Failed to save code');
      throw e;
    }
  }, [sessionId]);

  // Create debounced version (300ms)
  const updateCode = useMemo(
    () => debounce(updateCodeImmediate, 300),
    [updateCodeImmediate]
  );

  /**
   * Execute code
   */
  const executeCode = useCallback(async (
    studentId: string,
    code: string,
    executionSettings?: ExecutionSettings
  ): Promise<ExecutionResult> => {
    try {
      const res = await fetchWithRetry(`/api/sessions/${sessionId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId,
          code,
          executionSettings,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to execute code' }));
        throw new Error(errorData.error || 'Failed to execute code');
      }

      const result = await res.json();
      return result;
    } catch (e: any) {
      console.error('[useRealtimeSession] Failed to execute code:', e);
      throw e;
    }
  }, [sessionId]);

  /**
   * Feature a student's code
   */
  const featureStudent = useCallback(async (studentId: string) => {
    try {
      const res = await fetchWithRetry(`/api/sessions/${sessionId}/feature`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to feature student' }));
        throw new Error(errorData.error || 'Failed to feature student');
      }

      const data = await res.json();

      // Optimistically update local state
      setFeaturedStudent({
        studentId,
        code: students.get(studentId)?.code,
      });

      return data;
    } catch (e: any) {
      console.error('[useRealtimeSession] Failed to feature student:', e);
      throw e;
    }
  }, [sessionId, students]);

  /**
   * Join session
   */
  const joinSession = useCallback(async (studentId: string, name: string) => {
    try {
      const res = await fetchWithRetry(`/api/sessions/${sessionId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId,
          name,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to join session' }));
        throw new Error(errorData.error || 'Failed to join session');
      }

      const data = await res.json();
      return data;
    } catch (e: any) {
      console.error('[useRealtimeSession] Failed to join session:', e);
      throw e;
    }
  }, [sessionId]);

  return {
    // State
    session,
    students: Array.from(students.values()),
    featuredStudent,
    loading,
    error,

    // Connection status
    isConnected,
    connectionStatus,
    connectionError,
    onlineUsers,
    reconnectAttempt,
    maxReconnectAttempts,
    connectionStartTime,
    isReconnecting,
    isBroadcastConnected,

    // Actions
    updateCode,
    executeCode,
    featureStudent,
    joinSession,
    reconnect,
  };
}
