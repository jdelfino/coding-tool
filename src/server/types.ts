import { WebSocket } from 'ws';

export interface Student {
  id: string;
  name: string;
  code: string;
  ws?: WebSocket;
  lastUpdate: Date;
}

export interface Session {
  id: string;
  joinCode: string;
  problemText: string;
  connectedStudents: Map<string, Student>;
  instructorWs?: WebSocket;
  createdAt: Date;
  lastActivity: Date;
}

export interface ExecutionResult {
  success: boolean;
  output: string;
  error: string;
  executionTime: number;
}

export enum MessageType {
  // Student messages
  JOIN_SESSION = 'JOIN_SESSION',
  CODE_UPDATE = 'CODE_UPDATE',
  EXECUTE_CODE = 'EXECUTE_CODE',
  
  // Instructor messages
  CREATE_SESSION = 'CREATE_SESSION',
  UPDATE_PROBLEM = 'UPDATE_PROBLEM',
  REQUEST_STUDENT_CODE = 'REQUEST_STUDENT_CODE',
  EXECUTE_STUDENT_CODE = 'EXECUTE_STUDENT_CODE',
  
  // Server messages
  SESSION_CREATED = 'SESSION_CREATED',
  SESSION_JOINED = 'SESSION_JOINED',
  EXECUTION_RESULT = 'EXECUTION_RESULT',
  PROBLEM_UPDATE = 'PROBLEM_UPDATE',
  STUDENT_LIST_UPDATE = 'STUDENT_LIST_UPDATE',
  STUDENT_CODE = 'STUDENT_CODE',
  ERROR = 'ERROR',
}

export interface WebSocketMessage {
  type: MessageType;
  payload: any;
}
