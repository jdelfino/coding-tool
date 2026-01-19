/**
 * Unit tests for Breadcrumb component
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { Breadcrumb, BreadcrumbItem } from '../Breadcrumb';

// Mock next/link
jest.mock('next/link', () => {
  return function MockLink({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) {
    return <a href={href} className={className}>{children}</a>;
  };
});

describe('Breadcrumb', () => {
  describe('rendering', () => {
    it('should render nothing when items array is empty', () => {
      const { container } = render(<Breadcrumb items={[]} />);

      expect(container.firstChild).toBeNull();
    });

    it('should render a nav element with aria-label', () => {
      const items: BreadcrumbItem[] = [{ label: 'Home', href: '/' }];
      render(<Breadcrumb items={items} />);

      expect(screen.getByRole('navigation')).toHaveAttribute('aria-label', 'Breadcrumb');
    });

    it('should render single item', () => {
      const items: BreadcrumbItem[] = [{ label: 'Home' }];
      render(<Breadcrumb items={items} />);

      expect(screen.getByText('Home')).toBeInTheDocument();
    });

    it('should render multiple items', () => {
      const items: BreadcrumbItem[] = [
        { label: 'Classes', href: '/classes' },
        { label: 'CS 101', href: '/classes/cs101' },
        { label: 'Section A' },
      ];
      render(<Breadcrumb items={items} />);

      expect(screen.getByText('Classes')).toBeInTheDocument();
      expect(screen.getByText('CS 101')).toBeInTheDocument();
      expect(screen.getByText('Section A')).toBeInTheDocument();
    });
  });

  describe('links', () => {
    it('should render items with href as links', () => {
      const items: BreadcrumbItem[] = [
        { label: 'Classes', href: '/classes' },
        { label: 'Current' },
      ];
      render(<Breadcrumb items={items} />);

      const link = screen.getByRole('link', { name: 'Classes' });
      expect(link).toHaveAttribute('href', '/classes');
    });

    it('should render last item as non-clickable text', () => {
      const items: BreadcrumbItem[] = [
        { label: 'Classes', href: '/classes' },
        { label: 'Current Page' },
      ];
      render(<Breadcrumb items={items} />);

      // The last item should not be a link
      const lastItem = screen.getByText('Current Page');
      expect(lastItem.tagName).toBe('SPAN');
      expect(lastItem).toHaveAttribute('aria-current', 'page');
    });

    it('should render item without href as non-clickable even if not last', () => {
      const items: BreadcrumbItem[] = [
        { label: 'First' }, // no href
        { label: 'Last' },
      ];
      render(<Breadcrumb items={items} />);

      const firstItem = screen.getByText('First');
      expect(firstItem.tagName).toBe('SPAN');
    });

    it('should preserve query parameters in links', () => {
      const items: BreadcrumbItem[] = [
        { label: 'Instructor', href: '/instructor?view=classes' },
        { label: 'Section' },
      ];
      render(<Breadcrumb items={items} />);

      expect(screen.getByRole('link', { name: 'Instructor' })).toHaveAttribute(
        'href',
        '/instructor?view=classes'
      );
    });
  });

  describe('separator', () => {
    it('should use "/" as default separator', () => {
      const items: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: 'Page' },
      ];
      render(<Breadcrumb items={items} />);

      expect(screen.getByText('/')).toBeInTheDocument();
    });

    it('should use custom separator when provided', () => {
      const items: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: 'Page' },
      ];
      render(<Breadcrumb items={items} separator=">" />);

      expect(screen.getByText('>')).toBeInTheDocument();
      expect(screen.queryByText('/')).not.toBeInTheDocument();
    });

    it('should hide separator from screen readers', () => {
      const items: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: 'Page' },
      ];
      render(<Breadcrumb items={items} />);

      const separator = screen.getByText('/');
      expect(separator).toHaveAttribute('aria-hidden', 'true');
    });

    it('should render separators between items but not before first', () => {
      const items: BreadcrumbItem[] = [
        { label: 'One', href: '/one' },
        { label: 'Two', href: '/two' },
        { label: 'Three' },
      ];
      render(<Breadcrumb items={items} />);

      // Should have 2 separators for 3 items
      const separators = screen.getAllByText('/');
      expect(separators).toHaveLength(2);
    });
  });

  describe('responsive collapse', () => {
    it('should not collapse when 3 or fewer items', () => {
      const items: BreadcrumbItem[] = [
        { label: 'One', href: '/one' },
        { label: 'Two', href: '/two' },
        { label: 'Three' },
      ];
      render(<Breadcrumb items={items} />);

      // Should not show ellipsis
      expect(screen.queryByText('...')).not.toBeInTheDocument();
    });

    it('should show ellipsis when more than 3 items', () => {
      const items: BreadcrumbItem[] = [
        { label: 'One', href: '/one' },
        { label: 'Two', href: '/two' },
        { label: 'Three', href: '/three' },
        { label: 'Four' },
      ];
      render(<Breadcrumb items={items} />);

      // Should show ellipsis in collapsed view
      expect(screen.getByText('...')).toBeInTheDocument();
    });

    it('should show first, ellipsis, and last two items in collapsed view', () => {
      const items: BreadcrumbItem[] = [
        { label: 'First', href: '/first' },
        { label: 'Second', href: '/second' },
        { label: 'Third', href: '/third' },
        { label: 'Fourth', href: '/fourth' },
        { label: 'Fifth' },
      ];
      render(<Breadcrumb items={items} />);

      // In collapsed view: First, ..., Fourth, Fifth
      // Note: getAllByText because some items appear in both full and collapsed views
      expect(screen.getAllByText('First').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('...')).toBeInTheDocument();
      expect(screen.getAllByText('Fourth').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Fifth').length).toBeGreaterThanOrEqual(1);
    });

    it('should render both full and collapsed views for responsive display', () => {
      const items: BreadcrumbItem[] = [
        { label: 'One', href: '/one' },
        { label: 'Two', href: '/two' },
        { label: 'Three', href: '/three' },
        { label: 'Four' },
      ];
      render(<Breadcrumb items={items} />);

      // Should have two ol elements (one for full, one for collapsed)
      const lists = screen.getAllByRole('list');
      expect(lists.length).toBe(2);

      // Full view should have md:flex class
      expect(lists[0]).toHaveClass('md:flex');

      // Collapsed view should have md:hidden class
      expect(lists[1]).toHaveClass('md:hidden');
    });

    it('should only render one list when not collapsing', () => {
      const items: BreadcrumbItem[] = [
        { label: 'One', href: '/one' },
        { label: 'Two' },
      ];
      render(<Breadcrumb items={items} />);

      const lists = screen.getAllByRole('list');
      expect(lists.length).toBe(1);
    });
  });

  describe('styling', () => {
    it('should have text-sm class for font size', () => {
      const items: BreadcrumbItem[] = [{ label: 'Home' }];
      render(<Breadcrumb items={items} />);

      expect(screen.getByRole('navigation')).toHaveClass('text-sm');
    });

    it('should apply link styles to clickable items', () => {
      const items: BreadcrumbItem[] = [
        { label: 'Link', href: '/link' },
        { label: 'Current' },
      ];
      render(<Breadcrumb items={items} />);

      const link = screen.getByRole('link', { name: 'Link' });
      expect(link).toHaveClass('text-gray-500');
      expect(link).toHaveClass('hover:text-gray-700');
    });

    it('should apply current page styles to last item', () => {
      const items: BreadcrumbItem[] = [
        { label: 'Link', href: '/link' },
        { label: 'Current' },
      ];
      render(<Breadcrumb items={items} />);

      const current = screen.getByText('Current');
      expect(current).toHaveClass('text-gray-900');
      expect(current).toHaveClass('font-medium');
    });

    it('should apply separator styling', () => {
      const items: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: 'Page' },
      ];
      render(<Breadcrumb items={items} />);

      const separator = screen.getByText('/');
      expect(separator).toHaveClass('mx-2');
      expect(separator).toHaveClass('text-gray-400');
    });
  });

  describe('custom className', () => {
    it('should apply custom className', () => {
      const items: BreadcrumbItem[] = [{ label: 'Home' }];
      render(<Breadcrumb items={items} className="my-custom-class" />);

      expect(screen.getByRole('navigation')).toHaveClass('my-custom-class');
    });

    it('should merge custom className with default classes', () => {
      const items: BreadcrumbItem[] = [{ label: 'Home' }];
      render(<Breadcrumb items={items} className="mt-4" />);

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('mt-4');
      expect(nav).toHaveClass('text-sm');
    });
  });

  describe('accessibility', () => {
    it('should have navigation landmark', () => {
      const items: BreadcrumbItem[] = [{ label: 'Home' }];
      render(<Breadcrumb items={items} />);

      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('should have descriptive aria-label', () => {
      const items: BreadcrumbItem[] = [{ label: 'Home' }];
      render(<Breadcrumb items={items} />);

      expect(screen.getByRole('navigation')).toHaveAttribute('aria-label', 'Breadcrumb');
    });

    it('should mark current page with aria-current', () => {
      const items: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: 'Current Page' },
      ];
      render(<Breadcrumb items={items} />);

      expect(screen.getByText('Current Page')).toHaveAttribute('aria-current', 'page');
    });

    it('should use ordered list for semantic structure', () => {
      const items: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: 'Page' },
      ];
      render(<Breadcrumb items={items} />);

      expect(screen.getByRole('list')).toBeInTheDocument();
      expect(screen.getAllByRole('listitem').length).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('should handle single item with href (still renders as current page)', () => {
      const items: BreadcrumbItem[] = [{ label: 'Home', href: '/' }];
      render(<Breadcrumb items={items} />);

      // Even with href, single item is treated as current page
      const item = screen.getByText('Home');
      expect(item).toHaveAttribute('aria-current', 'page');
    });

    it('should handle items with special characters in labels', () => {
      const items: BreadcrumbItem[] = [
        { label: 'CS 101 & Math 200', href: '/classes' },
        { label: 'Section <A>' },
      ];
      render(<Breadcrumb items={items} />);

      expect(screen.getByText('CS 101 & Math 200')).toBeInTheDocument();
      expect(screen.getByText('Section <A>')).toBeInTheDocument();
    });

    it('should handle empty label strings', () => {
      const items: BreadcrumbItem[] = [
        { label: '', href: '/' },
        { label: 'Page' },
      ];
      render(<Breadcrumb items={items} />);

      // Should still render structure
      expect(screen.getByText('Page')).toBeInTheDocument();
    });

    it('should handle exactly 4 items (minimum collapse case)', () => {
      const items: BreadcrumbItem[] = [
        { label: 'One', href: '/one' },
        { label: 'Two', href: '/two' },
        { label: 'Three', href: '/three' },
        { label: 'Four' },
      ];
      render(<Breadcrumb items={items} />);

      // Should collapse: One, ..., Three, Four
      expect(screen.getByText('...')).toBeInTheDocument();
    });
  });
});
