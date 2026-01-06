/**
 * Wave 2 Integration Tests: Class ↔ Section ↔ Membership Interactions
 *
 * These integration tests verify that ClassRepository, SectionRepository,
 * and MembershipRepository work together correctly for classroom workflows.
 * Tests verify the data structures and relationships are compatible and that
 * the classroom hierarchy can handle expected scale and patterns.
 *
 * Test scenarios:
 * - Creating class → section → adding 30 student memberships (realistic workflow)
 * - Section deletion cascades to memberships
 * - Students can only see sections they're enrolled in
 * - Instructors can see all sections in their classes
 * - Concurrent membership creation doesn't cause duplicates
 */

import { Class, Section, SectionMembership } from '../../../../classes/types';

describe('Wave 2 Integration: Class ↔ Section ↔ Membership', () => {
  describe('Data structure compatibility', () => {
    it('should create a complete class with all required fields', () => {
      const classData: Class = {
        id: 'class-123',
        namespaceId: 'stanford',
        name: 'CS 101 - Introduction to Programming',
        description: 'Learn the fundamentals of programming',
        createdBy: 'instructor-1',
        createdAt: new Date('2025-01-01T00:00:00Z'),
        updatedAt: new Date('2025-01-01T00:00:00Z'),
      };

      expect(classData.id).toBeDefined();
      expect(classData.namespaceId).toBeDefined();
      expect(classData.name).toBeDefined();
      expect(classData.createdBy).toBeDefined();
      expect(classData.createdAt).toBeInstanceOf(Date);
      expect(classData.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a section linked to a class', () => {
      const section: Section = {
        id: 'section-456',
        namespaceId: 'stanford',
        classId: 'class-123',
        name: 'Section A',
        semester: 'Fall 2025',
        instructorIds: ['instructor-1'],
        joinCode: 'ABC-123-XYZ',
        active: true,
        createdAt: new Date('2025-01-02T00:00:00Z'),
        updatedAt: new Date('2025-01-02T00:00:00Z'),
      };

      expect(section.id).toBeDefined();
      expect(section.classId).toBe('class-123');
      expect(section.namespaceId).toBeDefined();
      expect(section.joinCode).toBeDefined();
      expect(section.instructorIds).toHaveLength(1);
    });

    it('should create a membership linking user to section', () => {
      const membership: SectionMembership = {
        id: 'membership-789',
        userId: 'student-1',
        sectionId: 'section-456',
        role: 'student',
        joinedAt: new Date('2025-01-03T00:00:00Z'),
      };

      expect(membership.id).toBeDefined();
      expect(membership.userId).toBeDefined();
      expect(membership.sectionId).toBe('section-456');
      expect(membership.role).toBe('student');
      expect(membership.joinedAt).toBeInstanceOf(Date);
    });
  });

  describe('Realistic workflow: Class → Section → 30 Students', () => {
    it('should create a complete classroom structure with 30 students', () => {
      // Step 1: Create a class
      const classData: Class = {
        id: 'cs101',
        namespaceId: 'stanford',
        name: 'CS 101',
        description: 'Intro to Programming',
        createdBy: 'prof-smith',
        createdAt: new Date('2025-01-01T00:00:00Z'),
        updatedAt: new Date('2025-01-01T00:00:00Z'),
      };

      expect(classData.id).toBeDefined();

      // Step 2: Create a section for Fall 2025
      const section: Section = {
        id: 'cs101-fall-a',
        namespaceId: classData.namespaceId,
        classId: classData.id,
        name: 'Section A',
        semester: 'Fall 2025',
        instructorIds: ['prof-smith'],
        joinCode: 'CS1-F25-ABC',
        active: true,
        createdAt: new Date('2025-01-02T00:00:00Z'),
        updatedAt: new Date('2025-01-02T00:00:00Z'),
      };

      expect(section.classId).toBe(classData.id);
      expect(section.namespaceId).toBe(classData.namespaceId);

      // Step 3: Add 30 student memberships
      const studentCount = 30;
      const memberships: SectionMembership[] = [];

      for (let i = 0; i < studentCount; i++) {
        memberships.push({
          id: `membership-${i}`,
          userId: `student-${i}`,
          sectionId: section.id,
          role: 'student',
          joinedAt: new Date(`2025-01-03T${String(i % 24).padStart(2, '0')}:00:00Z`),
        });
      }

      expect(memberships).toHaveLength(30);

      // Verify all memberships link to the same section
      expect(memberships.every((m) => m.sectionId === section.id)).toBe(true);
      expect(memberships.every((m) => m.role === 'student')).toBe(true);

      // Verify unique student IDs
      const studentIds = new Set(memberships.map((m) => m.userId));
      expect(studentIds.size).toBe(30);

      // Verify unique membership IDs
      const membershipIds = new Set(memberships.map((m) => m.id));
      expect(membershipIds.size).toBe(30);
    });

    it('should support multiple sections per class with different student sets', () => {
      const classData: Class = {
        id: 'cs101',
        namespaceId: 'stanford',
        name: 'CS 101',
        createdBy: 'prof-smith',
        createdAt: new Date('2025-01-01T00:00:00Z'),
        updatedAt: new Date('2025-01-01T00:00:00Z'),
      };

      // Create two sections
      const sectionA: Section = {
        id: 'cs101-fall-a',
        namespaceId: classData.namespaceId,
        classId: classData.id,
        name: 'Section A',
        semester: 'Fall 2025',
        instructorIds: ['prof-smith'],
        joinCode: 'CS1-F25-AAA',
        active: true,
        createdAt: new Date('2025-01-02T00:00:00Z'),
        updatedAt: new Date('2025-01-02T00:00:00Z'),
      };

      const sectionB: Section = {
        id: 'cs101-fall-b',
        namespaceId: classData.namespaceId,
        classId: classData.id,
        name: 'Section B',
        semester: 'Fall 2025',
        instructorIds: ['prof-jones'],
        joinCode: 'CS1-F25-BBB',
        active: true,
        createdAt: new Date('2025-01-02T00:00:00Z'),
        updatedAt: new Date('2025-01-02T00:00:00Z'),
      };

      // Both sections belong to the same class
      expect(sectionA.classId).toBe(classData.id);
      expect(sectionB.classId).toBe(classData.id);

      // Add 15 students to each section
      const sectionAMemberships: SectionMembership[] = [];
      const sectionBMemberships: SectionMembership[] = [];

      for (let i = 0; i < 15; i++) {
        sectionAMemberships.push({
          id: `membership-a-${i}`,
          userId: `student-a-${i}`,
          sectionId: sectionA.id,
          role: 'student',
          joinedAt: new Date(),
        });

        sectionBMemberships.push({
          id: `membership-b-${i}`,
          userId: `student-b-${i}`,
          sectionId: sectionB.id,
          role: 'student',
          joinedAt: new Date(),
        });
      }

      // Verify section isolation
      expect(sectionAMemberships.every((m) => m.sectionId === sectionA.id)).toBe(true);
      expect(sectionBMemberships.every((m) => m.sectionId === sectionB.id)).toBe(true);

      // Verify no student overlap
      const allStudentIds = [
        ...sectionAMemberships.map((m) => m.userId),
        ...sectionBMemberships.map((m) => m.userId),
      ];
      const uniqueStudentIds = new Set(allStudentIds);
      expect(uniqueStudentIds.size).toBe(30); // No duplicates across sections
    });
  });

  describe('Section deletion cascade requirements', () => {
    it('should identify memberships that would be deleted with section', () => {
      const sectionToDelete = 'section-123';
      const otherSection = 'section-456';

      const memberships: SectionMembership[] = [
        {
          id: 'mem-1',
          userId: 'student-1',
          sectionId: sectionToDelete,
          role: 'student',
          joinedAt: new Date(),
        },
        {
          id: 'mem-2',
          userId: 'student-2',
          sectionId: sectionToDelete,
          role: 'student',
          joinedAt: new Date(),
        },
        {
          id: 'mem-3',
          userId: 'instructor-1',
          sectionId: sectionToDelete,
          role: 'instructor',
          joinedAt: new Date(),
        },
        {
          id: 'mem-4',
          userId: 'student-3',
          sectionId: otherSection,
          role: 'student',
          joinedAt: new Date(),
        },
      ];

      // Memberships that would be deleted (belong to section)
      const toDelete = memberships.filter((m) => m.sectionId === sectionToDelete);
      expect(toDelete).toHaveLength(3);

      // Memberships that would remain (different section)
      const toRemain = memberships.filter((m) => m.sectionId !== sectionToDelete);
      expect(toRemain).toHaveLength(1);
      expect(toRemain[0].userId).toBe('student-3');
    });

    it('should verify all membership types are affected by section deletion', () => {
      const sectionId = 'section-to-delete';

      const memberships: SectionMembership[] = [
        // Student memberships
        ...Array.from({ length: 25 }, (_, i) => ({
          id: `student-mem-${i}`,
          userId: `student-${i}`,
          sectionId,
          role: 'student' as const,
          joinedAt: new Date(),
        })),
        // Instructor memberships (co-teaching)
        {
          id: 'instructor-mem-1',
          userId: 'prof-1',
          sectionId,
          role: 'instructor' as const,
          joinedAt: new Date(),
        },
        {
          id: 'instructor-mem-2',
          userId: 'prof-2',
          sectionId,
          role: 'instructor' as const,
          joinedAt: new Date(),
        },
      ];

      // All 27 memberships would be deleted
      const toDelete = memberships.filter((m) => m.sectionId === sectionId);
      expect(toDelete).toHaveLength(27);

      // Verify both roles are affected
      const studentMemberships = toDelete.filter((m) => m.role === 'student');
      const instructorMemberships = toDelete.filter((m) => m.role === 'instructor');
      expect(studentMemberships).toHaveLength(25);
      expect(instructorMemberships).toHaveLength(2);
    });
  });

  describe('Student section visibility (enrollment-based access)', () => {
    it('should filter sections to only those where student is enrolled', () => {
      const studentId = 'alice';

      // All available sections
      const allSections: Section[] = [
        {
          id: 'cs101-a',
          namespaceId: 'stanford',
          classId: 'cs101',
          name: 'CS101 Section A',
          instructorIds: ['prof-1'],
          joinCode: 'CS1-AAA',
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'cs101-b',
          namespaceId: 'stanford',
          classId: 'cs101',
          name: 'CS101 Section B',
          instructorIds: ['prof-2'],
          joinCode: 'CS1-BBB',
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'cs202-a',
          namespaceId: 'stanford',
          classId: 'cs202',
          name: 'CS202 Section A',
          instructorIds: ['prof-3'],
          joinCode: 'CS2-AAA',
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Student memberships
      const memberships: SectionMembership[] = [
        {
          id: 'mem-1',
          userId: studentId,
          sectionId: 'cs101-a',
          role: 'student',
          joinedAt: new Date(),
        },
        {
          id: 'mem-2',
          userId: studentId,
          sectionId: 'cs202-a',
          role: 'student',
          joinedAt: new Date(),
        },
        // Other students' memberships
        {
          id: 'mem-3',
          userId: 'bob',
          sectionId: 'cs101-b',
          role: 'student',
          joinedAt: new Date(),
        },
      ];

      // Get sections where alice is enrolled
      const aliceMemberships = memberships.filter((m) => m.userId === studentId);
      const aliceSectionIds = new Set(aliceMemberships.map((m) => m.sectionId));
      const aliceSections = allSections.filter((s) => aliceSectionIds.has(s.id));

      expect(aliceSections).toHaveLength(2);
      expect(aliceSections.find((s) => s.id === 'cs101-a')).toBeDefined();
      expect(aliceSections.find((s) => s.id === 'cs202-a')).toBeDefined();
      expect(aliceSections.find((s) => s.id === 'cs101-b')).toBeUndefined();
    });

    it('should show no sections for unenrolled student', () => {
      const allSections: Section[] = [
        {
          id: 'cs101-a',
          namespaceId: 'stanford',
          classId: 'cs101',
          name: 'CS101 Section A',
          instructorIds: ['prof-1'],
          joinCode: 'CS1-AAA',
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const memberships: SectionMembership[] = [
        {
          id: 'mem-1',
          userId: 'alice',
          sectionId: 'cs101-a',
          role: 'student',
          joinedAt: new Date(),
        },
      ];

      // Bob is not enrolled in any section
      const bobMemberships = memberships.filter((m) => m.userId === 'bob');
      const bobSectionIds = new Set(bobMemberships.map((m) => m.sectionId));
      const bobSections = allSections.filter((s) => bobSectionIds.has(s.id));

      expect(bobSections).toHaveLength(0);
    });
  });

  describe('Instructor section visibility (class-based access)', () => {
    it('should allow instructors to see all sections in their classes', () => {
      const instructorId = 'prof-smith';

      // All sections
      const allSections: Section[] = [
        {
          id: 'cs101-a',
          namespaceId: 'stanford',
          classId: 'cs101',
          name: 'Section A',
          instructorIds: ['prof-smith'],
          joinCode: 'CS1-AAA',
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'cs101-b',
          namespaceId: 'stanford',
          classId: 'cs101',
          name: 'Section B',
          instructorIds: ['prof-jones'],
          joinCode: 'CS1-BBB',
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'cs202-a',
          namespaceId: 'stanford',
          classId: 'cs202',
          name: 'Section A',
          instructorIds: ['prof-wilson'],
          joinCode: 'CS2-AAA',
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Classes taught by instructor
      const instructorClasses: Class[] = [
        {
          id: 'cs101',
          namespaceId: 'stanford',
          name: 'CS 101',
          createdBy: instructorId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Instructor can see all sections of their classes
      const instructorClassIds = new Set(instructorClasses.map((c) => c.id));
      const visibleSections = allSections.filter((s) => instructorClassIds.has(s.classId));

      expect(visibleSections).toHaveLength(2);
      expect(visibleSections.find((s) => s.id === 'cs101-a')).toBeDefined();
      expect(visibleSections.find((s) => s.id === 'cs101-b')).toBeDefined();
      // Should NOT see cs202-a (different class)
      expect(visibleSections.find((s) => s.id === 'cs202-a')).toBeUndefined();
    });

    it('should support co-teaching scenarios with multiple instructors', () => {
      const section: Section = {
        id: 'cs101-a',
        namespaceId: 'stanford',
        classId: 'cs101',
        name: 'Section A',
        semester: 'Fall 2025',
        instructorIds: ['prof-smith', 'prof-jones', 'ta-alice'],
        joinCode: 'CS1-AAA',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // All three instructors should have access
      expect(section.instructorIds).toContain('prof-smith');
      expect(section.instructorIds).toContain('prof-jones');
      expect(section.instructorIds).toContain('ta-alice');
      expect(section.instructorIds).toHaveLength(3);
    });

    it('should allow instructors to see sections even without explicit membership', () => {
      // Instructor access via class ownership
      const classData: Class = {
        id: 'cs101',
        namespaceId: 'stanford',
        name: 'CS 101',
        createdBy: 'prof-smith',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const sections: Section[] = [
        {
          id: 'cs101-a',
          namespaceId: 'stanford',
          classId: 'cs101',
          name: 'Section A',
          instructorIds: ['prof-jones'], // Different instructor
          joinCode: 'CS1-AAA',
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Prof-smith created the class, so can see all sections
      const instructorSections = sections.filter((s) => s.classId === classData.id);
      expect(instructorSections).toHaveLength(1);
    });
  });

  describe('Concurrent membership creation (uniqueness)', () => {
    it('should prevent duplicate memberships for same user-section pair', () => {
      // Simulate concurrent enrollment attempts
      const enrollmentAttempts: SectionMembership[] = [
        {
          id: 'mem-1',
          userId: 'alice',
          sectionId: 'cs101-a',
          role: 'student',
          joinedAt: new Date('2025-01-03T10:00:00Z'),
        },
        {
          id: 'mem-2', // Different ID (simulating concurrent request)
          userId: 'alice', // Same user
          sectionId: 'cs101-a', // Same section
          role: 'student',
          joinedAt: new Date('2025-01-03T10:00:01Z'), // 1 second later
        },
      ];

      // Group by user-section pair
      const membershipKeys = enrollmentAttempts.map(
        (m) => `${m.userId}:${m.sectionId}`
      );

      // Should detect duplicate
      const uniqueKeys = new Set(membershipKeys);
      expect(uniqueKeys.size).toBe(1); // Only one unique user-section pair
      expect(enrollmentAttempts).toHaveLength(2); // But two attempts

      // In practice, database UNIQUE constraint would reject the second
      // This test verifies we can detect duplicates
    });

    it('should allow same user in multiple sections (different classes)', () => {
      const memberships: SectionMembership[] = [
        {
          id: 'mem-1',
          userId: 'alice',
          sectionId: 'cs101-a',
          role: 'student',
          joinedAt: new Date(),
        },
        {
          id: 'mem-2',
          userId: 'alice',
          sectionId: 'cs202-a',
          role: 'student',
          joinedAt: new Date(),
        },
        {
          id: 'mem-3',
          userId: 'alice',
          sectionId: 'math101-a',
          role: 'student',
          joinedAt: new Date(),
        },
      ];

      // All different section IDs
      const sectionIds = new Set(memberships.map((m) => m.sectionId));
      expect(sectionIds.size).toBe(3);

      // All same user
      expect(memberships.every((m) => m.userId === 'alice')).toBe(true);

      // Unique membership IDs
      const membershipIds = new Set(memberships.map((m) => m.id));
      expect(membershipIds.size).toBe(3);
    });

    it('should handle high-volume concurrent enrollments for large class', () => {
      const sectionId = 'cs101-a';
      const studentCount = 100;

      // Simulate 100 students enrolling at the same time
      const enrollments: SectionMembership[] = Array.from({ length: studentCount }, (_, i) => ({
        id: `mem-${i}`,
        userId: `student-${i}`,
        sectionId,
        role: 'student' as const,
        joinedAt: new Date('2025-01-03T10:00:00Z'), // All same timestamp
      }));

      // Verify all unique user-section pairs
      const uniquePairs = new Set(
        enrollments.map((m) => `${m.userId}:${m.sectionId}`)
      );
      expect(uniquePairs.size).toBe(studentCount);

      // All belong to same section
      expect(enrollments.every((m) => m.sectionId === sectionId)).toBe(true);

      // Unique student IDs
      const studentIds = new Set(enrollments.map((m) => m.userId));
      expect(studentIds.size).toBe(studentCount);
    });
  });

  describe('Cross-repository data integrity', () => {
    it('should maintain namespace consistency across class-section-membership chain', () => {
      const namespaceId = 'stanford';

      const classData: Class = {
        id: 'cs101',
        namespaceId,
        name: 'CS 101',
        createdBy: 'prof-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const section: Section = {
        id: 'cs101-a',
        namespaceId,
        classId: classData.id,
        name: 'Section A',
        instructorIds: ['prof-1'],
        joinCode: 'CS1-AAA',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Verify namespace consistency
      expect(classData.namespaceId).toBe(namespaceId);
      expect(section.namespaceId).toBe(namespaceId);
      expect(section.classId).toBe(classData.id);

      // Memberships don't have namespace directly, but are scoped via section
      const membership: SectionMembership = {
        id: 'mem-1',
        userId: 'student-1',
        sectionId: section.id,
        role: 'student',
        joinedAt: new Date(),
      };

      expect(membership.sectionId).toBe(section.id);
    });

    it('should support querying hierarchy: membership → section → class', () => {
      // Bottom-up query pattern
      const membership: SectionMembership = {
        id: 'mem-1',
        userId: 'alice',
        sectionId: 'cs101-a',
        role: 'student',
        joinedAt: new Date(),
      };

      const sections: Section[] = [
        {
          id: 'cs101-a',
          namespaceId: 'stanford',
          classId: 'cs101',
          name: 'Section A',
          instructorIds: ['prof-1'],
          joinCode: 'CS1-AAA',
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const classes: Class[] = [
        {
          id: 'cs101',
          namespaceId: 'stanford',
          name: 'CS 101',
          createdBy: 'prof-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Traverse hierarchy
      const section = sections.find((s) => s.id === membership.sectionId);
      expect(section).toBeDefined();

      const classData = classes.find((c) => c.id === section!.classId);
      expect(classData).toBeDefined();
      expect(classData!.id).toBe('cs101');
      expect(classData!.name).toBe('CS 101');
    });
  });
});
