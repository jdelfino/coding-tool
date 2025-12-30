#!/usr/bin/env tsx
/**
 * Seed the application with preset test data via the API
 * 
 * Creates:
 * - 1 admin user named "admin"
 * - 1 teacher named "teach"
 * - 1 class with 1 section
 * - 4 students named "stu1" through "stu4"
 * - 1 defined problem
 * - Students enrolled in the section
 * 
 * Usage:
 *   npm run seed-data
 *   # or
 *   tsx scripts/seed-data.ts
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const DATA_DIR = path.join(process.cwd(), 'data');

interface User {
  id: string;
  username: string;
  role: string;
}

interface Class {
  id: string;
  name: string;
  description: string;
}

interface Section {
  id: string;
  name: string;
  classId: string;
  joinCode: string;
}

interface Problem {
  id: string;
  title: string;
  description: string;
}

/**
 * Create an admin user directly in the data file
 * This bypasses the auth provider to ensure we start with a known admin
 */
async function createAdminUser(): Promise<{ id: string; username: string }> {
  const usersFile = path.join(DATA_DIR, 'users.json');
  
  // Read existing users
  let users: any = {};
  try {
    const content = await fs.readFile(usersFile, 'utf-8');
    users = JSON.parse(content);
  } catch (error) {
    // File doesn't exist or is empty, start fresh
    users = {};
  }
  
  // Create admin user
  const adminId = randomUUID();
  const now = new Date().toISOString();
  users[adminId] = {
    id: adminId,
    username: 'admin',
    role: 'admin',
    createdAt: now,
    lastLoginAt: now,
  };
  
  // Write back
  await fs.writeFile(usersFile, JSON.stringify(users, null, 2), 'utf-8');
  
  return { id: adminId, username: 'admin' };
}

/**
 * Sign in and get session cookie
 */
async function signIn(username: string): Promise<{ sessionId: string; user: User }> {
  const response = await fetch(`${API_BASE}/api/auth/signin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to sign in as ${username}: ${error.error || response.statusText}`);
  }

  const data = await response.json();
  
  // Extract session cookie
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error('No session cookie received');
  }

  const match = setCookie.match(/sessionId=([^;]+)/);
  if (!match) {
    throw new Error('Could not parse session cookie');
  }

  return {
    sessionId: match[1],
    user: data.user,
  };
}

/**
 * Create an instructor via admin endpoint
 */
async function createInstructor(sessionId: string, username: string): Promise<User> {
  const response = await fetch(`${API_BASE}/api/admin/instructors`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `sessionId=${sessionId}`,
    },
    body: JSON.stringify({ username }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create instructor: ${error.error || response.statusText}`);
  }

  const data = await response.json();
  return data.user;
}

/**
 * Change a user's role via admin endpoint
 */
async function changeUserRole(sessionId: string, userId: string, role: string): Promise<User> {
  const response = await fetch(`${API_BASE}/api/admin/users/${userId}/role`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `sessionId=${sessionId}`,
    },
    body: JSON.stringify({ role }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to change user role: ${error.error || response.statusText}`);
  }

  const data = await response.json();
  return data.user;
}

/**
 * Create a class
 */
async function createClass(sessionId: string, name: string, description: string): Promise<Class> {
  const response = await fetch(`${API_BASE}/api/classes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `sessionId=${sessionId}`,
    },
    body: JSON.stringify({ name, description }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create class: ${error.error || response.statusText}`);
  }

  const data = await response.json();
  return data.class;
}

/**
 * Create a section
 */
async function createSection(
  sessionId: string,
  classId: string,
  name: string,
  semester: string
): Promise<Section> {
  const response = await fetch(`${API_BASE}/api/classes/${classId}/sections`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `sessionId=${sessionId}`,
    },
    body: JSON.stringify({ name, semester }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create section: ${error.error || response.statusText}`);
  }

  const data = await response.json();
  return data.section;
}

/**
 * Join a section using join code
 */
async function joinSection(sessionId: string, joinCode: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/sections/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `sessionId=${sessionId}`,
    },
    body: JSON.stringify({ joinCode }),
  });

  if (!response.ok) {
    const error = await response.json();
    // Ignore "already a member" errors
    if (!error.error?.includes('already a member')) {
      throw new Error(`Failed to join section: ${error.error || response.statusText}`);
    }
  }
}

/**
 * Create a problem
 */
async function createProblem(
  sessionId: string,
  title: string,
  description: string,
  starterCode: string
): Promise<Problem> {
  const response = await fetch(`${API_BASE}/api/problems`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `sessionId=${sessionId}`,
    },
    body: JSON.stringify({
      title,
      description,
      starterCode,
      testCases: [],
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create problem: ${error.error || response.statusText}`);
  }

  const data = await response.json();
  return data.problem;
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('🌱 Seeding application with test data...\n');
    console.log('⚠️  Note: This script works best after clearing all data (npm run clear-data)\n');

    // 1. Create admin user directly in the data file
    console.log('👑 Creating admin user...');
    const adminUserData = await createAdminUser();
    console.log(`✅ Admin user created in data file: ${adminUserData.username} (${adminUserData.id})\n`);
    
    // Sign in as admin to get a session
    console.log('🔐 Signing in as admin...');
    const admin = await signIn('admin');
    console.log(`✅ Admin signed in: ${admin.user.username} (${admin.user.role})\n`);

    // 2. Create teacher
    console.log('👨‍🏫 Creating teacher "teach"...');
    const teacher = await createInstructor(admin.sessionId, 'teach');
    console.log(`✅ Teacher created: ${teacher.username} (${teacher.id})\n`);

    // Sign in as the teacher
    console.log('🔐 Signing in as teacher...');
    const teacherSession = await signIn('teach');
    console.log(`✅ Teacher signed in\n`);

    // 4. Create class
    console.log('📚 Creating class...');
    const classData = await createClass(
      teacherSession.sessionId,
      'Introduction to Programming',
      'Learn the basics of programming with Python'
    );
    console.log(`✅ Class created: ${classData.name} (${classData.id})\n`);

    // 5. Create section
    console.log('📖 Creating section...');
    const section = await createSection(
      teacherSession.sessionId,
      classData.id,
      'Section A',
      'Fall 2025'
    );
    console.log(`✅ Section created: ${section.name}`);
    console.log(`   Join code: ${section.joinCode}\n`);

    // 6. Create students
    console.log('👨‍🎓 Creating students...');
    const students: Array<{ sessionId: string; user: User }> = [];
    
    for (let i = 1; i <= 4; i++) {
      const username = `stu${i}`;
      const student = await signIn(username);
      students.push(student);
      console.log(`   ✅ ${student.user.username} (${student.user.id})`);
    }
    console.log('');

    // 5. Enroll students in section
    console.log('📝 Enrolling students in section...');
    for (const student of students) {
      await joinSection(student.sessionId, section.joinCode);
      console.log(`   ✅ ${student.user.username} enrolled`);
    }
    console.log('');

    // 6. Create problem
    console.log('🧩 Creating problem...');
    const problem = await createProblem(
      teacherSession.sessionId,
      'Hello World',
      'Write a function that returns "Hello, World!"',
      'def hello():\n    # Your code here\n    pass'
    );
    console.log(`✅ Problem created: ${problem.title} (${problem.id})\n`);

    // Summary
    console.log('✨ Seed complete!');
    console.log('\n📊 Summary:');
    console.log(`   Admin: admin (${adminUserData.id})`);
    console.log(`   Teacher: teach (${teacher.id})`);
    console.log(`   Class: ${classData.name} (${classData.id})`);
    console.log(`   Section: ${section.name} (${section.id})`);
    console.log(`   Join Code: ${section.joinCode}`);
    console.log(`   Students: ${students.map(s => s.user.username).join(', ')}`);
    console.log(`   Problem: ${problem.title} (${problem.id})`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { signIn, createInstructor, createClass, createSection, joinSection, createProblem };
