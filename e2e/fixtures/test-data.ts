import { v4 as uuidv4 } from 'uuid';
import { writeDataFile, readDataFile } from '../helpers/db-helpers';

/**
 * Test data generators for creating test entities
 */

export interface TestClass {
  id: string;
  name: string;
  description?: string;
  instructorId: string;
}

export interface TestSection {
  id: string;
  classId: string;
  name: string;
  semester?: string;
  joinCode: string;
  instructorIds: string[];
}

export interface TestSession {
  id: string;
  sectionId: string;
  problemId?: string;
  createdAt: string;
  active: boolean;
}

/**
 * Creates a test class
 */
export async function createTestClass(
  instructorId: string,
  name: string = 'Test Class',
  description?: string
): Promise<TestClass> {
  const classId = uuidv4();
  const classes = await readDataFile('classes.json');
  
  const newClass: TestClass = {
    id: classId,
    name,
    description,
    instructorId
  };
  
  classes[classId] = newClass;
  await writeDataFile('classes.json', classes);
  
  return newClass;
}

/**
 * Creates a test section
 */
export async function createTestSection(
  classId: string,
  instructorId: string,
  name: string = 'Test Section',
  semester?: string
): Promise<TestSection> {
  const sectionId = uuidv4();
  const joinCode = generateJoinCode();
  const sections = await readDataFile('sections.json');
  
  const newSection: TestSection = {
    id: sectionId,
    classId,
    name,
    semester,
    joinCode,
    instructorIds: [instructorId]
  };
  
  sections[sectionId] = newSection;
  await writeDataFile('sections.json', sections);
  
  return newSection;
}

/**
 * Creates a test session
 */
export async function createTestSession(
  sectionId: string,
  problemId?: string
): Promise<TestSession> {
  const sessionId = uuidv4();
  const sessions = await readDataFile('sessions.json');
  
  const newSession: TestSession = {
    id: sessionId,
    sectionId,
    problemId,
    createdAt: new Date().toISOString(),
    active: true
  };
  
  sessions[sessionId] = newSession;
  await writeDataFile('sessions.json', sessions);
  
  return newSession;
}

/**
 * Generates a random 6-character join code
 */
function generateJoinCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Creates a complete test setup: instructor, class, section
 */
export async function createTestClassHierarchy(instructorId: string): Promise<{
  class: TestClass;
  section: TestSection;
}> {
  const testClass = await createTestClass(instructorId, 'CS 101', 'Introduction to Computer Science');
  const section = await createTestSection(testClass.id, instructorId, 'Section A', 'Fall 2025');
  
  return {
    class: testClass,
    section
  };
}
