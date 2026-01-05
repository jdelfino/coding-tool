/**
 * useSelectedNamespace Hook
 * 
 * Returns the namespace context for API calls:
 * - For system-admin: Returns the namespace selected in the dropdown (from localStorage)
 * - For other users: Returns their own namespaceId
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export function useSelectedNamespace(): string | null {
  const { user } = useAuth();
  const [selectedNamespaceId, setSelectedNamespaceId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setSelectedNamespaceId(null);
      return;
    }

    // For system-admin, use the selected namespace from localStorage
    if (user.role === 'system-admin') {
      const saved = localStorage.getItem('selectedNamespaceId');
      setSelectedNamespaceId(saved || user.namespaceId || 'default');
    } else {
      // For other users, use their own namespace
      setSelectedNamespaceId(user.namespaceId);
    }
  }, [user]);

  return selectedNamespaceId;
}

/**
 * Get query parameter for namespace filtering (system-admin only)
 * Returns '?namespace=xxx' for system-admin, empty string for others
 */
export function useNamespaceQueryParam(): string {
  const { user } = useAuth();
  const selectedNamespaceId = useSelectedNamespace();

  if (!user || user.role !== 'system-admin' || !selectedNamespaceId) {
    return '';
  }

  return `?namespace=${selectedNamespaceId}`;
}
