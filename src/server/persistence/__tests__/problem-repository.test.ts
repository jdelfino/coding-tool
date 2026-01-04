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
        namespaceId: 'default',
        title: 'Test Problem',
        description: 'Test description',
        starterCode: 'def solution(): pass',
        testCases: [],
        authorId: 'user-123',
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
        namespaceId: 'default',
        title: 'Test Problem',
        description: '',
        starterCode: '',
        testCases: [testCase],
        authorId: 'user-123',
        classId: undefined,
      };

      const problem = await repository.create(input);

      expect(problem.testCases).toHaveLength(1);
      expect(problem.testCases?.[0]).toEqual(testCase);
    });

    it('should reject invalid problem data', async () => {
      const input: any = {
        namespaceId: 'default',
        title: '', // Empty title
        description: 'Test',
        starterCode: '',
        testCases: [],
        authorId: 'user-123',
        classId: undefined,
      };

      await expect(repository.create(input)).rejects.toThrow();
    });

    it('should create and persist problem with executionSettings', async () => {
      const input: ProblemInput = {
        namespaceId: 'default',
        title: 'Test Problem with Exec Settings',
        description: 'Test description',
        starterCode: 'print("hello")',
        testCases: [],
        executionSettings: {
          stdin: 'test input\n',
          randomSeed: 42,
          attachedFiles: [
            { name: 'data.txt', content: 'file content' },
            { name: 'config.json', content: '{"key": "value"}' },
          ],
        },
        authorId: 'user-123',
        classId: undefined,
      };

      const created = await repository.create(input);

      expect(created.executionSettings).toBeDefined();
      expect(created.executionSettings?.stdin).toBe('test input\n');
      expect(created.executionSettings?.randomSeed).toBe(42);
      expect(created.executionSettings?.attachedFiles).toHaveLength(2);
      expect(created.executionSettings?.attachedFiles?.[0].name).toBe('data.txt');

      // Verify it persists by retrieving it
      const retrieved = await repository.getById(created.id);
      expect(retrieved?.executionSettings).toBeDefined();
      expect(retrieved?.executionSettings?.stdin).toBe('test input\n');
      expect(retrieved?.executionSettings?.randomSeed).toBe(42);
      expect(retrieved?.executionSettings?.attachedFiles).toHaveLength(2);
      expect(retrieved?.executionSettings?.attachedFiles?.[1].content).toBe('{"key": "value"}');
    });
  });

  describe('getById', () => {
    it('should retrieve a problem by ID', async () => {
      const input: ProblemInput = {
        namespaceId: 'default',
        title: 'Test Problem',
        description: 'Test description',
        starterCode: '',
        testCases: [],
        authorId: 'user-123',
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
        namespaceId: 'default',
        title: 'Problem 1',
        description: '',
        starterCode: '',
        testCases: [],
        authorId: 'user-123',
        classId: undefined,
      };

      const input2: ProblemInput = {
        namespaceId: 'default',
        title: 'Problem 2',
        description: '',
        starterCode: '',
        testCases: [],
        authorId: 'user-456',
        classId: undefined,
      };

      await repository.create(input1);
      await repository.create(input2);

      const problems = await repository.getAll();
      expect(problems).toHaveLength(2);
    });

    it('should filter problems by author', async () => {
      const input1: ProblemInput = {
        namespaceId: 'default',
        title: 'Problem 1',
        description: '',
        starterCode: '',
        testCases: [],
        authorId: 'user-123',
        classId: undefined,
      };

      const input2: ProblemInput = {
        namespaceId: 'default',
        title: 'Problem 2',
        description: '',
        starterCode: '',
        testCases: [],
        authorId: 'user-456',
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
        namespaceId: 'default',
        title: 'Problem 1',
        description: '',
        starterCode: '',
        testCases: [],
        authorId: 'user-123',
        classId: 'class-1',
      };

      const input2: ProblemInput = {
        namespaceId: 'default',
        title: 'Problem 2',
        description: '',
        starterCode: '',
        testCases: [],
        authorId: 'user-123',
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
        namespaceId: 'default',
        title: 'Zebra Problem',
        description: '',
        starterCode: '',
        testCases: [],
        authorId: 'user-123',
        classId: undefined,
      };

      const input2: ProblemInput = {
        namespaceId: 'default',
        title: 'Apple Problem',
        description: '',
        starterCode: '',
        testCases: [],
        authorId: 'user-123',
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
        namespaceId: 'default',
        title: 'Original Title',
        description: 'Original description',
        starterCode: '',
        testCases: [],
        authorId: 'user-123',
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
        namespaceId: 'default',
        title: 'Original Title',
        description: '',
        starterCode: '',
        testCases: [],
        authorId: 'user-123',
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
        namespaceId: 'default',
        title: 'Test Problem',
        description: '',
        starterCode: '',
        testCases: [],
        authorId: 'user-123',
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
        namespaceId: 'default',
        title: 'Test Problem',
        description: '',
        starterCode: '',
        testCases: [],
        authorId: 'user-123',
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
        namespaceId: 'default',
        title: 'Two Sum Problem',
        description: 'Find two numbers that add up to target',
        starterCode: '',
        testCases: [],
        authorId: 'user-123',
        classId: undefined,
      });

      await repository.create({
        namespaceId: 'default',
        title: 'Three Sum Problem',
        description: 'Find three numbers that add up to zero',
        starterCode: '',
        testCases: [],
        authorId: 'user-123',
        classId: undefined,
      });

      await repository.create({
        namespaceId: 'default',
        title: 'Binary Search',
        description: 'Implement binary search algorithm',
        starterCode: '',
        testCases: [],
        authorId: 'user-456',
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
        namespaceId: 'default',
        title: 'Problem 1',
        description: '',
        starterCode: '',
        testCases: [],
        authorId: 'user-123',
        classId: undefined,
      });

      await repository.create({
        namespaceId: 'default',
        title: 'Problem 2',
        description: '',
        starterCode: '',
        testCases: [],
        authorId: 'user-456',
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
        namespaceId: 'default',
        title: 'Class Problem',
        description: '',
        starterCode: '',
        testCases: [],
        authorId: 'user-123',
        classId: 'class-1',
      });

      await repository.create({
        namespaceId: 'default',
        title: 'Other Problem',
        description: '',
        starterCode: '',
        testCases: [],
        authorId: 'user-123',
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
        namespaceId: 'default',
        title: 'Original Problem',
        description: 'Original description',
        starterCode: 'original code',
        testCases: [],
        authorId: 'user-123',
        classId: 'class-1',
      });

      const duplicate = await repository.duplicate(original.id, 'Duplicate Problem');

      expect(duplicate.id).not.toBe(original.id);
      expect(duplicate.title).toBe('Duplicate Problem');
      expect(duplicate.description).toBe('Original description');
      expect(duplicate.starterCode).toBe('original code');
      expect(duplicate.authorId).toBe('user-123');
      expect(duplicate.classId).toBe('class-1');
    });

    it('should throw error for non-existent problem', async () => {
      await expect(
        repository.duplicate('non-existent-id', 'New Title')
      ).rejects.toThrow('not found');
    });
  });

  describe('namespace filtering', () => {
    it('should filter problems by namespace in getAll()', async () => {
      // Create problems in different namespaces
      const input1: ProblemInput = {
        namespaceId: 'namespace-a',
        title: 'Problem in Namespace A',
        description: 'Test',
        starterCode: '',
        testCases: [],
        authorId: 'user-123',
        classId: undefined,
      };

      const input2: ProblemInput = {
        namespaceId: 'namespace-b',
        title: 'Problem in Namespace B',
        description: 'Test',
        starterCode: '',
        testCases: [],
        authorId: 'user-123',
        classId: undefined,
      };

      const input3: ProblemInput = {
        namespaceId: 'namespace-a',
        title: 'Another Problem in Namespace A',
        description: 'Test',
        starterCode: '',
        testCases: [],
        authorId: 'user-456',
        classId: undefined,
      };

      await repository.create(input1);
      await repository.create(input2);
      await repository.create(input3);

      // Get all problems (no filter) - should return all 3
      const allProblems = await repository.getAll();
      expect(allProblems).toHaveLength(3);

      // Filter by namespace-a - should return 2
      const namespaceAProblems = await repository.getAll(undefined, 'namespace-a');
      expect(namespaceAProblems).toHaveLength(2);
      expect(namespaceAProblems.every(p => p.title.includes('Namespace A'))).toBe(true);

      // Filter by namespace-b - should return 1
      const namespaceBProblems = await repository.getAll(undefined, 'namespace-b');
      expect(namespaceBProblems).toHaveLength(1);
      expect(namespaceBProblems[0].title).toBe('Problem in Namespace B');

      // Filter by non-existent namespace - should return 0
      const emptyProblems = await repository.getAll(undefined, 'non-existent');
      expect(emptyProblems).toHaveLength(0);
    });

    it('should filter problems by namespace in search()', async () => {
      const input1: ProblemInput = {
        namespaceId: 'namespace-a',
        title: 'Search Test Problem A',
        description: 'Test',
        starterCode: '',
        testCases: [],
        authorId: 'user-123',
        classId: undefined,
      };

      const input2: ProblemInput = {
        namespaceId: 'namespace-b',
        title: 'Search Test Problem B',
        description: 'Test',
        starterCode: '',
        testCases: [],
        authorId: 'user-123',
        classId: undefined,
      };

      await repository.create(input1);
      await repository.create(input2);

      // Search without namespace filter - should return 2
      const allResults = await repository.search('Search Test');
      expect(allResults).toHaveLength(2);

      // Search with namespace filter - should return 1 each
      const namespaceAResults = await repository.search('Search Test', undefined, 'namespace-a');
      expect(namespaceAResults).toHaveLength(1);
      expect(namespaceAResults[0].title).toContain('Problem A');

      const namespaceBResults = await repository.search('Search Test', undefined, 'namespace-b');
      expect(namespaceBResults).toHaveLength(1);
      expect(namespaceBResults[0].title).toContain('Problem B');
    });

    it('should filter problems by namespace in getByAuthor()', async () => {
      const input1: ProblemInput = {
        namespaceId: 'namespace-a',
        title: 'Problem 1',
        description: 'Test',
        starterCode: '',
        testCases: [],
        authorId: 'author-123',
        classId: undefined,
      };

      const input2: ProblemInput = {
        namespaceId: 'namespace-b',
        title: 'Problem 2',
        description: 'Test',
        starterCode: '',
        testCases: [],
        authorId: 'author-123',
        classId: undefined,
      };

      await repository.create(input1);
      await repository.create(input2);

      // Get all problems by author - should return 2
      const allAuthorProblems = await repository.getByAuthor('author-123');
      expect(allAuthorProblems).toHaveLength(2);

      // Filter by namespace - should return 1 each
      const namespaceAProblems = await repository.getByAuthor('author-123', undefined, 'namespace-a');
      expect(namespaceAProblems).toHaveLength(1);

      const namespaceBProblems = await repository.getByAuthor('author-123', undefined, 'namespace-b');
      expect(namespaceBProblems).toHaveLength(1);
    });

    it('should filter problems by namespace in getByClass()', async () => {
      const input1: ProblemInput = {
        namespaceId: 'namespace-a',
        title: 'Problem 1',
        description: 'Test',
        starterCode: '',
        testCases: [],
        authorId: 'user-123',
        classId: 'class-123',
      };

      const input2: ProblemInput = {
        namespaceId: 'namespace-b',
        title: 'Problem 2',
        description: 'Test',
        starterCode: '',
        testCases: [],
        authorId: 'user-123',
        classId: 'class-123',
      };

      await repository.create(input1);
      await repository.create(input2);

      // Get all problems by class - should return 2
      const allClassProblems = await repository.getByClass('class-123');
      expect(allClassProblems).toHaveLength(2);

      // Filter by namespace - should return 1 each
      const namespaceAProblems = await repository.getByClass('class-123', undefined, 'namespace-a');
      expect(namespaceAProblems).toHaveLength(1);

      const namespaceBProblems = await repository.getByClass('class-123', undefined, 'namespace-b');
      expect(namespaceBProblems).toHaveLength(1);
    });

    it('should combine namespace filter with other filters', async () => {
      const input1: ProblemInput = {
        namespaceId: 'namespace-a',
        title: 'Problem 1',
        description: 'Test',
        starterCode: '',
        testCases: [],
        authorId: 'author-123',
        classId: 'class-1',
      };

      const input2: ProblemInput = {
        namespaceId: 'namespace-a',
        title: 'Problem 2',
        description: 'Test',
        starterCode: '',
        testCases: [],
        authorId: 'author-456',
        classId: 'class-1',
      };

      const input3: ProblemInput = {
        namespaceId: 'namespace-b',
        title: 'Problem 3',
        description: 'Test',
        starterCode: '',
        testCases: [],
        authorId: 'author-123',
        classId: 'class-1',
      };

      await repository.create(input1);
      await repository.create(input2);
      await repository.create(input3);

      // Get all problems by author and namespace
      const results = await repository.getByAuthor('author-123', undefined, 'namespace-a');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Problem 1');

      // Get all problems by class and namespace
      const classResults = await repository.getByClass('class-1', undefined, 'namespace-a');
      expect(classResults).toHaveLength(2);

      const classBResults = await repository.getByClass('class-1', undefined, 'namespace-b');
      expect(classBResults).toHaveLength(1);
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
