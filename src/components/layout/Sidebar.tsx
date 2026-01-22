'use client';

/**
 * Left sidebar navigation component.
 * Renders nav items filtered by user role from navigation config.
 * Supports expanded and collapsed states.
 */

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getNavItemsForRole, getNavGroupsForRole, NavGroup, NavItem } from '@/config/navigation';
import { SidebarToggle } from './SidebarToggle';
import { getIconComponent } from './iconMap';

interface SidebarProps {
  /** Whether sidebar is collapsed to icon-only mode */
  collapsed?: boolean;
  /** Callback when collapse toggle is clicked */
  onToggleCollapse?: () => void;
}

/**
 * Group label for display.
 */
const GROUP_LABELS: Record<NavGroup, string> = {
  [NavGroup.Main]: 'Main',
  [NavGroup.Teaching]: 'Teaching',
  [NavGroup.Admin]: 'Admin',
  [NavGroup.System]: 'System',
};

interface NavItemLinkProps {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
}

function NavItemLink({ item, isActive, collapsed }: NavItemLinkProps) {
  const IconComponent = getIconComponent(item.icon);

  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        isActive
          ? 'bg-blue-100 text-blue-700'
          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
      } ${collapsed ? 'justify-center' : ''}`}
      aria-current={isActive ? 'page' : undefined}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
    >
      {IconComponent && (
        <IconComponent
          className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-500'}`}
          aria-hidden="true"
        />
      )}
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
}

interface NavGroupSectionProps {
  group: NavGroup;
  items: NavItem[];
  pathname: string;
  collapsed: boolean;
  isFirst: boolean;
}

function NavGroupSection({ group, items, pathname, collapsed, isFirst }: NavGroupSectionProps) {
  const groupItems = items.filter(item => item.group === group);

  if (groupItems.length === 0) {
    return null;
  }

  return (
    <div className={isFirst ? '' : 'mt-4'}>
      {!collapsed && (
        <h3 className="px-3 mb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {GROUP_LABELS[group]}
        </h3>
      )}
      <nav className="space-y-1" role="navigation" aria-label={collapsed ? undefined : GROUP_LABELS[group]}>
        {groupItems.map(item => (
          <NavItemLink
            key={item.id}
            item={item}
            isActive={isPathActive(item.href, pathname)}
            collapsed={collapsed}
          />
        ))}
      </nav>
    </div>
  );
}

/**
 * Check if a nav item's href matches the current pathname.
 */
function isPathActive(href: string, pathname: string): boolean {
  // Handle query parameters in hrefs
  const hrefPath = href.split('?')[0];

  // Exact match
  if (pathname === hrefPath) {
    return true;
  }

  // For paths like /instructor, also match /instructor/...
  if (hrefPath !== '/' && pathname.startsWith(hrefPath + '/')) {
    return true;
  }

  return false;
}

export function Sidebar({ collapsed = false, onToggleCollapse }: SidebarProps) {
  const { user } = useAuth();
  const pathname = usePathname();

  const role = user?.role || 'student';
  const navItems = getNavItemsForRole(role);
  const navGroups = getNavGroupsForRole(role);

  return (
    <aside
      className={`flex flex-col bg-white border-r border-gray-200 h-full transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
      aria-label="Main navigation"
    >
      {/* Navigation items */}
      <div className="flex-1 overflow-y-auto py-4 px-2">
        {navGroups.map((group, index) => (
          <NavGroupSection
            key={group}
            group={group}
            items={navItems}
            pathname={pathname}
            collapsed={collapsed}
            isFirst={index === 0}
          />
        ))}
      </div>

      {/* Toggle button at bottom */}
      {onToggleCollapse && (
        <SidebarToggle isCollapsed={collapsed} onToggle={onToggleCollapse} />
      )}
    </aside>
  );
}
