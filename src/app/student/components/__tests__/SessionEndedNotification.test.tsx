/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SessionEndedNotification from '../SessionEndedNotification';

describe('SessionEndedNotification', () => {
  it('renders notification with correct message', () => {
    const mockDismiss = jest.fn();
    const mockLeaveToDashboard = jest.fn();

    render(
      <SessionEndedNotification 
        onDismiss={mockDismiss}
        onLeaveToDashboard={mockLeaveToDashboard}
      />
    );

    expect(screen.getByText('Session Ended')).toBeInTheDocument();
    expect(screen.getByText(/The instructor has ended this session/)).toBeInTheDocument();
    expect(screen.getByText(/You can still view your code and output/)).toBeInTheDocument();
  });

  it('calls onDismiss when dismiss button is clicked', () => {
    const mockDismiss = jest.fn();
    const mockLeaveToDashboard = jest.fn();

    render(
      <SessionEndedNotification 
        onDismiss={mockDismiss}
        onLeaveToDashboard={mockLeaveToDashboard}
      />
    );

    const dismissButton = screen.getByRole('button', { name: /dismiss/i });
    fireEvent.click(dismissButton);

    expect(mockDismiss).toHaveBeenCalledTimes(1);
    expect(mockLeaveToDashboard).not.toHaveBeenCalled();
  });

  it('calls onLeaveToDashboard when "Go to Dashboard" button is clicked', () => {
    const mockDismiss = jest.fn();
    const mockLeaveToDashboard = jest.fn();

    render(
      <SessionEndedNotification 
        onDismiss={mockDismiss}
        onLeaveToDashboard={mockLeaveToDashboard}
      />
    );

    const dashboardButton = screen.getByText('Go to Dashboard');
    fireEvent.click(dashboardButton);

    expect(mockLeaveToDashboard).toHaveBeenCalledTimes(1);
    expect(mockDismiss).not.toHaveBeenCalled();
  });

  it('displays warning icon', () => {
    const mockDismiss = jest.fn();
    const mockLeaveToDashboard = jest.fn();

    const { container } = render(
      <SessionEndedNotification 
        onDismiss={mockDismiss}
        onLeaveToDashboard={mockLeaveToDashboard}
      />
    );

    // Check for SVG icon presence
    const svgIcon = container.querySelector('svg');
    expect(svgIcon).toBeInTheDocument();
  });
});
