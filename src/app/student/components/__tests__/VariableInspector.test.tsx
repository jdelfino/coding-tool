/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { VariableInspector } from '../VariableInspector';

describe('VariableInspector', () => {
  it('renders empty state when no variables', () => {
    render(<VariableInspector locals={{}} globals={{}} />);

    expect(screen.getByText(/no local variables/i)).toBeInTheDocument();
    expect(screen.getByText(/no global variables/i)).toBeInTheDocument();
  });

  it('displays local variables', () => {
    const locals = {
      x: 5,
      name: 'Alice',
      active: true
    };

    render(<VariableInspector locals={locals} globals={{}} />);

    expect(screen.getByText('x')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText("'Alice'")).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('true')).toBeInTheDocument();
  });

  it('displays global variables', () => {
    const globals = {
      result: 42,
      message: 'done'
    };

    render(<VariableInspector locals={{}} globals={globals} />);

    expect(screen.getByText('result')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('message')).toBeInTheDocument();
    expect(screen.getByText("'done'")).toBeInTheDocument();
  });

  it('filters out function variables', () => {
    const globals = {
      factorial: '<function factorial>',
      helper: '<built-in function print>',
      x: 5
    };

    render(<VariableInspector locals={{}} globals={globals} />);

    // Functions should be filtered out
    expect(screen.queryByText('factorial')).not.toBeInTheDocument();
    expect(screen.queryByText('helper')).not.toBeInTheDocument();

    // Regular variables should still appear
    expect(screen.getByText('x')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('highlights changed variables', () => {
    const locals = { x: 10 };
    const previousLocals = { x: 5 };

    const { container } = render(
      <VariableInspector
        locals={locals}
        globals={{}}
        previousLocals={previousLocals}
      />
    );

    // Check for yellow highlight class on changed variable
    const changedElement = container.querySelector('.bg-yellow-50');
    expect(changedElement).toBeInTheDocument();
  });

  it('highlights new variables', () => {
    const locals = { x: 5, y: 10 };
    const previousLocals = { x: 5 };

    const { container } = render(
      <VariableInspector
        locals={locals}
        globals={{}}
        previousLocals={previousLocals}
      />
    );

    // y is new, should be highlighted
    const highlightedElements = container.querySelectorAll('.bg-yellow-50');
    expect(highlightedElements.length).toBeGreaterThan(0);
  });

  it('formats None values correctly', () => {
    const locals = { value: null };

    render(<VariableInspector locals={locals} globals={{}} />);

    expect(screen.getByText('None')).toBeInTheDocument();
  });

  it('formats arrays correctly', () => {
    const locals = { items: [1, 2, 3] };

    render(<VariableInspector locals={locals} globals={{}} />);

    expect(screen.getByText('[1,2,3]')).toBeInTheDocument();
  });

  it('displays variable counts', () => {
    const locals = { a: 1, b: 2, c: 3 };
    const globals = { func: '<function>' };

    render(<VariableInspector locals={locals} globals={globals} />);

    expect(screen.getByText('3 vars')).toBeInTheDocument();
    expect(screen.getByText('1 vars')).toBeInTheDocument();
  });
});
