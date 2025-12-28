/**
 * Shared utilities for local file-based storage
 * 
 * Provides common functions for file I/O, JSON serialization, and metadata management.
 */

import fs from 'fs/promises';
import {
  StorageMetadata,
  PersistenceError,
  PersistenceErrorCode,
} from '../types';

/**
 * Simple in-memory lock manager to prevent concurrent file writes
 */
class FileLockManager {
  private locks: Map<string, Promise<void>> = new Map();

  async withLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
    // Wait for any existing lock on this file
    const existingLock = this.locks.get(filePath);
    if (existingLock) {
      await existingLock;
    }

    // Create a new lock for this operation
    let releaseLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    this.locks.set(filePath, lockPromise);

    try {
      return await fn();
    } finally {
      // Release the lock
      releaseLock!();
      // Clean up if this was the current lock
      if (this.locks.get(filePath) === lockPromise) {
        this.locks.delete(filePath);
      }
    }
  }
}

const fileLockManager = new FileLockManager();

/**
 * Helper to create storage metadata
 */
export function createMetadata(existing?: StorageMetadata): StorageMetadata {
  const now = new Date();
  return {
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    version: (existing?.version || 0) + 1,
  };
}

/**
 * Helper to ensure directory exists
 */
export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    throw new PersistenceError(
      `Failed to create directory: ${dirPath}`,
      PersistenceErrorCode.STORAGE_ERROR,
      error
    );
  }
}

/**
 * Helper for atomic file writes (write to temp, then rename)
 * Protected by file-level locking to prevent concurrent write conflicts
 */
export async function atomicWrite(filePath: string, data: string): Promise<void> {
  return fileLockManager.withLock(filePath, async () => {
    // Use unique temp file for each write operation
    const tempPath = `${filePath}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).substring(7)}`;
    try {
      await fs.writeFile(tempPath, data, 'utf-8');
      await fs.rename(tempPath, filePath);
    } catch (error) {
      // Clean up temp file if it exists
      try {
        await fs.unlink(tempPath);
      } catch {}
      throw new PersistenceError(
        `Failed to write file: ${filePath}`,
        PersistenceErrorCode.STORAGE_ERROR,
        error
      );
    }
  });
}

/**
 * Helper to read JSON file safely
 */
export async function readJsonFile<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data, (key, value) => {
      // Revive Date objects
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
        return new Date(value);
      }
      // Revive Map objects (serialized as {__type: 'Map', entries: [[k,v], ...]})
      if (value && typeof value === 'object' && value.__type === 'Map') {
        return new Map(value.entries);
      }
      return value;
    });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return default
      return defaultValue;
    }
    throw new PersistenceError(
      `Failed to read file: ${filePath}`,
      PersistenceErrorCode.STORAGE_ERROR,
      error
    );
  }
}

/**
 * Helper to write JSON file safely with atomic write
 * Includes custom serialization for Map objects
 */
export async function writeJsonFile(filePath: string, data: any): Promise<void> {
  const jsonData = JSON.stringify(data, (key, value) => {
    // Serialize Map objects
    if (value instanceof Map) {
      return {
        __type: 'Map',
        entries: Array.from(value.entries()),
      };
    }
    return value;
  }, 2);
  await atomicWrite(filePath, jsonData);
}
