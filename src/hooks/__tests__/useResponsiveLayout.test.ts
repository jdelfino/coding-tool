/**
 * Tests for useResponsiveLayout hook
 * 
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react';
import { useResponsiveLayout, useSidebarSection } from '../useResponsiveLayout';

describe('useResponsiveLayout', () => {
  beforeEach(() => {
    // Reset window size before each test
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
  });

  it('returns true for desktop width (>= 1024px)', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1200,
    });

    const { result } = renderHook(() => useResponsiveLayout(1024));
    expect(result.current).toBe(true);
  });

  it('returns false for mobile width (< 1024px)', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 768,
    });

    const { result } = renderHook(() => useResponsiveLayout(1024));
    expect(result.current).toBe(false);
  });

  it('updates on window resize', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1200,
    });

    const { result } = renderHook(() => useResponsiveLayout(1024));
    expect(result.current).toBe(true);

    // Simulate resize to mobile
    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBe(false);
  });

  it('uses custom breakpoint', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1000,
    });

    const { result } = renderHook(() => useResponsiveLayout(1200));
    expect(result.current).toBe(false);
  });
});

describe('useSidebarSection', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes with default collapsed state', () => {
    const { result } = renderHook(() => useSidebarSection('test-section', false));
    expect(result.current.isCollapsed).toBe(false);
  });

  it('initializes with collapsed state', () => {
    const { result } = renderHook(() => useSidebarSection('test-section', true));
    expect(result.current.isCollapsed).toBe(true);
  });

  it('loads saved state from localStorage', () => {
    localStorage.setItem('sidebar-test-section-collapsed', 'true');
    
    const { result } = renderHook(() => useSidebarSection('test-section', false));
    expect(result.current.isCollapsed).toBe(true);
  });

  it('toggles collapsed state', () => {
    const { result } = renderHook(() => useSidebarSection('test-section', false));
    
    expect(result.current.isCollapsed).toBe(false);
    
    act(() => {
      result.current.toggle();
    });
    
    expect(result.current.isCollapsed).toBe(true);
  });

  it('persists collapsed state to localStorage', () => {
    const { result } = renderHook(() => useSidebarSection('test-section', false));
    
    act(() => {
      result.current.toggle();
    });
    
    expect(localStorage.getItem('sidebar-test-section-collapsed')).toBe('true');
  });

  it('uses unique storage keys for different sections', () => {
    const { result: result1 } = renderHook(() => useSidebarSection('section1', false));
    const { result: result2 } = renderHook(() => useSidebarSection('section2', false));
    
    act(() => {
      result1.current.toggle();
    });
    
    expect(result1.current.isCollapsed).toBe(true);
    expect(result2.current.isCollapsed).toBe(false);
    expect(localStorage.getItem('sidebar-section1-collapsed')).toBe('true');
    expect(localStorage.getItem('sidebar-section2-collapsed')).toBeNull();
  });
});
