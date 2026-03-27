'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const activityData = [
  { day: 'Mon', lessonsCompleted: 3, timeSpent: 45, quizzesTaken: 2 },
  { day: 'Tue', lessonsCompleted: 5, timeSpent: 62, quizzesTaken: 3 },
  { day: 'Wed', lessonsCompleted: 2, timeSpent: 30, quizzesTaken: 1 },
  { day: 'Thu', lessonsCompleted: 4, timeSpent: 55, quizzesTaken: 2 },
  { day: 'Fri', lessonsCompleted: 6, timeSpent: 78, quizzesTaken: 4 },
  { day: 'Sat', lessonsCompleted: 3, timeSpent: 42, quizzesTaken: 2 },
  { day: 'Sun', lessonsCompleted: 1, timeSpent: 20, quizzesTaken: 1 },
];

export const UserActivityChart: React.FC = () => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Weekly Activity</h2>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span className="text-gray-600">Lessons</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span className="text-gray-600">Time (min)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-purple-500 rounded"></div>
            <span className="text-gray-600">Quizzes</span>
          </div>
        </div>
      </div>
      
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={activityData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="day" 
              tick={{ fontSize: 12 }} 
              stroke="#9ca3af"
            />
            <YAxis 
              tick={{ fontSize: 12 }} 
              stroke="#9ca3af"
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
              labelStyle={{ color: '#374151', fontWeight: 'bold' }}
            />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="rect"
            />
            <Bar
              dataKey="lessonsCompleted"
              fill="#3b82f6"
              name="Lessons Completed"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="timeSpent"
              fill="#10b981"
              name="Time Spent (min)"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="quizzesTaken"
              fill="#8b5cf6"
              name="Quizzes Taken"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <p className="text-2xl font-bold text-blue-600">24</p>
          <p className="text-sm text-gray-600">Total Lessons</p>
        </div>
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <p className="text-2xl font-bold text-green-600">332</p>
          <p className="text-sm text-gray-600">Minutes Learned</p>
        </div>
        <div className="text-center p-3 bg-purple-50 rounded-lg">
          <p className="text-2xl font-bold text-purple-600">15</p>
          <p className="text-sm text-gray-600">Quizzes Completed</p>
        </div>
      </div>
    </div>
  );
};
