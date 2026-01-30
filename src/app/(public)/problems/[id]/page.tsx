/**
 * Public problem page (unauthenticated)
 *
 * Displays problem title, description, and a click-to-reveal solution.
 * Server-rendered with OG meta tags for link previews.
 */

import { cache } from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createStorage } from '@/server/persistence';
import MarkdownContent from '@/components/MarkdownContent';

type Params = {
  params: Promise<{ id: string }>;
};

const getProblem = cache(async function getProblem(id: string) {
  const storage = await createStorage(process.env.SUPABASE_SECRET_KEY!);
  return storage.problems.getById(id);
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

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">{problem.title}</h1>

      {problem.description && (
        <div className="mb-8">
          <MarkdownContent content={problem.description} />
        </div>
      )}

      {problem.solution && (
        <details className="mb-8">
          <summary className="cursor-pointer text-lg font-semibold text-gray-700 hover:text-gray-900 select-none">
            Show Solution
          </summary>
          <pre className="mt-4 bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
            <code className="text-sm font-mono">{problem.solution}</code>
          </pre>
        </details>
      )}

    </div>
  );
}
