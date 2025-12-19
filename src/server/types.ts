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
  publicViewWs?: WebSocket;
  featuredStudentId?: string;
  featuredCode?: string;
  createdAt: Date;
  lastActivity: Date;
  // Session history fields
  creatorId: string; // User ID of the instructor who created the session
  participants: string[]; // Array of user IDs who participated
  status: 'active' | 'completed';
  endedAt?: Date;
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
  LIST_SESSIONS = 'LIST_SESSIONS',
  JOIN_EXISTING_SESSION = 'JOIN_EXISTING_SESSION',
  END_SESSION = 'END_SESSION',
  UPDATE_PROBLEM = 'UPDATE_PROBLEM',
  REQUEST_STUDENT_CODE = 'REQUEST_STUDENT_CODE',
  EXECUTE_STUDENT_CODE = 'EXECUTE_STUDENT_CODE',
  SELECT_SUBMISSION_FOR_PUBLIC = 'SELECT_SUBMISSION_FOR_PUBLIC',
  
  // Public view messages
  JOIN_PUBLIC_VIEW = 'JOIN_PUBLIC_VIEW',
  PUBLIC_CODE_EDIT = 'PUBLIC_CODE_EDIT',
  PUBLIC_EXECUTE_CODE = 'PUBLIC_EXECUTE_CODE',
  
  // Server messages
  SESSION_CREATED = 'SESSION_CREATED',
  SESSION_JOINED = 'SESSION_JOINED',
  SESSION_LIST = 'SESSION_LIST',
  SESSION_ENDED = 'SESSION_ENDED',
  EXECUTION_RESULT = 'EXECUTION_RESULT',
  PROBLEM_UPDATE = 'PROBLEM_UPDATE',
  STUDENT_LIST_UPDATE = 'STUDENT_LIST_UPDATE',
  STUDENT_CODE = 'STUDENT_CODE',
  PUBLIC_SUBMISSION_UPDATE = 'PUBLIC_SUBMISSION_UPDATE',
  ERROR = 'ERROR',
}

export interface WebSocketMessage {
  type: MessageType;
  payload: any;
}
