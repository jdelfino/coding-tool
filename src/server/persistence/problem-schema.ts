/**
 * Problem storage schema definitions
 * 
 * Defines the structure for persisting problems to storage (JSON files, database, etc.)
 * and provides serialization/deserialization utilities.
 */

import { Problem, ProblemValidationError } from '../types/problem';

/**
 * JSON schema structure for problem storage
 * 
 * This matches the Problem interface but documents the expected
 * storage format and provides validation rules.
 * 
 * Example:
 * ```json
 * {
 *   "id": "uuid-v4",
 *   "title": "Factorial Function",
 *   "description": "# Problem\n\nWrite a function that computes factorial...",
 *   "starterCode": "def factorial(n):\n    pass",
 *   "testCases": [
 *     {"type": "io", "input": "5", "expected": "120", ...}
 *   ],
 *   "authorId": "instructor-123",
 *   "classId": null,
 *   "createdAt": "2025-12-21T12:00:00Z",
 *   "updatedAt": "2025-12-21T12:00:00Z"
 * }
 * ```
 */
export interface ProblemSchema {
  /** Unique identifier (UUID v4) */
  id: string;
  
  /** Problem title (3-200 characters) */
  title: string;
  
  /** Problem description in markdown (optional, 0-50000 characters) */
  description?: string;
  
  /** Optional starter code template */
  starterCode?: string;
  
  /** Array of test cases (optional) */
  testCases?: unknown[];
  
  /** Author user ID */
  authorId: string;
  
  /** Optional class ID */
  classId?: string;
  
  /** ISO 8601 timestamp */
  createdAt: string;
  
  /** ISO 8601 timestamp */
  updatedAt: string;
}

/**
 * Validation rules for problem fields
 */
export const PROBLEM_VALIDATION_RULES = {
  title: {
    minLength: 3,
    maxLength: 200,
    required: true,
  },
  description: {
    minLength: 0,
    maxLength: 50000,
    required: false,
  },
  starterCode: {
    maxLength: 50000,
    required: false,
  },
  testCases: {
    minCount: 0,
    required: false,
  },
} as const;

/**
 * Validate problem data structure
 * 
 * Checks all required fields and constraints before persisting.
 * 
 * @param problem - Problem to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateProblemSchema(problem: Partial<Problem>): ProblemValidationError[] {
  const errors: ProblemValidationError[] = [];
  
  // Validate title
  if (!problem.title || problem.title.trim().length === 0) {
    errors.push({
      field: 'title',
      message: 'Title is required',
      code: 'REQUIRED_FIELD',
    });
  } else if (problem.title.length < PROBLEM_VALIDATION_RULES.title.minLength) {
    errors.push({
      field: 'title',
      message: `Title must be at least ${PROBLEM_VALIDATION_RULES.title.minLength} characters`,
      code: 'MIN_LENGTH',
    });
  } else if (problem.title.length > PROBLEM_VALIDATION_RULES.title.maxLength) {
    errors.push({
      field: 'title',
      message: `Title must be at most ${PROBLEM_VALIDATION_RULES.title.maxLength} characters`,
      code: 'MAX_LENGTH',
    });
  }
  
  // Validate description (optional now)
  if (problem.description && problem.description.length > PROBLEM_VALIDATION_RULES.description.maxLength) {
    errors.push({
      field: 'description',
      message: `Description must be at most ${PROBLEM_VALIDATION_RULES.description.maxLength} characters`,
      code: 'MAX_LENGTH',
    });
  }
  
  // Validate starter code (if provided)
  if (problem.starterCode && problem.starterCode.length > PROBLEM_VALIDATION_RULES.starterCode.maxLength) {
    errors.push({
      field: 'starterCode',
      message: `Starter code must be at most ${PROBLEM_VALIDATION_RULES.starterCode.maxLength} characters`,
      code: 'MAX_LENGTH',
    });
  }
  
  // Validate test cases (optional now)
  // No validation required as test cases are now optional
  
  // Validate author ID
  if (!problem.authorId || problem.authorId.trim().length === 0) {
    errors.push({
      field: 'authorId',
      message: 'Author ID is required',
      code: 'REQUIRED_FIELD',
    });
  }
  
  return errors;
}

/**
 * Check if problem is valid
 * 
 * @param problem - Problem to check
 * @returns true if valid, false otherwise
 */
export function isValidProblem(problem: Partial<Problem>): boolean {
  return validateProblemSchema(problem).length === 0;
}

/**
 * Serialize problem for storage
 * 
 * Converts Problem object to JSON-serializable format.
 * Handles Date serialization to ISO strings.
 * 
 * @param problem - Problem to serialize
 * @returns Serialized problem schema
 */
export function serializeProblem(problem: Problem): ProblemSchema {
  return {
    id: problem.id,
    title: problem.title,
    description: problem.description,
    starterCode: problem.starterCode,
    testCases: problem.testCases,
    authorId: problem.authorId,
    classId: problem.classId,
    createdAt: problem.createdAt.toISOString(),
    updatedAt: problem.updatedAt.toISOString(),
  };
}

/**
 * Deserialize problem from storage
 * 
 * Converts stored JSON format back to Problem object.
 * Handles Date parsing from ISO strings.
 * 
 * @param schema - Serialized problem schema
 * @returns Problem object
 */
export function deserializeProblem(schema: ProblemSchema): Problem {
  return {
    id: schema.id,
    title: schema.title,
    description: schema.description,
    starterCode: schema.starterCode,
    testCases: schema.testCases as any[], // Type-checked by validation
    authorId: schema.authorId,
    classId: schema.classId,
    createdAt: new Date(schema.createdAt),
    updatedAt: new Date(schema.updatedAt),
  };
}
