'use client';

/**
 * Accept Invitation Page
 *
 * Handles the email invitation acceptance flow for namespace-admin and instructor roles.
 *
 * Flow:
 * 1. User clicks invite link in email, lands here with token in URL hash
 * 2. Page verifies token with Supabase verifyOtp
 * 3. On success, fetches invitation details from our API
 * 4. User fills in username to complete profile
 * 5. On submit, redirects to appropriate dashboard
 */

import React, { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabase-client';
import { useLocationHash, useLocationReload } from '@/hooks/useLocationHash';

// Page state types
type PageState =
  | { status: 'verifying' }
  | { status: 'loading-invitation' }
  | { status: 'ready'; invitation: InvitationInfo }
  | { status: 'submitting'; invitation: InvitationInfo }
  | { status: 'success' }
  | { status: 'error'; error: ErrorType };

// Error types
type ErrorType =
  | 'otp_expired'
  | 'otp_invalid'
  | 'user_already_exists'
  | 'invitation_consumed'
  | 'invitation_revoked'
  | 'invitation_not_found'
  | 'invitation_expired'
  | 'network_error'
  | 'unknown';

interface InvitationInfo {
  id: string;
  email: string;
  targetRole: 'namespace-admin' | 'instructor';
  namespace: {
    id: string;
    displayName: string;
  } | null;
}

// Error messages for each error type
const ERROR_MESSAGES: Record<ErrorType, { title: string; message: string }> = {
  otp_expired: {
    title: 'Invitation Expired',
    message: 'This invitation link has expired. Please contact your administrator to send a new invitation.',
  },
  otp_invalid: {
    title: 'Invalid Link',
    message: 'This invitation link is invalid. Please check your email for the correct link.',
  },
  user_already_exists: {
    title: 'Account Exists',
    message: 'An account with this email already exists. Please sign in instead.',
  },
  invitation_consumed: {
    title: 'Already Used',
    message: 'This invitation has already been used.',
  },
  invitation_revoked: {
    title: 'Invitation Revoked',
    message: 'This invitation has been revoked. Please contact your administrator.',
  },
  invitation_not_found: {
    title: 'Invitation Not Found',
    message: "We couldn't find your invitation. Please contact your administrator.",
  },
  invitation_expired: {
    title: 'Invitation Expired',
    message: 'This invitation has expired. Please contact your administrator to send a new invitation.',
  },
  network_error: {
    title: 'Connection Error',
    message: 'Unable to connect. Please check your internet connection and try again.',
  },
  unknown: {
    title: 'Something Went Wrong',
    message: 'An unexpected error occurred. Please try again or contact your administrator.',
  },
};

export default function AcceptInvitePage() {
  const router = useRouter();
  const locationHash = useLocationHash();
  const reload = useLocationReload();
  const [pageState, setPageState] = useState<PageState>({ status: 'verifying' });
  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [submitError, setSubmitError] = useState('');

  // Verify token and load invitation on mount
  useEffect(() => {
    const verifyAndLoadInvitation = async () => {
      try {
        const supabase = getSupabaseClient();

        // Extract tokens from URL hash
        // Supabase redirects with either:
        // - #token_hash=...&type=invite (needs client-side verification)
        // - #access_token=...&type=invite (already verified server-side)
        const hash = locationHash.substring(1);
        const params = new URLSearchParams(hash);
        const tokenHash = params.get('token_hash');
        const accessToken = params.get('access_token');
        const type = params.get('type');

        if (type !== 'invite') {
          setPageState({ status: 'error', error: 'otp_invalid' });
          return;
        }

        // Case 1: Already verified (access_token in URL)
        // Supabase verified server-side and redirected with tokens
        if (accessToken) {
          // The Supabase client auto-detects tokens in URL hash and establishes session
          // Just verify we have a valid session
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();

          if (sessionError || !session) {
            console.error('[AcceptInvite] Session error:', sessionError);
            setPageState({ status: 'error', error: 'otp_invalid' });
            return;
          }

          // Session established, proceed to fetch invitation
        }
        // Case 2: Needs verification (token_hash in URL)
        else if (tokenHash) {
          // Verify the token with Supabase
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'invite',
          });

          if (verifyError) {
            console.error('[AcceptInvite] Verify OTP error:', verifyError);

            // Map Supabase errors to our error types
            if (verifyError.message.includes('expired')) {
              setPageState({ status: 'error', error: 'otp_expired' });
            } else if (verifyError.message.includes('already') || verifyError.message.includes('registered')) {
              setPageState({ status: 'error', error: 'user_already_exists' });
            } else {
              setPageState({ status: 'error', error: 'otp_invalid' });
            }
            return;
          }
          // Token verified, proceed to fetch invitation
        }
        // Case 3: No valid token
        else {
          setPageState({ status: 'error', error: 'otp_invalid' });
          return;
        }

        // Session established, now fetch invitation details
        setPageState({ status: 'loading-invitation' });

        const response = await fetch('/api/auth/accept-invite', {
          credentials: 'include',
        });

        if (!response.ok) {
          const data = await response.json();
          console.error('[AcceptInvite] Fetch invitation error:', data);

          // Map API error codes to our error types
          const errorCode = data.code as string;
          if (errorCode === 'INVITATION_CONSUMED') {
            setPageState({ status: 'error', error: 'invitation_consumed' });
          } else if (errorCode === 'INVITATION_REVOKED') {
            setPageState({ status: 'error', error: 'invitation_revoked' });
          } else if (errorCode === 'INVITATION_NOT_FOUND') {
            setPageState({ status: 'error', error: 'invitation_not_found' });
          } else if (errorCode === 'INVITATION_EXPIRED') {
            setPageState({ status: 'error', error: 'invitation_expired' });
          } else if (response.status === 401) {
            setPageState({ status: 'error', error: 'otp_invalid' });
          } else {
            setPageState({ status: 'error', error: 'unknown' });
          }
          return;
        }

        const data = await response.json();
        const invitationInfo: InvitationInfo = {
          id: data.invitation.id,
          email: data.invitation.email,
          targetRole: data.invitation.targetRole,
          namespace: data.namespace,
        };
        setInvitation(invitationInfo);
        setPageState({ status: 'ready', invitation: invitationInfo });
      } catch (error) {
        console.error('[AcceptInvite] Unexpected error:', error);
        setPageState({ status: 'error', error: 'network_error' });
      }
    };

    verifyAndLoadInvitation();
  }, [locationHash]);

  // Validate username
  const validateUsername = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) {
      return 'Username is required';
    }
    if (trimmed.length < 3) {
      return 'Username must be at least 3 characters';
    }
    if (trimmed.length > 30) {
      return 'Username must be at most 30 characters';
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      return 'Username can only contain letters, numbers, and underscores';
    }
    return '';
  };

  // Handle form submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Validate username
    const validationError = validateUsername(username);
    if (validationError) {
      setUsernameError(validationError);
      return;
    }

    setUsernameError('');
    setSubmitError('');
    if (!invitation) return;
    setPageState({ status: 'submitting', invitation });

    try {
      const response = await fetch('/api/auth/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: username.trim(),
          displayName: displayName.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();

        // Map error codes
        if (data.code === 'DUPLICATE_USERNAME') {
          setSubmitError('This username is already taken. Please choose another.');
        } else if (data.code === 'INVITATION_CONSUMED') {
          setPageState({ status: 'error', error: 'invitation_consumed' });
          return;
        } else if (data.code === 'INVITATION_EXPIRED') {
          setPageState({ status: 'error', error: 'invitation_expired' });
          return;
        } else {
          setSubmitError(data.error || 'Failed to complete registration');
        }

        // Restore ready state for retry
        if (invitation) {
          setPageState({ status: 'ready', invitation });
        }
        return;
      }

      const data = await response.json();
      setPageState({ status: 'success' });

      // Redirect based on role
      if (data.user.role === 'namespace-admin') {
        router.push('/namespace');
      } else if (data.user.role === 'instructor') {
        router.push('/instructor');
      } else {
        router.push('/');
      }
    } catch (error) {
      console.error('[AcceptInvite] Submit error:', error);
      setSubmitError('Unable to connect. Please try again.');
      // We need to restore the ready state - but we lost the invitation info
      // So we'll show a generic error
      setPageState({ status: 'error', error: 'network_error' });
    }
  };

  // Handle retry for network errors
  const handleRetry = () => {
    setPageState({ status: 'verifying' });
    reload();
  };

  // Format role for display
  const formatRole = (role: string): string => {
    if (role === 'namespace-admin') return 'Namespace Administrator';
    if (role === 'instructor') return 'Instructor';
    return role;
  };

  // Render loading states
  if (pageState.status === 'verifying') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">Verifying invitation...</p>
        </div>
      </div>
    );
  }

  if (pageState.status === 'loading-invitation') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading your invitation...</p>
        </div>
      </div>
    );
  }

  if (pageState.status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Account Created!</h2>
          <p className="text-gray-600">Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (pageState.status === 'error') {
    const errorInfo = ERROR_MESSAGES[pageState.error];
    const showSignInLink = ['user_already_exists', 'invitation_consumed'].includes(pageState.error);
    const showRetryButton = pageState.error === 'network_error';

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-12 px-4">
        <div className="max-w-md w-full p-10 bg-white rounded-2xl shadow-2xl border border-gray-100 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{errorInfo.title}</h2>
          <p className="text-gray-600 mb-6">{errorInfo.message}</p>

          {showSignInLink && (
            <Link
              href="/auth/signin"
              className="inline-block px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Sign In
            </Link>
          )}

          {showRetryButton && (
            <button
              onClick={handleRetry}
              className="inline-block px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  // Render form (ready or submitting state)
  if (!invitation) {
    return null; // Should never happen, but guard for TypeScript
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-12 px-4">
      <div className="max-w-md w-full space-y-8 p-10 bg-white rounded-2xl shadow-2xl border border-gray-100">
        <div>
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
          </div>
          <h2 className="text-center text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Complete Your Profile
          </h2>
          <p className="mt-3 text-center text-sm text-gray-600">
            You've been invited to join as {formatRole(invitation.targetRole).toLowerCase()}
          </p>
        </div>

        {/* Invitation Info */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Email:</span>
              <span className="font-medium text-gray-900">{invitation.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Role:</span>
              <span className="font-medium text-gray-900">{formatRole(invitation.targetRole)}</span>
            </div>
            {invitation.namespace && (
              <div className="flex justify-between">
                <span className="text-gray-500">Organization:</span>
                <span className="font-medium text-gray-900">{invitation.namespace.displayName}</span>
              </div>
            )}
          </div>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                Username <span className="text-red-500">*</span>
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                className={`appearance-none rounded-lg relative block w-full px-4 py-3 border ${
                  usernameError ? 'border-red-300' : 'border-gray-300'
                } placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500`}
                placeholder="Choose a username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (usernameError) setUsernameError('');
                }}
                disabled={pageState.status === 'submitting'}
              />
              {usernameError && (
                <p className="mt-1 text-sm text-red-600">{usernameError}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">3-30 characters, letters, numbers, and underscores only</p>
            </div>

            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-2">
                Display Name <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                id="displayName"
                name="displayName"
                type="text"
                className="appearance-none rounded-lg relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500"
                placeholder="Your preferred display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={pageState.status === 'submitting'}
                maxLength={100}
              />
            </div>
          </div>

          {submitError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-sm font-medium text-red-800">{submitError}</p>
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={pageState.status === 'submitting'}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0"
            >
              {pageState.status === 'submitting' && (
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {pageState.status === 'submitting' ? 'Creating your account...' : 'Complete Registration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
