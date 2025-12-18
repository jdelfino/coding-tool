import { WebSocket, WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { sessionManagerHolder } from './session-manager';
import { executeCodeSafe } from './code-executor';
import { MessageType, WebSocketMessage, Student } from './types';

// Use the sessionManager instance from the holder
const sessionManager = sessionManagerHolder.instance;

interface Connection {
  ws: WebSocket;
  role: 'instructor' | 'student' | 'public';
  sessionId?: string;
  studentId?: string;
  isAlive: boolean;
}

class WebSocketHandler {
  private connections: Map<WebSocket, Connection> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  initialize(wss: WebSocketServer) {
    // Set up heartbeat to detect dead connections
    this.heartbeatInterval = setInterval(() => {
      this.heartbeat();
    }, 30000); // 30 seconds

    wss.on('connection', (ws: WebSocket) => {
      console.log('New WebSocket connection');
      
      const connection: Connection = {
        ws,
        role: 'student', // Will be set when they identify themselves
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
        await this.handleCreateSession(ws, connection);
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
        
      case MessageType.EXECUTE_CODE:
        await this.handleExecuteCode(ws, connection, message.payload);
        break;
        
      case MessageType.EXECUTE_STUDENT_CODE:
        await this.handleExecuteStudentCode(ws, connection, message.payload);
        break;
        
      case MessageType.REQUEST_STUDENT_CODE:
        await this.handleRequestStudentCode(ws, connection, message.payload);
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

  private async handleCreateSession(ws: WebSocket, connection: Connection) {
    const session = await sessionManager.createSession();
    connection.role = 'instructor';
    connection.sessionId = session.id;
    
    this.send(ws, {
      type: MessageType.SESSION_CREATED,
      payload: {
        sessionId: session.id,
        joinCode: session.joinCode,
      },
    });
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
    
    const session = await sessionManager.getSessionByJoinCode(joinCode);
    if (!session) {
      this.sendError(ws, 'Session not found. Please check the join code.');
      return;
    }

    const studentId = uuidv4();
    connection.role = 'student';
    connection.sessionId = session.id;
    connection.studentId = studentId;

    const success = await sessionManager.addStudent(session.id, studentId, studentName.trim());
    if (!success) {
      this.sendError(ws, 'Failed to join session. Please try again.');
      return;
    }

    this.send(ws, {
      type: MessageType.SESSION_JOINED,
      payload: {
        sessionId: session.id,
        studentId,
        problemText: session.problemText,
      },
    });

    // Notify instructor of new student
    await this.broadcastStudentList(session.id);
  }

  private async handleUpdateProblem(connection: Connection, payload: any) {
    if (connection.role !== 'instructor' || !connection.sessionId) {
      return;
    }

    const { problemText } = payload;
    
    if (typeof problemText !== 'string') {
      console.error('Invalid problem text type');
      return;
    }
    
    if (problemText.length > 10000) {
      console.error('Problem text too long');
      return;
    }

    await sessionManager.updateProblem(connection.sessionId, problemText);

    // Broadcast to all students
    this.broadcastToSession(connection.sessionId, {
      type: MessageType.PROBLEM_UPDATE,
      payload: { problemText },
    }, 'student');
    
    // Also broadcast to public views
    this.broadcastToSession(connection.sessionId, {
      type: MessageType.PROBLEM_UPDATE,
      payload: { problemText },
    }, 'public');
  }

  private async handleCodeUpdate(connection: Connection, payload: any) {
    if (connection.role !== 'student' || !connection.sessionId || !connection.studentId) {
      return;
    }

    const { code } = payload;
    await sessionManager.updateStudentCode(connection.sessionId, connection.studentId, code);

    // Notify instructor
    await this.broadcastStudentList(connection.sessionId);
  }

  private async handleExecuteCode(ws: WebSocket, connection: Connection, payload: any) {
    if (connection.role !== 'student') {
      this.sendError(ws, 'Only students can execute code');
      return;
    }

    try {
      const { code } = payload;
      
      if (!code || typeof code !== 'string') {
        this.sendError(ws, 'Invalid code provided');
        return;
      }
      
      const result = await executeCodeSafe(code);

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
    if (connection.role !== 'instructor' || !connection.sessionId) {
      this.sendError(ws, 'Only instructors can execute student code');
      return;
    }

    try {
      const { studentId } = payload;
      
      if (!studentId || typeof studentId !== 'string') {
        this.sendError(ws, 'Invalid student ID');
        return;
      }
      
      const code = await sessionManager.getStudentCode(connection.sessionId, studentId);
      
      if (!code) {
        this.sendError(ws, 'Student code not found or empty');
        return;
      }

      const result = await executeCodeSafe(code);

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
    if (connection.role !== 'instructor' || !connection.sessionId) return;

    const { studentId } = payload;
    const code = await sessionManager.getStudentCode(connection.sessionId, studentId);
    
    if (code === undefined) {
      this.sendError(ws, 'Student not found');
      return;
    }

    this.send(ws, {
      type: MessageType.STUDENT_CODE,
      payload: { studentId, code },
    });
  }

  private async handleSelectSubmissionForPublic(connection: Connection, payload: any) {
    if (connection.role !== 'instructor' || !connection.sessionId) return;

    const { studentId } = payload;
    
    if (studentId) {
      // Set featured submission
      const success = await sessionManager.setFeaturedSubmission(connection.sessionId, studentId);
      if (!success) {
        console.error('Failed to set featured submission');
        return;
      }
    } else {
      // Clear featured submission
      await sessionManager.clearFeaturedSubmission(connection.sessionId);
    }

    // Broadcast update to public views
    await this.broadcastPublicSubmissionUpdate(connection.sessionId);
  }

  private async handleJoinPublicView(ws: WebSocket, connection: Connection, payload: any) {
    const { sessionId } = payload;
    
    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      this.sendError(ws, 'Session not found');
      return;
    }

    connection.role = 'public';
    connection.sessionId = sessionId;

    // Send current session state
    const featured = await sessionManager.getFeaturedSubmission(sessionId);
    this.send(ws, {
      type: MessageType.PUBLIC_SUBMISSION_UPDATE,
      payload: {
        joinCode: session.joinCode,
        problemText: session.problemText,
        code: featured.code || '',
        hasFeaturedSubmission: !!featured.studentId,
      },
    });
  }

  private async handlePublicCodeEdit(connection: Connection, payload: any) {
    if (connection.role !== 'public' || !connection.sessionId) return;

    const { code } = payload;
    await sessionManager.updateFeaturedCode(connection.sessionId, code);

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
      const { code } = payload;
      
      if (!code || typeof code !== 'string') {
        this.sendError(ws, 'Invalid code provided');
        return;
      }
      
      const result = await executeCodeSafe(code);

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
    const session = await sessionManager.getSession(sessionId);
    if (!session) return;

    const featured = await sessionManager.getFeaturedSubmission(sessionId);
    
    this.broadcastToSession(sessionId, {
      type: MessageType.PUBLIC_SUBMISSION_UPDATE,
      payload: {
        joinCode: session.joinCode,
        problemText: session.problemText,
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
      await sessionManager.removeStudent(connection.sessionId, connection.studentId);
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
    const students = await sessionManager.getStudents(sessionId);
    const studentList = students.map((s: Student) => ({
      id: s.id,
      name: s.name,
      hasCode: s.code.length > 0,
    }));

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
