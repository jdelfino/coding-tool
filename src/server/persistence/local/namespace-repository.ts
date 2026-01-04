/**
 * Local file-based namespace repository implementation
 */

import path from 'path';
import { Namespace } from '../../auth/types';
import { INamespaceRepository } from '../../auth/interfaces';
import { StorageConfig } from '../types';
import { ensureDir, readJsonFile, writeJsonFile } from './utils';

/**
 * Validates a namespace ID format.
 * Must be 3-32 characters, lowercase, alphanumeric, and hyphens only.
 *
 * @param id - Namespace ID to validate
 * @returns True if valid, false otherwise
 */
export function isValidNamespaceId(id: string): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }

  // Check length
  if (id.length < 3 || id.length > 32) {
    return false;
  }

  // Check format: lowercase alphanumeric and hyphens only
  const validPattern = /^[a-z0-9-]+$/;
  if (!validPattern.test(id)) {
    return false;
  }

  // Cannot start or end with hyphen
  if (id.startsWith('-') || id.endsWith('-')) {
    return false;
  }

  // Cannot have consecutive hyphens
  if (id.includes('--')) {
    return false;
  }

  return true;
}

/**
 * Local file-based namespace repository implementation
 */
export class LocalNamespaceRepository implements INamespaceRepository {
  private readonly filePath: string;
  private readonly namespaces: Map<string, Namespace> = new Map();
  private initialized = false;

  constructor(private readonly config: StorageConfig) {
    const baseDir = config.baseDir || './data';
    this.filePath = path.join(baseDir, 'namespaces.json');
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const baseDir = this.config.baseDir || './data';
    await ensureDir(baseDir);

    await this.reloadFromDisk();

    this.initialized = true;
  }

  /**
   * Reload namespaces from disk (for cross-process consistency)
   */
  private async reloadFromDisk(): Promise<void> {
    const namespaceData = await readJsonFile<Record<string, Namespace>>(
      this.filePath,
      {}
    );

    this.namespaces.clear();
    for (const [id, namespace] of Object.entries(namespaceData)) {
      // Convert date strings back to Date objects
      const ns: Namespace = {
        ...namespace,
        createdAt: new Date(namespace.createdAt),
        updatedAt: new Date(namespace.updatedAt),
      };
      this.namespaces.set(id, ns);
    }
  }

  async shutdown(): Promise<void> {
    if (this.initialized) {
      await this.flush();
    }
    this.namespaces.clear();
    this.initialized = false;
  }

  async health(): Promise<boolean> {
    try {
      const baseDir = this.config.baseDir || './data';
      const fs = await import('fs/promises');
      await fs.access(baseDir);
      return true;
    } catch {
      return false;
    }
  }

  private async flush(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Repository not initialized');
    }

    // Convert Map to object for JSON serialization
    const namespaceData: Record<string, Namespace> = {};
    for (const [id, namespace] of this.namespaces.entries()) {
      namespaceData[id] = namespace;
    }

    await writeJsonFile(this.filePath, namespaceData);
  }

  async createNamespace(namespace: Namespace): Promise<Namespace> {
    if (!isValidNamespaceId(namespace.id)) {
      throw new Error(
        `Invalid namespace ID: ${namespace.id}. Must be 3-32 characters, lowercase, alphanumeric, and hyphens only.`
      );
    }

    // Reload to ensure we have latest data
    await this.reloadFromDisk();

    if (this.namespaces.has(namespace.id)) {
      throw new Error(`Namespace already exists: ${namespace.id}`);
    }

    // Ensure dates are set
    const now = new Date();
    const ns: Namespace = {
      ...namespace,
      createdAt: namespace.createdAt || now,
      updatedAt: namespace.updatedAt || now,
      active: namespace.active !== undefined ? namespace.active : true,
    };

    this.namespaces.set(ns.id, ns);
    await this.flush();

    return ns;
  }

  async getNamespace(id: string): Promise<Namespace | null> {
    // Reload from disk to get latest data from other processes
    await this.reloadFromDisk();
    return this.namespaces.get(id) || null;
  }

  async listNamespaces(includeInactive: boolean = false): Promise<Namespace[]> {
    // Reload from disk to get latest data
    await this.reloadFromDisk();

    const namespaces = Array.from(this.namespaces.values());

    if (!includeInactive) {
      return namespaces.filter((ns) => ns.active);
    }

    return namespaces;
  }

  async updateNamespace(id: string, updates: Partial<Namespace>): Promise<void> {
    // Reload to ensure we have latest data
    await this.reloadFromDisk();

    const existing = this.namespaces.get(id);
    if (!existing) {
      throw new Error(`Namespace not found: ${id}`);
    }

    // Prevent changing the ID
    if (updates.id && updates.id !== id) {
      throw new Error('Cannot change namespace ID');
    }

    // Update the namespace
    const updated: Namespace = {
      ...existing,
      ...updates,
      id, // Ensure ID doesn't change
      createdAt: existing.createdAt, // Preserve creation date
      updatedAt: new Date(), // Update modification date
    };

    this.namespaces.set(id, updated);
    await this.flush();
  }

  async deleteNamespace(id: string): Promise<void> {
    // Reload to ensure we have latest data
    await this.reloadFromDisk();

    const existing = this.namespaces.get(id);
    if (!existing) {
      throw new Error(`Namespace not found: ${id}`);
    }

    // Soft delete: set active to false
    const updated: Namespace = {
      ...existing,
      active: false,
      updatedAt: new Date(),
    };

    this.namespaces.set(id, updated);
    await this.flush();
  }

  async namespaceExists(id: string): Promise<boolean> {
    // Reload from disk to get latest data
    await this.reloadFromDisk();
    return this.namespaces.has(id);
  }
}
