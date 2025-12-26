/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SessionEndedNotification from '../SessionEndedNotification';

describe('SessionEndedNotification', () => {
  it('renders notification with correct message', () => {
    const mockLeaveToDashboard = jest.fn();

    render(
      <SessionEndedNotification 
        onLeaveToDashboard={mockLeaveToDashboard}
      />
    );

    expect(screen.getByText('Session Ended')).toBeInTheDocument();
    expect(screen.getByText(/The instructor has ended this session/)).toBeInTheDocument();
    expect(screen.getByText(/You can still view your code and output/)).toBeInTheDocument();
  });

  it('calls onLeaveToDashboard when "Go to Dashboard" button is clicked', () => {
    const mockLeaveToDashboard = jest.fn();

    render(
      <SessionEndedNotification 
        onLeaveToDashboard={mockLeaveToDashboard}
      />
    );

    const dashboardButton = screen.getByText('Go to Dashboard');
    fireEvent.click(dashboardButton);

    expect(mockLeaveToDashboard).toHaveBeenCalledTimes(1);
  });

  it('displays warning icon', () => {
    const mockLeaveToDashboard = jest.fn();

    const { container } = render(
      <SessionEndedNotification 
        onLeaveToDashboard={mockLeaveToDashboard}
      />
    );

    // Check for SVG icon presence
    const svgIcon = container.querySelector('svg');
    expect(svgIcon).toBeInTheDocument();
  });

  it('renders as an inline banner (not fixed position)', () => {
    const mockLeaveToDashboard = jest.fn();

    const { container } = render(
      <SessionEndedNotification 
        onLeaveToDashboard={mockLeaveToDashboard}
      />
    );

    // Check that the outer div does not have fixed positioning
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).not.toHaveClass('fixed');
    expect(outerDiv).toHaveClass('mb-4');
  });
});
