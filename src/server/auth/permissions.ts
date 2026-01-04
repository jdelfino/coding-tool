/**
 * Permission definitions and role-based mappings.
 * Defines what actions each role can perform.
 */

import { UserRole, Permission } from './types';

/**
 * Map of roles to their allowed permissions.
 * System admins have full access including namespace management.
 * Namespace admins have full access within their namespace.
 * Instructors have teaching access, students have limited access.
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  'system-admin': [
    // Session permissions
    'session.create',
    'session.join',
    'session.viewAll',
    'session.viewOwn',
    'session.delete',
    
    // User management permissions
    'user.manage',
    'user.create',
    'user.delete',
    'user.viewAll',
    'user.changeRole',
    
    // Data access permissions
    'data.viewAll',
    'data.viewOwn',
    'data.export',
    
    // Namespace management permissions
    'namespace.create',
    'namespace.manage',
    'namespace.delete',
    'namespace.viewAll',
    
    // System administration
    'system.admin',
  ],
  
  'namespace-admin': [
    // Session permissions
    'session.create',
    'session.join',
    'session.viewAll',
    'session.viewOwn',
    'session.delete',
    
    // User management permissions
    'user.manage',
    'user.create',
    'user.delete',
    'user.viewAll',
    'user.changeRole',
    
    // Data access permissions
    'data.viewAll',
    'data.viewOwn',
    'data.export',
    
    // System administration (within namespace only)
    'system.admin',
  ],
  
  instructor: [
    // Session permissions
    'session.create',
    'session.join',
    'session.viewAll',
    'session.viewOwn',
    'session.delete',
    
    // User management permissions
    'user.manage',
    'user.create',
    'user.delete',
    'user.viewAll',
    
    // Data access permissions
    'data.viewAll',
    'data.viewOwn',
    'data.export',
  ],
  
  student: [
    // Session permissions (limited)
    'session.join',
    'session.viewOwn',
    
    // Data access permissions (own data only)
    'data.viewOwn',
  ],
};

/**
 * Check if a role has a specific permission.
 */
export function hasRolePermission(role: UserRole, permission: Permission | string): boolean {
  const rolePermissions = ROLE_PERMISSIONS[role];
  return rolePermissions.includes(permission as Permission);
}

/**
 * Get all permissions for a role.
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role];
}

/**
 * Permission descriptions for documentation/UI.
 */
export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  'session.create': 'Create new coding sessions',
  'session.join': 'Join existing coding sessions',
  'session.viewAll': 'View all coding sessions (including other instructors)',
  'session.viewOwn': 'View own coding sessions',
  'session.delete': 'Delete coding sessions',
  
  'user.manage': 'Manage user accounts',
  'user.create': 'Create new user accounts',
  'user.delete': 'Delete user accounts',
  'user.viewAll': 'View all user accounts',
  'user.changeRole': 'Change user roles',
  
  'data.viewAll': 'View all student data and code',
  'data.viewOwn': 'View own data and code',
  'data.export': 'Export data and analytics',
  
  'namespace.create': 'Create new namespaces',
  'namespace.manage': 'Manage namespace settings and users',
  'namespace.delete': 'Delete namespaces',
  'namespace.viewAll': 'View data across all namespaces',
  
  'system.admin': 'Full system administration access',
};
