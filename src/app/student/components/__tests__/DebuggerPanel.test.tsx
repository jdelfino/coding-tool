import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DebuggerPanel } from '../DebuggerPanel';

describe('DebuggerPanel', () => {
  const defaultProps = {
    currentStep: 0,
    totalSteps: 5,
    currentLine: 1,
    locals: {},
    globals: {},
    previousLocals: {},
    previousGlobals: {},
    callStack: [],
    canStepForward: true,
    canStepBackward: false,
    onStepForward: jest.fn(),
    onStepBackward: jest.fn(),
    onJumpToFirst: jest.fn(),
    onJumpToLast: jest.fn(),
    onExit: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders debugger title and controls', () => {
    render(<DebuggerPanel {...defaultProps} />);
    
    expect(screen.getByText('Debugger')).toBeInTheDocument();
    expect(screen.getByText('Exit Debug Mode')).toBeInTheDocument();
  });

  it('displays step counter', () => {
    render(<DebuggerPanel {...defaultProps} />);
    
    expect(screen.getByText(/step 1 of 5/i)).toBeInTheDocument();
  });

  it('displays current line number', () => {
    render(<DebuggerPanel {...defaultProps} currentLine={42} />);
    
    expect(screen.getByText(/line 42/i)).toBeInTheDocument();
  });

  it('shows truncation warning when truncated', () => {
    render(<DebuggerPanel {...defaultProps} truncated={true} />);
    
    expect(screen.getByText(/trace truncated/i)).toBeInTheDocument();
  });

  it('calls onStepForward when Next button clicked', () => {
    render(<DebuggerPanel {...defaultProps} />);
    
    fireEvent.click(screen.getByText(/next/i));
    expect(defaultProps.onStepForward).toHaveBeenCalledTimes(1);
  });

  it('calls onStepBackward when Prev button clicked', () => {
    const props = { ...defaultProps, canStepBackward: true };
    render(<DebuggerPanel {...props} />);
    
    fireEvent.click(screen.getByText(/prev/i));
    expect(defaultProps.onStepBackward).toHaveBeenCalledTimes(1);
  });

  it('calls onJumpToFirst when First button clicked', () => {
    const props = { ...defaultProps, canStepBackward: true };
    render(<DebuggerPanel {...props} />);
    
    fireEvent.click(screen.getByText(/first/i));
    expect(defaultProps.onJumpToFirst).toHaveBeenCalledTimes(1);
  });

  it('calls onJumpToLast when Last button clicked', () => {
    render(<DebuggerPanel {...defaultProps} />);
    
    fireEvent.click(screen.getByText(/last/i));
    expect(defaultProps.onJumpToLast).toHaveBeenCalledTimes(1);
  });

  it('calls onExit when Exit button clicked', () => {
    render(<DebuggerPanel {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Exit Debug Mode'));
    expect(defaultProps.onExit).toHaveBeenCalledTimes(1);
  });

  it('disables Prev and First buttons when canStepBackward is false', () => {
    render(<DebuggerPanel {...defaultProps} />);
    
    const prevButton = screen.getByText(/prev/i);
    const firstButton = screen.getByText(/first/i);
    
    expect(prevButton).toBeDisabled();
    expect(firstButton).toBeDisabled();
  });

  it('disables Next and Last buttons when canStepForward is false', () => {
    const props = { ...defaultProps, canStepForward: false };
    render(<DebuggerPanel {...props} />);
    
    const nextButton = screen.getByText(/next/i);
    const lastButton = screen.getByText(/last/i);
    
    expect(nextButton).toBeDisabled();
    expect(lastButton).toBeDisabled();
  });

  it('renders VariableInspector with props', () => {
    const props = {
      ...defaultProps,
      locals: { x: 5 },
      globals: { func: '<function>' }
    };
    
    render(<DebuggerPanel {...props} />);
    
    expect(screen.getByText('Variables')).toBeInTheDocument();
    expect(screen.getByText('x')).toBeInTheDocument();
  });

  it('renders CallStackPanel', () => {
    render(<DebuggerPanel {...defaultProps} />);
    
    expect(screen.getByText('Call Stack')).toBeInTheDocument();
  });

  it('shows keyboard shortcut hints', () => {
    render(<DebuggerPanel {...defaultProps} />);
    
    expect(screen.getByText(/keyboard:/i)).toBeInTheDocument();
  });
});
