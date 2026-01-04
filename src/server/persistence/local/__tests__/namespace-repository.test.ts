/**
 * Unit tests for LocalNamespaceRepository
 */

import { LocalNamespaceRepository, isValidNamespaceId } from '../namespace-repository';
import { Namespace } from '../../../auth/types';
import { StorageConfig } from '../../types';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('isValidNamespaceId', () => {
  it('should accept valid namespace IDs', () => {
    expect(isValidNamespaceId('stanford')).toBe(true);
    expect(isValidNamespaceId('mit')).toBe(true);
    expect(isValidNamespaceId('company-x')).toBe(true);
    expect(isValidNamespaceId('org-123')).toBe(true);
    expect(isValidNamespaceId('my-organization')).toBe(true);
    expect(isValidNamespaceId('a1b2c3')).toBe(true);
  });

  it('should reject IDs that are too short', () => {
    expect(isValidNamespaceId('ab')).toBe(false);
    expect(isValidNamespaceId('a')).toBe(false);
    expect(isValidNamespaceId('')).toBe(false);
  });

  it('should reject IDs that are too long', () => {
    const longId = 'a'.repeat(33);
    expect(isValidNamespaceId(longId)).toBe(false);
  });

  it('should reject IDs with uppercase letters', () => {
    expect(isValidNamespaceId('Stanford')).toBe(false);
    expect(isValidNamespaceId('STANFORD')).toBe(false);
    expect(isValidNamespaceId('StAnFoRd')).toBe(false);
  });

  it('should reject IDs with special characters', () => {
    expect(isValidNamespaceId('org_name')).toBe(false);
    expect(isValidNamespaceId('org.name')).toBe(false);
    expect(isValidNamespaceId('org@name')).toBe(false);
    expect(isValidNamespaceId('org name')).toBe(false);
    expect(isValidNamespaceId('org!name')).toBe(false);
  });

  it('should reject IDs starting with hyphen', () => {
    expect(isValidNamespaceId('-org')).toBe(false);
    expect(isValidNamespaceId('-stanford')).toBe(false);
  });

  it('should reject IDs ending with hyphen', () => {
    expect(isValidNamespaceId('org-')).toBe(false);
    expect(isValidNamespaceId('stanford-')).toBe(false);
  });

  it('should reject IDs with consecutive hyphens', () => {
    expect(isValidNamespaceId('org--name')).toBe(false);
    expect(isValidNamespaceId('my---org')).toBe(false);
  });

  it('should reject null or undefined', () => {
    expect(isValidNamespaceId(null as any)).toBe(false);
    expect(isValidNamespaceId(undefined as any)).toBe(false);
  });

  it('should reject non-string values', () => {
    expect(isValidNamespaceId(123 as any)).toBe(false);
    expect(isValidNamespaceId({} as any)).toBe(false);
    expect(isValidNamespaceId([] as any)).toBe(false);
  });
});

describe('LocalNamespaceRepository', () => {
  let repo: LocalNamespaceRepository;
  let testDir: string;
  let config: StorageConfig;

  beforeEach(async () => {
    // Create a temporary directory for testing
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'namespace-repo-test-'));
    config = { type: 'local', baseDir: testDir };
    repo = new LocalNamespaceRepository(config);
    await repo.initialize();
  });

  afterEach(async () => {
    await repo.shutdown();
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('createNamespace', () => {
    it('should create a new namespace', async () => {
      const namespace: Namespace = {
        id: 'stanford',
        displayName: 'Stanford University',
        active: true,
        createdAt: new Date(),
        createdBy: 'admin-1',
        updatedAt: new Date(),
      };

      const created = await repo.createNamespace(namespace);

      expect(created.id).toBe('stanford');
      expect(created.displayName).toBe('Stanford University');
      expect(created.active).toBe(true);
      expect(created.createdBy).toBe('admin-1');
      expect(created.createdAt).toBeInstanceOf(Date);
      expect(created.updatedAt).toBeInstanceOf(Date);
    });

    it('should set default values for active flag', async () => {
      const namespace = {
        id: 'mit',
        displayName: 'MIT',
        createdBy: 'admin-1',
      } as Namespace;

      const created = await repo.createNamespace(namespace);

      expect(created.active).toBe(true);
      expect(created.createdAt).toBeInstanceOf(Date);
      expect(created.updatedAt).toBeInstanceOf(Date);
    });

    it('should reject invalid namespace IDs', async () => {
      const namespace: Namespace = {
        id: 'INVALID',
        displayName: 'Invalid Namespace',
        active: true,
        createdAt: new Date(),
        createdBy: 'admin-1',
        updatedAt: new Date(),
      };

      await expect(repo.createNamespace(namespace)).rejects.toThrow(
        'Invalid namespace ID'
      );
    });

    it('should reject duplicate namespace IDs', async () => {
      const namespace: Namespace = {
        id: 'stanford',
        displayName: 'Stanford University',
        active: true,
        createdAt: new Date(),
        createdBy: 'admin-1',
        updatedAt: new Date(),
      };

      await repo.createNamespace(namespace);

      // Try to create again with same ID
      await expect(repo.createNamespace(namespace)).rejects.toThrow(
        'Namespace already exists'
      );
    });

    it('should persist namespace to disk', async () => {
      const namespace: Namespace = {
        id: 'stanford',
        displayName: 'Stanford University',
        active: true,
        createdAt: new Date(),
        createdBy: 'admin-1',
        updatedAt: new Date(),
      };

      await repo.createNamespace(namespace);

      // Read directly from file
      const filePath = path.join(testDir, 'namespaces.json');
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(fileContent);

      expect(data.stanford).toBeDefined();
      expect(data.stanford.displayName).toBe('Stanford University');
    });
  });

  describe('getNamespace', () => {
    it('should retrieve an existing namespace', async () => {
      const namespace: Namespace = {
        id: 'stanford',
        displayName: 'Stanford University',
        active: true,
        createdAt: new Date(),
        createdBy: 'admin-1',
        updatedAt: new Date(),
      };

      await repo.createNamespace(namespace);
      const retrieved = await repo.getNamespace('stanford');

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe('stanford');
      expect(retrieved!.displayName).toBe('Stanford University');
    });

    it('should return null for non-existent namespace', async () => {
      const retrieved = await repo.getNamespace('nonexistent');
      expect(retrieved).toBeNull();
    });

    it('should reload from disk to get latest data', async () => {
      // Create a namespace
      await repo.createNamespace({
        id: 'stanford',
        displayName: 'Stanford University',
        active: true,
        createdAt: new Date(),
        createdBy: 'admin-1',
        updatedAt: new Date(),
      });

      // Create a second repository instance (simulating another process)
      const repo2 = new LocalNamespaceRepository(config);
      await repo2.initialize();

      // Should be able to read the namespace created by the first instance
      const retrieved = await repo2.getNamespace('stanford');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.displayName).toBe('Stanford University');

      await repo2.shutdown();
    });
  });

  describe('listNamespaces', () => {
    beforeEach(async () => {
      // Create some test namespaces
      await repo.createNamespace({
        id: 'stanford',
        displayName: 'Stanford University',
        active: true,
        createdAt: new Date(),
        createdBy: 'admin-1',
        updatedAt: new Date(),
      });

      await repo.createNamespace({
        id: 'mit',
        displayName: 'MIT',
        active: true,
        createdAt: new Date(),
        createdBy: 'admin-1',
        updatedAt: new Date(),
      });

      await repo.createNamespace({
        id: 'inactive-org',
        displayName: 'Inactive Org',
        active: false,
        createdAt: new Date(),
        createdBy: 'admin-1',
        updatedAt: new Date(),
      });
    });

    it('should list all active namespaces by default', async () => {
      const namespaces = await repo.listNamespaces();

      expect(namespaces).toHaveLength(2);
      expect(namespaces.map((ns) => ns.id)).toContain('stanford');
      expect(namespaces.map((ns) => ns.id)).toContain('mit');
      expect(namespaces.map((ns) => ns.id)).not.toContain('inactive-org');
    });

    it('should include inactive namespaces when requested', async () => {
      const namespaces = await repo.listNamespaces(true);

      expect(namespaces).toHaveLength(3);
      expect(namespaces.map((ns) => ns.id)).toContain('stanford');
      expect(namespaces.map((ns) => ns.id)).toContain('mit');
      expect(namespaces.map((ns) => ns.id)).toContain('inactive-org');
    });

    it('should return empty array when no namespaces exist', async () => {
      // Create a new repository with empty data
      const emptyDir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'namespace-empty-test-')
      );
      const emptyRepo = new LocalNamespaceRepository({ type: 'local', baseDir: emptyDir });
      await emptyRepo.initialize();

      const namespaces = await emptyRepo.listNamespaces();
      expect(namespaces).toHaveLength(0);

      await emptyRepo.shutdown();
      await fs.rm(emptyDir, { recursive: true, force: true });
    });
  });

  describe('updateNamespace', () => {
    beforeEach(async () => {
      await repo.createNamespace({
        id: 'stanford',
        displayName: 'Stanford University',
        active: true,
        createdAt: new Date('2024-01-01'),
        createdBy: 'admin-1',
        updatedAt: new Date('2024-01-01'),
      });
    });

    it('should update namespace display name', async () => {
      await repo.updateNamespace('stanford', {
        displayName: 'Stanford University - Updated',
      });

      const updated = await repo.getNamespace('stanford');
      expect(updated!.displayName).toBe('Stanford University - Updated');
    });

    it('should update namespace active status', async () => {
      await repo.updateNamespace('stanford', { active: false });

      const updated = await repo.getNamespace('stanford');
      expect(updated!.active).toBe(false);
    });

    it('should update the updatedAt timestamp', async () => {
      const before = new Date();
      await repo.updateNamespace('stanford', {
        displayName: 'Updated Name',
      });
      const after = new Date();

      const updated = await repo.getNamespace('stanford');
      expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime()
      );
      expect(updated!.updatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should not change the createdAt timestamp', async () => {
      const original = await repo.getNamespace('stanford');
      const originalCreatedAt = original!.createdAt;

      await repo.updateNamespace('stanford', {
        displayName: 'Updated Name',
      });

      const updated = await repo.getNamespace('stanford');
      expect(updated!.createdAt.getTime()).toBe(originalCreatedAt.getTime());
    });

    it('should not allow changing the namespace ID', async () => {
      await expect(
        repo.updateNamespace('stanford', { id: 'new-id' } as any)
      ).rejects.toThrow('Cannot change namespace ID');
    });

    it('should throw error for non-existent namespace', async () => {
      await expect(
        repo.updateNamespace('nonexistent', { displayName: 'New Name' })
      ).rejects.toThrow('Namespace not found');
    });
  });

  describe('deleteNamespace', () => {
    beforeEach(async () => {
      await repo.createNamespace({
        id: 'stanford',
        displayName: 'Stanford University',
        active: true,
        createdAt: new Date(),
        createdBy: 'admin-1',
        updatedAt: new Date(),
      });
    });

    it('should soft delete a namespace', async () => {
      await repo.deleteNamespace('stanford');

      const deleted = await repo.getNamespace('stanford');
      expect(deleted).not.toBeNull();
      expect(deleted!.active).toBe(false);
    });

    it('should update the updatedAt timestamp on delete', async () => {
      const before = new Date();
      await repo.deleteNamespace('stanford');
      const after = new Date();

      const deleted = await repo.getNamespace('stanford');
      expect(deleted!.updatedAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime()
      );
      expect(deleted!.updatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should throw error for non-existent namespace', async () => {
      await expect(repo.deleteNamespace('nonexistent')).rejects.toThrow(
        'Namespace not found'
      );
    });

    it('should not include deleted namespace in default list', async () => {
      await repo.deleteNamespace('stanford');

      const namespaces = await repo.listNamespaces();
      expect(namespaces.map((ns) => ns.id)).not.toContain('stanford');
    });

    it('should include deleted namespace when explicitly requested', async () => {
      await repo.deleteNamespace('stanford');

      const namespaces = await repo.listNamespaces(true);
      expect(namespaces.map((ns) => ns.id)).toContain('stanford');
      const deleted = namespaces.find((ns) => ns.id === 'stanford');
      expect(deleted!.active).toBe(false);
    });
  });

  describe('namespaceExists', () => {
    beforeEach(async () => {
      await repo.createNamespace({
        id: 'stanford',
        displayName: 'Stanford University',
        active: true,
        createdAt: new Date(),
        createdBy: 'admin-1',
        updatedAt: new Date(),
      });
    });

    it('should return true for existing namespace', async () => {
      const exists = await repo.namespaceExists('stanford');
      expect(exists).toBe(true);
    });

    it('should return false for non-existent namespace', async () => {
      const exists = await repo.namespaceExists('nonexistent');
      expect(exists).toBe(false);
    });

    it('should return true even for inactive namespaces', async () => {
      await repo.deleteNamespace('stanford');
      const exists = await repo.namespaceExists('stanford');
      expect(exists).toBe(true);
    });
  });

  describe('health', () => {
    it('should return true when storage is accessible', async () => {
      const healthy = await repo.health();
      expect(healthy).toBe(true);
    });

    it('should return false when storage is not accessible', async () => {
      // Don't call initialize on a bad config, just check health
      const badConfig: StorageConfig = { type: 'local', baseDir: '/nonexistent/path/that/does/not/exist' };
      const badRepo = new LocalNamespaceRepository(badConfig);

      const healthy = await badRepo.health();
      expect(healthy).toBe(false);
    });
  });
});
