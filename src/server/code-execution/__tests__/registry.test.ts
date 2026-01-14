/**
 * Tests for BackendRegistry
 *
 * Tests the factory pattern implementation for code execution backends.
 */

import {
  BackendRegistry,
  BackendRegistration,
  BackendSelector,
  getBackendRegistry,
} from '../registry';
import {
  ICodeExecutionBackend,
  BackendCapabilities,
  BackendStatus,
  ExecutionResult,
  CodeSubmission,
} from '../interfaces';

/**
 * Create a mock backend for testing
 */
function createMockBackend(
  type: string,
  capabilities: Partial<BackendCapabilities> = {}
): ICodeExecutionBackend {
  const fullCapabilities: BackendCapabilities = {
    execute: true,
    trace: false,
    attachedFiles: false,
    stdin: false,
    randomSeed: false,
    stateful: false,
    requiresWarmup: false,
    ...capabilities,
  };

  return {
    backendType: type,
    capabilities: fullCapabilities,
    async execute(_submission: CodeSubmission): Promise<ExecutionResult> {
      return {
        success: true,
        output: `Output from ${type}`,
        error: '',
        executionTime: 100,
      };
    },
    async getStatus(): Promise<BackendStatus> {
      return { available: true, healthy: true };
    },
  };
}

/**
 * Create a mock registration for testing
 */
function createMockRegistration(
  type: string,
  options: {
    priority?: number;
    isAvailable?: boolean;
    capabilities?: Partial<BackendCapabilities>;
  } = {}
): BackendRegistration {
  const {
    priority = 0,
    isAvailable = true,
    capabilities = {},
  } = options;

  const fullCapabilities: BackendCapabilities = {
    execute: true,
    trace: false,
    attachedFiles: false,
    stdin: false,
    randomSeed: false,
    stateful: false,
    requiresWarmup: false,
    ...capabilities,
  };

  return {
    type,
    factory: () => createMockBackend(type, capabilities),
    priority,
    isAvailable: () => isAvailable,
    capabilities: fullCapabilities,
  };
}

describe('BackendRegistry', () => {
  let registry: BackendRegistry;

  beforeEach(() => {
    registry = BackendRegistry.getInstance();
    registry.reset();
  });

  afterEach(() => {
    registry.reset();
  });

  describe('singleton pattern', () => {
    it('returns the same instance', () => {
      const instance1 = BackendRegistry.getInstance();
      const instance2 = BackendRegistry.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('getBackendRegistry returns the singleton', () => {
      const instance = getBackendRegistry();
      expect(instance).toBe(BackendRegistry.getInstance());
    });
  });

  describe('register', () => {
    it('registers a new backend', () => {
      const registration = createMockRegistration('test-backend');
      registry.register(registration);

      const backends = registry.list();
      expect(backends).toHaveLength(1);
      expect(backends[0].type).toBe('test-backend');
    });

    it('throws error when registering duplicate type', () => {
      const registration1 = createMockRegistration('duplicate-backend');
      const registration2 = createMockRegistration('duplicate-backend');

      registry.register(registration1);
      expect(() => registry.register(registration2)).toThrow(
        "Backend type 'duplicate-backend' is already registered"
      );
    });

    it('allows registering multiple different backends', () => {
      registry.register(createMockRegistration('backend-1'));
      registry.register(createMockRegistration('backend-2'));
      registry.register(createMockRegistration('backend-3'));

      const backends = registry.list();
      expect(backends).toHaveLength(3);
    });
  });

  describe('get', () => {
    it('returns backend instance by type', () => {
      registry.register(createMockRegistration('my-backend'));

      const backend = registry.get('my-backend');
      expect(backend).not.toBeNull();
      expect(backend?.backendType).toBe('my-backend');
    });

    it('returns null for unregistered type', () => {
      const backend = registry.get('nonexistent');
      expect(backend).toBeNull();
    });

    it('returns null for unavailable backend', () => {
      registry.register(
        createMockRegistration('unavailable-backend', { isAvailable: false })
      );

      const backend = registry.get('unavailable-backend');
      expect(backend).toBeNull();
    });

    it('calls factory each time', () => {
      let callCount = 0;
      const registration: BackendRegistration = {
        type: 'counted-backend',
        factory: () => {
          callCount++;
          return createMockBackend('counted-backend');
        },
        priority: 0,
        isAvailable: () => true,
        capabilities: {
          execute: true,
          trace: false,
          attachedFiles: false,
          stdin: false,
          randomSeed: false,
          stateful: false,
          requiresWarmup: false,
        },
      };

      registry.register(registration);

      registry.get('counted-backend');
      registry.get('counted-backend');
      registry.get('counted-backend');

      expect(callCount).toBe(3);
    });
  });

  describe('select', () => {
    beforeEach(() => {
      // Register multiple backends with different priorities and capabilities
      registry.register(
        createMockRegistration('low-priority', {
          priority: 10,
          capabilities: { trace: false },
        })
      );
      registry.register(
        createMockRegistration('high-priority', {
          priority: 100,
          capabilities: { trace: true, attachedFiles: true },
        })
      );
      registry.register(
        createMockRegistration('medium-priority', {
          priority: 50,
          capabilities: { trace: true },
        })
      );
    });

    describe('with no criteria', () => {
      it('returns highest-priority available backend', () => {
        const backend = registry.select();
        expect(backend).not.toBeNull();
        expect(backend?.backendType).toBe('high-priority');
      });
    });

    describe('with preferred backend', () => {
      it('returns preferred backend if available', () => {
        const backend = registry.select({ preferred: 'low-priority' });
        expect(backend?.backendType).toBe('low-priority');
      });

      it('falls back to priority selection if preferred unavailable', () => {
        registry.register(
          createMockRegistration('unavailable-preferred', {
            priority: 200,
            isAvailable: false,
          })
        );

        const backend = registry.select({ preferred: 'unavailable-preferred' });
        expect(backend?.backendType).toBe('high-priority');
      });

      it('falls back to priority selection if preferred not registered', () => {
        const backend = registry.select({ preferred: 'nonexistent' });
        expect(backend?.backendType).toBe('high-priority');
      });
    });

    describe('with required capabilities', () => {
      it('filters backends by capabilities', () => {
        const backend = registry.select({
          requiredCapabilities: { trace: true, attachedFiles: true },
        });
        expect(backend?.backendType).toBe('high-priority');
      });

      it('returns highest-priority backend matching capabilities', () => {
        const backend = registry.select({
          requiredCapabilities: { trace: true },
        });
        // high-priority has trace:true and priority 100
        expect(backend?.backendType).toBe('high-priority');
      });

      it('returns null if no backend matches capabilities', () => {
        const backend = registry.select({
          requiredCapabilities: { stateful: true },
        });
        expect(backend).toBeNull();
      });

      it('preferred backend must also match capabilities', () => {
        // low-priority doesn't have trace capability
        const backend = registry.select({
          preferred: 'low-priority',
          requiredCapabilities: { trace: true },
        });
        // Falls back to highest priority with trace
        expect(backend?.backendType).toBe('high-priority');
      });
    });

    describe('with environment and sessionId', () => {
      it('accepts environment hint', () => {
        const backend = registry.select({ environment: 'production' });
        expect(backend).not.toBeNull();
      });

      it('accepts sessionId', () => {
        const backend = registry.select({ sessionId: 'session-123' });
        expect(backend).not.toBeNull();
      });
    });

    describe('edge cases', () => {
      it('returns null when no backends registered', () => {
        registry.reset();
        const backend = registry.select();
        expect(backend).toBeNull();
      });

      it('returns null when all backends unavailable', () => {
        registry.reset();
        registry.register(
          createMockRegistration('unavailable-1', { isAvailable: false })
        );
        registry.register(
          createMockRegistration('unavailable-2', { isAvailable: false })
        );

        const backend = registry.select();
        expect(backend).toBeNull();
      });

      it('handles empty criteria object', () => {
        const backend = registry.select({});
        expect(backend?.backendType).toBe('high-priority');
      });
    });
  });

  describe('list', () => {
    it('returns empty array when no backends registered', () => {
      const backends = registry.list();
      expect(backends).toEqual([]);
    });

    it('returns all registered backends', () => {
      registry.register(createMockRegistration('backend-a'));
      registry.register(createMockRegistration('backend-b'));

      const backends = registry.list();
      expect(backends).toHaveLength(2);
    });

    it('returns backends sorted by priority (descending)', () => {
      registry.register(createMockRegistration('low', { priority: 10 }));
      registry.register(createMockRegistration('high', { priority: 100 }));
      registry.register(createMockRegistration('medium', { priority: 50 }));

      const backends = registry.list();
      expect(backends[0].type).toBe('high');
      expect(backends[1].type).toBe('medium');
      expect(backends[2].type).toBe('low');
    });

    it('includes unavailable backends', () => {
      registry.register(
        createMockRegistration('available', { isAvailable: true })
      );
      registry.register(
        createMockRegistration('unavailable', { isAvailable: false })
      );

      const backends = registry.list();
      expect(backends).toHaveLength(2);
    });
  });

  describe('reset', () => {
    it('clears all registered backends', () => {
      registry.register(createMockRegistration('backend-1'));
      registry.register(createMockRegistration('backend-2'));

      expect(registry.list()).toHaveLength(2);

      registry.reset();

      expect(registry.list()).toHaveLength(0);
    });

    it('allows re-registering after reset', () => {
      registry.register(createMockRegistration('backend'));
      registry.reset();
      registry.register(createMockRegistration('backend'));

      expect(registry.list()).toHaveLength(1);
    });

    it('provides test isolation', () => {
      // Simulate first test
      registry.register(createMockRegistration('test-1-backend'));
      registry.reset();

      // Simulate second test
      registry.register(createMockRegistration('test-2-backend'));

      const backends = registry.list();
      expect(backends).toHaveLength(1);
      expect(backends[0].type).toBe('test-2-backend');
    });
  });

  describe('priority-based selection', () => {
    it('selects highest priority when multiple match', () => {
      registry.register(createMockRegistration('priority-5', { priority: 5 }));
      registry.register(createMockRegistration('priority-10', { priority: 10 }));
      registry.register(createMockRegistration('priority-1', { priority: 1 }));

      const backend = registry.select();
      expect(backend?.backendType).toBe('priority-10');
    });

    it('handles equal priorities deterministically', () => {
      // Note: with equal priorities, selection depends on iteration order
      // This test verifies the behavior is consistent
      registry.register(createMockRegistration('same-a', { priority: 50 }));
      registry.register(createMockRegistration('same-b', { priority: 50 }));

      const backend1 = registry.select();
      const backend2 = registry.select();

      // Both calls should return the same type
      expect(backend1?.backendType).toBe(backend2?.backendType);
    });

    it('skips unavailable backends regardless of priority', () => {
      registry.register(
        createMockRegistration('unavailable-high', {
          priority: 1000,
          isAvailable: false,
        })
      );
      registry.register(
        createMockRegistration('available-low', {
          priority: 1,
          isAvailable: true,
        })
      );

      const backend = registry.select();
      expect(backend?.backendType).toBe('available-low');
    });
  });

  describe('capability filtering', () => {
    beforeEach(() => {
      registry.register(
        createMockRegistration('basic', {
          priority: 100,
          capabilities: {
            execute: true,
            trace: false,
            attachedFiles: false,
            stdin: false,
            randomSeed: false,
            stateful: false,
            requiresWarmup: false,
          },
        })
      );
      registry.register(
        createMockRegistration('full', {
          priority: 50,
          capabilities: {
            execute: true,
            trace: true,
            attachedFiles: true,
            stdin: true,
            randomSeed: true,
            stateful: true,
            requiresWarmup: true,
          },
        })
      );
    });

    it('filters by single capability', () => {
      const backend = registry.select({
        requiredCapabilities: { trace: true },
      });
      expect(backend?.backendType).toBe('full');
    });

    it('filters by multiple capabilities', () => {
      const backend = registry.select({
        requiredCapabilities: { trace: true, attachedFiles: true, stdin: true },
      });
      expect(backend?.backendType).toBe('full');
    });

    it('ignores false capability requirements', () => {
      // Requiring trace: false should not exclude backends with trace: true
      const backend = registry.select({
        requiredCapabilities: { trace: false },
      });
      // Should return highest priority (basic)
      expect(backend?.backendType).toBe('basic');
    });

    it('returns higher priority when both match', () => {
      // Both have execute: true, so higher priority wins
      const backend = registry.select({
        requiredCapabilities: { execute: true },
      });
      expect(backend?.backendType).toBe('basic');
    });
  });
});
