'use client';

import React from 'react';
import { BookOpen, Headphones, Braille, Maximize, FileText } from 'lucide-react';

interface AlternateFormat {
  type: 'print' | 'ebook' | 'audiobook' | 'braille' | 'large-print';
  available: boolean;
  url?: string;
}

interface AccessibleMetadataProps {
  formats: AlternateFormat[];
  language?: string;
  pageCount?: number;
  readingLevel?: string;
  isbn?: string;
}

const FORMAT_ICONS: Record<AlternateFormat['type'], React.ElementType> = {
  print: BookOpen,
  ebook: FileText,
  audiobook: Headphones,
  braille: Braille,
  'large-print': Maximize,
};

const FORMAT_LABELS: Record<AlternateFormat['type'], string> = {
  print: 'Print',
  ebook: 'E-book',
  audiobook: 'Audiobook',
  braille: 'Braille',
  'large-print': 'Large Print',
};

export function AccessibleMetadata({
  formats,
  language,
  pageCount,
  readingLevel,
  isbn,
}: AccessibleMetadataProps) {
  const availableFormats = formats.filter(f => f.available);

  return (
    <div className="space-y-4">
      {/* Alternate Formats */}
      {availableFormats.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-2">Available Formats</h3>
          <div className="flex flex-wrap gap-2">
            {availableFormats.map((format) => {
              const Icon = FORMAT_ICONS[format.type];
              const content = (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-full hover:bg-gray-50 transition-colors">
                  <Icon className="w-4 h-4" aria-hidden="true" />
                  {FORMAT_LABELS[format.type]}
                </span>
              );

              return format.url ? (
                <a key={format.type} href={format.url} target="_blank" rel="noopener noreferrer">
                  {content}
                </a>
              ) : (
                <span key={format.type}>{content}</span>
              );
            })}
          </div>
        </div>
      )}

      {/* Book Details */}
      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-2">Book Details</h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {language && (
            <>
              <dt className="text-gray-500">Language</dt>
              <dd className="text-gray-900">{language}</dd>
            </>
          )}
          {pageCount && (
            <>
              <dt className="text-gray-500">Pages</dt>
              <dd className="text-gray-900">{pageCount.toLocaleString()}</dd>
            </>
          )}
          {readingLevel && (
            <>
              <dt className="text-gray-500">Reading Level</dt>
              <dd className="text-gray-900">{readingLevel}</dd>
            </>
          )}
          {isbn && (
            <>
              <dt className="text-gray-500">ISBN</dt>
              <dd className="text-gray-900 font-mono text-xs">{isbn}</dd>
            </>
          )}
        </dl>
      </div>

      {/* Accessibility note */}
      <p className="text-xs text-gray-400">
        Need a different format?{' '}
        <a href="/contact" className="text-indigo-600 hover:underline">
          Contact the library
        </a>{' '}
        for assistance.
      </p>
    </div>
  );
}
