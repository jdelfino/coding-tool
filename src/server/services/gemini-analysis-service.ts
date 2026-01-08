/**
 * Gemini Analysis Service
 *
 * Provides AI-powered analysis of student code submissions using Google's Gemini API.
 * Generates walkthrough scripts that help instructors discuss submissions during lectures.
 */

import {
  AnalysisInput,
  WalkthroughScript,
  WalkthroughEntry,
  GeminiAnalysisResponse,
  WalkthroughCategory,
} from '@/server/types/analysis';

// Configuration constants
// Available models (from ListModels): gemini-2.5-flash, gemini-2.0-flash, gemini-2.0-flash-lite
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models';
const REQUEST_TIMEOUT_MS = 30000;
const MIN_CODE_LENGTH = 20;
const STARTER_CODE_DIFF_THRESHOLD = 0.1; // 10% - submissions with <10% diff from starter are filtered
const MAX_SUBMISSIONS_TO_ANALYZE = 30;
const FILTER_WARNING_THRESHOLD = 0.3; // 30% - warn if this many submissions are filtered

/**
 * Calculate simple diff ratio between two strings
 * Returns a value between 0 (identical) and 1 (completely different)
 */
function calculateDiffRatio(str1: string, str2: string): number {
  if (!str1 && !str2) return 0;
  if (!str1 || !str2) return 1;

  // Normalize whitespace for comparison
  const norm1 = str1.replace(/\s+/g, ' ').trim();
  const norm2 = str2.replace(/\s+/g, ' ').trim();

  if (norm1 === norm2) return 0;

  // Simple character-based diff ratio (Levenshtein-like but simpler)
  const maxLen = Math.max(norm1.length, norm2.length);
  if (maxLen === 0) return 0;

  let differences = 0;
  const minLen = Math.min(norm1.length, norm2.length);

  for (let i = 0; i < minLen; i++) {
    if (norm1[i] !== norm2[i]) differences++;
  }
  differences += Math.abs(norm1.length - norm2.length);

  return differences / maxLen;
}

/**
 * Generate anonymous student label (A, B, C, ..., Z, AA, AB, ...)
 */
function generateStudentLabel(index: number): string {
  let label = '';
  let n = index;
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return `Student ${label}`;
}

/**
 * Filter submissions that are empty, too small, or match starter code
 */
interface FilterResult {
  filtered: Array<{ studentId: string; code: string; label: string }>;
  filteredOutCount: number;
  warning?: string;
}

function filterSubmissions(
  submissions: Array<{ studentId: string; code: string }>,
  starterCode: string
): FilterResult {
  const normalizedStarter = starterCode.trim();
  let filteredOutCount = 0;

  const filtered: Array<{ studentId: string; code: string; label: string }> = [];

  for (const submission of submissions) {
    const code = submission.code.trim();

    // Filter empty or tiny submissions
    if (code.length < MIN_CODE_LENGTH) {
      filteredOutCount++;
      continue;
    }

    // Filter submissions that closely match starter code
    if (normalizedStarter) {
      const diffRatio = calculateDiffRatio(code, normalizedStarter);
      if (diffRatio < STARTER_CODE_DIFF_THRESHOLD) {
        filteredOutCount++;
        continue;
      }
    }

    filtered.push({
      studentId: submission.studentId,
      code,
      label: generateStudentLabel(filtered.length),
    });
  }

  // Generate warning if many submissions were filtered
  let warning: string | undefined;
  const totalCount = submissions.length;
  if (totalCount > 0 && filteredOutCount / totalCount >= FILTER_WARNING_THRESHOLD) {
    const percentage = Math.round((filteredOutCount / totalCount) * 100);
    warning = `Note: ${percentage}% of submissions were empty or unchanged from starter code - many students may need help getting started`;
  }

  return { filtered, filteredOutCount, warning };
}

/**
 * Build the prompt for Gemini analysis
 */
function buildPrompt(
  problemTitle: string,
  problemDescription: string,
  submissions: Array<{ label: string; code: string }>
): string {
  const submissionsText = submissions
    .map((s) => `[${s.label.replace('Student ', '')}]: \`\`\`python\n${s.code}\n\`\`\``)
    .join('\n\n');

  return `You are an experienced CS instructor analyzing student code submissions for a live classroom walkthrough.

## Problem
${problemTitle}
${problemDescription || '(No description provided)'}

## Student Submissions
${submissionsText}

## Task
Create an ORDERED sequence of 3-8 submissions worth discussing. Order pedagogically:
1. Common errors/misconceptions (teachable moments)
2. Edge case handling issues
3. Interesting or exemplary approaches

## Output (JSON only, no markdown code blocks)
{
  "entries": [
    {
      "studentLabel": "A",
      "discussionPoints": ["Point 1 (5-15 words)", "Point 2"],
      "pedagogicalNote": "Brief reason to discuss this",
      "category": "common-error|edge-case|interesting-approach|exemplary"
    }
  ],
  "commonPatterns": ["Pattern most students showed", "Another pattern"]
}

## Guidelines
- Be CONCISE - instructor reads this live during lecture
- Maximum 8 entries (classroom time constraints)
- Discussion points: actionable, specific, 5-15 words each
- Only include submissions that have interesting discussion points
- studentLabel should be just the letter (A, B, C, etc.)`;
}

/**
 * Parse Gemini response into structured format
 */
function parseGeminiResponse(
  responseText: string,
  labelToStudentId: Map<string, string>
): { entries: Array<Omit<WalkthroughEntry, 'position'>>; commonPatterns: string[] } {
  // Try to extract JSON from the response (handle markdown code blocks)
  let jsonText = responseText.trim();
  const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonText = jsonMatch[1].trim();
  }

  const parsed: GeminiAnalysisResponse = JSON.parse(jsonText);

  if (!Array.isArray(parsed.entries)) {
    throw new Error('Invalid response: entries must be an array');
  }

  const validCategories: WalkthroughCategory[] = [
    'common-error',
    'edge-case',
    'interesting-approach',
    'exemplary',
  ];

  const entries = parsed.entries.map((entry) => {
    const label = entry.studentLabel.toUpperCase();
    const studentId = labelToStudentId.get(label);

    if (!studentId) {
      throw new Error(`Unknown student label in response: ${entry.studentLabel}`);
    }

    const category = validCategories.includes(entry.category as WalkthroughCategory)
      ? (entry.category as WalkthroughCategory)
      : 'common-error';

    return {
      studentLabel: `Student ${label}`,
      studentId,
      discussionPoints: Array.isArray(entry.discussionPoints) ? entry.discussionPoints : [],
      pedagogicalNote: entry.pedagogicalNote || '',
      category,
    };
  });

  return {
    entries,
    commonPatterns: Array.isArray(parsed.commonPatterns) ? parsed.commonPatterns : [],
  };
}

/**
 * GeminiAnalysisService - Manages interaction with Gemini API for code analysis
 */
export class GeminiAnalysisService {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || '';
  }

  /**
   * Check if the service is configured with an API key
   */
  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Analyze student submissions and generate a walkthrough script
   */
  async analyzeSubmissions(input: AnalysisInput): Promise<WalkthroughScript> {
    if (!this.isConfigured()) {
      throw new Error('Gemini API key not configured. Set GEMINI_API_KEY environment variable.');
    }

    const totalSubmissions = input.submissions.length;

    // Handle edge case: no submissions
    if (totalSubmissions === 0) {
      return {
        sessionId: input.sessionId,
        entries: [],
        summary: {
          totalSubmissions: 0,
          filteredOut: 0,
          analyzedSubmissions: 0,
          commonPatterns: [],
          warning: 'No submissions to analyze',
        },
        generatedAt: new Date(),
      };
    }

    // Pre-filter submissions
    const { filtered, filteredOutCount, warning } = filterSubmissions(
      input.submissions,
      input.starterCode
    );

    // Handle edge case: all submissions filtered
    if (filtered.length === 0) {
      return {
        sessionId: input.sessionId,
        entries: [],
        summary: {
          totalSubmissions,
          filteredOut: filteredOutCount,
          analyzedSubmissions: 0,
          commonPatterns: [],
          warning: "Most students haven't modified the starter code yet",
        },
        generatedAt: new Date(),
      };
    }

    // Sample if too many submissions
    let toAnalyze = filtered;
    if (filtered.length > MAX_SUBMISSIONS_TO_ANALYZE) {
      // Take most recent (assuming they're in order)
      toAnalyze = filtered.slice(-MAX_SUBMISSIONS_TO_ANALYZE);
    }

    // Build label to studentId mapping for response parsing
    const labelToStudentId = new Map<string, string>();
    for (const sub of toAnalyze) {
      const letter = sub.label.replace('Student ', '');
      labelToStudentId.set(letter, sub.studentId);
    }

    // Build prompt and call Gemini
    const prompt = buildPrompt(
      input.problemTitle,
      input.problemDescription,
      toAnalyze.map((s) => ({ label: s.label, code: s.code }))
    );

    const responseText = await this.callGeminiAPI(prompt);

    // Parse response
    const { entries, commonPatterns } = parseGeminiResponse(responseText, labelToStudentId);

    // Add position numbers
    const entriesWithPosition: WalkthroughEntry[] = entries.map((entry, index) => ({
      ...entry,
      position: index + 1,
    }));

    return {
      sessionId: input.sessionId,
      entries: entriesWithPosition,
      summary: {
        totalSubmissions,
        filteredOut: filteredOutCount,
        analyzedSubmissions: toAnalyze.length,
        commonPatterns,
        warning,
      },
      generatedAt: new Date(),
    };
  }

  /**
   * Call Gemini API with the given prompt
   */
  private async callGeminiAPI(prompt: string): Promise<string> {
    const url = `${GEMINI_API_URL}/${GEMINI_MODEL}:generateContent?key=${this.apiKey}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorBody = await response.text();

        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        }

        if (response.status === 401 || response.status === 403) {
          throw new Error('Invalid Gemini API key. Please check your configuration.');
        }

        throw new Error(`Gemini API error (${response.status}): ${errorBody}`);
      }

      const data = await response.json();

      // Extract text from Gemini response
      const candidates = data.candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error('No response generated by Gemini');
      }

      const content = candidates[0].content;
      if (!content || !content.parts || content.parts.length === 0) {
        throw new Error('Empty response from Gemini');
      }

      return content.parts[0].text || '';
    } catch (error) {
      clearTimeout(timeout);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Analysis timed out. Try with fewer students.');
        }
        throw error;
      }

      throw new Error('Unknown error calling Gemini API');
    }
  }
}

// Export singleton instance for convenience
let defaultService: GeminiAnalysisService | null = null;

export function getGeminiService(): GeminiAnalysisService {
  if (!defaultService) {
    defaultService = new GeminiAnalysisService();
  }
  return defaultService;
}

// Export for testing
export { filterSubmissions, buildPrompt, parseGeminiResponse, calculateDiffRatio };
