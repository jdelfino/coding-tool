/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import InstructorNav from '../InstructorNav';

describe('InstructorNav', () => {
  const mockOnNavigate = jest.fn();

  beforeEach(() => {
    mockOnNavigate.mockClear();
  });

  it('renders all navigation items', () => {
    render(
      <InstructorNav 
        currentView="classes" 
        onNavigate={mockOnNavigate}
      />
    );

    expect(screen.getByText('Classes')).toBeInTheDocument();
    expect(screen.getByText('Sections')).toBeInTheDocument();
    expect(screen.getByText('Problems')).toBeInTheDocument();
  });

  it('highlights the active view', () => {
    render(
      <InstructorNav 
        currentView="problems" 
        onNavigate={mockOnNavigate}
      />
    );

    const problemsButton = screen.getByText('Problems').closest('button');
    expect(problemsButton).toHaveClass('bg-blue-600');
    expect(problemsButton).toHaveClass('text-white');
  });

  it('calls onNavigate when clicking a nav item', () => {
    render(
      <InstructorNav 
        currentView="classes" 
        onNavigate={mockOnNavigate}
      />
    );

    fireEvent.click(screen.getByText('Problems'));
    expect(mockOnNavigate).toHaveBeenCalledWith('problems');
  });

  it('disables navigation when disabled prop is true', () => {
    render(
      <InstructorNav 
        currentView="session" 
        onNavigate={mockOnNavigate}
        disabled
      />
    );

    const classesButton = screen.getByText('Classes').closest('button');
    expect(classesButton).toBeDisabled();

    fireEvent.click(classesButton!);
    expect(mockOnNavigate).not.toHaveBeenCalled();
  });

  it('shows active session indicator when in session view', () => {
    render(
      <InstructorNav 
        currentView="session" 
        onNavigate={mockOnNavigate}
      />
    );

    expect(screen.getByText('Active Session')).toBeInTheDocument();
  });

  it('does not show active session indicator for other views', () => {
    render(
      <InstructorNav 
        currentView="problems" 
        onNavigate={mockOnNavigate}
      />
    );

    expect(screen.queryByText('Active Session')).not.toBeInTheDocument();
  });

  it('disables sections button when on classes view', () => {
    render(
      <InstructorNav 
        currentView="classes" 
        onNavigate={mockOnNavigate}
      />
    );

    const sectionsButton = screen.getByText('Sections').closest('button');
    expect(sectionsButton).toBeDisabled();
  });

  it('enables all buttons when appropriate', () => {
    render(
      <InstructorNav 
        currentView="sections" 
        onNavigate={mockOnNavigate}
      />
    );

    const classesButton = screen.getByText('Classes').closest('button');
    const problemsButton = screen.getByText('Problems').closest('button');
    
    expect(classesButton).not.toBeDisabled();
    expect(problemsButton).not.toBeDisabled();
  });
});
