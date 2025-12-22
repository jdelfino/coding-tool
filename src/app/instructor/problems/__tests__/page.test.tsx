/**
 * Tests for Instructor Problems Redirect Page
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import ProblemsRedirectPage from '../page';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

describe('ProblemsRedirectPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('redirects to /instructor on mount', () => {
    const mockReplace = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({
      replace: mockReplace,
    });

    render(<ProblemsRedirectPage />);

    expect(mockReplace).toHaveBeenCalledWith('/instructor');
  });

  it('shows loading spinner while redirecting', () => {
    const mockReplace = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({
      replace: mockReplace,
    });

    render(<ProblemsRedirectPage />);

    // Check for spinner (loading status role)
    const spinner = screen.getByRole('status');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveAttribute('aria-label', 'Loading');
  });

  it('renders with correct layout classes', () => {
    const mockReplace = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({
      replace: mockReplace,
    });

    const { container } = render(<ProblemsRedirectPage />);
    const mainDiv = container.firstChild as HTMLElement;
    
    expect(mainDiv.className).toContain('min-h-screen');
    expect(mainDiv.className).toContain('flex');
    expect(mainDiv.className).toContain('items-center');
    expect(mainDiv.className).toContain('justify-center');
  });
});
