/**
 * Integration tests for ClassRepository cross-process data reloading
 * 
 * These tests verify that changes made by one repository instance
 * are visible to another instance (simulating cross-process behavior)
 */

import { ClassRepository } from '../local';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('ClassRepository - Cross-Process Data Reloading', () => {
  let testDir: string;
  let repository1: ClassRepository;
  let repository2: ClassRepository;

  beforeEach(async () => {
    // Create a temporary directory for test data
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'class-repo-test-'));
    
    // Create two repository instances pointing to the same data directory
    repository1 = new ClassRepository(testDir);
    repository2 = new ClassRepository(testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should see classes created by another repository instance', async () => {
    // Repository 1 creates a class
    const classData = await repository1.createClass({
      name: 'Test Class',
      description: 'A test class for cross-process testing',
      createdBy: 'instructor-1',
    });

    // Repository 2 should see the class
    const retrievedClass = await repository2.getClass(classData.id);
    
    expect(retrievedClass).not.toBeNull();
    expect(retrievedClass?.id).toBe(classData.id);
    expect(retrievedClass?.name).toBe('Test Class');
    expect(retrievedClass?.description).toBe('A test class for cross-process testing');
  });

  it('should see class updates made by another repository instance', async () => {
    // Repository 1 creates a class
    const classData = await repository1.createClass({
      name: 'Original Name',
      description: 'Original description',
      createdBy: 'instructor-1',
    });

    // Repository 1 updates the class
    await repository1.updateClass(classData.id, {
      name: 'Updated Name',
      description: 'Updated description',
    });

    // Repository 2 should see the updated class
    const retrievedClass = await repository2.getClass(classData.id);
    
    expect(retrievedClass).not.toBeNull();
    expect(retrievedClass?.name).toBe('Updated Name');
    expect(retrievedClass?.description).toBe('Updated description');
  });

  it('should see all classes in listClasses across repository instances', async () => {
    // Repository 1 creates multiple classes
    await repository1.createClass({
      name: 'Class 1',
      description: 'First class',
      createdBy: 'instructor-1',
    });

    await repository1.createClass({
      name: 'Class 2',
      description: 'Second class',
      createdBy: 'instructor-2',
    });

    // Repository 2 should see both classes
    const classes = await repository2.listClasses();
    
    expect(classes).toHaveLength(2);
    expect(classes.map(c => c.name).sort()).toEqual(['Class 1', 'Class 2']);
  });

  it('should filter classes by creator across repository instances', async () => {
    // Repository 1 creates classes with different creators
    await repository1.createClass({
      name: 'Class A',
      description: 'By instructor 1',
      createdBy: 'instructor-1',
    });

    await repository1.createClass({
      name: 'Class B',
      description: 'By instructor 2',
      createdBy: 'instructor-2',
    });

    await repository1.createClass({
      name: 'Class C',
      description: 'By instructor 1',
      createdBy: 'instructor-1',
    });

    // Repository 2 should see only instructor-1's classes
    const classes = await repository2.listClasses('instructor-1');
    
    expect(classes).toHaveLength(2);
    expect(classes.every(c => c.createdBy === 'instructor-1')).toBe(true);
    expect(classes.map(c => c.name).sort()).toEqual(['Class A', 'Class C']);
  });

  it('should not see deleted classes across repository instances', async () => {
    // Repository 1 creates a class
    const classData = await repository1.createClass({
      name: 'To Be Deleted',
      description: 'This class will be deleted',
      createdBy: 'instructor-1',
    });

    // Verify repository 2 can see it
    let retrievedClass = await repository2.getClass(classData.id);
    expect(retrievedClass).not.toBeNull();

    // Repository 1 deletes the class
    await repository1.deleteClass(classData.id);

    // Repository 2 should no longer see the class
    retrievedClass = await repository2.getClass(classData.id);
    expect(retrievedClass).toBeNull();
  });
});
