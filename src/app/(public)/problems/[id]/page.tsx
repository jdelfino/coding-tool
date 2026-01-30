/**
 * Public problem page (unauthenticated)
 *
 * Displays problem title, description, and a click-to-reveal solution
 * with syntax highlighting. Includes a self-link for copy/paste into slides.
 * Server-rendered with OG meta tags for link previews.
 */

import { cache } from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { codeToHtml } from 'shiki';
import { getProblemRepository } from '@/server/persistence';
import { SERVICE_ROLE_MARKER } from '@/server/supabase/client';
import MarkdownContent from '@/components/MarkdownContent';

type Params = {
  params: Promise<{ id: string }>;
};

const getProblem = cache(async function getProblem(id: string) {
  const repo = getProblemRepository(SERVICE_ROLE_MARKER);
  return repo.getById(id);
});

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const problem = await getProblem(id);

  if (!problem) {
    return { title: 'Problem Not Found' };
  }

  return {
    title: problem.title,
    openGraph: {
      title: problem.title,
      description: problem.description || '',
    },
  };
}

export default async function PublicProblemPage({ params }: Params) {
  const { id } = await params;
  const problem = await getProblem(id);

  if (!problem) {
    notFound();
  }

  let solutionHtml: string | null = null;
  if (problem.solution) {
    solutionHtml = await codeToHtml(problem.solution, {
      lang: 'python',
      theme: 'github-dark',
    });
  }

  const publicUrl = `/problems/${problem.id}`;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{problem.title}</h1>

      <a href={publicUrl} className="text-sm text-blue-600 hover:underline mb-6 block">
        {publicUrl}
      </a>

      {problem.description && (
        <div className="mb-8">
          <MarkdownContent content={problem.description} />
        </div>
      )}

      {solutionHtml && (
        <details className="mb-8">
          <summary className="cursor-pointer text-lg font-semibold text-gray-700 hover:text-gray-900 select-none">
            Show Solution
          </summary>
          <div
            className="mt-4 rounded-lg overflow-x-auto [&_pre]:p-4 [&_pre]:text-sm"
            dangerouslySetInnerHTML={{ __html: solutionHtml }}
          />
        </details>
      )}

    </div>
  );
}
