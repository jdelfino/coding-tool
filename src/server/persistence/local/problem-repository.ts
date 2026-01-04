/**
 * Local file-based problem repository
 *
 * Stores problems as individual JSON files with an index for fast queries.
 * Designed for single-server deployment with future migration path to database.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import {
  Problem,
  ProblemMetadata,
  ProblemFilter,
  ProblemInput,
} from '../../types/problem';
import {
  serializeProblem,
  deserializeProblem,
  validateProblemSchema,
} from '../problem-schema';
import { IProblemRepository } from '../interfaces';
import { PersistenceError, PersistenceErrorCode } from '../types';

interface ProblemIndex {
  problems: ProblemMetadata[];
  lastUpdated: string;
}

/**
 * Local JSON file-based problem repository
 */
export class LocalProblemRepository implements IProblemRepository {
  private baseDir: string;
  private problemsDir: string;
  private indexPath: string;
  private initialized = false;

  constructor(baseDir: string = './data') {
    this.baseDir = baseDir;
    this.problemsDir = path.join(baseDir, 'problems');
    this.indexPath = path.join(this.problemsDir, 'index.json');
  }

  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.problemsDir, { recursive: true });

      // Create index if it doesn't exist
      try {
        await fs.access(this.indexPath);
      } catch {
        await this.saveIndex({ problems: [], lastUpdated: new Date().toISOString() });
      }

      this.initialized = true;
    } catch (error) {
      throw new PersistenceError(
        'Failed to initialize problem repository',
        PersistenceErrorCode.STORAGE_ERROR,
        error
      );
    }
  }

  async shutdown(): Promise<void> {
    this.initialized = false;
  }

  async health(): Promise<boolean> {
    try {
      await fs.access(this.problemsDir);
      await fs.access(this.indexPath);
      return true;
    } catch {
      return false;
    }
  }

  async create(problemInput: ProblemInput): Promise<Problem> {
    this.ensureInitialized();

    const problem: Problem = {
      ...problemInput,
      id: randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Validate
    const errors = validateProblemSchema(problem);
    if (errors.length > 0) {
      throw new PersistenceError(
        `Validation failed: ${errors.map(e => e.message).join(', ')}`,
        PersistenceErrorCode.INVALID_DATA,
        { errors }
      );
    }

    // Save to file
    await this.saveProblemFile(problem);

    // Update index
    await this.updateIndex(problem);

    return problem;
  }

  async getById(id: string): Promise<Problem | null> {
    this.ensureInitialized();

    try {
      const filePath = this.getProblemFilePath(id);
      const content = await fs.readFile(filePath, 'utf-8');
      const schema = JSON.parse(content);
      return deserializeProblem(schema);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw new PersistenceError(
        `Failed to read problem ${id}`,
        PersistenceErrorCode.STORAGE_ERROR,
        error
      );
    }
  }

  async getAll(filter?: ProblemFilter, namespaceId?: string): Promise<ProblemMetadata[]> {
    this.ensureInitialized();

    const index = await this.loadIndex();
    let problems = index.problems;

    // Apply namespace filter first
    if (namespaceId) {
      problems = problems.filter(p => {
        // Note: We need to load the full problem to check namespaceId
        // For now, we'll filter after loading. TODO: Add namespaceId to metadata
        return true; // Will be filtered in applyFilters
      });
    }

    // Apply filters
    if (filter || namespaceId) {
      problems = await this.applyFilters(problems, filter, namespaceId);
    }

    // Apply sorting
    if (filter?.sortBy) {
      problems = this.sortProblems(problems, filter.sortBy, filter.sortOrder || 'asc');
    }

    return problems;
  }

  async update(id: string, updates: Partial<Problem>): Promise<Problem> {
    this.ensureInitialized();

    const existing = await this.getById(id);
    if (!existing) {
      throw new PersistenceError(
        `Problem ${id} not found`,
        PersistenceErrorCode.NOT_FOUND
      );
    }

    const updated: Problem = {
      ...existing,
      ...updates,
      id: existing.id, // Prevent ID change
      createdAt: existing.createdAt, // Prevent createdAt change
      updatedAt: new Date(),
    };

    // Validate
    const errors = validateProblemSchema(updated);
    if (errors.length > 0) {
      throw new PersistenceError(
        `Validation failed: ${errors.map(e => e.message).join(', ')}`,
        PersistenceErrorCode.INVALID_DATA,
        { errors }
      );
    }

    // Save updated problem
    await this.saveProblemFile(updated);

    // Update index
    await this.updateIndex(updated);

    return updated;
  }

  async delete(id: string): Promise<void> {
    this.ensureInitialized();

    const existing = await this.getById(id);
    if (!existing) {
      throw new PersistenceError(
        `Problem ${id} not found`,
        PersistenceErrorCode.NOT_FOUND
      );
    }

    // Delete file
    const filePath = this.getProblemFilePath(id);
    await fs.unlink(filePath);

    // Remove from index
    await this.removeFromIndex(id);
  }

  async search(query: string, filter?: ProblemFilter, namespaceId?: string): Promise<ProblemMetadata[]> {
    this.ensureInitialized();

    const allProblems = await this.getAll(filter, namespaceId);

    if (!query || query.trim().length === 0) {
      return allProblems;
    }

    const searchTerms = query.toLowerCase().split(/\s+/);

    return allProblems.filter(problem => {
      const searchText = `${problem.title} ${problem.id}`.toLowerCase();
      return searchTerms.every(term => searchText.includes(term));
    });
  }

  async getByAuthor(authorId: string, filter?: ProblemFilter, namespaceId?: string): Promise<ProblemMetadata[]> {
    return this.getAll({ ...filter, authorId }, namespaceId);
  }

  async getByClass(classId: string, filter?: ProblemFilter, namespaceId?: string): Promise<ProblemMetadata[]> {
    return this.getAll({ ...filter, classId }, namespaceId);
  }

  async duplicate(id: string, newTitle: string): Promise<Problem> {
    this.ensureInitialized();

    const original = await this.getById(id);
    if (!original) {
      throw new PersistenceError(
        `Problem ${id} not found`,
        PersistenceErrorCode.NOT_FOUND
      );
    }

    const duplicate: ProblemInput = {
      namespaceId: original.namespaceId,
      title: newTitle,
      description: original.description,
      starterCode: original.starterCode,
      testCases: original.testCases,
      authorId: original.authorId,
      classId: original.classId,
    };

    return this.create(duplicate);
  }

  // Private helper methods

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new PersistenceError(
        'Repository not initialized',
        PersistenceErrorCode.UNAVAILABLE
      );
    }
  }

  private getProblemFilePath(id: string): string {
    return path.join(this.problemsDir, `${id}.json`);
  }

  private async saveProblemFile(problem: Problem): Promise<void> {
    const filePath = this.getProblemFilePath(problem.id);
    const tempPath = `${filePath}.tmp`;

    try {
      const schema = serializeProblem(problem);
      await fs.writeFile(tempPath, JSON.stringify(schema, null, 2), 'utf-8');
      await fs.rename(tempPath, filePath);
    } catch (error) {
      // Cleanup temp file if it exists
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw new PersistenceError(
        `Failed to save problem ${problem.id}`,
        PersistenceErrorCode.STORAGE_ERROR,
        error
      );
    }
  }

  private async loadIndex(): Promise<ProblemIndex> {
    try {
      const content = await fs.readFile(this.indexPath, 'utf-8');
      return JSON.parse(content, (key, value) => {
        // Revive dates
        if (key === 'createdAt') {
          return new Date(value);
        }
        return value;
      });
    } catch (error) {
      throw new PersistenceError(
        'Failed to load problem index',
        PersistenceErrorCode.STORAGE_ERROR,
        error
      );
    }
  }

  private async saveIndex(index: ProblemIndex): Promise<void> {
    const tempPath = `${this.indexPath}.tmp`;

    try {
      await fs.writeFile(tempPath, JSON.stringify(index, null, 2), 'utf-8');
      await fs.rename(tempPath, this.indexPath);
    } catch (error) {
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw new PersistenceError(
        'Failed to save problem index',
        PersistenceErrorCode.STORAGE_ERROR,
        error
      );
    }
  }

  private async updateIndex(problem: Problem): Promise<void> {
    const index = await this.loadIndex();

    const metadata: ProblemMetadata = {
      id: problem.id,
      title: problem.title,
      testCaseCount: problem.testCases?.length || 0,
      createdAt: problem.createdAt,
      authorName: problem.authorId, // TODO: Resolve actual author name
      classId: problem.classId,
    };

    // Remove existing entry if present
    index.problems = index.problems.filter(p => p.id !== problem.id);

    // Add new entry
    index.problems.push(metadata);
    index.lastUpdated = new Date().toISOString();

    await this.saveIndex(index);
  }

  private async removeFromIndex(id: string): Promise<void> {
    const index = await this.loadIndex();
    index.problems = index.problems.filter(p => p.id !== id);
    index.lastUpdated = new Date().toISOString();
    await this.saveIndex(index);
  }

  private async applyFilters(problems: ProblemMetadata[], filter?: ProblemFilter, namespaceId?: string): Promise<ProblemMetadata[]> {
    let filtered = problems;

    // Apply namespace filter by loading full problems
    if (namespaceId) {
      const namespacedProblems: ProblemMetadata[] = [];
      for (const metadata of filtered) {
        const problem = await this.getById(metadata.id);
        if (problem && problem.namespaceId === namespaceId) {
          namespacedProblems.push(metadata);
        }
      }
      filtered = namespacedProblems;
    }

    if (!filter) {
      return filtered;
    }

    if (filter.authorId) {
      filtered = filtered.filter(p => p.authorName === filter.authorId);
    }

    if (filter.classId) {
      filtered = filtered.filter(p => p.classId === filter.classId);
    }

    return filtered;
  }

  private sortProblems(
    problems: ProblemMetadata[],
    sortBy: 'title' | 'created' | 'updated',
    order: 'asc' | 'desc'
  ): ProblemMetadata[] {
    const sorted = [...problems].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'created':
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
          break;
        case 'updated':
          // For now, use createdAt as we don't store updatedAt in metadata
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
          break;
      }

      return order === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }
}
