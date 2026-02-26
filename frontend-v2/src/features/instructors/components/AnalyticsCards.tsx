'use client';

import React from 'react';
import { DollarSign, Users, BookOpen, Star } from 'lucide-react';

const stats = [
  { label: 'Total Revenue', value: '$1,240', icon: DollarSign, color: 'bg-green-100 text-green-600' },
  { label: 'Students', value: '342', icon: Users, color: 'bg-blue-100 text-blue-600' },
  { label: 'Courses', value: '8', icon: BookOpen, color: 'bg-purple-100 text-purple-600' },
  { label: 'Avg Rating', value: '4.7', icon: Star, color: 'bg-orange-100 text-orange-600' },
];

export const AnalyticsCards: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition">
            <div className="flex items-center justify-between mb-4">
              <div className={`${stat.color} p-3 rounded-lg`}>
                <Icon size={24} />
              </div>
            </div>
            <p className="text-gray-600 text-sm font-medium mb-1">{stat.label}</p>
            <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
          </div>
        );
      })}
    </div>
  );
};
