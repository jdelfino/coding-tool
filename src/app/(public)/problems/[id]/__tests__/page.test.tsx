/**
 * Tests for public problem page /problems/[id]
 *
 * Tests:
 * - Renders problem title, description, and solution
 * - Solution is in a collapsed details element
 * - Shows 'Open in Classroom' link
 * - generateMetadata returns correct title and OG tags
 * - Handles missing problems with notFound()
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import PublicProblemPage, { generateMetadata } from '../page';
import { createStorage } from '@/server/persistence';
import { notFound } from 'next/navigation';

jest.mock('@/server/persistence');
jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

// MarkdownContent is a client component; mock it
jest.mock('@/components/MarkdownContent', () => {
  return function MockMarkdownContent({ content }: { content: string }) {
    return <div data-testid="markdown-content">{content}</div>;
  };
});

const mockCreateStorage = createStorage as jest.MockedFunction<typeof createStorage>;
const mockNotFound = notFound as jest.MockedFunction<typeof notFound>;

describe('Public Problem Page', () => {
  const mockProblem = {
    id: 'problem-123',
    title: 'Two Sum',
    description: 'Find two numbers that add up to a target.',
    solution: 'def two_sum(nums, target):\n    lookup = {}\n    for i, n in enumerate(nums):\n        if target - n in lookup:\n            return [lookup[target-n], i]\n        lookup[n] = i',
    starterCode: 'def two_sum():\n    pass',
    testCases: [],
    authorId: 'user-1',
    classId: 'class-1',
    namespaceId: 'default',
    tags: ['arrays'],
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('page rendering', () => {
    it('renders problem title as h1', async () => {
      mockCreateStorage.mockResolvedValue({
        problems: { getById: jest.fn().mockResolvedValue(mockProblem) },
      } as any);

      const page = await PublicProblemPage({ params: Promise.resolve({ id: 'problem-123' }) });
      render(page);

      expect(screen.getByRole('heading', { level: 1, name: 'Two Sum' })).toBeInTheDocument();
    });

    it('renders problem description via MarkdownContent', async () => {
      mockCreateStorage.mockResolvedValue({
        problems: { getById: jest.fn().mockResolvedValue(mockProblem) },
      } as any);

      const page = await PublicProblemPage({ params: Promise.resolve({ id: 'problem-123' }) });
      render(page);

      expect(screen.getByTestId('markdown-content')).toHaveTextContent('Find two numbers that add up to a target.');
    });

    it('renders solution in a collapsed details element', async () => {
      mockCreateStorage.mockResolvedValue({
        problems: { getById: jest.fn().mockResolvedValue(mockProblem) },
      } as any);

      const page = await PublicProblemPage({ params: Promise.resolve({ id: 'problem-123' }) });
      render(page);

      const details = document.querySelector('details');
      expect(details).toBeInTheDocument();
      expect(details).not.toHaveAttribute('open');
      expect(screen.getByText(/solution/i, { selector: 'summary' })).toBeInTheDocument();
    });

    it('does not render Open in Classroom link', async () => {
      mockCreateStorage.mockResolvedValue({
        problems: { getById: jest.fn().mockResolvedValue(mockProblem) },
      } as any);

      const page = await PublicProblemPage({ params: Promise.resolve({ id: 'problem-123' }) });
      render(page);

      const link = screen.queryByRole('link', { name: /open in classroom/i });
      expect(link).not.toBeInTheDocument();
    });

    it('calls notFound for missing problem', async () => {
      mockCreateStorage.mockResolvedValue({
        problems: { getById: jest.fn().mockResolvedValue(null) },
      } as any);

      await expect(
        PublicProblemPage({ params: Promise.resolve({ id: 'nonexistent' }) })
      ).rejects.toThrow('NEXT_NOT_FOUND');

      expect(mockNotFound).toHaveBeenCalled();
    });
  });

  describe('generateMetadata', () => {
    it('returns correct title and OG tags', async () => {
      mockCreateStorage.mockResolvedValue({
        problems: { getById: jest.fn().mockResolvedValue(mockProblem) },
      } as any);

      const metadata = await generateMetadata({ params: Promise.resolve({ id: 'problem-123' }) });

      expect(metadata.title).toBe('Two Sum');
      expect(metadata.openGraph).toBeDefined();
      expect(metadata.openGraph!.title).toBe('Two Sum');
      expect(metadata.openGraph!.description).toBe('Find two numbers that add up to a target.');
    });

    it('returns fallback metadata for missing problem', async () => {
      mockCreateStorage.mockResolvedValue({
        problems: { getById: jest.fn().mockResolvedValue(null) },
      } as any);

      const metadata = await generateMetadata({ params: Promise.resolve({ id: 'nonexistent' }) });

      expect(metadata.title).toBe('Problem Not Found');
    });
  });
});
