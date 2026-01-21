/**
 * API routes for student self-registration via section join codes
 *
 * Flow:
 * 1. Student gets join code from instructor
 * 2. GET /api/auth/register-student?code=X validates code and returns section info
 * 3. Student fills out registration form
 * 4. POST /api/auth/register-student creates account and enrolls in section
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getStudentRegistrationService,
  StudentRegistrationError,
} from '@/server/invitations';
import { getStorage } from '@/server/persistence';
import { rateLimit } from '@/server/rate-limit';

/**
 * GET /api/auth/register-student?code=X
 *
 * Validates a section join code and returns section/class info.
 * This is called before showing the registration form.
 *
 * Query params:
 * - code: Section join code (required)
 *
 * Response:
 * - 200: { section, class, namespace, capacityAvailable }
 * - 400: Invalid or missing code, or section inactive
 */
export async function GET(request: NextRequest) {
  // Rate limit by IP to prevent join code brute force attacks
  const limited = await rateLimit('join', request);
  if (limited) return limited;

  try {
    const code = request.nextUrl.searchParams.get('code');

    if (!code) {
      return NextResponse.json(
        { error: 'Join code is required', code: 'MISSING_CODE' },
        { status: 400 }
      );
    }

    const studentRegistrationService = await getStudentRegistrationService();
    const result = await studentRegistrationService.validateSectionCode(code);

    if (!result.valid) {
      const errorMessages: Record<string, string> = {
        INVALID_CODE: 'Invalid join code',
        SECTION_INACTIVE: 'This section is no longer accepting new students',
        NAMESPACE_NOT_FOUND: 'Organization not found',
      };

      return NextResponse.json(
        {
          error: errorMessages[result.error!] || 'Validation failed',
          code: result.error,
        },
        { status: 400 }
      );
    }

    // Get class info for the section
    const storage = await getStorage();
    const classInfo = await storage.classes.getClass(result.section!.classId);

    // Get instructor info for display
    const instructors = [];
    for (const instructorId of result.section!.instructorIds.slice(0, 3)) {
      const user = await storage.users.getUser(instructorId);
      if (user) {
        instructors.push({
          id: user.id,
          displayName: user.displayName || user.email,
        });
      }
    }

    return NextResponse.json({
      section: {
        id: result.section!.id,
        name: result.section!.name,
        semester: result.section!.semester,
      },
      class: classInfo ? {
        id: classInfo.id,
        name: classInfo.name,
        description: classInfo.description,
      } : null,
      namespace: {
        id: result.namespace!.id,
        displayName: result.namespace!.displayName,
      },
      instructors,
      capacityAvailable: result.capacityAvailable,
    });
  } catch (error: any) {
    console.error('[API] Register student GET error:', error);
    return NextResponse.json(
      { error: 'Failed to validate join code' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/register-student
 *
 * Creates a new student account and enrolls in the section.
 *
 * Request body:
 * - code: Section join code (required)
 * - email: Student email (required)
 * - password: Account password (required)
 * - displayName: Optional display name
 *
 * Response:
 * - 201: { user, section }
 * - 400: Validation error (missing fields, invalid code, capacity, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, email, password, displayName } = body;

    // Validate required fields
    const errors: string[] = [];

    if (!code || typeof code !== 'string') {
      errors.push('Join code is required');
    }
    if (!email || typeof email !== 'string') {
      errors.push('Email is required');
    }
    if (!password || typeof password !== 'string') {
      errors.push('Password is required');
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: errors.join(', '), code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters', code: 'WEAK_PASSWORD' },
        { status: 400 }
      );
    }

    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return NextResponse.json(
        {
          error: 'Password must contain at least one letter and one number',
          code: 'WEAK_PASSWORD',
        },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json(
        { error: 'Invalid email format', code: 'INVALID_EMAIL' },
        { status: 400 }
      );
    }

    // Register the student
    const studentRegistrationService = await getStudentRegistrationService();
    const result = await studentRegistrationService.registerStudent(
      code,
      email.trim(),
      password,
      displayName?.trim()
    );

    return NextResponse.json(
      {
        user: result.user,
        section: {
          id: result.section.id,
          name: result.section.name,
          semester: result.section.semester,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[API] Register student POST error:', error);

    // Handle StudentRegistrationError (check by name for mock compatibility)
    if (error.name === 'StudentRegistrationError' && error.code) {
      const statusCode = error.code === 'USER_CREATION_FAILED' ? 409 : 400;

      const errorMessages: Record<string, string> = {
        INVALID_CODE: 'Invalid join code',
        SECTION_INACTIVE: 'This section is no longer accepting new students',
        NAMESPACE_NOT_FOUND: 'Organization not found',
        NAMESPACE_AT_CAPACITY: 'This class has reached its student limit',
        INVALID_EMAIL: 'Invalid email format',
        INVALID_PASSWORD: 'Invalid password',
        USER_CREATION_FAILED: 'Failed to create account (email may already be in use)',
        MEMBERSHIP_FAILED: 'Failed to enroll in section',
      };

      return NextResponse.json(
        {
          error: errorMessages[error.code] || error.message,
          code: error.code,
        },
        { status: statusCode }
      );
    }

    // Handle duplicate email from Supabase
    if (error.message?.includes('already') || error.message?.includes('duplicate')) {
      return NextResponse.json(
        {
          error: 'An account with this email already exists',
          code: 'EMAIL_EXISTS',
        },
        { status: 409 }
      );
    }

    // Pass through password validation errors from Supabase (e.g., pwned password check)
    if (error.message?.toLowerCase().includes('password')) {
      return NextResponse.json(
        {
          error: error.message,
          code: 'WEAK_PASSWORD',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    );
  }
}
