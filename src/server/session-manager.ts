import { v4 as uuidv4 } from 'uuid';
import { Session, Student } from './types';

class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private sessionsByJoinCode: Map<string, string> = new Map();

  /**
   * Generate a unique 6-character join code
   */
  private generateJoinCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding confusing chars
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Ensure uniqueness
    if (this.sessionsByJoinCode.has(code)) {
      return this.generateJoinCode();
    }
    
    return code;
  }

  /**
   * Create a new session
   */
  createSession(): Session {
    const sessionId = uuidv4();
    const joinCode = this.generateJoinCode();
    
    const session: Session = {
      id: sessionId,
      joinCode,
      problemText: '',
      connectedStudents: new Map(),
      createdAt: new Date(),
      lastActivity: new Date(),
    };
    
    this.sessions.set(sessionId, session);
    this.sessionsByJoinCode.set(joinCode, sessionId);
    
    console.log(`Created session ${sessionId} with join code ${joinCode}`);
    return session;
  }

  /**
   * Get a session by join code
   */
  getSessionByJoinCode(joinCode: string): Session | undefined {
    const sessionId = this.sessionsByJoinCode.get(joinCode.toUpperCase());
    if (!sessionId) return undefined;
    return this.sessions.get(sessionId);
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Update problem text for a session
   */
  updateProblem(sessionId: string, problemText: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    
    session.problemText = problemText;
    session.lastActivity = new Date();
    console.log(`Updated problem for session ${sessionId}`);
    return true;
  }

  /**
   * Add a student to a session
   */
  addStudent(sessionId: string, studentId: string, name: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    
    const student: Student = {
      id: studentId,
      name,
      code: '',
      lastUpdate: new Date(),
    };
    
    session.connectedStudents.set(studentId, student);
    session.lastActivity = new Date();
    console.log(`Added student ${name} (${studentId}) to session ${sessionId}`);
    return true;
  }

  /**
   * Remove a student from a session
   */
  removeStudent(sessionId: string, studentId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    
    const removed = session.connectedStudents.delete(studentId);
    if (removed) {
      session.lastActivity = new Date();
      console.log(`Removed student ${studentId} from session ${sessionId}`);
    }
    return removed;
  }

  /**
   * Update student code
   */
  updateStudentCode(sessionId: string, studentId: string, code: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    
    const student = session.connectedStudents.get(studentId);
    if (!student) return false;
    
    student.code = code;
    student.lastUpdate = new Date();
    session.lastActivity = new Date();
    return true;
  }

  /**
   * Get student code
   */
  getStudentCode(sessionId: string, studentId: string): string | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    
    const student = session.connectedStudents.get(studentId);
    return student?.code;
  }

  /**
   * Get all students in a session
   */
  getStudents(sessionId: string): Student[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];
    
    return Array.from(session.connectedStudents.values());
  }

  /**
   * Set featured submission for public view
   */
  setFeaturedSubmission(sessionId: string, studentId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    
    const student = session.connectedStudents.get(studentId);
    if (!student) return false;
    
    session.featuredStudentId = studentId;
    // Create a copy of the student's code for the public view
    session.featuredCode = student.code;
    session.lastActivity = new Date();
    console.log(`Set featured submission for session ${sessionId}: student ${studentId}`);
    return true;
  }

  /**
   * Clear featured submission
   */
  clearFeaturedSubmission(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    
    session.featuredStudentId = undefined;
    session.featuredCode = undefined;
    session.lastActivity = new Date();
    return true;
  }

  /**
   * Update featured code (from public view edits)
   */
  updateFeaturedCode(sessionId: string, code: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    
    session.featuredCode = code;
    session.lastActivity = new Date();
    return true;
  }

  /**
   * Get featured submission data
   */
  getFeaturedSubmission(sessionId: string): { studentId?: string; code?: string } {
    const session = this.sessions.get(sessionId);
    if (!session) return {};
    
    return {
      studentId: session.featuredStudentId,
      code: session.featuredCode,
    };
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    
    this.sessionsByJoinCode.delete(session.joinCode);
    this.sessions.delete(sessionId);
    console.log(`Deleted session ${sessionId}`);
    return true;
  }

  /**
   * Cleanup old sessions (optional for Phase 1)
   * Remove sessions with no activity for more than 24 hours
   */
  cleanupOldSessions(): number {
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    let cleaned = 0;
    
    for (const [sessionId, session] of this.sessions.entries()) {
      const age = now.getTime() - session.lastActivity.getTime();
      if (age > maxAge) {
        this.deleteSession(sessionId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} old sessions`);
    }
    return cleaned;
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }
}

// Singleton instance
export const sessionManager = new SessionManager();
