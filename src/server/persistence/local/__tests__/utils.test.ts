/**
 * Tests for local storage utilities
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { atomicWrite, readJsonFile, writeJsonFile } from '../utils';

describe('atomicWrite', () => {
  let tempDir: string;
  let testFile: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'utils-test-'));
    testFile = path.join(tempDir, 'test.json');
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should write data atomically', async () => {
    const data = JSON.stringify({ test: 'value' });
    await atomicWrite(testFile, data);

    const content = await fs.readFile(testFile, 'utf-8');
    expect(content).toBe(data);
  });

  it('should handle concurrent writes without race conditions', async () => {
    // Simulate multiple concurrent writes (like multiple students disconnecting)
    const writes = Array.from({ length: 10 }, (_, i) =>
      atomicWrite(testFile, JSON.stringify({ write: i, timestamp: Date.now() }))
    );

    // All writes should complete without errors
    try {
      await Promise.all(writes);
    } catch (error) {
      console.error('Concurrent write error:', error);
      throw error;
    }

    // File should exist and be readable
    const content = await fs.readFile(testFile, 'utf-8');
    const parsed = JSON.parse(content);
    
    // Should have a valid write number
    expect(parsed).toHaveProperty('write');
    expect(typeof parsed.write).toBe('number');
    expect(parsed.write).toBeGreaterThanOrEqual(0);
    expect(parsed.write).toBeLessThan(10);
  });

  it('should not leave temp files after successful write', async () => {
    await atomicWrite(testFile, JSON.stringify({ test: 'data' }));

    const tempFile = `${testFile}.tmp`;
    await expect(fs.access(tempFile)).rejects.toThrow();
  });

  it('should clean up temp file on write error', async () => {
    const invalidPath = path.join(tempDir, 'nonexistent', 'test.json');
    const tempFile = `${invalidPath}.tmp`;

    await expect(atomicWrite(invalidPath, 'data')).rejects.toThrow();

    // Temp file should not exist
    await expect(fs.access(tempFile)).rejects.toThrow();
  });
});

describe('readJsonFile and writeJsonFile', () => {
  let tempDir: string;
  let testFile: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'utils-test-'));
    testFile = path.join(tempDir, 'test.json');
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should write and read JSON data', async () => {
    const data = { test: 'value', number: 42, nested: { key: 'val' } };
    
    await writeJsonFile(testFile, data);
    const result = await readJsonFile(testFile);

    expect(result).toEqual(data);
  });

  it('should handle concurrent JSON writes', async () => {
    // Multiple concurrent writes
    const writes = Array.from({ length: 5 }, (_, i) =>
      writeJsonFile(testFile, { index: i, data: `write-${i}` })
    );

    await expect(Promise.all(writes)).resolves.not.toThrow();

    // Should be able to read the file
    const result = await readJsonFile(testFile);
    expect(result).toHaveProperty('index');
    expect(typeof result.index).toBe('number');
  });
});
