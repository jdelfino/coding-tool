import { v4 as uuidv4 } from 'uuid';
import { Session, Student } from './types';
import { IStorageRepository } from './persistence';

export class SessionManager {
  // In-memory index for join codes (for fast lookup)
  private sessionsByJoinCode: Map<string, string> = new Map();

  constructor(private storage?: IStorageRepository) {
    // Storage is optional for backward compatibility during migration
  }

  /**
   * Initialize session manager
   * Loads existing sessions from storage
   */
  async initialize(): Promise<void> {
    if (!this.storage) return;
    
    try {
      // Load all sessions from storage
      const sessions = await this.storage.sessions.listAllSessions();
      
      // Rebuild join code index
      for (const session of sessions) {
        this.sessionsByJoinCode.set(session.joinCode, session.id);
      }
      
      console.log(`Loaded ${sessions.length} sessions from storage`);
    } catch (error) {
      console.error('Failed to load sessions from storage:', error);
      throw error;
    }
  }

  /**
   * Generate a unique join code (6 uppercase letters/numbers)
   */
  private generateJoinCode(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    // Ensure uniqueness (very unlikely to collide, but check anyway)
    if (this.sessionsByJoinCode.has(code)) {
      return this.generateJoinCode();
    }
    
    return code;
  }

  /**
   * Create a new session
   */
  async createSession(creatorId?: string): Promise<Session> {
    const sessionId = uuidv4();
    const joinCode = this.generateJoinCode();
    
    const session: Session = {
      id: sessionId,
      joinCode,
      problemText: '',
      connectedStudents: new Map(),
      createdAt: new Date(),
      lastActivity: new Date(),
      creatorId: creatorId || 'system',
      participants: [],
      status: 'active',
    };
    
    // Persist to storage if available
    if (this.storage) {
      try {
        await this.storage.sessions.createSession(session);
      } catch (error) {
        console.error('Failed to persist session to storage:', error);
        throw error;
      }
    }
    
    this.sessionsByJoinCode.set(joinCode, sessionId);
    
    console.log(`Created session ${sessionId} with join code ${joinCode}`);
    return session;
  }

  /**
   * Get a session by join code
   */
  async getSessionByJoinCode(joinCode: string): Promise<Session | null> {
    const sessionId = this.sessionsByJoinCode.get(joinCode.toUpperCase());
    if (!sessionId) return null;
    
    if (this.storage) {
      const session = await this.storage.sessions.getSession(sessionId);
      return session;
    }
    
    return null;
  }

  /**
   * Get a session by ID
   */
  async getSession(sessionId: string): Promise<Session | null> {
    if (this.storage) {
      const session = await this.storage.sessions.getSession(sessionId);
      return session;
    }
    
    return null;
  }

  /**
   * Update problem text for a session
   */
  async updateProblem(sessionId: string, problemText: string): Promise<boolean> {
    if (!this.storage) return false;
    
    try {
      await this.storage.sessions.updateSession(sessionId, {
        problemText,
        lastActivity: new Date(),
      });
      console.log(`Updated problem for session ${sessionId}`);
      return true;
    } catch (error) {
      console.error(`Failed to update problem for session ${sessionId}:`, error);
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
    
    const student: Student = {
      id: studentId,
      name,
      code: '',
      lastUpdate: new Date(),
    };
    
    session.connectedStudents.set(studentId, student);
    
    // Initialize participants array if it doesn't exist (backwards compatibility)
    if (!session.participants) {
      session.participants = [];
    }
    
    // Add to participants list if not already there
    if (!session.participants.includes(studentId)) {
      session.participants.push(studentId);
    }
    
    try {
      await this.storage.sessions.updateSession(sessionId, {
        connectedStudents: session.connectedStudents,
        participants: session.participants,
        lastActivity: new Date(),
      });
      console.log(`Added student ${name} (${studentId}) to session ${sessionId}`);
      return true;
    } catch (error) {
      console.error(`Failed to add student to session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Remove a student from a session
   */
  async removeStudent(sessionId: string, studentId: string): Promise<boolean> {
    if (!this.storage) return false;
    
    const session = await this.getSession(sessionId);
    if (!session) return false;
    
    const removed = session.connectedStudents.delete(studentId);
    if (removed) {
      try {
        await this.storage.sessions.updateSession(sessionId, {
          connectedStudents: session.connectedStudents,
          lastActivity: new Date(),
        });
        console.log(`Removed student ${studentId} from session ${sessionId}`);
        return true;
      } catch (error) {
        console.error(`Failed to remove student from session ${sessionId}:`, error);
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
    
    const student = session.connectedStudents.get(studentId);
    if (!student) return false;
    
    student.code = code;
    student.lastUpdate = new Date();
    
    try {
      await this.storage.sessions.updateSession(sessionId, {
        connectedStudents: session.connectedStudents,
        lastActivity: new Date(),
      });
      return true;
    } catch (error) {
      console.error(`Failed to update student code for session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Get student code
   */
  async getStudentCode(sessionId: string, studentId: string): Promise<string | undefined> {
    const session = await this.getSession(sessionId);
    if (!session) return undefined;
    
    const student = session.connectedStudents.get(studentId);
    return student?.code;
  }

  /**
   * Get all students in a session
   */
  async getStudents(sessionId: string): Promise<Student[]> {
    const session = await this.getSession(sessionId);
    if (!session) return [];
    
    return Array.from(session.connectedStudents.values());
  }

  /**
   * Set featured submission for public view
   */
  async setFeaturedSubmission(sessionId: string, studentId: string): Promise<boolean> {
    if (!this.storage) return false;
    
    const session = await this.getSession(sessionId);
    if (!session) return false;
    
    const student = session.connectedStudents.get(studentId);
    if (!student) return false;
    
    try {
      await this.storage.sessions.updateSession(sessionId, {
        featuredStudentId: studentId,
        featuredCode: student.code,
        lastActivity: new Date(),
      });
      console.log(`Set featured submission for session ${sessionId}: student ${studentId}`);
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
  async getFeaturedSubmission(sessionId: string): Promise<{ studentId?: string; code?: string }> {
    const session = await this.getSession(sessionId);
    if (!session) return {};
    
    return {
      studentId: session.featuredStudentId,
      code: session.featuredCode,
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
      console.log(`Ended session ${sessionId}`);
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
      this.sessionsByJoinCode.delete(session.joinCode);
      console.log(`Deleted session ${sessionId}`);
      return true;
    } catch (error) {
      console.error(`Failed to delete session ${sessionId}:`, error);
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
      
      if (cleaned > 0) {
        console.log(`Cleaned up ${cleaned} old sessions`);
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
    if (!this.storage) return [];
    
    try {
      const allSessions = await this.storage.sessions.listAllSessions();
      return allSessions.filter(s => s.creatorId === creatorId);
    } catch (error) {
      console.error('Failed to get sessions by creator:', error);
      return [];
    }
  }

  /**
   * Get sessions where user is a participant (student)
   */
  async getSessionsByParticipant(userId: string): Promise<Session[]> {
    if (!this.storage) return [];
    
    try {
      const allSessions = await this.storage.sessions.listAllSessions();
      return allSessions.filter(s => s.participants && s.participants.includes(userId));
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
