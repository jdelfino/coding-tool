import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { sessionManagerHolder } from './session-manager';
import { executeCodeSafe } from './code-executor';
import { MessageType, WebSocketMessage, Student } from './types';
import { getAuthProvider } from './auth';
import { RBACService } from './auth/rbac';
import { User } from './auth/types';
import { revisionBufferHolder } from './revision-buffer';
import { getStorage } from './persistence';
import { getSectionRepository, getMembershipRepository } from './classes';
import * as DiffMatchPatch from 'diff-match-patch';

interface Connection {
  ws: WebSocket;
  role: 'instructor' | 'student' | 'public';
  sessionId?: string;
  studentId?: string;
  userId?: string; // User ID from authentication
  user?: User; // Full user object for permission checks
  isAlive: boolean;
}

class WebSocketHandler {
  private connections: Map<WebSocket, Connection> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private rbac = new RBACService();

  /**
   * Check if a connection has a specific permission.
   * Returns true if the user has the permission, false otherwise.
   */
  private hasPermission(connection: Connection, permission: string): boolean {
    if (!connection.user) {
      return false;
    }
    return this.rbac.hasPermission(connection.user, permission);
  }

  async initialize(wss: WebSocketServer) {
    // Set up heartbeat to detect dead connections
    this.heartbeatInterval = setInterval(() => {
      this.heartbeat();
    }, 30000); // 30 seconds

    wss.on('connection', async (ws: WebSocket, request: IncomingMessage) => {
      console.log('New WebSocket connection');
      
      // Extract user authentication from cookies
      let userId: string | undefined;
      let user: User | undefined;
      try {
        const cookies = request.headers.cookie;
        
        if (cookies) {
          const sessionId = cookies
            .split(';')
            .map(c => c.trim())
            .find(c => c.startsWith('sessionId='))
            ?.split('=')[1];
          
          if (sessionId) {
            const authProvider = await getAuthProvider();
            const session = await authProvider.getSession(sessionId);
            
            if (session && session.user) {
              userId = session.user.id;
              user = session.user; // Store full user object
              console.log('[WS Auth] Authenticated as user:', userId, '(', session.user.username, session.user.role, ')');
            } else if (session) {
              console.log('[WS Auth] Session found but user property is missing!');
            }
          } else {
            console.log('[WS Auth] No sessionId cookie found');
          }
        } else {
          console.log('[WS Auth] No cookies in request headers');
        }
      } catch (error) {
        console.error('[WS Auth] Error extracting user authentication:', error);
      }
      
      const connection: Connection = {
        ws,
        role: 'student', // Will be set when they identify themselves
        userId, // Set from authentication if available
        user, // Store full user object for permission checks
        isAlive: true,
      };
      
      this.connections.set(ws, connection);

      // Set up pong handler for heartbeat
      ws.on('pong', () => {
        const conn = this.connections.get(ws);
        if (conn) conn.isAlive = true;
      });

      ws.on('message', async (data: Buffer) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          await this.handleMessage(ws, message);
        } catch (error) {
          console.error('Error handling message:', error);
          this.sendError(ws, 'Invalid message format');
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });
  }

  private async handleMessage(ws: WebSocket, message: WebSocketMessage) {
    const connection = this.connections.get(ws);
    if (!connection) return;

    console.log('Received message:', message.type);

    switch (message.type) {
      case MessageType.CREATE_SESSION:
        await this.handleCreateSession(ws, connection, message.payload);
        break;

      case MessageType.LIST_SESSIONS:
        await this.handleListSessions(ws, connection);
        break;

      case MessageType.JOIN_EXISTING_SESSION:
        await this.handleJoinExistingSession(ws, connection, message.payload);
        break;

      case MessageType.END_SESSION:
        await this.handleEndSession(ws, connection, message.payload);
        break;
        
      case MessageType.JOIN_SESSION:
        await this.handleJoinSession(ws, connection, message.payload);
        break;
        
      case MessageType.UPDATE_PROBLEM:
        await this.handleUpdateProblem(connection, message.payload);
        break;
        
      case MessageType.CODE_UPDATE:
        await this.handleCodeUpdate(connection, message.payload);
        break;
        
      case MessageType.UPDATE_STUDENT_SETTINGS:
        await this.handleUpdateStudentSettings(connection, message.payload);
        break;
        
      case MessageType.EXECUTE_CODE:
        await this.handleExecuteCode(ws, connection, message.payload);
        break;
        
      case MessageType.EXECUTE_STUDENT_CODE:
        await this.handleExecuteStudentCode(ws, connection, message.payload);
        break;
        
      case MessageType.REQUEST_STUDENT_CODE:
        await this.handleRequestStudentCode(ws, connection, message.payload);
        break;
        
      case MessageType.GET_REVISIONS:
        await this.handleGetRevisions(ws, connection, message.payload);
        break;
        
      case MessageType.SELECT_SUBMISSION_FOR_PUBLIC:
        await this.handleSelectSubmissionForPublic(connection, message.payload);
        break;
        
      case MessageType.JOIN_PUBLIC_VIEW:
        await this.handleJoinPublicView(ws, connection, message.payload);
        break;
        
      case MessageType.PUBLIC_CODE_EDIT:
        await this.handlePublicCodeEdit(connection, message.payload);
        break;
        
      case MessageType.PUBLIC_EXECUTE_CODE:
        await this.handlePublicExecuteCode(ws, connection, message.payload);
        break;
        
      default:
        this.sendError(ws, 'Unknown message type');
    }
  }

  private async handleCreateSession(ws: WebSocket, connection: Connection, payload: any) {
    try {
      console.log('[handleCreateSession] Starting, payload:', payload);
      const { sectionId } = payload;
      
      if (!sectionId || typeof sectionId !== 'string') {
        console.error('[handleCreateSession] Invalid sectionId');
        this.sendError(ws, 'Section ID is required to create a session');
        return;
      }

      if (!connection.userId) {
        console.error('[handleCreateSession] No userId in connection');
        this.sendError(ws, 'Authentication required to create a session');
        return;
      }

      console.log('[handleCreateSession] Fetching section:', sectionId);
      // Validate instructor has access to this section
      const sectionRepo = await getSectionRepository();
      const section = await sectionRepo.getSection(sectionId);
      
      if (!section) {
        console.error('[handleCreateSession] Section not found:', sectionId);
        this.sendError(ws, 'Section not found');
        return;
      }

      console.log('[handleCreateSession] Checking instructor access, section.instructorIds:', section.instructorIds, 'userId:', connection.userId);
      // Check if user is instructor of this section
      const isInstructor = section.instructorIds.includes(connection.userId);
      if (!isInstructor) {
        console.error('[handleCreateSession] User is not instructor of section');
        this.sendError(ws, 'You are not an instructor of this section');
        return;
      }

      console.log('[handleCreateSession] Creating session...');
      // Create session with section context
      const session = await sessionManagerHolder.instance.createSession(
        connection.userId,
        sectionId,
        section.name
      );
      
      console.log('[handleCreateSession] Session created:', session.id);
      connection.role = 'instructor';
      connection.sessionId = session.id;
      
      console.log('[handleCreateSession] Sending SESSION_CREATED response');
      this.send(ws, {
        type: MessageType.SESSION_CREATED,
        payload: {
          sessionId: session.id,
          joinCode: session.joinCode,
          sectionId: session.sectionId,
          sectionName: session.sectionName,
          problem: session.problem,
        },
      });
      console.log('[handleCreateSession] Response sent successfully');
    } catch (error) {
      console.error('[handleCreateSession] Error:', error);
      this.sendError(ws, 'Failed to create session: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  private async handleListSessions(ws: WebSocket, connection: Connection) {
    try {
      const sessions = await sessionManagerHolder.instance.listSessions();
      
      // Convert sessions to a serializable format (without Maps)
      const sessionList = sessions.map(session => ({
        id: session.id,
        joinCode: session.joinCode,
        problem: session.problem,
        studentCount: session.students.size,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
      }));

      this.send(ws, {
        type: MessageType.SESSION_LIST,
        payload: { sessions: sessionList },
      });
    } catch (error) {
      console.error('Error listing sessions:', error);
      this.sendError(ws, 'Failed to list sessions');
    }
  }

  private async handleJoinExistingSession(ws: WebSocket, connection: Connection, payload: any) {
    const { sessionId } = payload;
    
    console.log('[handleJoinExistingSession] Attempting to join session:', sessionId, 'for user:', connection.userId);
    
    if (!sessionId || typeof sessionId !== 'string') {
      console.log('[handleJoinExistingSession] Invalid session ID');
      this.sendError(ws, 'Invalid session ID');
      return;
    }

    const session = await sessionManagerHolder.instance.getSession(sessionId);
    console.log('[handleJoinExistingSession] Session lookup result:', session ? 'Found' : 'Not found');
    
    if (!session) {
      console.log('[handleJoinExistingSession] Session not found:', sessionId);
      this.sendError(ws, 'Session not found');
      return;
    }

    // Validate access if session is scoped to a section
    if (session.sectionId && connection.userId) {
      const sectionRepo = await getSectionRepository();
      const section = await sectionRepo.getSection(session.sectionId);
      
      if (!section) {
        this.sendError(ws, 'Section not found');
        return;
      }

      // Check if user is section instructor OR a member
      const isInstructor = section.instructorIds.includes(connection.userId);
      
      if (!isInstructor) {
        const membershipRepo = await getMembershipRepository();
        const membership = await membershipRepo.getMembership(connection.userId, session.sectionId);
        
        if (!membership) {
          this.sendError(ws, 'You are not authorized to access this section\'s session.');
          return;
        }
      }
    } else if (session.sectionId && !connection.userId) {
      // Session requires section membership but user is not authenticated
      this.sendError(ws, 'You must be signed in to access this section-based session.');
      return;
    }

    connection.role = 'instructor';
    connection.sessionId = session.id;

    this.send(ws, {
      type: MessageType.SESSION_JOINED,
      payload: {
        sessionId: session.id,
        joinCode: session.joinCode,
        problem: session.problem,
        executionSettings: session.executionSettings,
      },
    });

    // Send current student list
    await this.broadcastStudentList(session.id);
  }

  private async handleEndSession(ws: WebSocket, connection: Connection, payload: any) {
    const { sessionId } = payload;
    
    if (!sessionId || typeof sessionId !== 'string') {
      this.sendError(ws, 'Invalid session ID');
      return;
    }

    // Only allow instructor to end their own session or if they're already in it
    if (connection.sessionId && connection.sessionId !== sessionId) {
      this.sendError(ws, 'Cannot end a different session');
      return;
    }

    try {
      const ended = await sessionManagerHolder.instance.endSession(sessionId);
      
      if (ended) {
        // Flush all revisions for this session before ending
        if (revisionBufferHolder.instance) {
          await revisionBufferHolder.instance.flushSession(sessionId);
        }

        // Notify all connected clients in this session
        this.broadcastToSession(sessionId, {
          type: MessageType.SESSION_ENDED,
          payload: { sessionId },
        });

        // Clear connection's session
        if (connection.sessionId === sessionId) {
          connection.sessionId = undefined;
        }

        this.send(ws, {
          type: MessageType.SESSION_ENDED,
          payload: { sessionId },
        });
      } else {
        this.sendError(ws, 'Failed to end session');
      }
    } catch (error) {
      console.error('Error ending session:', error);
      this.sendError(ws, 'Failed to end session');
    }
  }

  private async handleJoinSession(ws: WebSocket, connection: Connection, payload: any) {
    const { joinCode, studentName } = payload;
    
    // Validate inputs
    if (!joinCode || typeof joinCode !== 'string') {
      this.sendError(ws, 'Invalid join code');
      return;
    }
    
    if (!studentName || typeof studentName !== 'string' || studentName.trim().length === 0) {
      this.sendError(ws, 'Invalid student name');
      return;
    }
    
    if (studentName.trim().length > 50) {
      this.sendError(ws, 'Student name is too long (max 50 characters)');
      return;
    }
    
    const session = await sessionManagerHolder.instance.getSessionByJoinCode(joinCode);
    if (!session) {
      this.sendError(ws, 'Session not found. Please check the join code.');
      return;
    }

    // Auto-enroll student in section if session is scoped to a section
    if (session.sectionId && connection.userId) {
      console.log('[JOIN_SESSION] Checking/creating section membership for user:', connection.userId);
      const membershipRepo = await getMembershipRepository();
      
      // Check if already a member
      const existingMembership = await membershipRepo.getMembership(connection.userId, session.sectionId);
      
      if (!existingMembership) {
        console.log('[JOIN_SESSION] Auto-enrolling student in section:', session.sectionId);
        try {
          await membershipRepo.addMembership({
            userId: connection.userId,
            sectionId: session.sectionId,
            role: 'student',
          });
          console.log('[JOIN_SESSION] Student successfully enrolled in section');
        } catch (error) {
          console.error('[JOIN_SESSION] Error enrolling student:', error);
          this.sendError(ws, 'Failed to join session. Please try again.');
          return;
        }
      } else {
        console.log('[JOIN_SESSION] Student already enrolled in section');
      }
    } else if (session.sectionId && !connection.userId) {
      // Session requires section membership but user is not authenticated
      this.sendError(ws, 'You must be signed in to join this section-based session.');
      return;
    }

    // Use authenticated user ID if available, otherwise generate a UUID
    // This ensures students can see their session history after signing out and back in
    const studentId = connection.userId || uuidv4();
    console.log(`[JOIN_SESSION] studentName: ${studentName}, connection.userId: ${connection.userId}, studentId: ${studentId}`);
    connection.role = 'student';
    connection.sessionId = session.id;
    connection.studentId = studentId;

    // Check if student has existing code (rejoining)
    const studentData = await sessionManagerHolder.instance.getStudentData(session.id, studentId);
    console.log(`[JOIN_SESSION] student data for ${studentId}:`, studentData ? `${studentData.code.length} chars` : 'none');

    const success = await sessionManagerHolder.instance.addStudent(session.id, studentId, studentName.trim());
    if (!success) {
      this.sendError(ws, 'Failed to join session. Please try again.');
      return;
    }

    this.send(ws, {
      type: MessageType.SESSION_JOINED,
      payload: {
        sessionId: session.id,
        studentId,
        problem: session.problem,
        sessionExecutionSettings: session.executionSettings, // Session-level defaults
        code: studentData?.code || '', // Student's code if rejoining
        studentExecutionSettings: studentData?.executionSettings, // Student's specific settings if set
      },
    });

    // Reset revision tracking baseline when student rejoins with existing code
    if (revisionBufferHolder.instance && studentData?.code) {
      revisionBufferHolder.instance.resetStudent(session.id, studentId, studentData.code);
    }

    // Notify instructor of new student
    await this.broadcastStudentList(session.id);
  }

  private async handleUpdateProblem(connection: Connection, payload: any) {
    // Check if user has permission to manage sessions
    if (!this.hasPermission(connection, 'session.viewAll') || !connection.sessionId) {
      return;
    }

    const { problem, executionSettings } = payload;
    
    if (!problem) {
      console.error('Problem object is required');
      return;
    }
    
    await sessionManagerHolder.instance.updateSessionProblem(
      connection.sessionId, 
      problem,
      executionSettings
    );
    
    // Broadcast to all students and public views
    this.broadcastToSession(connection.sessionId, {
      type: MessageType.PROBLEM_UPDATE,
      payload: { problem, executionSettings },
    }, 'student');
    
    this.broadcastToSession(connection.sessionId, {
      type: MessageType.PROBLEM_UPDATE,
      payload: { problem, executionSettings },
    }, 'public');
  }

  private async handleCodeUpdate(connection: Connection, payload: any) {
    if (connection.role !== 'student' || !connection.sessionId || !connection.studentId) {
      return;
    }

    const { code } = payload;
    await sessionManagerHolder.instance.updateStudentCode(connection.sessionId, connection.studentId, code);

    // Track revision using the revision buffer (generates diffs server-side)
    if (revisionBufferHolder.instance) {
      await revisionBufferHolder.instance.addRevision(connection.sessionId, connection.studentId, code);
    }

    // Notify instructor
    await this.broadcastStudentList(connection.sessionId);
  }

  private async handleUpdateStudentSettings(connection: Connection, payload: any) {
    if (connection.role !== 'student' || !connection.sessionId || !connection.studentId) {
      return;
    }

    const { executionSettings } = payload;
    
    if (!executionSettings) {
      console.error('executionSettings object is required');
      return;
    }
    
    await sessionManagerHolder.instance.updateStudentSettings(
      connection.sessionId, 
      connection.studentId, 
      executionSettings
    );
    
    console.log(`Updated student ${connection.studentId} settings:`, executionSettings);
  }

  private async handleExecuteCode(ws: WebSocket, connection: Connection, payload: any) {
    if (connection.role !== 'student') {
      this.sendError(ws, 'Only students can execute code');
      return;
    }

    try {
      const { code, stdin } = payload;
      
      if (!code || typeof code !== 'string') {
        this.sendError(ws, 'Invalid code provided');
        return;
      }
      
      // Get student-specific settings
      const studentData = connection.sessionId && connection.studentId
        ? await sessionManagerHolder.instance.getStudentData(connection.sessionId, connection.studentId)
        : null;
      
      // Get session defaults
      const session = connection.sessionId 
        ? await sessionManagerHolder.instance.getSession(connection.sessionId)
        : null;
      
      // Use student-specific values if set, otherwise fall back to session defaults
      const randomSeed = studentData?.executionSettings?.randomSeed !== undefined 
        ? studentData.executionSettings.randomSeed 
        : session?.executionSettings?.randomSeed;
      
      const attachedFiles = studentData?.executionSettings?.attachedFiles && studentData.executionSettings.attachedFiles.length > 0
        ? studentData.executionSettings.attachedFiles
        : session?.executionSettings?.attachedFiles;
      
      const result = await executeCodeSafe({ 
        code, 
        stdin,
        randomSeed,
        attachedFiles,
      });

      this.send(ws, {
        type: MessageType.EXECUTION_RESULT,
        payload: result,
      });
    } catch (error) {
      console.error('Error executing code:', error);
      this.sendError(ws, 'Code execution failed. Please try again.');
    }
  }

  private async handleExecuteStudentCode(ws: WebSocket, connection: Connection, payload: any) {
    // Check if user has permission to execute code for all students
    if (!this.hasPermission(connection, 'data.viewAll') || !connection.sessionId) {
      this.sendError(ws, 'Permission denied: Requires data.viewAll permission');
      return;
    }

    try {
      const { studentId, stdin } = payload;
      
      if (!studentId || typeof studentId !== 'string') {
        this.sendError(ws, 'Invalid student ID');
        return;
      }
      
      // Get student-specific data including code, randomSeed, and attachedFiles
      const studentData = await sessionManagerHolder.instance.getStudentData(connection.sessionId, studentId);
      
      if (!studentData || !studentData.code) {
        this.sendError(ws, 'Student code not found or empty');
        return;
      }

      // Get session defaults for fallback
      const session = await sessionManagerHolder.instance.getSession(connection.sessionId);
      
      // Use student-specific values if set, otherwise fall back to session defaults
      const randomSeed = studentData.executionSettings?.randomSeed !== undefined 
        ? studentData.executionSettings.randomSeed 
        : session?.executionSettings?.randomSeed;
      
      const attachedFiles = studentData.executionSettings?.attachedFiles && studentData.executionSettings.attachedFiles.length > 0
        ? studentData.executionSettings.attachedFiles
        : session?.executionSettings?.attachedFiles;
      
      const result = await executeCodeSafe({ 
        code: studentData.code, 
        stdin,
        randomSeed,
        attachedFiles,
      });

      this.send(ws, {
        type: MessageType.EXECUTION_RESULT,
        payload: { ...result, studentId },
      });
    } catch (error) {
      console.error('Error executing student code:', error);
      this.sendError(ws, 'Failed to execute student code. Please try again.');
    }
  }

  private async handleRequestStudentCode(ws: WebSocket, connection: Connection, payload: any) {
    // Check if user has permission to view student data
    if (!this.hasPermission(connection, 'data.viewAll') || !connection.sessionId) return;

    const { studentId } = payload;
    const studentData = await sessionManagerHolder.instance.getStudentData(connection.sessionId, studentId);
    
    if (!studentData) {
      this.sendError(ws, 'Student not found');
      return;
    }

    console.log('[REQUEST_STUDENT_CODE] Sending student data:', {
      studentId,
      executionSettings: studentData.executionSettings,
    });

    this.send(ws, {
      type: MessageType.STUDENT_CODE,
      payload: { 
        studentId, 
        code: studentData.code,
        executionSettings: studentData.executionSettings,
      },
    });
  }

  private async handleGetRevisions(ws: WebSocket, connection: Connection, payload: any) {
    // Check if user has permission to view student data
    if (!this.hasPermission(connection, 'data.viewAll') || !connection.sessionId) return;

    const { studentId } = payload;
    
    try {
      const storage = await getStorage();
      const storedRevisions = await storage.revisions.getRevisions(connection.sessionId, studentId);
      
      // Reconstruct full code for each revision from diffs
      const dmp = new DiffMatchPatch.diff_match_patch();
      const revisions = [];
      
      for (const rev of storedRevisions) {
        let fullCode: string;
        
        if (rev.isDiff && rev.diff) {
          // Apply diff to reconstruct code
          // Find the previous full snapshot
          const prevSnapshot = storedRevisions
            .slice(0, storedRevisions.indexOf(rev))
            .reverse()
            .find(r => !r.isDiff && r.fullCode !== undefined);
          
          if (prevSnapshot && prevSnapshot.fullCode !== undefined) {
            // Start with previous snapshot
            let currentCode = prevSnapshot.fullCode;
            
            // Apply all diffs between snapshot and current revision
            const startIdx = storedRevisions.indexOf(prevSnapshot) + 1;
            const endIdx = storedRevisions.indexOf(rev) + 1;
            
            for (let i = startIdx; i < endIdx; i++) {
              const r = storedRevisions[i];
              if (r.isDiff && r.diff) {
                const patches = dmp.patch_fromText(r.diff);
                const [patchedCode] = dmp.patch_apply(patches, currentCode);
                currentCode = patchedCode;
              } else if (r.fullCode !== undefined) {
                currentCode = r.fullCode;
              }
            }
            fullCode = currentCode;
          } else {
            // No previous snapshot, skip or use empty
            fullCode = '';
          }
        } else if (rev.fullCode !== undefined) {
          fullCode = rev.fullCode;
        } else {
          fullCode = '';
        }
        
        revisions.push({
          id: rev.id,
          timestamp: rev.timestamp,
          code: fullCode,
        });
      }
      
      this.send(ws, {
        type: MessageType.REVISIONS_DATA,
        payload: {
          sessionId: connection.sessionId,
          studentId,
          revisions,
        },
      });
    } catch (error) {
      console.error('Error fetching revisions:', error);
      this.sendError(ws, 'Failed to fetch revisions');
    }
  }

  private async handleSelectSubmissionForPublic(connection: Connection, payload: any) {
    // Check if user has permission to manage sessions
    if (!this.hasPermission(connection, 'session.viewAll') || !connection.sessionId) {
      return;
    }

    const { studentId } = payload;
    const sessionId = connection.sessionId;
    
    if (studentId) {
      // Set featured submission
      const success = await sessionManagerHolder.instance.setFeaturedSubmission(sessionId, studentId);
      if (!success) {
        console.error('Failed to set featured submission');
        return;
      }
    } else {
      // Clear featured submission
      await sessionManagerHolder.instance.clearFeaturedSubmission(sessionId);
    }

    // Broadcast update to public views
    await this.broadcastPublicSubmissionUpdate(sessionId);
  }

  private async handleJoinPublicView(ws: WebSocket, connection: Connection, payload: any) {
    const { sessionId } = payload;
    
    const session = await sessionManagerHolder.instance.getSession(sessionId);
    if (!session) {
      this.sendError(ws, 'Session not found');
      return;
    }

    connection.role = 'public';
    connection.sessionId = sessionId;

    // Send current session state
    const featured = await sessionManagerHolder.instance.getFeaturedSubmission(sessionId);
    this.send(ws, {
      type: MessageType.PUBLIC_SUBMISSION_UPDATE,
      payload: {
        joinCode: session.joinCode,
        problem: session.problem,
        executionSettings: featured.executionSettings || session.executionSettings,
        code: featured.code || '',
        hasFeaturedSubmission: !!featured.studentId,
      },
    });
  }

  private async handlePublicCodeEdit(connection: Connection, payload: any) {
    if (connection.role !== 'public' || !connection.sessionId) return;

    const { code } = payload;
    await sessionManagerHolder.instance.updateFeaturedCode(connection.sessionId, code);

    // Broadcast to other public views (for sync if multiple displays)
    this.broadcastToSession(connection.sessionId, {
      type: MessageType.PUBLIC_SUBMISSION_UPDATE,
      payload: { code },
    }, 'public');
  }

  private async handlePublicExecuteCode(ws: WebSocket, connection: Connection, payload: any) {
    if (connection.role !== 'public' || !connection.sessionId) {
      this.sendError(ws, 'Unauthorized');
      return;
    }

    try {
      const { code, stdin } = payload;
      
      if (!code || typeof code !== 'string') {
        this.sendError(ws, 'Invalid code provided');
        return;
      }
      
      // Get session to access executionSettings
      const session = await sessionManagerHolder.instance.getSession(connection.sessionId);
      
      const result = await executeCodeSafe({ 
        code, 
        stdin,
        randomSeed: session?.executionSettings?.randomSeed,
        attachedFiles: session?.executionSettings?.attachedFiles,
      });

      this.send(ws, {
        type: MessageType.EXECUTION_RESULT,
        payload: result,
      });
    } catch (error) {
      console.error('Error executing public code:', error);
      this.sendError(ws, 'Code execution failed. Please try again.');
    }
  }

  private async broadcastPublicSubmissionUpdate(sessionId: string) {
    const session = await sessionManagerHolder.instance.getSession(sessionId);
    if (!session) return;

    const featured = await sessionManagerHolder.instance.getFeaturedSubmission(sessionId);
    
    this.broadcastToSession(sessionId, {
      type: MessageType.PUBLIC_SUBMISSION_UPDATE,
      payload: {
        joinCode: session.joinCode,
        problem: session.problem,
        executionSettings: featured.executionSettings || session.executionSettings,
        code: featured.code || '',
        hasFeaturedSubmission: !!featured.studentId,
      },
    }, 'public');
  }

  private async handleDisconnect(ws: WebSocket) {
    const connection = this.connections.get(ws);
    if (!connection) return;

    console.log('WebSocket disconnected');

    if (connection.sessionId && connection.studentId) {
      await sessionManagerHolder.instance.removeStudent(connection.sessionId, connection.studentId);
      await this.broadcastStudentList(connection.sessionId);
    }

    this.connections.delete(ws);
  }

  private broadcastToSession(
    sessionId: string,
    message: WebSocketMessage,
    role?: 'instructor' | 'student' | 'public'
  ) {
    for (const [ws, conn] of this.connections.entries()) {
      if (conn.sessionId === sessionId && (!role || conn.role === role)) {
        this.send(ws, message);
      }
    }
  }

  private async broadcastStudentList(sessionId: string) {
    const session = await sessionManagerHolder.instance.getSession(sessionId);
    if (!session) return;
    
    const students = await sessionManagerHolder.instance.getStudents(sessionId);
    const studentList = students.map((s: Student) => ({
      id: s.id,
      name: s.name,
      hasCode: s.code.length > 0,
      // Use student-specific settings if set, otherwise fall back to session/problem defaults
      randomSeed: s.executionSettings?.randomSeed ?? session.executionSettings?.randomSeed ?? session.problem?.executionSettings?.randomSeed,
      attachedFiles: s.executionSettings?.attachedFiles ?? session.executionSettings?.attachedFiles ?? session.problem?.executionSettings?.attachedFiles,
    }));

    console.log('[broadcastStudentList] Sending student list:', {
      sessionId,
      sessionDefaults: {
        randomSeed: session.executionSettings?.randomSeed,
        attachedFiles: session.executionSettings?.attachedFiles,
      },
      students: studentList.map(s => ({ id: s.id, randomSeed: s.randomSeed, attachedFiles: s.attachedFiles })),
    });

    this.broadcastToSession(sessionId, {
      type: MessageType.STUDENT_LIST_UPDATE,
      payload: { students: studentList },
    }, 'instructor');
  }

  private send(ws: WebSocket, message: WebSocketMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: WebSocket, error: string) {
    this.send(ws, {
      type: MessageType.ERROR,
      payload: { error },
    });
  }

  private heartbeat() {
    for (const [ws, connection] of this.connections.entries()) {
      if (!connection.isAlive) {
        console.log('Terminating dead connection');
        ws.terminate();
        this.connections.delete(ws);
        continue;
      }

      connection.isAlive = false;
      ws.ping();
    }
  }

  shutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }
}

export const wsHandler = new WebSocketHandler();
