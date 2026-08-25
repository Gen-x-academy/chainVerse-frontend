'use client';

import React from 'react';
import Link from 'next/link';
import { BookOpen, ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { SecureCoverImage } from './SecureCoverImage';

interface SeriesVolume {
  id: string;
  title: string;
  volumeNumber: number;
  coverUrl?: string;
  isCurrent?: boolean;
}

interface SeriesNavigationProps {
  seriesName: string;
  seriesId: string;
  volumes: SeriesVolume[];
  currentVolumeId?: string;
}

export function SeriesNavigation({
  seriesName,
  seriesId,
  volumes,
  currentVolumeId,
}: SeriesNavigationProps) {
  if (volumes.length === 0) return null;

  const currentIndex = volumes.findIndex(v => v.id === currentVolumeId);
  const prevVolume = currentIndex > 0 ? volumes[currentIndex - 1] : null;
  const nextVolume = currentIndex < volumes.length - 1 ? volumes[currentIndex + 1] : null;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Series Header */}
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-500" />
          <h3 className="font-medium text-gray-900">{seriesName}</h3>
          <span className="text-sm text-gray-500">
            ({volumes.length} volume{volumes.length !== 1 ? 's' : ''})
          </span>
        </div>
      </div>

      {/* Volume Grid */}
      <div className="p-4">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {volumes.map((volume) => {
            const isCurrent = volume.id === currentVolumeId;
            return (
              <Link
                key={volume.id}
                href={`/courses/${volume.id}`}
                className={`relative rounded-lg overflow-hidden border-2 transition ${
                  isCurrent
                    ? 'border-indigo-500 ring-2 ring-indigo-200'
                    : 'border-transparent hover:border-gray-300'
                }`}
              >
                <SecureCoverImage
                  src={volume.coverUrl}
                  alt={`Volume ${volume.volumeNumber}: ${volume.title}`}
                  size="sm"
                  className="w-full !h-24 !w-auto rounded-none"
                />
                <div className="p-2 text-center">
                  <span className="text-xs font-medium text-gray-700">
                    Vol. {volume.volumeNumber}
                  </span>
                </div>
                {isCurrent && (
                  <div className="absolute top-1 right-1 bg-indigo-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                    Current
                  </div>
                )}
              </Link>
            );
          })}
        </div>

        {/* Previous/Next Navigation */}
        {(prevVolume || nextVolume) && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            {prevVolume ? (
              <Link
                href={`/courses/${prevVolume.id}`}
                className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
              >
                <ChevronLeft className="w-4 h-4" />
                Vol. {prevVolume.volumeNumber}
              </Link>
            ) : (
              <span />
            )}
            {nextVolume ? (
              <Link
                href={`/courses/${nextVolume.id}`}
                className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
              >
                Vol. {nextVolume.volumeNumber}
                <ChevronRight className="w-4 h-4" />
              </Link>
            ) : (
              <span />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
