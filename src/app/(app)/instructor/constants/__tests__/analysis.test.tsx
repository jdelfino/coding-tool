import { categoryStyles } from '../analysis';

describe('categoryStyles', () => {
  it('has entries for all four walkthrough categories', () => {
    expect(Object.keys(categoryStyles)).toEqual(
      expect.arrayContaining(['common-error', 'edge-case', 'interesting-approach', 'exemplary'])
    );
    expect(Object.keys(categoryStyles)).toHaveLength(4);
  });

  it.each(Object.entries(categoryStyles))('category "%s" has bg, text, and label strings', (_key, style) => {
    expect(typeof style.bg).toBe('string');
    expect(typeof style.text).toBe('string');
    expect(typeof style.label).toBe('string');
    expect(style.bg).not.toBe('');
    expect(style.text).not.toBe('');
    expect(style.label).not.toBe('');
  });
});
