'use client';

import React from 'react';
import { useAnalyticsMetrics } from '@/src/hooks/useAnalyticsMetrics';

export const AnalyticsCards: React.FC = () => {
  const { metrics, isLoading, error } = useAnalyticsMetrics();

  if (error) {
    return (
      <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-600 text-sm">
        {error}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-pulse">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gray-200 rounded-lg" />
            </div>
            <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
            <div className="h-8 bg-gray-200 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <div key={metric.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition">
            <div className="flex items-center justify-between mb-4">
              <div className={`${metric.iconBg} p-3 rounded-lg`}>
                <Icon size={24} className={metric.iconColor} />
              </div>
            </div>
            <p className="text-gray-600 text-sm font-medium mb-1">{metric.title}</p>
            <p className="text-3xl font-bold text-gray-900">{metric.value}</p>
            {metric.change && (
              <p className={`text-sm mt-1 ${metric.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                {metric.change} <span className="text-gray-400">{metric.description}</span>
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};
