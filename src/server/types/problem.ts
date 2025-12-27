/**
 * Problem data models for programming exercises
 * 
 * Defines the structure for reusable programming problems that can be
 * created by instructors and loaded into coding sessions.
 */

import { TestCase } from '../testing/types';

/**
 * Execution settings for running code
 * Can be defined in a Problem (defaults), Session (session overrides), or Student (student overrides)
 */
export interface ExecutionSettings {
  stdin?: string; // Standard input for the program
  randomSeed?: number; // Seed for reproducible random number generation
  attachedFiles?: Array<{ name: string; content: string }>; // Files available to the program
}

/**
 * A programming problem/exercise
 * 
 * Problems can be created offline, stored persistently, and loaded
 * into active coding sessions. Each problem includes a description,
 * optional starter code, test cases, and a reference solution.
 */
export interface Problem {
  /** Unique identifier */
  id: string;
  
  /** Problem title */
  title: string;
  
  /** Problem description (supports markdown, optional) */
  description?: string;
  
  /** Optional starter code template for students */
  starterCode?: string;
  
  /** Reference solution (hidden from students, optional) */
  solutionCode?: string;
  
  /** Test cases for verifying solutions (optional) */
  testCases?: TestCase[];
  
  /** Default execution settings (can be overridden by session or students) */
  executionSettings?: ExecutionSettings;
  
  /** User ID of instructor who created this problem */
  authorId: string;
  
  /** Optional: scope problem to specific class */
  classId?: string;
  
  /** When this problem was created */
  createdAt: Date;
  
  /** When this problem was last modified */
  updatedAt: Date;
}

/**
 * Lightweight problem metadata for list views
 * 
 * Used when displaying problem lists without loading
 * full descriptions and test cases.
 */
export interface ProblemMetadata {
  /** Problem ID */
  id: string;
  
  /** Problem title */
  title: string;
  
  /** Number of test cases */
  testCaseCount: number;
  
  /** When created */
  createdAt: Date;
  
  /** Author's display name or username */
  authorName: string;
  
  /** Class ID if scoped to a class */
  classId?: string;
}

/**
 * Filter options for querying problems
 */
export interface ProblemFilter {
  /** Filter by author */
  authorId?: string;
  
  /** Search query (matches title and description) */
  searchQuery?: string;
  
  /** Filter by class */
  classId?: string;
  
  /** Sort field */
  sortBy?: 'title' | 'created' | 'updated';
  
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
  
  /** Include public problems from other authors */
  includePublic?: boolean;
}

/**
 * Validation error for problem data
 */
export interface ProblemValidationError {
  /** Field that failed validation */
  field: string;
  
  /** Error message */
  message: string;
  
  /** Error code for programmatic handling */
  code: string;
}

/**
 * Problem sanitized for student view
 * 
 * Removes solution code and other instructor-only information.
 */
export interface StudentProblem {
  /** Problem ID */
  id: string;
  
  /** Problem title */
  title: string;
  
  /** Problem description */
  description: string;
  
  /** Starter code (if any) */
  starterCode?: string;
  
  /** Test cases visible to students */
  testCases: TestCase[];
}

/**
 * Helper type for creating problems (omits generated fields)
 */
export type ProblemInput = Omit<Problem, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Problem statistics
 */
export interface ProblemStats {
  /** Number of test cases */
  testCaseCount: number;
  
  /** Length of solution code */
  solutionLength: number;
  
  /** Whether problem has starter code */
  hasStarterCode: boolean;
}
