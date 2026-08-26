'use client';

import React, { useState } from 'react';
import { BookOpen, AlertCircle } from 'lucide-react';

interface SecureCoverImageProps {
  src?: string;
  alt: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASSES = {
  sm: 'w-16 h-20',
  md: 'w-24 h-32',
  lg: 'w-40 h-56',
} as const;

function sanitizeSrc(src: string): string | null {
  try {
    const url = new URL(src, window.location.origin);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function SecureCoverImage({ src, alt, className = '', size = 'md' }: SecureCoverImageProps) {
  const [loadError, setLoadError] = useState(false);
  const [loadStarted, setLoadStarted] = useState(false);

  const sanitizedSrc = src ? sanitizeSrc(src) : null;
  const showFallback = !sanitizedSrc || loadError;

  return (
    <div
      className={`${SIZE_CLASSES[size]} rounded-lg overflow-hidden flex-shrink-0 ${className}`}
      role="img"
      aria-label={alt}
    >
      {showFallback ? (
        <div className="w-full h-full bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center">
          <BookOpen className="w-1/2 h-1/2 text-indigo-400" aria-hidden="true" />
        </div>
      ) : (
        <>
          {!loadStarted && (
            <div className="w-full h-full bg-gray-100 animate-pulse" />
          )}
          <img
            src={sanitizedSrc}
            alt={alt}
            onLoad={() => setLoadStarted(true)}
            onError={() => setLoadError(true)}
            className={`w-full h-full object-cover ${loadStarted ? '' : 'hidden'}`}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </>
      )}
    </div>
  );
}

interface CoverImageGalleryProps {
  covers: { src?: string; alt: string; format?: string }[];
}

export function CoverImageGallery({ covers }: CoverImageGalleryProps) {
  if (covers.length === 0) return null;

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {covers.map((cover, i) => (
        <div key={i} className="flex-shrink-0">
          <SecureCoverImage src={cover.src} alt={cover.alt} size="md" />
          {cover.format && (
            <p className="text-xs text-gray-500 text-center mt-1">{cover.format}</p>
          )}
        </div>
      ))}
    </div>
  );
}
