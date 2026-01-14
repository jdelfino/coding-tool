/**
 * Backend Registry - Factory Pattern for Code Execution Backends
 *
 * Provides a centralized registry for code execution backends with:
 * - Factory-based instantiation
 * - Priority-based selection
 * - Capability filtering
 * - Singleton access pattern
 */

import { ICodeExecutionBackend, BackendCapabilities } from './interfaces';

/**
 * Registration entry for a backend
 */
export interface BackendRegistration {
  /** Unique identifier for this backend type */
  type: string;
  /** Factory function to create backend instances */
  factory: () => ICodeExecutionBackend;
  /** Priority for selection (higher = preferred) */
  priority: number;
  /** Check if backend is currently available */
  isAvailable: () => boolean;
  /** Backend capabilities */
  capabilities: BackendCapabilities;
}

/**
 * Criteria for selecting a backend
 */
export interface BackendSelector {
  /** Preferred backend type (used if available) */
  preferred?: string;
  /** Required capabilities that backend must support */
  requiredCapabilities?: Partial<BackendCapabilities>;
  /** Session ID (for logging/context) */
  sessionId?: string;
  /** Environment hint */
  environment?: 'production' | 'development' | 'test';
}

/**
 * Centralized registry for code execution backends
 *
 * Implements the singleton pattern for global access.
 * Backends register with a type, factory, priority, and capabilities.
 * Selection follows these rules:
 * 1. If preferred type specified and available, use it
 * 2. Otherwise, find highest-priority available backend matching capabilities
 */
export class BackendRegistry {
  private static instance: BackendRegistry;
  private backends: Map<string, BackendRegistration>;

  private constructor() {
    this.backends = new Map();
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): BackendRegistry {
    if (!BackendRegistry.instance) {
      BackendRegistry.instance = new BackendRegistry();
    }
    return BackendRegistry.instance;
  }

  /**
   * Register a backend
   *
   * @param registration - Backend registration details
   * @throws Error if backend type already registered
   */
  register(registration: BackendRegistration): void {
    if (this.backends.has(registration.type)) {
      throw new Error(`Backend type '${registration.type}' is already registered`);
    }
    this.backends.set(registration.type, registration);
  }

  /**
   * Get a backend by type
   *
   * @param type - Backend type identifier
   * @returns Backend instance or null if not found/unavailable
   */
  get(type: string): ICodeExecutionBackend | null {
    const registration = this.backends.get(type);
    if (!registration) {
      return null;
    }
    if (!registration.isAvailable()) {
      return null;
    }
    return registration.factory();
  }

  /**
   * Select a backend based on criteria
   *
   * Selection logic:
   * 1. If preferred type specified and available, use it
   * 2. Otherwise, find highest-priority available backend matching capability requirements
   *
   * @param criteria - Selection criteria
   * @returns Backend instance or null if no suitable backend found
   */
  select(criteria?: BackendSelector): ICodeExecutionBackend | null {
    // Try preferred backend first
    if (criteria?.preferred) {
      const preferred = this.get(criteria.preferred);
      if (preferred && this.matchesCapabilities(criteria.preferred, criteria.requiredCapabilities)) {
        return preferred;
      }
    }

    // Find highest-priority available backend matching capabilities
    const candidates = Array.from(this.backends.entries())
      .filter(([type, reg]) => {
        // Must be available
        if (!reg.isAvailable()) {
          return false;
        }
        // Must match required capabilities
        if (!this.matchesCapabilities(type, criteria?.requiredCapabilities)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b[1].priority - a[1].priority); // Sort by priority descending

    if (candidates.length === 0) {
      return null;
    }

    // Return highest priority match
    return candidates[0][1].factory();
  }

  /**
   * Check if a backend matches required capabilities
   */
  private matchesCapabilities(
    type: string,
    required?: Partial<BackendCapabilities>
  ): boolean {
    if (!required) {
      return true;
    }

    const registration = this.backends.get(type);
    if (!registration) {
      return false;
    }

    const caps = registration.capabilities;
    for (const [key, value] of Object.entries(required)) {
      if (value === true && !caps[key as keyof BackendCapabilities]) {
        return false;
      }
    }

    return true;
  }

  /**
   * List all registered backends
   *
   * @returns Array of all registrations (sorted by priority descending)
   */
  list(): BackendRegistration[] {
    return Array.from(this.backends.values()).sort((a, b) => b.priority - a.priority);
  }

  /**
   * Reset the registry (for testing)
   *
   * Clears all registrations. Use in test cleanup.
   */
  reset(): void {
    this.backends.clear();
  }
}

/**
 * Get the global backend registry instance
 *
 * Convenience function for accessing the singleton.
 */
export function getBackendRegistry(): BackendRegistry {
  return BackendRegistry.getInstance();
}
