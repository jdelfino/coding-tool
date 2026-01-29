/**
 * Unit tests for SectionDetailPage - Reopen button
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SectionDetailPage from '../page';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ sectionId: 'section-1' }),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'test@example.com' }, isLoading: false }),
}));

jest.mock('@/components/ui/BackButton', () => ({
  BackButton: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const pastSession = {
  id: 'session-past-1',
  status: 'completed',
  createdAt: '2026-01-15T10:00:00Z',
  problem: { title: 'Past Problem', description: 'A completed problem' },
  students: new Map(),
};

function mockSectionFetch(role: 'instructor' | 'student', sessions: object[] = [pastSession]) {
  return (url: string, options?: RequestInit) => {
    if (url === '/api/sections/my') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          sections: [{
            id: 'section-1', name: 'Section A', className: 'CS 101',
            classDescription: 'Intro', semester: 'Fall 2026', role,
          }],
        }),
      });
    }
    if (url === '/api/sections/section-1/sessions') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ sessions }),
      });
    }
    if (url === '/api/sessions/session-past-1/reopen' && options?.method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ sessionId: 'session-past-1' }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  };
}

const mockAlert = jest.fn();

describe('SectionDetailPage - Reopen button', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.alert = mockAlert;
  });

  it('shows Reopen button for instructors on past sessions', async () => {
    global.fetch = jest.fn(mockSectionFetch('instructor')) as jest.Mock;
    render(<SectionDetailPage />);
    expect(await screen.findByText('Reopen')).toBeInTheDocument();
  });

  it('does not show Reopen button for students on past sessions', async () => {
    global.fetch = jest.fn(mockSectionFetch('student')) as jest.Mock;
    render(<SectionDetailPage />);
    expect(await screen.findByText('Past Problem')).toBeInTheDocument();
    expect(screen.queryByText('Reopen')).not.toBeInTheDocument();
  });

  it('calls reopen API and navigates on success', async () => {
    global.fetch = jest.fn(mockSectionFetch('instructor')) as jest.Mock;
    render(<SectionDetailPage />);
    const reopenBtn = await screen.findByText('Reopen');

    await userEvent.click(reopenBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/sessions/session-past-1/reopen', {
        method: 'POST',
      });
      expect(mockPush).toHaveBeenCalledWith('/instructor/session/session-past-1');
    });
  });

  it('shows alert on reopen error', async () => {
    const baseFetch = mockSectionFetch('instructor');
    global.fetch = jest.fn((url: string, options?: RequestInit) => {
      if (url === '/api/sessions/session-past-1/reopen' && options?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: 'Cannot reopen session: active session already exists' }),
        });
      }
      return baseFetch(url, options);
    }) as jest.Mock;

    render(<SectionDetailPage />);
    const reopenBtn = await screen.findByText('Reopen');
    await userEvent.click(reopenBtn);

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith('Cannot reopen session: active session already exists');
    });
    expect(mockPush).not.toHaveBeenCalledWith('/instructor/session/session-past-1');
  });

  it('disables button while reopening', async () => {
    let resolveReopen!: (value: unknown) => void;
    const baseFetch = mockSectionFetch('instructor');
    global.fetch = jest.fn((url: string, options?: RequestInit) => {
      if (url === '/api/sessions/session-past-1/reopen' && options?.method === 'POST') {
        return new Promise((resolve) => { resolveReopen = resolve; });
      }
      return baseFetch(url, options);
    }) as jest.Mock;

    render(<SectionDetailPage />);
    const reopenBtn = await screen.findByText('Reopen');
    await userEvent.click(reopenBtn);

    // Button should show "Reopening..." and be disabled
    expect(await screen.findByText('Reopening...')).toBeDisabled();

    // Resolve the request
    resolveReopen({
      ok: true,
      json: () => Promise.resolve({ sessionId: 'session-past-1' }),
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/instructor/session/session-past-1');
    });
  });
});
