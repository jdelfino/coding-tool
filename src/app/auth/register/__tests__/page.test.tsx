/**
 * Tests for the registration page with email/password authentication.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import RegisterPage from '../page';
import { useAuth } from '@/contexts/AuthContext';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock AuthContext
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

describe('RegisterPage', () => {
  const mockSignIn = jest.fn();
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });
    (useAuth as jest.Mock).mockReturnValue({
      signIn: mockSignIn,
    });
  });

  describe('Form Rendering', () => {
    it('renders registration form with all required fields', () => {
      render(<RegisterPage />);

      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^username$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/organization id/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    });

    it('renders link to signin page', () => {
      render(<RegisterPage />);

      const signinLink = screen.getByText(/sign in here/i);
      expect(signinLink).toBeInTheDocument();
      expect(signinLink.closest('a')).toHaveAttribute('href', '/auth/signin');
    });

    it('has correct input types and autocomplete attributes', () => {
      render(<RegisterPage />);

      const emailInput = screen.getByLabelText(/email address/i);
      const usernameInput = screen.getByLabelText(/^username$/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      expect(emailInput).toHaveAttribute('type', 'email');
      expect(emailInput).toHaveAttribute('autocomplete', 'email');
      expect(usernameInput).toHaveAttribute('type', 'text');
      expect(usernameInput).toHaveAttribute('autocomplete', 'username');
      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(passwordInput).toHaveAttribute('autocomplete', 'new-password');
      expect(confirmPasswordInput).toHaveAttribute('type', 'password');
    });

    it('marks organization ID as optional', () => {
      render(<RegisterPage />);

      const label = screen.getByLabelText(/organization id/i);
      expect(label.parentElement?.textContent).toMatch(/optional/i);
    });
  });

  describe('Form Validation', () => {
    it('shows error when email is empty', async () => {
      render(<RegisterPage />);

      const submitButton = screen.getByRole('button', { name: /create account/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/please enter your email address/i)).toBeInTheDocument();
      });

      expect(fetch).not.toHaveBeenCalled();
    });

    it('shows error when email format is invalid', async () => {
      render(<RegisterPage />);

      const emailInput = screen.getByLabelText(/email address/i);
      const form = emailInput.closest('form')!;

      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      });

      expect(fetch).not.toHaveBeenCalled();
    });

    it('shows error when password is empty', async () => {
      render(<RegisterPage />);

      const emailInput = screen.getByLabelText(/email address/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/please enter a password/i)).toBeInTheDocument();
      });

      expect(fetch).not.toHaveBeenCalled();
    });

    it('shows error when password is too short', async () => {
      render(<RegisterPage />);

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'short' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
      });

      expect(fetch).not.toHaveBeenCalled();
    });

    it('shows error when passwords do not match', async () => {
      render(<RegisterPage />);

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'password456' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
      });

      expect(fetch).not.toHaveBeenCalled();
    });

    it('shows error when username is empty', async () => {
      render(<RegisterPage />);

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/please enter a username/i)).toBeInTheDocument();
      });

      expect(fetch).not.toHaveBeenCalled();
    });

    it('shows error when username contains invalid characters', async () => {
      render(<RegisterPage />);

      const emailInput = screen.getByLabelText(/email address/i);
      const usernameInput = screen.getByLabelText(/^username$/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(usernameInput, { target: { value: 'invalid user!' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/username can only contain/i)).toBeInTheDocument();
      });

      expect(fetch).not.toHaveBeenCalled();
    });

    it('allows valid usernames with letters, numbers, hyphens, and underscores', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ user: { id: '1' } }),
      });
      mockSignIn.mockResolvedValue(undefined);

      render(<RegisterPage />);

      const emailInput = screen.getByLabelText(/email address/i);
      const usernameInput = screen.getByLabelText(/^username$/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(usernameInput, { target: { value: 'valid_user-123' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });
    });
  });

  describe('Form Submission', () => {
    it('calls register API with form data on valid submission', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ user: { id: '1' } }),
      });
      mockSignIn.mockResolvedValue(undefined);

      render(<RegisterPage />);

      const emailInput = screen.getByLabelText(/email address/i);
      const usernameInput = screen.getByLabelText(/^username$/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      // Check the body was sent correctly (key order may vary in JSON.stringify)
      const callArgs = (fetch as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe('/api/auth/register');
      expect(callArgs[1]).toMatchObject({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const bodyObj = JSON.parse(callArgs[1].body);
      expect(bodyObj).toEqual({
        email: 'test@example.com',
        password: 'password123',
        username: 'testuser',
        namespaceId: undefined,
      });
    });

    it('includes namespaceId in request when provided', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ user: { id: '1' } }),
      });
      mockSignIn.mockResolvedValue(undefined);

      render(<RegisterPage />);

      const emailInput = screen.getByLabelText(/email address/i);
      const usernameInput = screen.getByLabelText(/^username$/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const namespaceIdInput = screen.getByLabelText(/organization id/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });
      fireEvent.change(namespaceIdInput, { target: { value: 'org-123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      // Check the body was sent correctly (key order may vary in JSON.stringify)
      const callArgs = (fetch as jest.Mock).mock.calls[0];
      const bodyObj = JSON.parse(callArgs[1].body);
      expect(bodyObj).toEqual({
        email: 'test@example.com',
        password: 'password123',
        username: 'testuser',
        namespaceId: 'org-123',
      });
    });

    it('auto-signs in after successful registration', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ user: { id: '1' } }),
      });
      mockSignIn.mockResolvedValue(undefined);

      render(<RegisterPage />);

      const emailInput = screen.getByLabelText(/email address/i);
      const usernameInput = screen.getByLabelText(/^username$/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password123');
      });
    });

    it('redirects to home page after successful registration and auto-login', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ user: { id: '1' } }),
      });
      mockSignIn.mockResolvedValue(undefined);

      render(<RegisterPage />);

      const emailInput = screen.getByLabelText(/email address/i);
      const usernameInput = screen.getByLabelText(/^username$/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/');
      });
    });

    it('shows loading state during registration', async () => {
      let resolveFetch: () => void;
      const fetchPromise = new Promise<any>((resolve) => {
        resolveFetch = () => resolve({ ok: true, json: async () => ({ user: { id: '1' } }) });
      });
      (fetch as jest.Mock).mockReturnValue(fetchPromise);
      mockSignIn.mockResolvedValue(undefined);

      render(<RegisterPage />);

      const emailInput = screen.getByLabelText(/email address/i);
      const usernameInput = screen.getByLabelText(/^username$/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      // Check loading state
      await waitFor(() => {
        expect(screen.getByText(/creating account\.\.\./i)).toBeInTheDocument();
      });

      expect(submitButton).toBeDisabled();
      expect(emailInput).toBeDisabled();

      // Resolve the promise
      resolveFetch!();
      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message on registration failure', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Registration failed' }),
      });

      render(<RegisterPage />);

      const emailInput = screen.getByLabelText(/email address/i);
      const usernameInput = screen.getByLabelText(/^username$/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/registration failed/i)).toBeInTheDocument();
      });

      expect(mockSignIn).not.toHaveBeenCalled();
    });

    it('maps "already exists" errors to user-friendly message', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'User already exists' }),
      });

      render(<RegisterPage />);

      const emailInput = screen.getByLabelText(/email address/i);
      const usernameInput = screen.getByLabelText(/^username$/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/an account with this email already exists/i)).toBeInTheDocument();
      });
    });

    it('handles fetch errors gracefully', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      render(<RegisterPage />);

      const emailInput = screen.getByLabelText(/email address/i);
      const usernameInput = screen.getByLabelText(/^username$/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });

    it('clears error message on new submission attempt', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Registration failed' }),
      });

      render(<RegisterPage />);

      const emailInput = screen.getByLabelText(/email address/i);
      const usernameInput = screen.getByLabelText(/^username$/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      // First submission with error
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/registration failed/i)).toBeInTheDocument();
      });

      // Clear error
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ user: { id: '1' } }),
      });
      mockSignIn.mockResolvedValue(undefined);

      // Second submission
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByText(/registration failed/i)).not.toBeInTheDocument();
      });
    });
  });
});
