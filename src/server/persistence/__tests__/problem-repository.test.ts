/**
 * Tests for LocalProblemRepository
 */

import { LocalProblemRepository } from '../local/problem-repository';
import type { Problem, ProblemInput } from '../../types/problem';
import type { TestCase } from '../../testing/types';
import { promises as fs } from 'fs';
import * as path from 'path';

describe('LocalProblemRepository', () => {
  let repository: LocalProblemRepository;
  let testDir: string;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = path.join(__dirname, `test-problems-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    
    repository = new LocalProblemRepository(testDir);
    await repository.initialize();
  });

  afterEach(async () => {
    // Cleanup
    await repository.shutdown();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('create', () => {
    it('should create a problem with minimal fields', async () => {
      const input: ProblemInput = {
        title: 'Test Problem',
        description: 'Test description',
        starterCode: 'def solution(): pass',
        solutionCode: 'def solution(): return 42',
        testCases: [],
        authorId: 'user-123',
        isPublic: false,
        classId: undefined,
      };

      const problem = await repository.create(input);

      expect(problem).toBeDefined();
      expect(problem.id).toBeDefined();
      expect(problem.title).toBe('Test Problem');
      expect(problem.description).toBe('Test description');
      expect(problem.createdAt).toBeInstanceOf(Date);
      expect(problem.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a problem with test cases', async () => {
      const testCase: TestCase = {
        id: 'test-1',
        name: 'Basic test',
        problemId: 'test-problem',
        type: 'input-output',
        description: 'Test basic input/output',
        visible: true,
        order: 1,
        config: {
          type: 'input-output',
          data: {
            input: '42',
            expectedOutput: '42',
            matchType: 'exact',
          },
        },
      };

      const input: ProblemInput = {
        title: 'Test Problem',
        description: '',
        starterCode: '',
        solutionCode: '',
        testCases: [testCase],
        authorId: 'user-123',
        isPublic: false,
        classId: undefined,
      };

      const problem = await repository.create(input);

      expect(problem.testCases).toHaveLength(1);
      expect(problem.testCases?.[0]).toEqual(testCase);
    });

    it('should reject invalid problem data', async () => {
      const input: any = {
        title: '', // Empty title
        description: 'Test',
        starterCode: '',
        solutionCode: '',
        testCases: [],
        authorId: 'user-123',
        isPublic: false,
        classId: undefined,
      };

      await expect(repository.create(input)).rejects.toThrow();
    });
  });

  describe('getById', () => {
    it('should retrieve a problem by ID', async () => {
      const input: ProblemInput = {
        title: 'Test Problem',
        description: 'Test description',
        starterCode: '',
        solutionCode: '',
        testCases: [],
        authorId: 'user-123',
        isPublic: false,
        classId: undefined,
      };

      const created = await repository.create(input);
      const retrieved = await repository.getById(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.title).toBe('Test Problem');
    });

    it('should return null for non-existent ID', async () => {
      const result = await repository.getById('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('getAll', () => {
    it('should return empty array when no problems exist', async () => {
      const problems = await repository.getAll();
      expect(problems).toEqual([]);
    });

    it('should return all problems', async () => {
      const input1: ProblemInput = {
        title: 'Problem 1',
        description: '',
        starterCode: '',
        solutionCode: '',
        testCases: [],
        authorId: 'user-123',
        isPublic: false,
        classId: undefined,
      };

      const input2: ProblemInput = {
        title: 'Problem 2',
        description: '',
        starterCode: '',
        solutionCode: '',
        testCases: [],
        authorId: 'user-456',
        isPublic: true,
        classId: undefined,
      };

      await repository.create(input1);
      await repository.create(input2);

      const problems = await repository.getAll();
      expect(problems).toHaveLength(2);
    });

    it('should filter problems by author', async () => {
      const input1: ProblemInput = {
        title: 'Problem 1',
        description: '',
        starterCode: '',
        solutionCode: '',
        testCases: [],
        authorId: 'user-123',
        isPublic: false,
        classId: undefined,
      };

      const input2: ProblemInput = {
        title: 'Problem 2',
        description: '',
        starterCode: '',
        solutionCode: '',
        testCases: [],
        authorId: 'user-456',
        isPublic: true,
        classId: undefined,
      };

      await repository.create(input1);
      await repository.create(input2);

      const problems = await repository.getAll({ authorId: 'user-123' });
      expect(problems).toHaveLength(1);
      expect(problems[0].title).toBe('Problem 1');
    });

    it('should filter problems by class', async () => {
      const input1: ProblemInput = {
        title: 'Problem 1',
        description: '',
        starterCode: '',
        solutionCode: '',
        testCases: [],
        authorId: 'user-123',
        isPublic: false,
        classId: 'class-1',
      };

      const input2: ProblemInput = {
        title: 'Problem 2',
        description: '',
        starterCode: '',
        solutionCode: '',
        testCases: [],
        authorId: 'user-123',
        isPublic: false,
        classId: 'class-2',
      };

      await repository.create(input1);
      await repository.create(input2);

      const problems = await repository.getAll({ classId: 'class-1' });
      expect(problems).toHaveLength(1);
      expect(problems[0].title).toBe('Problem 1');
    });

    it('should sort problems by title', async () => {
      const input1: ProblemInput = {
        title: 'Zebra Problem',
        description: '',
        starterCode: '',
        solutionCode: '',
        testCases: [],
        authorId: 'user-123',
        isPublic: false,
        classId: undefined,
      };

      const input2: ProblemInput = {
        title: 'Apple Problem',
        description: '',
        starterCode: '',
        solutionCode: '',
        testCases: [],
        authorId: 'user-123',
        isPublic: false,
        classId: undefined,
      };

      await repository.create(input1);
      await repository.create(input2);

      const problems = await repository.getAll({ sortBy: 'title', sortOrder: 'asc' });
      expect(problems[0].title).toBe('Apple Problem');
      expect(problems[1].title).toBe('Zebra Problem');
    });
  });

  describe('update', () => {
    it('should update a problem', async () => {
      const input: ProblemInput = {
        title: 'Original Title',
        description: 'Original description',
        starterCode: '',
        solutionCode: '',
        testCases: [],
        authorId: 'user-123',
        isPublic: false,
        classId: undefined,
      };

      const created = await repository.create(input);
      
      const updated = await repository.update(created.id, {
        title: 'Updated Title',
        description: 'Updated description',
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.description).toBe('Updated description');
      expect(updated.id).toBe(created.id); // ID unchanged
      expect(updated.createdAt).toEqual(created.createdAt); // createdAt unchanged
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
    });

    it('should throw error for non-existent problem', async () => {
      await expect(
        repository.update('non-existent-id', { title: 'New Title' })
      ).rejects.toThrow('not found');
    });

    it('should validate updated data', async () => {
      const input: ProblemInput = {
        title: 'Original Title',
        description: '',
        starterCode: '',
        solutionCode: '',
        testCases: [],
        authorId: 'user-123',
        isPublic: false,
        classId: undefined,
      };

      const created = await repository.create(input);
      
      await expect(
        repository.update(created.id, { title: '' }) // Empty title
      ).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('should delete a problem', async () => {
      const input: ProblemInput = {
        title: 'Test Problem',
        description: '',
        starterCode: '',
        solutionCode: '',
        testCases: [],
        authorId: 'user-123',
        isPublic: false,
        classId: undefined,
      };

      const created = await repository.create(input);
      
      await repository.delete(created.id);
      
      const retrieved = await repository.getById(created.id);
      expect(retrieved).toBeNull();
    });

    it('should throw error for non-existent problem', async () => {
      await expect(
        repository.delete('non-existent-id')
      ).rejects.toThrow('not found');
    });

    it('should remove problem from index', async () => {
      const input: ProblemInput = {
        title: 'Test Problem',
        description: '',
        starterCode: '',
        solutionCode: '',
        testCases: [],
        authorId: 'user-123',
        isPublic: false,
        classId: undefined,
      };

      const created = await repository.create(input);
      
      await repository.delete(created.id);
      
      const allProblems = await repository.getAll();
      expect(allProblems).toHaveLength(0);
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await repository.create({
        title: 'Two Sum Problem',
        description: 'Find two numbers that add up to target',
        starterCode: '',
        solutionCode: '',
        testCases: [],
        authorId: 'user-123',
        isPublic: true,
        classId: undefined,
      });

      await repository.create({
        title: 'Three Sum Problem',
        description: 'Find three numbers that add up to zero',
        starterCode: '',
        solutionCode: '',
        testCases: [],
        authorId: 'user-123',
        isPublic: true,
        classId: undefined,
      });

      await repository.create({
        title: 'Binary Search',
        description: 'Implement binary search algorithm',
        starterCode: '',
        solutionCode: '',
        testCases: [],
        authorId: 'user-456',
        isPublic: false,
        classId: undefined,
      });
    });

    it('should search by title', async () => {
      const results = await repository.search('sum');
      expect(results).toHaveLength(2);
      expect(results.every(p => p.title.toLowerCase().includes('sum'))).toBe(true);
    });

    it('should search with multiple terms', async () => {
      const results = await repository.search('two sum');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Two Sum Problem');
    });

    it('should return all problems for empty query', async () => {
      const results = await repository.search('');
      expect(results).toHaveLength(3);
    });

    it('should combine search with filters', async () => {
      const results = await repository.search('sum', { authorId: 'user-123' });
      expect(results).toHaveLength(2);
    });
  });

  describe('getByAuthor', () => {
    it('should return problems by specific author', async () => {
      await repository.create({
        title: 'Problem 1',
        description: '',
        starterCode: '',
        solutionCode: '',
        testCases: [],
        authorId: 'user-123',
        isPublic: false,
        classId: undefined,
      });

      await repository.create({
        title: 'Problem 2',
        description: '',
        starterCode: '',
        solutionCode: '',
        testCases: [],
        authorId: 'user-456',
        isPublic: false,
        classId: undefined,
      });

      const results = await repository.getByAuthor('user-123');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Problem 1');
    });
  });

  describe('getByClass', () => {
    it('should return problems for specific class', async () => {
      await repository.create({
        title: 'Class Problem',
        description: '',
        starterCode: '',
        solutionCode: '',
        testCases: [],
        authorId: 'user-123',
        isPublic: false,
        classId: 'class-1',
      });

      await repository.create({
        title: 'Other Problem',
        description: '',
        starterCode: '',
        solutionCode: '',
        testCases: [],
        authorId: 'user-123',
        isPublic: false,
        classId: 'class-2',
      });

      const results = await repository.getByClass('class-1');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Class Problem');
    });
  });

  describe('duplicate', () => {
    it('should create a duplicate with new title', async () => {
      const original = await repository.create({
        title: 'Original Problem',
        description: 'Original description',
        starterCode: 'original code',
        solutionCode: 'original solution',
        testCases: [],
        authorId: 'user-123',
        isPublic: true,
        classId: 'class-1',
      });

      const duplicate = await repository.duplicate(original.id, 'Duplicate Problem');

      expect(duplicate.id).not.toBe(original.id);
      expect(duplicate.title).toBe('Duplicate Problem');
      expect(duplicate.description).toBe('Original description');
      expect(duplicate.starterCode).toBe('original code');
      expect(duplicate.solutionCode).toBe('original solution');
      expect(duplicate.authorId).toBe('user-123');
      expect(duplicate.isPublic).toBe(false); // Duplicates are private
      expect(duplicate.classId).toBe('class-1');
    });

    it('should throw error for non-existent problem', async () => {
      await expect(
        repository.duplicate('non-existent-id', 'New Title')
      ).rejects.toThrow('not found');
    });
  });

  describe('health', () => {
    it('should return true when healthy', async () => {
      const healthy = await repository.health();
      expect(healthy).toBe(true);
    });

    it('should return false when directory missing', async () => {
      await repository.shutdown();
      await fs.rm(testDir, { recursive: true, force: true });
      
      const healthy = await repository.health();
      expect(healthy).toBe(false);
    });
  });
});
