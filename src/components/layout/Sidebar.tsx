'use client';

/**
 * Left sidebar navigation component.
 * Renders nav items filtered by user role from navigation config.
 * Supports expanded and collapsed states.
 */

import React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
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
  searchParams: URLSearchParams | null;
  collapsed: boolean;
  isFirst: boolean;
}

function NavGroupSection({ group, items, pathname, searchParams, collapsed, isFirst }: NavGroupSectionProps) {
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
            isActive={isPathActive(item.href, pathname, searchParams ?? undefined)}
            collapsed={collapsed}
          />
        ))}
      </nav>
    </div>
  );
}

/**
 * Check if a nav item's href matches the current pathname and search params.
 */
function isPathActive(href: string, pathname: string, searchParams?: URLSearchParams): boolean {
  const [hrefPath, hrefQuery] = href.split('?');

  // For hrefs with query params (like /instructor?view=sessions),
  // require exact path AND query param match
  if (hrefQuery) {
    if (pathname !== hrefPath) {
      return false;
    }
    // Check if the view param matches
    const hrefParams = new URLSearchParams(hrefQuery);
    const hrefView = hrefParams.get('view');
    const currentView = searchParams?.get('view');
    return hrefView === currentView;
  }

  // For hrefs without query params (like /instructor),
  // match only when there's no view param in current URL
  if (pathname === hrefPath) {
    // If this is /instructor without query, only match when no view param
    if (hrefPath === '/instructor') {
      return !searchParams?.get('view');
    }
    return true;
  }

  // For paths like /classes, also match /classes/...
  if (hrefPath !== '/' && pathname.startsWith(hrefPath + '/')) {
    return true;
  }

  return false;
}

export function Sidebar({ collapsed = false, onToggleCollapse }: SidebarProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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
      {/* Collapse toggle at top */}
      {onToggleCollapse && (
        <div className="px-2 py-3 border-b border-gray-200">
          <SidebarToggle isCollapsed={collapsed} onToggle={onToggleCollapse} />
        </div>
      )}

      {/* Navigation items */}
      <div className="flex-1 overflow-y-auto py-4 px-2">
        {navGroups.map((group, index) => (
          <NavGroupSection
            key={group}
            group={group}
            items={navItems}
            pathname={pathname}
            searchParams={searchParams}
            collapsed={collapsed}
            isFirst={index === 0}
          />
        ))}
      </div>
    </aside>
  );
}
