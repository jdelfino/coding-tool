'use client';

/**
 * MarkdownContent Component
 *
 * Renders markdown content with styling for common elements like
 * headers, lists, code blocks, bold, italic, and links.
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export default function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        components={{
          // Headers
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold text-gray-900 mt-4 mb-2 first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-bold text-gray-900 mt-3 mb-2 first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold text-gray-900 mt-3 mb-1 first:mt-0">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-semibold text-gray-900 mt-2 mb-1 first:mt-0">{children}</h4>
          ),
          h5: ({ children }) => (
            <h5 className="text-sm font-semibold text-gray-900 mt-2 mb-1 first:mt-0">{children}</h5>
          ),
          h6: ({ children }) => (
            <h6 className="text-sm font-medium text-gray-800 mt-2 mb-1 first:mt-0">{children}</h6>
          ),
          // Paragraphs
          p: ({ children }) => (
            <p className="text-gray-700 mb-2 last:mb-0">{children}</p>
          ),
          // Lists
          ul: ({ children }) => (
            <ul className="list-disc list-inside text-gray-700 mb-2 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside text-gray-700 mb-2 space-y-1">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-gray-700">{children}</li>
          ),
          // Code
          code: ({ className, children, ...props }) => {
            // Check if this is a code block (has language class) or inline code
            const isCodeBlock = className?.includes('language-');
            if (isCodeBlock) {
              return (
                <code className={`block bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto text-sm font-mono ${className || ''}`} {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className="bg-gray-200 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="mb-2 last:mb-0">{children}</pre>
          ),
          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              {children}
            </a>
          ),
          // Strong and emphasis
          strong: ({ children }) => (
            <strong className="font-bold text-gray-900">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic">{children}</em>
          ),
          // Blockquote
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-600 my-2">
              {children}
            </blockquote>
          ),
          // Horizontal rule
          hr: () => (
            <hr className="border-t border-gray-300 my-4" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
