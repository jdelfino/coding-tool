/**
 * Unit tests for SessionControls component
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SessionControls from '../SessionControls';

describe('SessionControls', () => {
  const mockOnEndSession = jest.fn();
  const mockOnLeaveSession = jest.fn();

  const defaultProps = {
    sessionId: 'session-123',
    joinCode: 'ABC123',
    onEndSession: mockOnEndSession,
    onLeaveSession: mockOnLeaveSession,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render session controls with join code', () => {
    render(<SessionControls {...defaultProps} />);

    expect(screen.getByText('Active Session')).toBeInTheDocument();
    expect(screen.getByText('ABC123')).toBeInTheDocument();
    expect(screen.getByText('Student Join Code')).toBeInTheDocument();
    expect(screen.getByText(/Share this code with students/)).toBeInTheDocument();
  });

  it('should display section name when provided', () => {
    render(<SessionControls {...defaultProps} sectionName="Section A - MWF 10am" />);

    expect(screen.getByText('Active Session')).toBeInTheDocument();
    expect(screen.getByText('Section A - MWF 10am')).toBeInTheDocument();
  });

  it('should not display section name when not provided', () => {
    render(<SessionControls {...defaultProps} />);

    expect(screen.queryByText(/Section/)).not.toBeInTheDocument();
  });

  it('should call onLeaveSession when Leave Session button is clicked', () => {
    render(<SessionControls {...defaultProps} />);

    const leaveButton = screen.getByRole('button', { name: /Leave Session/ });
    fireEvent.click(leaveButton);

    expect(mockOnLeaveSession).toHaveBeenCalledTimes(1);
    expect(mockOnEndSession).not.toHaveBeenCalled();
  });

  it('should call onEndSession when End Session button is clicked', () => {
    render(<SessionControls {...defaultProps} />);

    const endButton = screen.getByRole('button', { name: /End Session/ });
    fireEvent.click(endButton);

    expect(mockOnEndSession).toHaveBeenCalledTimes(1);
    expect(mockOnLeaveSession).not.toHaveBeenCalled();
  });

  it('should render both action buttons', () => {
    render(<SessionControls {...defaultProps} />);

    expect(screen.getByRole('button', { name: /Leave Session/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /End Session/ })).toBeInTheDocument();
  });

  it('should display join code in large font', () => {
    render(<SessionControls {...defaultProps} />);

    const joinCode = screen.getByText('ABC123');
    expect(joinCode).toHaveClass('text-5xl', 'font-bold', 'text-blue-600', 'font-mono');
  });

  it('should render with different join codes', () => {
    const { rerender } = render(<SessionControls {...defaultProps} joinCode="XYZ789" />);

    expect(screen.getByText('XYZ789')).toBeInTheDocument();
    expect(screen.queryByText('ABC123')).not.toBeInTheDocument();

    rerender(<SessionControls {...defaultProps} joinCode="TEST99" />);

    expect(screen.getByText('TEST99')).toBeInTheDocument();
    expect(screen.queryByText('XYZ789')).not.toBeInTheDocument();
  });

  it('should not call handlers multiple times on multiple clicks', () => {
    render(<SessionControls {...defaultProps} />);

    const leaveButton = screen.getByRole('button', { name: /Leave Session/ });
    fireEvent.click(leaveButton);
    fireEvent.click(leaveButton);
    fireEvent.click(leaveButton);

    expect(mockOnLeaveSession).toHaveBeenCalledTimes(3);
  });
});
