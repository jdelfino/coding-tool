/**
 * Session Service - Pure functions for session business logic
 *
 * This service contains stateless functions that handle session operations.
 * All functions accept storage as a dependency (no instance state).
 *
 * Extracted from session-manager.ts to separate business logic from
 * WebSocket state management.
 */

import { v4 as uuidv4 } from 'uuid';
import { IStorageRepository } from '@/server/persistence/interfaces';
import { Session, Student } from '@/server/types';
import { Problem, ExecutionSettings } from '@/server/types/problem';

// ============================================================================
// Session Creation
// ============================================================================

/**
 * Create a new session within a section
 *
 * Business logic:
 * - Validates section exists and namespace matches
 * - Enforces single active session per user
 * - Creates session with empty problem
 *
 * @throws Error if validation fails
 */
export async function createSession(
  storage: IStorageRepository,
  creatorId: string,
  sectionId: string,
  namespaceId: string
): Promise<Session> {
  // Validate section exists
  if (!storage.sections) {
    throw new Error(
      'Sections repository not available - this is a critical system error.'
    );
  }

  const section = await storage.sections.getSection(sectionId, namespaceId);
  if (!section) {
    throw new Error(`Section ${sectionId} not found in namespace ${namespaceId}`);
  }

  // Verify namespace consistency
  if (section.namespaceId !== namespaceId) {
    throw new Error(
      `Namespace mismatch: Section ${sectionId} belongs to namespace ${section.namespaceId}, not ${namespaceId}`
    );
  }

  // Enforce single active session per user
  const existingActiveSessions = await storage.sessions.listAllSessions({
    instructorId: creatorId,
    active: true,
    namespaceId,
  });

  if (existingActiveSessions.length > 0) {
    throw new Error(
      `Cannot create session: User already has ${existingActiveSessions.length} active session(s). ` +
        `End your current session before starting a new one.`
    );
  }

  // Create session
  const sessionId = uuidv4();
  const session: Session = {
    id: sessionId,
    namespaceId: section.namespaceId,
    problem: createEmptyProblem(creatorId, section.namespaceId),
    students: new Map(),
    createdAt: new Date(),
    lastActivity: new Date(),
    creatorId,
    participants: [],
    status: 'active',
    sectionId,
    sectionName: section.name,
  };

  await storage.sessions.createSession(session);
  return session;
}

/**
 * Create session with a cloned problem
 */
export async function createSessionWithProblem(
  storage: IStorageRepository,
  creatorId: string,
  sectionId: string,
  namespaceId: string,
  problemId: string
): Promise<Session> {
  // Validate problem exists and belongs to namespace
  const problem = await storage.problems.getById(problemId, namespaceId);
  if (!problem) {
    throw new Error(
      `Problem ${problemId} not found in namespace ${namespaceId}. ` +
        `Cross-namespace problem references are not allowed.`
    );
  }

  // Validate section exists
  if (!storage.sections) {
    throw new Error(
      'Sections repository not available - this is a critical system error.'
    );
  }

  const section = await storage.sections.getSection(sectionId, namespaceId);
  if (!section) {
    throw new Error(`Section ${sectionId} not found in namespace ${namespaceId}`);
  }

  // Enforce single active session per user
  const existingActiveSessions = await storage.sessions.listAllSessions({
    instructorId: creatorId,
    active: true,
    namespaceId,
  });

  if (existingActiveSessions.length > 0) {
    throw new Error(
      `Cannot create session: User already has ${existingActiveSessions.length} active session(s). ` +
        `End your current session before starting a new one.`
    );
  }

  // Create session with cloned problem
  const sessionId = uuidv4();
  const session: Session = {
    id: sessionId,
    namespaceId: section.namespaceId,
    problem: cloneProblem(problem),
    students: new Map(),
    createdAt: new Date(),
    lastActivity: new Date(),
    creatorId,
    participants: [],
    status: 'active',
    sectionId,
    sectionName: section.name,
  };

  await storage.sessions.createSession(session);
  return session;
}

// ============================================================================
// Student Operations
// ============================================================================

/**
 * Add a student to a session (or update existing student on rejoin)
 *
 * Business logic:
 * - Preserves existing code on rejoin
 * - Initializes with starter code on first join
 * - Adds to participants list if not present
 */
export async function addStudent(
  storage: IStorageRepository,
  session: Session,
  studentId: string,
  name: string
): Promise<Student> {
  // Check if student already exists (rejoining)
  const existingStudent = session.students.get(studentId);

  // Initialize with starter code if first join, preserve existing code otherwise
  const initialCode =
    existingStudent?.code !== undefined
      ? existingStudent.code
      : session.problem?.starterCode || '';

  const student: Student = {
    id: studentId,
    name: name.trim(),
    code: initialCode,
    lastUpdate: new Date(),
    executionSettings: existingStudent?.executionSettings,
  };

  // Update session
  session.students.set(studentId, student);

  if (!session.participants.includes(studentId)) {
    session.participants.push(studentId);
  }

  // Persist
  await storage.sessions.updateSession(session.id, {
    students: session.students,
    participants: session.participants,
    lastActivity: new Date(),
  });

  return student;
}

/**
 * Update student code and optionally execution settings
 */
export async function updateStudentCode(
  storage: IStorageRepository,
  session: Session,
  studentId: string,
  code: string,
  executionSettings?: ExecutionSettings
): Promise<void> {
  const student = session.students.get(studentId);
  if (!student) {
    throw new Error(`Student ${studentId} not found in session`);
  }

  student.code = code;
  student.lastUpdate = new Date();

  if (executionSettings) {
    student.executionSettings = {
      ...student.executionSettings,
      ...executionSettings,
    };
  }

  await storage.sessions.updateSession(session.id, {
    students: session.students,
    lastActivity: new Date(),
  });
}

/**
 * Get student data with merged execution settings
 *
 * Merges problem-level settings with student-level overrides
 */
export function getStudentData(
  session: Session,
  studentId: string
):
  | {
      code: string;
      executionSettings?: ExecutionSettings;
    }
  | undefined {
  const student = session.students.get(studentId);
  if (!student) return undefined;

  const problemSettings = session.problem?.executionSettings;
  const studentSettings = student.executionSettings;

  // Build merged execution settings
  const mergedSettings: ExecutionSettings = {
    stdin: studentSettings?.stdin ?? problemSettings?.stdin,
    randomSeed:
      studentSettings?.randomSeed !== undefined
        ? studentSettings.randomSeed
        : problemSettings?.randomSeed,
    attachedFiles:
      studentSettings?.attachedFiles !== undefined
        ? studentSettings.attachedFiles
        : problemSettings?.attachedFiles,
  };

  const hasSettings =
    mergedSettings.stdin !== undefined ||
    mergedSettings.randomSeed !== undefined ||
    mergedSettings.attachedFiles !== undefined;

  return {
    code: student.code,
    executionSettings: hasSettings ? mergedSettings : undefined,
  };
}

// ============================================================================
// Featured Submissions
// ============================================================================

/**
 * Set a student's code as the featured submission
 */
export async function setFeaturedSubmission(
  storage: IStorageRepository,
  session: Session,
  studentId: string
): Promise<void> {
  const student = session.students.get(studentId);
  if (!student) {
    throw new Error(`Student ${studentId} not found in session`);
  }

  await storage.sessions.updateSession(session.id, {
    featuredStudentId: studentId,
    featuredCode: student.code,
    lastActivity: new Date(),
  });
}

/**
 * Clear the featured submission
 */
export async function clearFeaturedSubmission(
  storage: IStorageRepository,
  sessionId: string
): Promise<void> {
  await storage.sessions.updateSession(sessionId, {
    featuredStudentId: undefined,
    featuredCode: undefined,
    lastActivity: new Date(),
  });
}

// ============================================================================
// Session Lifecycle
// ============================================================================

/**
 * End a session (mark as completed)
 */
export async function endSession(
  storage: IStorageRepository,
  sessionId: string
): Promise<void> {
  await storage.sessions.updateSession(sessionId, {
    status: 'completed',
    endedAt: new Date(),
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Clone a problem for use in a session
 * Creates a deep copy to avoid modifying the original
 */
export function cloneProblem(problem: Problem): Problem {
  return {
    ...problem,
    testCases: problem.testCases
      ? [...problem.testCases.map((tc) => ({ ...tc }))]
      : undefined,
    executionSettings: problem.executionSettings
      ? {
          ...problem.executionSettings,
          attachedFiles: problem.executionSettings.attachedFiles
            ? problem.executionSettings.attachedFiles.map((f) => ({ ...f }))
            : undefined,
        }
      : undefined,
  };
}

/**
 * Create an empty problem for a new session
 */
export function createEmptyProblem(authorId: string, namespaceId: string): Problem {
  return {
    id: uuidv4(),
    namespaceId,
    title: 'Untitled Session',
    description: '',
    starterCode: '',
    testCases: [],
    executionSettings: undefined,
    authorId,
    classId: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
