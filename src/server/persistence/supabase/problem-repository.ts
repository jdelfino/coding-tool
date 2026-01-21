/**
 * Supabase-backed problem repository implementation
 *
 * Implements problem CRUD operations using Supabase as the storage backend.
 * Problems are stored in the problems table with JSONB for execution_settings.
 *
 * Supports RLS-backed access control when accessToken is provided.
 */

import { IProblemRepository } from '../interfaces';
import { Problem, ProblemMetadata, ProblemFilter, ProblemInput } from '../../types/problem';
import { getSupabaseClientWithAuth } from '../../supabase/client';

/**
 * Maps a database row to a Problem domain object
 */
function mapRowToProblem(row: any): Problem {
  return {
    id: row.id,
    namespaceId: row.namespace_id,
    title: row.title,
    description: row.description || undefined,
    starterCode: row.starter_code || undefined,
    testCases: row.test_cases || undefined,
    executionSettings: row.execution_settings || undefined,
    authorId: row.author_id,
    classId: row.class_id || undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Maps a database row to lightweight ProblemMetadata
 */
function mapRowToProblemMetadata(row: any): ProblemMetadata {
  return {
    id: row.id,
    namespaceId: row.namespace_id,
    title: row.title,
    testCaseCount: row.test_cases?.length || 0,
    createdAt: new Date(row.created_at),
    authorName: row.author_name || row.author_id,
    classId: row.class_id || undefined,
  };
}

/**
 * Supabase implementation of IProblemRepository
 */
export class SupabaseProblemRepository implements IProblemRepository {
  private initialized = false;
  private readonly accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Test connection
    const supabase = getSupabaseClientWithAuth(this.accessToken);
    const { error } = await supabase.from('problems').select('id').limit(1);

    if (error) {
      throw new Error(`Failed to initialize ProblemRepository: ${error.message}`);
    }

    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    // No cleanup needed for Supabase client
    this.initialized = false;
  }

  async health(): Promise<boolean> {
    try {
      const supabase = getSupabaseClientWithAuth(this.accessToken);
      const { error } = await supabase.from('problems').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  async create(problem: ProblemInput): Promise<Problem> {
    const supabase = getSupabaseClientWithAuth(this.accessToken);

    const now = new Date();
    const id = crypto.randomUUID();

    const problemData = {
      id,
      namespace_id: problem.namespaceId,
      title: problem.title,
      description: problem.description || null,
      starter_code: problem.starterCode || null,
      test_cases: (problem.testCases as any) || null,
      execution_settings: (problem.executionSettings as any) || null,
      author_id: problem.authorId,
      class_id: problem.classId || null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    const { data, error } = await supabase
      .from('problems')
      .insert(problemData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create problem: ${error.message}`);
    }

    return mapRowToProblem(data);
  }

  async getById(id: string, namespaceId?: string): Promise<Problem | null> {
    const supabase = getSupabaseClientWithAuth(this.accessToken);

    let query = supabase.from('problems').select('*').eq('id', id);

    if (namespaceId) {
      query = query.eq('namespace_id', namespaceId);
    }

    const { data, error } = await query.single();

    if (error) {
      // Not found is expected, other errors are not
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get problem: ${error.message}`);
    }

    return data ? mapRowToProblem(data) : null;
  }

  async getAll(filter?: ProblemFilter, namespaceId?: string): Promise<ProblemMetadata[]> {
    const supabase = getSupabaseClientWithAuth(this.accessToken);

    // Select fields for metadata plus test_cases for count
    let query = supabase.from('problems').select('id, namespace_id, title, test_cases, created_at, author_id, class_id');

    // Apply namespace filter
    if (namespaceId) {
      query = query.eq('namespace_id', namespaceId);
    } else if (filter?.namespaceId) {
      query = query.eq('namespace_id', filter.namespaceId);
    }

    // Apply other filters
    if (filter?.authorId) {
      query = query.eq('author_id', filter.authorId);
    }

    if (filter?.classId) {
      query = query.eq('class_id', filter.classId);
    }

    // Apply sorting
    if (filter?.sortBy) {
      const sortColumn =
        filter.sortBy === 'title'
          ? 'title'
          : filter.sortBy === 'created'
            ? 'created_at'
            : 'updated_at';
      const sortOrder = filter.sortOrder === 'desc' ? { ascending: false } : { ascending: true };
      query = query.order(sortColumn, sortOrder);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get problems: ${error.message}`);
    }

    return data ? data.map((row) => mapRowToProblemMetadata({ ...row, author_name: row.author_id })) : [];
  }

  async update(id: string, updates: Partial<Problem>): Promise<Problem> {
    const supabase = getSupabaseClientWithAuth(this.accessToken);

    // Map domain fields to database columns
    const dbUpdates: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.starterCode !== undefined) dbUpdates.starter_code = updates.starterCode;
    if (updates.testCases !== undefined) dbUpdates.test_cases = updates.testCases;
    if (updates.executionSettings !== undefined) dbUpdates.execution_settings = updates.executionSettings;
    if (updates.classId !== undefined) dbUpdates.class_id = updates.classId;
    if (updates.namespaceId !== undefined) dbUpdates.namespace_id = updates.namespaceId;
    if (updates.authorId !== undefined) dbUpdates.author_id = updates.authorId;

    const { data, error } = await supabase
      .from('problems')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error(`Problem not found: ${id}`);
      }
      throw new Error(`Failed to update problem: ${error.message}`);
    }

    return mapRowToProblem(data);
  }

  async delete(id: string): Promise<void> {
    const supabase = getSupabaseClientWithAuth(this.accessToken);

    const { error } = await supabase.from('problems').delete().eq('id', id);

    if (error) {
      throw new Error(`Failed to delete problem: ${error.message}`);
    }
  }

  async search(query: string, filter?: ProblemFilter, namespaceId?: string): Promise<ProblemMetadata[]> {
    const supabase = getSupabaseClientWithAuth(this.accessToken);

    // Build query with ilike search on title and description
    let dbQuery = supabase
      .from('problems')
      .select('id, namespace_id, title, test_cases, created_at, author_id, class_id')
      .or(`title.ilike.%${query}%,description.ilike.%${query}%`);

    // Apply namespace filter
    if (namespaceId) {
      dbQuery = dbQuery.eq('namespace_id', namespaceId);
    } else if (filter?.namespaceId) {
      dbQuery = dbQuery.eq('namespace_id', filter.namespaceId);
    }

    // Apply other filters
    if (filter?.authorId) {
      dbQuery = dbQuery.eq('author_id', filter.authorId);
    }

    if (filter?.classId) {
      dbQuery = dbQuery.eq('class_id', filter.classId);
    }

    // Apply sorting
    if (filter?.sortBy) {
      const sortColumn =
        filter.sortBy === 'title'
          ? 'title'
          : filter.sortBy === 'created'
            ? 'created_at'
            : 'updated_at';
      const sortOrder = filter.sortOrder === 'desc' ? { ascending: false } : { ascending: true };
      dbQuery = dbQuery.order(sortColumn, sortOrder);
    }

    const { data, error } = await dbQuery;

    if (error) {
      throw new Error(`Failed to search problems: ${error.message}`);
    }

    return data ? data.map((row) => mapRowToProblemMetadata({ ...row, author_name: row.author_id })) : [];
  }

  async getByAuthor(authorId: string, filter?: ProblemFilter, namespaceId?: string): Promise<ProblemMetadata[]> {
    const supabase = getSupabaseClientWithAuth(this.accessToken);

    let query = supabase
      .from('problems')
      .select('id, namespace_id, title, test_cases, created_at, author_id, class_id')
      .eq('author_id', authorId);

    // Apply namespace filter
    if (namespaceId) {
      query = query.eq('namespace_id', namespaceId);
    } else if (filter?.namespaceId) {
      query = query.eq('namespace_id', filter.namespaceId);
    }

    // Apply other filters
    if (filter?.classId) {
      query = query.eq('class_id', filter.classId);
    }

    // Apply sorting
    if (filter?.sortBy) {
      const sortColumn =
        filter.sortBy === 'title'
          ? 'title'
          : filter.sortBy === 'created'
            ? 'created_at'
            : 'updated_at';
      const sortOrder = filter.sortOrder === 'desc' ? { ascending: false } : { ascending: true };
      query = query.order(sortColumn, sortOrder);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get problems by author: ${error.message}`);
    }

    return data ? data.map((row) => mapRowToProblemMetadata({ ...row, author_name: row.author_id })) : [];
  }

  async getByClass(classId: string, filter?: ProblemFilter, namespaceId?: string): Promise<ProblemMetadata[]> {
    const supabase = getSupabaseClientWithAuth(this.accessToken);

    let query = supabase
      .from('problems')
      .select('id, namespace_id, title, test_cases, created_at, author_id, class_id')
      .eq('class_id', classId);

    // Apply namespace filter
    if (namespaceId) {
      query = query.eq('namespace_id', namespaceId);
    } else if (filter?.namespaceId) {
      query = query.eq('namespace_id', filter.namespaceId);
    }

    // Apply other filters
    if (filter?.authorId) {
      query = query.eq('author_id', filter.authorId);
    }

    // Apply sorting
    if (filter?.sortBy) {
      const sortColumn =
        filter.sortBy === 'title'
          ? 'title'
          : filter.sortBy === 'created'
            ? 'created_at'
            : 'updated_at';
      const sortOrder = filter.sortOrder === 'desc' ? { ascending: false } : { ascending: true };
      query = query.order(sortColumn, sortOrder);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get problems by class: ${error.message}`);
    }

    return data ? data.map((row) => mapRowToProblemMetadata({ ...row, author_name: row.author_id })) : [];
  }

  async duplicate(id: string, newTitle: string): Promise<Problem> {
    // First, get the original problem
    const original = await this.getById(id);

    if (!original) {
      throw new Error(`Problem not found: ${id}`);
    }

    // Create a copy with new title and ID
    const problemInput: ProblemInput = {
      namespaceId: original.namespaceId,
      title: newTitle,
      description: original.description,
      starterCode: original.starterCode,
      testCases: original.testCases,
      executionSettings: original.executionSettings,
      authorId: original.authorId,
      classId: original.classId,
    };

    return this.create(problemInput);
  }
}
