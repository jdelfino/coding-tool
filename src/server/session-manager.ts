import { v4 as uuidv4 } from 'uuid';
import { Session, Student } from './types';
import { Problem, ExecutionSettings } from './types/problem';
import { IStorageRepository, getStorage } from './persistence';

export class SessionManager {
  constructor(private storage?: IStorageRepository) {
    // Storage is optional for backward compatibility during migration
  }

  /**
   * Ensure storage is initialized (auto-initialize for API routes)
   */
  private async ensureStorage(): Promise<IStorageRepository> {
    if (!this.storage) {
      this.storage = await getStorage(); // Use singleton storage
      // Don't call initialize() - getStorage() handles that
    }
    return this.storage;
  }

  /**
   * Initialize session manager
   * Loads existing sessions from storage
   */
  async initialize(): Promise<void> {
    if (!this.storage) return;

    try {
      // Load all sessions from storage (for validation/warmup)
      await this.storage.sessions.listAllSessions();
    } catch (error) {
      console.error('Failed to load sessions from storage:', error);
      throw error;
    }
  }



  /**
   * Create a new session within a section
   * @param creatorId - User ID of the instructor creating the session
   * @param sectionId - Section ID this session belongs to (required)
   * @param problem - Optional problem to clone into session
   */
  async createSession(
    creatorId: string,
    sectionId: string,
    sectionName: string,
    problem?: Problem
  ): Promise<Session> {
    // Ensure storage is initialized (auto-init for API routes)
    const storage = await this.ensureStorage();

    // Enforce single active session per user
    const existingActiveSessions = await this.getActiveSessionsForUser(creatorId);
    if (existingActiveSessions.length > 0) {
      throw new Error(
        `Cannot create session: User already has ${existingActiveSessions.length} active session(s). End your current session before starting a new one.`
      );
    }

    const sessionId = uuidv4();

    const session: Session = {
      id: sessionId,
      problem: problem ? this.cloneProblem(problem) : this.createEmptyProblem(creatorId),
      students: new Map(),
      createdAt: new Date(),
      lastActivity: new Date(),
      creatorId,
      participants: [],
      status: 'active',
      sectionId,
      sectionName,
    };

    // Persist to storage
    try {
      await storage.sessions.createSession(session);
    } catch (error) {
      console.error('Failed to persist session to storage:', error);
      throw error;
    }

    return session;
  }

  /**
   * Create an empty problem for a new session
   */
  private createEmptyProblem(authorId: string): Problem {
    return {
      id: uuidv4(),
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

  /**
   * Clone a problem for use in a session
   * Creates a deep copy to avoid modifying the original
   */
  private cloneProblem(problem: Problem): Problem {
    return {
      ...problem,
      testCases: problem.testCases ? [...problem.testCases.map(tc => ({ ...tc }))] : undefined,
      executionSettings: problem.executionSettings ? {
        ...problem.executionSettings,
        attachedFiles: problem.executionSettings.attachedFiles
          ? problem.executionSettings.attachedFiles.map(f => ({ ...f }))
          : undefined,
      } : undefined,
    };
  }

  /**
   * Get a session by ID
   */
  async getSession(sessionId: string): Promise<Session | null> {
    // Ensure storage is initialized (auto-init for API routes)
    const storage = await this.ensureStorage();

    const session = await storage.sessions.getSession(sessionId);
    return session;
  }

  /**
   * Get all active sessions for a user (by creator ID)
   */
  async getActiveSessionsForUser(creatorId: string): Promise<Session[]> {
    // Ensure storage is initialized
    const storage = await this.ensureStorage();

    // Get all sessions and filter by creator and active status
    const allSessions = await storage.sessions.listAllSessions();
    return allSessions.filter(
      session => session.creatorId === creatorId && session.status === 'active'
    );
  }

  /**
   * Update session with a problem object
   */
  async updateSessionProblem(
    sessionId: string,
    problem: Problem,
    executionSettings?: ExecutionSettings
  ): Promise<boolean> {
    if (!this.storage) return false;

    try {
      const session = await this.getSession(sessionId);
      if (!session) return false;

      // Clone the problem to avoid mutation
      const clonedProblem = this.cloneProblem(problem);

      // Merge executionSettings into the cloned problem
      if (executionSettings !== undefined) {
        clonedProblem.executionSettings = executionSettings;
      }

      await this.storage.sessions.updateSession(sessionId, {
        problem: clonedProblem,
        lastActivity: new Date(),
      });
      return true;
    } catch (error) {
      console.error(`Failed to update session problem ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Add a student to a session
   */
  async addStudent(sessionId: string, studentId: string, name: string): Promise<boolean> {
    if (!this.storage) return false;

    const session = await this.getSession(sessionId);
    if (!session) return false;

    // Check if student already exists (rejoining)
    const existingStudent = session.students.get(studentId);

    // Initialize with starter code if this is the first join, otherwise preserve existing code
    const initialCode = existingStudent?.code !== undefined
      ? existingStudent.code
      : (session.problem?.starterCode || '');

    const student: Student = {
      id: studentId,
      name,
      code: initialCode,
      lastUpdate: new Date(),
    };

    session.students.set(studentId, student);

    // Add to participants list if not already there
    if (!session.participants.includes(studentId)) {
      session.participants.push(studentId);
    }

    try {
      await this.storage.sessions.updateSession(sessionId, {
        students: session.students,
        participants: session.participants,
        lastActivity: new Date(),
      });

      const logMessage = existingStudent
        ? `Added student ${name} (${studentId}) to session ${sessionId} (rejoining with existing code)`
        : `Added student ${name} (${studentId}) to session ${sessionId} (initialized with starter code)`;
      return true;
    } catch (error) {
      console.error(`Failed to add student to session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Remove a student from a session (disconnect only, preserves code)
   */
  async removeStudent(sessionId: string, studentId: string): Promise<boolean> {
    if (!this.storage) return false;

    const session = await this.getSession(sessionId);
    if (!session) return false;

    const student = session.students.get(studentId);
    if (student) {
      // Don't delete the student - just clear the WebSocket reference
      // This preserves their code for when they reconnect
      student.ws = undefined;

      try {
        await this.storage.sessions.updateSession(sessionId, {
          students: session.students,
          lastActivity: new Date(),
        });
        return true;
      } catch (error) {
        console.error(`Failed to disconnect student from session ${sessionId}:`, error);
        return false;
      }
    }
    return false;
  }

  /**
   * Update student code
   */
  async updateStudentCode(sessionId: string, studentId: string, code: string): Promise<boolean> {
    if (!this.storage) return false;

    const session = await this.getSession(sessionId);
    if (!session) return false;

    const student = session.students.get(studentId);
    if (!student) return false;

    student.code = code;
    student.lastUpdate = new Date();

    try {
      await this.storage.sessions.updateSession(sessionId, {
        students: session.students,
        lastActivity: new Date(),
      });
      return true;
    } catch (error) {
      console.error(`Failed to update student code for session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Update student-specific settings (randomSeed and attachedFiles)
   */
  async updateStudentSettings(
    sessionId: string,
    studentId: string,
    executionSettings: ExecutionSettings
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const student = session.students.get(studentId);
    if (!student) {
      throw new Error('Student not found');
    }

    // Merge with existing settings (allows partial updates)
    student.executionSettings = {
      ...student.executionSettings,
      ...executionSettings
    };
    student.lastUpdate = new Date();

    if (this.storage) {
      try {
        await this.storage.sessions.updateSession(sessionId, {
          students: session.students,
          lastActivity: new Date(),
        });
      } catch (error) {
        console.error(`Failed to persist student settings update for session ${sessionId}:`, error);
        throw error;
      }
    }
  }

  /**
   * Get student data including code, randomSeed, and attachedFiles
   */
  async getStudentData(sessionId: string, studentId: string): Promise<{
    code: string;
    executionSettings?: ExecutionSettings;
  } | undefined> {
    const session = await this.getSession(sessionId);
    if (!session) return undefined;

    const student = session.students.get(studentId);
    if (!student) return undefined;

    // Merge execution settings: problem defaults → student overrides
    const problemSettings = session.problem.executionSettings;
    const studentSettings = student.executionSettings;

    // Build merged execution settings
    const mergedSettings: ExecutionSettings = {
      stdin: studentSettings?.stdin ?? problemSettings?.stdin,
      randomSeed: studentSettings?.randomSeed !== undefined
        ? studentSettings.randomSeed
        : problemSettings?.randomSeed,
      attachedFiles: studentSettings?.attachedFiles !== undefined
        ? studentSettings.attachedFiles // explicit student override, even if empty array
        : problemSettings?.attachedFiles,
    };

    // Only include executionSettings if at least one field is defined
    const hasSettings = mergedSettings.stdin !== undefined ||
                       mergedSettings.randomSeed !== undefined ||
                       mergedSettings.attachedFiles !== undefined;

    return {
      code: student.code,
      executionSettings: hasSettings ? mergedSettings : undefined,
    };
  }

  /**
   * Get student code
   */
  async getStudentCode(sessionId: string, studentId: string): Promise<string | undefined> {
    const session = await this.getSession(sessionId);
    if (!session) return undefined;

    const student = session.students.get(studentId);
    return student?.code;
  }

  /**
   * Get all students in a session
   */
  async getStudents(sessionId: string): Promise<Student[]> {
    const session = await this.getSession(sessionId);
    if (!session) return [];

    return Array.from(session.students.values());
  }

  /**
   * Set featured submission for public view
   */
  async setFeaturedSubmission(sessionId: string, studentId: string): Promise<boolean> {
    if (!this.storage) return false;

    const session = await this.getSession(sessionId);
    if (!session) return false;

    const student = session.students.get(studentId);
    if (!student) return false;

    try {
      await this.storage.sessions.updateSession(sessionId, {
        featuredStudentId: studentId,
        featuredCode: student.code,
        lastActivity: new Date(),
      });
      return true;
    } catch (error) {
      console.error(`Failed to set featured submission for session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Clear featured submission
   */
  async clearFeaturedSubmission(sessionId: string): Promise<boolean> {
    if (!this.storage) return false;

    try {
      await this.storage.sessions.updateSession(sessionId, {
        featuredStudentId: undefined,
        featuredCode: undefined,
        lastActivity: new Date(),
      });
      return true;
    } catch (error) {
      console.error(`Failed to clear featured submission for session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Update featured code (from public view edits)
   */
  async updateFeaturedCode(sessionId: string, code: string): Promise<boolean> {
    if (!this.storage) return false;

    try {
      await this.storage.sessions.updateSession(sessionId, {
        featuredCode: code,
        lastActivity: new Date(),
      });
      return true;
    } catch (error) {
      console.error(`Failed to update featured code for session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Get featured submission data
   */
  async getFeaturedSubmission(sessionId: string): Promise<{
    studentId?: string;
    code?: string;
    executionSettings?: ExecutionSettings;
  }> {
    const session = await this.getSession(sessionId);
    if (!session) return {};

    // Get the student data if we have a featured student
    const student = session.featuredStudentId
      ? session.students.get(session.featuredStudentId)
      : null;

    return {
      studentId: session.featuredStudentId,
      code: session.featuredCode,
      executionSettings: student?.executionSettings,
    };
  }

  /**
   * End a session (mark as completed)
   */
  async endSession(sessionId: string): Promise<boolean> {
    if (!this.storage) return false;

    const session = await this.getSession(sessionId);
    if (!session) return false;

    try {
      await this.storage.sessions.updateSession(sessionId, {
        status: 'completed',
        endedAt: new Date(),
      });
      return true;
    } catch (error) {
      console.error(`Failed to end session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    if (!this.storage) return false;

    const session = await this.getSession(sessionId);
    if (!session) return false;

    try {
      await this.storage.sessions.deleteSession(sessionId);
      return true;
    } catch (error) {
      console.error(`Failed to delete session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Get sessions for a specific section
   */
  async getSessionsBySection(sectionId: string): Promise<Session[]> {
    const storage = await this.ensureStorage();

    try {
      const allSessions = await storage.sessions.listAllSessions();
      return allSessions.filter(s => s.sectionId === sectionId);
    } catch (error) {
      console.error(`Failed to get sessions for section ${sectionId}:`, error);
      return [];
    }
  }

  /**
   * Check if a user is a member of the session's section
   * If session has no sectionId, returns true (backwards compatibility)
   */
  async isSectionMember(sessionId: string, userId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (!session) return false;

    // If session has no section, allow access (backwards compatibility)
    if (!session.sectionId) return true;

    // Check section membership
    const storage = await this.ensureStorage();
    if (!storage.memberships) {
      console.warn('Membership repository not available');
      return false;
    }

    try {
      const membership = await storage.memberships.getMembership(userId, session.sectionId);
      return membership !== null;
    } catch (error) {
      console.error(`Failed to check section membership for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Cleanup old sessions (optional for Phase 1)
   * Remove sessions with no activity for more than 24 hours
   */
  async cleanupOldSessions(): Promise<number> {
    if (!this.storage) return 0;

    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    let cleaned = 0;

    try {
      const sessions = await this.storage.sessions.listAllSessions();

      for (const session of sessions) {
        const age = now.getTime() - session.lastActivity.getTime();
        if (age > maxAge) {
          await this.deleteSession(session.id);
          cleaned++;
        }
      }

    } catch (error) {
      console.error('Failed to cleanup old sessions:', error);
    }

    return cleaned;
  }

  /**
   * Get session count
   */
  async getSessionCount(): Promise<number> {
    if (!this.storage) return 0;

    try {
      return await this.storage.sessions.countSessions();
    } catch (error) {
      console.error('Failed to get session count:', error);
      return 0;
    }
  }

  /**
   * List all sessions (for instructor dashboard)
   */
  async listSessions(): Promise<Session[]> {
    if (!this.storage) return [];

    try {
      return await this.storage.sessions.listAllSessions();
    } catch (error) {
      console.error('Failed to list sessions:', error);
      return [];
    }
  }

  /**
   * Get sessions where user is creator (instructor)
   */
  async getSessionsByCreator(creatorId: string): Promise<Session[]> {
    const storage = await this.ensureStorage();

    try {
      const allSessions = await storage.sessions.listAllSessions();
      return allSessions.filter(s => s.creatorId === creatorId);
    } catch (error) {
      console.error('Failed to get sessions by creator:', error);
      return [];
    }
  }

  /**
   * Get sessions where user is a participant (student)
   */
  /**
   * Get sessions where user is a participant (student)
   */
  async getSessionsByParticipant(userId: string): Promise<Session[]> {
    const storage = await this.ensureStorage();

    try {
      const allSessions = await storage.sessions.listAllSessions();
      return allSessions.filter(s => s.participants.includes(userId));
    } catch (error) {
      console.error('Failed to get sessions by participant:', error);
      return [];
    }
  }
}

// Mutable singleton instance holder
// Will be replaced in index.ts with a properly initialized instance
export const sessionManagerHolder = {
  instance: new SessionManager() as SessionManager,
};

// For convenience, export the instance directly too
export { sessionManagerHolder as sessionManager };

// Getter function for API routes
export function getSessionManager(): SessionManager {
  return sessionManagerHolder.instance;
}
