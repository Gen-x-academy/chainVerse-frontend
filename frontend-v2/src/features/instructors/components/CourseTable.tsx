'use client';

import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';

const courses = [
  { id: 1, title: 'Advanced React Patterns', students: 234, revenue: '$5,200', status: 'Published' },
  { id: 2, title: 'TypeScript Mastery', students: 189, revenue: '$4,100', status: 'Published' },
  { id: 3, title: 'Node.js Backend Development', students: 156, revenue: '$3,800', status: 'Published' },
  { id: 4, title: 'Web3 & Smart Contracts', students: 98, revenue: '$2,200', status: 'Draft' },
  { id: 5, title: 'Solidity for Beginners', students: 67, revenue: '$1,500', status: 'Draft' },
];

export const CourseTable: React.FC = () => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Your Courses</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Title</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Students</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Revenue</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((course) => (
              <tr key={course.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                <td className="py-4 px-4">
                  <span className="font-medium text-gray-900">{course.title}</span>
                </td>
                <td className="py-4 px-4 text-gray-600">{course.students}</td>
                <td className="py-4 px-4 font-semibold text-gray-900">{course.revenue}</td>
                <td className="py-4 px-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      course.status === 'Published'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {course.status}
                  </span>
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center gap-2">
                    <button className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition">
                      <Pencil size={16} />
                    </button>
                    <button className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
