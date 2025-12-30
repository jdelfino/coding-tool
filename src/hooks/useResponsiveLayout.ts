'use client';

import { useState, useEffect } from 'react';

/**
 * Custom hook to detect responsive layout breakpoint
 * Returns true for desktop layout (>= 1024px), false for mobile
 */
export function useResponsiveLayout(breakpoint: number = 1024): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    // Check if we're in the browser
    if (typeof window === 'undefined') {
      return;
    }

    // Initial check
    const checkLayout = () => {
      setIsDesktop(window.innerWidth >= breakpoint);
    };

    checkLayout();

    // Add resize listener
    window.addEventListener('resize', checkLayout);

    return () => {
      window.removeEventListener('resize', checkLayout);
    };
  }, [breakpoint]);

  return isDesktop;
}

/**
 * Custom hook to manage collapsible sidebar sections with localStorage persistence
 */
export function useSidebarSection(sectionId: string, defaultCollapsed: boolean = false) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  useEffect(() => {
    // Load collapsed state from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`sidebar-${sectionId}-collapsed`);
      if (saved !== null) {
        setIsCollapsed(saved === 'true');
      }
    }
  }, [sectionId]);

  const toggle = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`sidebar-${sectionId}-collapsed`, String(newState));
    }
  };

  const setCollapsed = (collapsed: boolean) => {
    setIsCollapsed(collapsed);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`sidebar-${sectionId}-collapsed`, String(collapsed));
    }
  };

  return { isCollapsed, toggle, setCollapsed };
}
