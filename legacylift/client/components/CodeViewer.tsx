import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface Props {
  content: string;
}

export default function CodeViewer({ content }: Props) {
  return (
    <div className="prose prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
              <SyntaxHighlighter
                {...props}
                style={vscDarkPlus}
                language={match[1]}
                PreTag="div"
                className="rounded-lg !bg-[#1e1e1e] border border-gray-700 shadow-lg my-4"
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code {...props} className="bg-gray-700 px-1 py-0.5 rounded text-sm text-red-300">
                {children}
              </code>
            );
          },
          // Style normal text elements
          h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-blue-400 mt-6 mb-4" {...props} />,
          h2: ({node, ...props}) => <h2 className="text-xl font-bold text-green-400 mt-6 mb-3" {...props} />,
          h3: ({node, ...props}) => <h3 className="text-lg font-bold text-yellow-400 mt-4 mb-2" {...props} />,
          p: ({node, ...props}) => <p className="text-gray-300 mb-4 leading-relaxed" {...props} />,
          ul: ({node, ...props}) => <ul className="list-disc pl-6 mb-4 text-gray-300" {...props} />,
          li: ({node, ...props}) => <li className="mb-1" {...props} />,
          strong: ({node, ...props}) => <strong className="text-white font-semibold" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}