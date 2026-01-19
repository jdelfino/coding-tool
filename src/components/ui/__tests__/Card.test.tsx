import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Card, CardVariant } from '../Card';

describe('Card', () => {
  describe('Basic rendering', () => {
    it('renders children correctly', () => {
      render(<Card>Test content</Card>);
      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('applies default variant styles when no variant specified', () => {
      render(<Card>Content</Card>);
      const card = screen.getByText('Content').closest('div');
      expect(card).toHaveClass('bg-white');
      expect(card).toHaveClass('border');
      expect(card).toHaveClass('border-gray-200');
      expect(card).toHaveClass('rounded-lg');
      expect(card).toHaveClass('shadow-sm');
      expect(card).toHaveClass('hover:shadow-md');
      expect(card).toHaveClass('transition-shadow');
    });

    it('applies custom className', () => {
      render(<Card className="custom-class p-8">Content</Card>);
      const card = screen.getByText('Content').closest('div');
      expect(card).toHaveClass('custom-class');
      expect(card).toHaveClass('p-8');
    });

    it('passes through additional HTML attributes', () => {
      render(
        <Card data-testid="test-card" role="article">
          Content
        </Card>
      );
      const card = screen.getByTestId('test-card');
      expect(card).toHaveAttribute('role', 'article');
    });
  });

  describe('Variants', () => {
    it('renders default variant correctly', () => {
      render(<Card variant="default">Default card</Card>);
      const card = screen.getByText('Default card').closest('div');
      expect(card).toHaveClass('bg-white');
      expect(card).toHaveClass('border-gray-200');
      expect(card).toHaveClass('rounded-lg');
      expect(card).toHaveClass('shadow-sm');
      expect(card).toHaveClass('hover:shadow-md');
    });

    it('renders elevated variant correctly', () => {
      render(<Card variant="elevated">Elevated card</Card>);
      const card = screen.getByText('Elevated card').closest('div');
      expect(card).toHaveClass('bg-white');
      expect(card).toHaveClass('border-gray-100');
      expect(card).toHaveClass('rounded-xl');
      expect(card).toHaveClass('shadow-2xl');
    });

    it('renders outlined variant correctly', () => {
      render(<Card variant="outlined">Outlined card</Card>);
      const card = screen.getByText('Outlined card').closest('div');
      expect(card).toHaveClass('bg-transparent');
      expect(card).toHaveClass('border');
      expect(card).toHaveClass('border-gray-200');
      expect(card).toHaveClass('rounded-lg');
      expect(card).not.toHaveClass('shadow-sm');
    });

    it.each<CardVariant>(['default', 'elevated', 'outlined'])(
      'renders %s variant without errors',
      (variant) => {
        render(<Card variant={variant}>Card content</Card>);
        expect(screen.getByText('Card content')).toBeInTheDocument();
      }
    );
  });

  describe('Compound components', () => {
    describe('Card.Header', () => {
      it('renders header content', () => {
        render(
          <Card>
            <Card.Header>Header Title</Card.Header>
          </Card>
        );
        expect(screen.getByText('Header Title')).toBeInTheDocument();
      });

      it('applies header styles', () => {
        render(
          <Card>
            <Card.Header data-testid="header">Header</Card.Header>
          </Card>
        );
        const header = screen.getByTestId('header');
        expect(header).toHaveClass('px-6');
        expect(header).toHaveClass('py-4');
        expect(header).toHaveClass('border-b');
        expect(header).toHaveClass('border-gray-200');
      });

      it('accepts custom className', () => {
        render(
          <Card>
            <Card.Header className="custom-header" data-testid="header">
              Header
            </Card.Header>
          </Card>
        );
        const header = screen.getByTestId('header');
        expect(header).toHaveClass('custom-header');
      });
    });

    describe('Card.Body', () => {
      it('renders body content', () => {
        render(
          <Card>
            <Card.Body>Body content</Card.Body>
          </Card>
        );
        expect(screen.getByText('Body content')).toBeInTheDocument();
      });

      it('applies body styles', () => {
        render(
          <Card>
            <Card.Body data-testid="body">Body</Card.Body>
          </Card>
        );
        const body = screen.getByTestId('body');
        expect(body).toHaveClass('p-6');
      });

      it('accepts custom className', () => {
        render(
          <Card>
            <Card.Body className="custom-body" data-testid="body">
              Body
            </Card.Body>
          </Card>
        );
        const body = screen.getByTestId('body');
        expect(body).toHaveClass('custom-body');
      });
    });

    describe('Card.Footer', () => {
      it('renders footer content', () => {
        render(
          <Card>
            <Card.Footer>Footer actions</Card.Footer>
          </Card>
        );
        expect(screen.getByText('Footer actions')).toBeInTheDocument();
      });

      it('applies footer styles', () => {
        render(
          <Card>
            <Card.Footer data-testid="footer">Footer</Card.Footer>
          </Card>
        );
        const footer = screen.getByTestId('footer');
        expect(footer).toHaveClass('px-6');
        expect(footer).toHaveClass('py-4');
        expect(footer).toHaveClass('border-t');
        expect(footer).toHaveClass('border-gray-200');
        expect(footer).toHaveClass('bg-gray-50');
        expect(footer).toHaveClass('rounded-b-lg');
      });

      it('accepts custom className', () => {
        render(
          <Card>
            <Card.Footer className="custom-footer" data-testid="footer">
              Footer
            </Card.Footer>
          </Card>
        );
        const footer = screen.getByTestId('footer');
        expect(footer).toHaveClass('custom-footer');
      });
    });

    it('renders all compound components together', () => {
      render(
        <Card variant="elevated">
          <Card.Header>Card Title</Card.Header>
          <Card.Body>Card content goes here</Card.Body>
          <Card.Footer>Card actions</Card.Footer>
        </Card>
      );

      expect(screen.getByText('Card Title')).toBeInTheDocument();
      expect(screen.getByText('Card content goes here')).toBeInTheDocument();
      expect(screen.getByText('Card actions')).toBeInTheDocument();
    });
  });

  describe('Ref forwarding', () => {
    it('forwards ref to Card', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<Card ref={ref}>Content</Card>);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it('forwards ref to Card.Header', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(
        <Card>
          <Card.Header ref={ref}>Header</Card.Header>
        </Card>
      );
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it('forwards ref to Card.Body', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(
        <Card>
          <Card.Body ref={ref}>Body</Card.Body>
        </Card>
      );
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it('forwards ref to Card.Footer', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(
        <Card>
          <Card.Footer ref={ref}>Footer</Card.Footer>
        </Card>
      );
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('Usage patterns', () => {
    it('supports simple card with padding via className', () => {
      render(<Card className="p-4">Simple padded content</Card>);
      const card = screen.getByText('Simple padded content').closest('div');
      expect(card).toHaveClass('p-4');
    });

    it('supports interactive card patterns', () => {
      const handleClick = jest.fn();
      render(
        <Card onClick={handleClick} role="button" tabIndex={0}>
          Clickable card
        </Card>
      );
      const card = screen.getByRole('button');
      card.click();
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('supports nesting content in body with custom padding', () => {
      render(
        <Card variant="outlined">
          <Card.Body className="p-8">
            <h2>Custom padded content</h2>
          </Card.Body>
        </Card>
      );
      const body = screen.getByText('Custom padded content').closest('div');
      expect(body).toHaveClass('p-8');
      expect(body).toHaveClass('p-6'); // Base style still present, Tailwind handles precedence
    });
  });
});
