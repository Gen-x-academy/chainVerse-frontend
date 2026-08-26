'use client';

import React from 'react';
import { BookOpen, Clock, Trophy, TrendingUp } from 'lucide-react';

interface Stat {
  label: string;
  value: string;
}

interface StudentStatsGridProps {
  stats: Stat[];
  isLoading?: boolean;
}

const STAT_ICONS = [BookOpen, Clock, Trophy, TrendingUp];
const STAT_COLORS = [
  'bg-blue-100 text-blue-600',
  'bg-orange-100 text-orange-600',
  'bg-green-100 text-green-600',
  'bg-purple-100 text-purple-600',
];

export function StudentStatsGrid({ stats, isLoading }: StudentStatsGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 bg-gray-200 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat, index) => {
        const Icon = STAT_ICONS[index];
        return (
          <div
            key={index}
            className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 hover:shadow-md transition"
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-1">{stat.label}</p>
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className={`${STAT_COLORS[index]} p-3 rounded-lg flex-shrink-0`}>
                <Icon size={24} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
