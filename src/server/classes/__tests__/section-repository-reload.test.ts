/**
 * Integration tests for SectionRepository cross-process data reloading
 * 
 * These tests verify that changes made by one repository instance
 * are visible to another instance (simulating cross-process behavior)
 */

import { SectionRepository } from '../local';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('SectionRepository - Cross-Process Data Reloading', () => {
  let testDir: string;
  let repository1: SectionRepository;
  let repository2: SectionRepository;

  beforeEach(async () => {
    // Create a temporary directory for test data
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'section-repo-test-'));
    
    // Create two repository instances pointing to the same data directory
    repository1 = new SectionRepository(testDir);
    repository2 = new SectionRepository(testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should see sections created by another repository instance (simulating cross-process)', async () => {
    // Repository 1 creates a section
    const section = await repository1.createSection({
      namespaceId: 'default',
      classId: 'class-123',
      name: 'Test Section',
      semester: 'Fall 2024',
      instructorIds: ['instructor-1'],
      active: true,
    });

    // Repository 2 should see the section (after reloading from disk)
    const retrievedSection = await repository2.getSection(section.id);
    
    expect(retrievedSection).not.toBeNull();
    expect(retrievedSection?.id).toBe(section.id);
    expect(retrievedSection?.name).toBe('Test Section');
    expect(retrievedSection?.classId).toBe('class-123');
  });

  it('should see sections found by join code across repository instances', async () => {
    // Repository 1 creates a section
    const section = await repository1.createSection({
      namespaceId: 'default',
      classId: 'class-456',
      name: 'Another Section',
      semester: 'Spring 2025',
      instructorIds: ['instructor-2'],
      active: true,
    });

    // Repository 2 should find the section by join code
    const retrievedSection = await repository2.getSectionByJoinCode(section.joinCode);
    
    expect(retrievedSection).not.toBeNull();
    expect(retrievedSection?.id).toBe(section.id);
    expect(retrievedSection?.joinCode).toBe(section.joinCode);
  });

  it('should see updated sections across repository instances', async () => {
    // Repository 1 creates a section
    const section = await repository1.createSection({
      namespaceId: 'default',
      classId: 'class-789',
      name: 'Original Name',
      semester: 'Fall 2024',
      instructorIds: ['instructor-3'],
      active: true,
    });

    // Repository 1 updates the section
    await repository1.updateSection(section.id, {
      name: 'Updated Name',
      active: false,
    });

    // Repository 2 should see the updated section
    const retrievedSection = await repository2.getSection(section.id);
    
    expect(retrievedSection).not.toBeNull();
    expect(retrievedSection?.name).toBe('Updated Name');
    expect(retrievedSection?.active).toBe(false);
  });

  it('should see all sections in listSections across repository instances', async () => {
    // Repository 1 creates multiple sections
    await repository1.createSection({
      namespaceId: 'default',
      classId: 'class-abc',
      name: 'Section 1',
      semester: 'Fall 2024',
      instructorIds: ['instructor-1'],
      active: true,
    });

    await repository1.createSection({
      namespaceId: 'default',
      classId: 'class-abc',
      name: 'Section 2',
      semester: 'Fall 2024',
      instructorIds: ['instructor-2'],
      active: true,
    });

    // Repository 2 should see both sections
    const sections = await repository2.listSections({ classId: 'class-abc' });
    
    expect(sections).toHaveLength(2);
    expect(sections.map(s => s.name).sort()).toEqual(['Section 1', 'Section 2']);
  });

  it('should not see deleted sections across repository instances', async () => {
    // Repository 1 creates a section
    const section = await repository1.createSection({
      namespaceId: 'default',
      classId: 'class-xyz',
      name: 'To Be Deleted',
      semester: 'Fall 2024',
      instructorIds: ['instructor-1'],
      active: true,
    });

    // Repository 2 verifies it can see the section
    let retrievedSection = await repository2.getSection(section.id);
    expect(retrievedSection).not.toBeNull();

    // Repository 1 deletes the section
    await repository1.deleteSection(section.id);

    // Repository 2 should no longer see the section
    retrievedSection = await repository2.getSection(section.id);
    expect(retrievedSection).toBeNull();
  });
});
