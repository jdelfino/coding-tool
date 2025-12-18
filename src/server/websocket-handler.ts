import { WebSocket, WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { sessionManager } from './session-manager';
import { executeCodeSafe } from './code-executor';
import { MessageType, WebSocketMessage, Student } from './types';

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
        this.handleCreateSession(ws, connection);
        break;
        
      case MessageType.JOIN_SESSION:
        this.handleJoinSession(ws, connection, message.payload);
        break;
        
      case MessageType.UPDATE_PROBLEM:
        this.handleUpdateProblem(connection, message.payload);
        break;
        
      case MessageType.CODE_UPDATE:
        this.handleCodeUpdate(connection, message.payload);
        break;
        
      case MessageType.EXECUTE_CODE:
        await this.handleExecuteCode(ws, connection, message.payload);
        break;
        
      case MessageType.EXECUTE_STUDENT_CODE:
        await this.handleExecuteStudentCode(ws, connection, message.payload);
        break;
        
      case MessageType.REQUEST_STUDENT_CODE:
        this.handleRequestStudentCode(ws, connection, message.payload);
        break;
        
      case MessageType.SELECT_SUBMISSION_FOR_PUBLIC:
        this.handleSelectSubmissionForPublic(connection, message.payload);
        break;
        
      case MessageType.JOIN_PUBLIC_VIEW:
        this.handleJoinPublicView(ws, connection, message.payload);
        break;
        
      case MessageType.PUBLIC_CODE_EDIT:
        this.handlePublicCodeEdit(connection, message.payload);
        break;
        
      case MessageType.PUBLIC_EXECUTE_CODE:
        await this.handlePublicExecuteCode(ws, connection, message.payload);
        break;
        
      default:
        this.sendError(ws, 'Unknown message type');
    }
  }

  private handleCreateSession(ws: WebSocket, connection: Connection) {
    const session = sessionManager.createSession();
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

  private handleJoinSession(ws: WebSocket, connection: Connection, payload: any) {
    const { joinCode, studentName } = payload;
    
    const session = sessionManager.getSessionByJoinCode(joinCode);
    if (!session) {
      this.sendError(ws, 'Session not found');
      return;
    }

    const studentId = uuidv4();
    connection.role = 'student';
    connection.sessionId = session.id;
    connection.studentId = studentId;

    sessionManager.addStudent(session.id, studentId, studentName);

    this.send(ws, {
      type: MessageType.SESSION_JOINED,
      payload: {
        sessionId: session.id,
        studentId,
        problemText: session.problemText,
      },
    });

    // Notify instructor of new student
    this.broadcastStudentList(session.id);
  }

  private handleUpdateProblem(connection: Connection, payload: any) {
    if (connection.role !== 'instructor' || !connection.sessionId) {
      return;
    }

    const { problemText } = payload;
    sessionManager.updateProblem(connection.sessionId, problemText);

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

  private handleCodeUpdate(connection: Connection, payload: any) {
    if (connection.role !== 'student' || !connection.sessionId || !connection.studentId) {
      return;
    }

    const { code } = payload;
    sessionManager.updateStudentCode(connection.sessionId, connection.studentId, code);

    // Notify instructor
    this.broadcastStudentList(connection.sessionId);
  }

  private async handleExecuteCode(ws: WebSocket, connection: Connection, payload: any) {
    if (connection.role !== 'student') return;

    const { code } = payload;
    const result = await executeCodeSafe(code);

    this.send(ws, {
      type: MessageType.EXECUTION_RESULT,
      payload: result,
    });
  }

  private async handleExecuteStudentCode(ws: WebSocket, connection: Connection, payload: any) {
    if (connection.role !== 'instructor' || !connection.sessionId) return;

    const { studentId } = payload;
    const code = sessionManager.getStudentCode(connection.sessionId, studentId);
    
    if (!code) {
      this.sendError(ws, 'Student code not found');
      return;
    }

    const result = await executeCodeSafe(code);

    this.send(ws, {
      type: MessageType.EXECUTION_RESULT,
      payload: { ...result, studentId },
    });
  }

  private handleRequestStudentCode(ws: WebSocket, connection: Connection, payload: any) {
    if (connection.role !== 'instructor' || !connection.sessionId) return;

    const { studentId } = payload;
    const code = sessionManager.getStudentCode(connection.sessionId, studentId);
    
    if (code === undefined) {
      this.sendError(ws, 'Student not found');
      return;
    }

    this.send(ws, {
      type: MessageType.STUDENT_CODE,
      payload: { studentId, code },
    });
  }

  private handleSelectSubmissionForPublic(connection: Connection, payload: any) {
    if (connection.role !== 'instructor' || !connection.sessionId) return;

    const { studentId } = payload;
    
    if (studentId) {
      // Set featured submission
      const success = sessionManager.setFeaturedSubmission(connection.sessionId, studentId);
      if (!success) {
        console.error('Failed to set featured submission');
        return;
      }
    } else {
      // Clear featured submission
      sessionManager.clearFeaturedSubmission(connection.sessionId);
    }

    // Broadcast update to public views
    this.broadcastPublicSubmissionUpdate(connection.sessionId);
  }

  private handleJoinPublicView(ws: WebSocket, connection: Connection, payload: any) {
    const { sessionId } = payload;
    
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      this.sendError(ws, 'Session not found');
      return;
    }

    connection.role = 'public';
    connection.sessionId = sessionId;

    // Send current session state
    const featured = sessionManager.getFeaturedSubmission(sessionId);
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

  private handlePublicCodeEdit(connection: Connection, payload: any) {
    if (connection.role !== 'public' || !connection.sessionId) return;

    const { code } = payload;
    sessionManager.updateFeaturedCode(connection.sessionId, code);

    // Broadcast to other public views (for sync if multiple displays)
    this.broadcastToSession(connection.sessionId, {
      type: MessageType.PUBLIC_SUBMISSION_UPDATE,
      payload: { code },
    }, 'public');
  }

  private async handlePublicExecuteCode(ws: WebSocket, connection: Connection, payload: any) {
    if (connection.role !== 'public' || !connection.sessionId) return;

    const { code } = payload;
    const result = await executeCodeSafe(code);

    this.send(ws, {
      type: MessageType.EXECUTION_RESULT,
      payload: result,
    });
  }

  private broadcastPublicSubmissionUpdate(sessionId: string) {
    const session = sessionManager.getSession(sessionId);
    if (!session) return;

    const featured = sessionManager.getFeaturedSubmission(sessionId);
    
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

  private handleDisconnect(ws: WebSocket) {
    const connection = this.connections.get(ws);
    if (!connection) return;

    console.log('WebSocket disconnected');

    if (connection.sessionId && connection.studentId) {
      sessionManager.removeStudent(connection.sessionId, connection.studentId);
      this.broadcastStudentList(connection.sessionId);
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

  private broadcastStudentList(sessionId: string) {
    const students = sessionManager.getStudents(sessionId);
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
