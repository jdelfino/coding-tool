/**
 * Tests for DuplicateProblemModal component.
 *
 * Contract: the modal prefills the title as 'Copy of <original>', lists all
 * provided classes plus a default 'Same class' option, and POSTs to
 * /api/problems/{id}/duplicate with body { title, targetClassId? } where
 * targetClassId is omitted when the user leaves the dropdown on default.
 * On success it calls onSuccess then onClose. On error it shows the
 * server-returned message.
 *
 * Why it matters: wrong endpoint, wrong body shape (e.g. sending
 * targetClassId='' instead of omitting the key), missing prefill, or
 * swallowed errors would silently break the feature or cause 400/403
 * responses from the server.
 *
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DuplicateProblemModal from '../DuplicateProblemModal';

const problem = { id: 'p1', title: 'Loops', classId: 'A' };
const classes = [
  { id: 'A', name: 'CS101' },
  { id: 'B', name: 'CS102' },
];

const defaultProps = {
  problem,
  classes,
  onClose: jest.fn(),
  onSuccess: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('DuplicateProblemModal – initial render', () => {
  it('prefills the title input with "Copy of <original title>"', () => {
    render(<DuplicateProblemModal {...defaultProps} />);
    const input = screen.getByRole('textbox', { name: /title/i });
    expect(input).toHaveValue('Copy of Loops');
  });

  it('shows a default "Same class" option in the target-class dropdown', () => {
    render(<DuplicateProblemModal {...defaultProps} />);
    expect(screen.getByRole('option', { name: /same class/i })).toBeInTheDocument();
  });

  it('lists all provided classes as dropdown options', () => {
    render(<DuplicateProblemModal {...defaultProps} />);
    expect(screen.getByRole('option', { name: 'CS101' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'CS102' })).toBeInTheDocument();
  });

  it('defaults the target-class dropdown to the same-class value (empty string)', () => {
    render(<DuplicateProblemModal {...defaultProps} />);
    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('');
  });
});

describe('DuplicateProblemModal – submitting with a target class', () => {
  it('POSTs to the correct endpoint with title and targetClassId when a class is selected', async () => {
    /**
     * Verifies the full request: URL, method, and body all match the endpoint
     * contract. A wrong endpoint or missing targetClassId would create the
     * duplicate in the wrong class without any visible error.
     */
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ problem: { id: 'new-p' } }),
    });

    render(<DuplicateProblemModal {...defaultProps} />);

    // Pick class B
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'B' } });
    fireEvent.click(screen.getByRole('button', { name: /duplicate/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/problems/p1/duplicate',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ title: 'Copy of Loops', targetClassId: 'B' }),
        })
      );
    });
  });

  it('calls onSuccess then onClose after a successful POST', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ problem: { id: 'new-p' } }),
    });

    render(<DuplicateProblemModal {...defaultProps} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'B' } });
    fireEvent.click(screen.getByRole('button', { name: /duplicate/i }));

    await waitFor(() => {
      expect(defaultProps.onSuccess).toHaveBeenCalledTimes(1);
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });
});

describe('DuplicateProblemModal – submitting without a target class (same class)', () => {
  it('POSTs without a targetClassId key when "Same class" is selected', async () => {
    /**
     * Verifies that targetClassId is omitted (not sent as '') when the user
     * leaves the dropdown at default. Sending targetClassId='' would produce
     * a 400 from the server (empty string is not a valid UUID).
     */
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ problem: { id: 'new-p' } }),
    });

    render(<DuplicateProblemModal {...defaultProps} />);
    // Leave dropdown at default (same class)
    fireEvent.click(screen.getByRole('button', { name: /duplicate/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body).not.toHaveProperty('targetClassId');
    expect(body.title).toBe('Copy of Loops');
  });
});

describe('DuplicateProblemModal – error handling', () => {
  it('shows an error message from the server when the response is not ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Title cannot be blank' }),
    });

    render(<DuplicateProblemModal {...defaultProps} />);
    // Clear the title to trigger server error scenario
    fireEvent.change(screen.getByRole('textbox', { name: /title/i }), {
      target: { value: '  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /duplicate/i }));

    await waitFor(() => {
      expect(screen.getByText('Title cannot be blank')).toBeInTheDocument();
    });

    // Modal should remain open
    expect(defaultProps.onClose).not.toHaveBeenCalled();
    expect(defaultProps.onSuccess).not.toHaveBeenCalled();
  });

  it('disables the submit button while the request is in flight', async () => {
    let resolveRequest!: (value: unknown) => void;
    (global.fetch as jest.Mock).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRequest = resolve;
      })
    );

    render(<DuplicateProblemModal {...defaultProps} />);
    const submitBtn = screen.getByRole('button', { name: /duplicate/i });

    fireEvent.click(submitBtn);

    // Button should be disabled while pending
    expect(submitBtn).toBeDisabled();

    // Resolve the request
    resolveRequest({ ok: true, json: async () => ({ problem: { id: 'new' } }) });

    await waitFor(() => {
      expect(defaultProps.onSuccess).toHaveBeenCalled();
    });
  });
});

describe('DuplicateProblemModal – close', () => {
  it('calls onClose when the Cancel button is clicked', () => {
    render(<DuplicateProblemModal {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });
});
