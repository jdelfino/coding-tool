import { WalkthroughCategory } from '@/server/types/analysis';

/**
 * Visual styles for each walkthrough category.
 * Used by walkthrough UI components to render category badges.
 */
export const categoryStyles: Record<WalkthroughCategory, { bg: string; text: string; label: string }> = {
  'common-error': { bg: '#fef2f2', text: '#991b1b', label: 'Error' },
  'edge-case': { bg: '#fef9c3', text: '#854d0e', label: 'Edge Case' },
  'interesting-approach': { bg: '#f0fdf4', text: '#166534', label: 'Interesting' },
  'exemplary': { bg: '#eff6ff', text: '#1e40af', label: 'Exemplary' },
};
