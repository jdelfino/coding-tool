/**
 * Local file-based problem repository implementation
 */

import fs from 'fs/promises';
import path from 'path';
import { IProblemRepository } from '../interfaces';
import {
  StorageConfig,
  ProblemSpec,
  StoredProblem,
  PersistenceError,
  PersistenceErrorCode,
} from '../types';
import { createMetadata, ensureDir, readJsonFile, writeJsonFile } from './utils';

/**
 * Local file-based problem repository implementation
 */
export class LocalProblemRepository implements IProblemRepository {
  private readonly filePath: string;
  private readonly cache: Map<string, StoredProblem> = new Map();
  private initialized = false;

  constructor(private readonly config: StorageConfig) {
    const baseDir = config.baseDir || './data';
    this.filePath = path.join(baseDir, 'problems.json');
  }

  async initialize(): Promise<void> {
    const baseDir = this.config.baseDir || './data';
    await ensureDir(baseDir);
    
    await this.reloadFromDisk();
    
    this.initialized = true;
  }

  /**
   * Reload problems from disk (for cross-process consistency)
   */
  private async reloadFromDisk(): Promise<void> {
    const problems = await readJsonFile<Record<string, StoredProblem>>(
      this.filePath,
      {}
    );
    
    this.cache.clear();
    for (const [id, problem] of Object.entries(problems)) {
      this.cache.set(id, problem);
    }
  }

  async shutdown(): Promise<void> {
    await this.flush();
    this.cache.clear();
    this.initialized = false;
  }

  async health(): Promise<boolean> {
    try {
      const baseDir = this.config.baseDir || './data';
      await fs.access(baseDir);
      return true;
    } catch {
      return false;
    }
  }

  private async flush(): Promise<void> {
    const problems: Record<string, StoredProblem> = {};
    for (const [id, problem] of this.cache.entries()) {
      problems[id] = problem;
    }
    await writeJsonFile(this.filePath, problems);
  }

  async saveProblem(problem: ProblemSpec): Promise<string> {
    const stored: StoredProblem = {
      ...problem,
      _metadata: createMetadata(this.cache.get(problem.id)?._metadata),
    };
    
    this.cache.set(problem.id, stored);
    await this.flush();
    
    return problem.id;
  }

  async getProblem(problemId: string): Promise<StoredProblem | null> {
    // Reload from disk to get latest data from other processes
    await this.reloadFromDisk();
    return this.cache.get(problemId) || null;
  }

  async updateProblem(problemId: string, updates: Partial<ProblemSpec>): Promise<void> {
    const existing = this.cache.get(problemId);
    if (!existing) {
      throw new PersistenceError(
        `Problem not found: ${problemId}`,
        PersistenceErrorCode.NOT_FOUND
      );
    }
    
    const updated: StoredProblem = {
      ...existing,
      ...updates,
      id: problemId,
      _metadata: createMetadata(existing._metadata),
    };
    
    this.cache.set(problemId, updated);
    await this.flush();
  }

  async deleteProblem(problemId: string): Promise<void> {
    if (!this.cache.has(problemId)) {
      throw new PersistenceError(
        `Problem not found: ${problemId}`,
        PersistenceErrorCode.NOT_FOUND
      );
    }
    
    this.cache.delete(problemId);
    await this.flush();
  }

  async listProblems(filters?: {
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    tags?: string[];
    createdBy?: string;
    limit?: number;
    offset?: number;
  }): Promise<StoredProblem[]> {
    let problems = Array.from(this.cache.values());
    
    // Apply filters
    if (filters?.difficulty) {
      problems = problems.filter(p => p.difficulty === filters.difficulty);
    }
    if (filters?.tags && filters.tags.length > 0) {
      problems = problems.filter(p => 
        p.tags?.some(tag => filters.tags!.includes(tag))
      );
    }
    if (filters?.createdBy) {
      problems = problems.filter(p => p.createdBy === filters.createdBy);
    }
    
    // Apply pagination
    if (filters?.offset) {
      problems = problems.slice(filters.offset);
    }
    if (filters?.limit) {
      problems = problems.slice(0, filters.limit);
    }
    
    return problems;
  }

  async searchProblems(query: string, limit?: number): Promise<StoredProblem[]> {
    const lowerQuery = query.toLowerCase();
    let problems = Array.from(this.cache.values()).filter(p =>
      p.title.toLowerCase().includes(lowerQuery) ||
      p.description.toLowerCase().includes(lowerQuery)
    );
    
    if (limit) {
      problems = problems.slice(0, limit);
    }
    
    return problems;
  }
}
