/**
 * Unit tests for Badge component
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { Badge } from '../Badge';

describe('Badge', () => {
  describe('rendering', () => {
    it('should render children content', () => {
      render(<Badge>Active</Badge>);

      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('should render as a span element', () => {
      render(<Badge>Status</Badge>);

      const badge = screen.getByText('Status');
      expect(badge.tagName).toBe('SPAN');
    });
  });

  describe('variants', () => {
    it('should apply default variant styles by default', () => {
      render(<Badge>Default</Badge>);

      const badge = screen.getByText('Default');
      expect(badge).toHaveClass('bg-gray-100', 'text-gray-700');
    });

    it('should apply success variant styles', () => {
      render(<Badge variant="success">Success</Badge>);

      const badge = screen.getByText('Success');
      expect(badge).toHaveClass('bg-success-50', 'text-success-700');
    });

    it('should apply warning variant styles', () => {
      render(<Badge variant="warning">Warning</Badge>);

      const badge = screen.getByText('Warning');
      expect(badge).toHaveClass('bg-warning-50', 'text-warning-700');
    });

    it('should apply error variant styles', () => {
      render(<Badge variant="error">Error</Badge>);

      const badge = screen.getByText('Error');
      expect(badge).toHaveClass('bg-error-50', 'text-error-700');
    });

    it('should apply info variant styles', () => {
      render(<Badge variant="info">Info</Badge>);

      const badge = screen.getByText('Info');
      expect(badge).toHaveClass('bg-info-50', 'text-info-700');
    });
  });

  describe('styling', () => {
    it('should have rounded-full class for pill shape', () => {
      render(<Badge>Pill</Badge>);

      expect(screen.getByText('Pill')).toHaveClass('rounded-full');
    });

    it('should have small text size', () => {
      render(<Badge>Small</Badge>);

      expect(screen.getByText('Small')).toHaveClass('text-xs');
    });

    it('should have medium font weight', () => {
      render(<Badge>Medium</Badge>);

      expect(screen.getByText('Medium')).toHaveClass('font-medium');
    });

    it('should have appropriate padding', () => {
      render(<Badge>Padded</Badge>);

      const badge = screen.getByText('Padded');
      expect(badge).toHaveClass('px-2.5', 'py-0.5');
    });

    it('should use inline-flex for alignment', () => {
      render(<Badge>Flex</Badge>);

      expect(screen.getByText('Flex')).toHaveClass('inline-flex', 'items-center');
    });
  });

  describe('custom className', () => {
    it('should apply custom className', () => {
      render(<Badge className="my-custom-class">Custom</Badge>);

      expect(screen.getByText('Custom')).toHaveClass('my-custom-class');
    });

    it('should merge custom className with default classes', () => {
      render(<Badge className="ml-2" variant="success">Merged</Badge>);

      const badge = screen.getByText('Merged');
      expect(badge).toHaveClass('ml-2');
      expect(badge).toHaveClass('bg-success-50');
      expect(badge).toHaveClass('rounded-full');
    });
  });

  describe('complex children', () => {
    it('should render with React elements as children', () => {
      render(
        <Badge>
          <span data-testid="icon">*</span>
          <span>With Icon</span>
        </Badge>
      );

      expect(screen.getByTestId('icon')).toBeInTheDocument();
      expect(screen.getByText('With Icon')).toBeInTheDocument();
    });
  });
});
