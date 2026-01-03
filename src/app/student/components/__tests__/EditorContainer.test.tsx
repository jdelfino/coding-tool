/**
 * Tests for EditorContainer component
 * 
 * Ensures the wrapper component enforces correct patterns for CodeEditor
 * 
 * @jest-environment jsdom
 */

import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EditorContainer } from '../EditorContainer';

describe('EditorContainer', () => {
  describe('Fixed height variant (default)', () => {
    it('should apply default 500px height', () => {
      const { container } = render(
        <EditorContainer>
          <div data-testid="child">Content</div>
        </EditorContainer>
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveStyle({ height: '500px' });
    });

    it('should apply custom height', () => {
      const { container } = render(
        <EditorContainer height="600px">
          <div data-testid="child">Content</div>
        </EditorContainer>
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveStyle({ height: '600px' });
    });

    it('should not have flex properties', () => {
      const { container } = render(
        <EditorContainer height="500px">
          <div data-testid="child">Content</div>
        </EditorContainer>
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).not.toHaveStyle({ flex: '1' });
      expect(wrapper).not.toHaveStyle({ minHeight: '0' });
    });
  });

  describe('Flex variant', () => {
    it('should apply flex properties', () => {
      const { container } = render(
        <EditorContainer variant="flex">
          <div data-testid="child">Content</div>
        </EditorContainer>
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveStyle({
        flex: '1',
        minHeight: '0',
        display: 'flex',
        flexDirection: 'column',
      });
    });

    it('should not have fixed height', () => {
      const { container } = render(
        <EditorContainer variant="flex">
          <div data-testid="child">Content</div>
        </EditorContainer>
      );

      const wrapper = container.firstChild as HTMLElement;
      // Height should not be set (or be empty/auto)
      const height = window.getComputedStyle(wrapper).height;
      expect(height).not.toBe('500px');
    });
  });

  describe('Style merging', () => {
    it('should allow additional inline styles', () => {
      const { container } = render(
        <EditorContainer height="500px" style={{ marginTop: '1rem' }}>
          <div data-testid="child">Content</div>
        </EditorContainer>
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveStyle({ height: '500px', marginTop: '1rem' });
    });

    it('should not override variant-specific styles', () => {
      const { container } = render(
        <EditorContainer variant="flex" style={{ padding: '1rem' }}>
          <div data-testid="child">Content</div>
        </EditorContainer>
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveStyle({
        flex: '1',
        minHeight: '0',
        padding: '1rem',
      });
    });
  });

  describe('Children rendering', () => {
    it('should render children correctly', () => {
      const { getByTestId } = render(
        <EditorContainer>
          <div data-testid="test-child">Test Content</div>
        </EditorContainer>
      );

      expect(getByTestId('test-child')).toBeInTheDocument();
      expect(getByTestId('test-child')).toHaveTextContent('Test Content');
    });

    it('should support multiple children', () => {
      const { getByTestId } = render(
        <EditorContainer>
          <div data-testid="child-1">First</div>
          <div data-testid="child-2">Second</div>
        </EditorContainer>
      );

      expect(getByTestId('child-1')).toBeInTheDocument();
      expect(getByTestId('child-2')).toBeInTheDocument();
    });
  });
});
