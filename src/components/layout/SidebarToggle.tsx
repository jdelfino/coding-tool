'use client';

/**
 * Toggle button for collapsing/expanding sidebar.
 * Shows ChevronLeft when expanded, ChevronRight when collapsed.
 * Positioned at the bottom of the sidebar.
 */

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SidebarToggleProps {
  /** Whether the sidebar is currently collapsed */
  isCollapsed: boolean;
  /** Callback when toggle is clicked */
  onToggle: () => void;
}

export function SidebarToggle({ isCollapsed, onToggle }: SidebarToggleProps) {
  const Icon = isCollapsed ? ChevronRight : ChevronLeft;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!isCollapsed}
      aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      className="w-full flex items-center justify-center p-2 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors border-t border-gray-200"
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
