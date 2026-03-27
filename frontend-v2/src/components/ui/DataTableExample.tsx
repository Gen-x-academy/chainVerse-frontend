'use client';

import React, { useState } from 'react';
import { DataTable, TableColumn } from './DataTable';
import { Pencil, Trash2, Users, DollarSign, Calendar } from 'lucide-react';

// Example 1: Courses data
interface Course {
  id: number;
  title: string;
  students: number;
  revenue: string;
  status: 'Published' | 'Draft' | 'Archived';
  createdDate: string;
}

const coursesData: Course[] = [
  { id: 1, title: 'Advanced React Patterns', students: 234, revenue: '$5,200', status: 'Published', createdDate: '2024-01-15' },
  { id: 2, title: 'TypeScript Mastery', students: 189, revenue: '$4,100', status: 'Published', createdDate: '2024-01-20' },
  { id: 3, title: 'Node.js Backend Development', students: 156, revenue: '$3,800', status: 'Draft', createdDate: '2024-02-01' },
  { id: 4, title: 'Web3 & Smart Contracts', students: 98, revenue: '$2,200', status: 'Draft', createdDate: '2024-02-10' },
  { id: 5, title: 'Solidity for Beginners', students: 67, revenue: '$1,500', status: 'Archived', createdDate: '2024-02-15' },
];

// Example 2: Users data
interface User {
  id: number;
  name: string;
  email: string;
  role: 'Admin' | 'Instructor' | 'Student';
  lastLogin: string;
  active: boolean;
}

const usersData: User[] = [
  { id: 1, name: 'John Doe', email: 'john@example.com', role: 'Admin', lastLogin: '2024-03-27 14:30', active: true },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'Instructor', lastLogin: '2024-03-27 10:15', active: true },
  { id: 3, name: 'Bob Johnson', email: 'bob@example.com', role: 'Student', lastLogin: '2024-03-26 18:45', active: false },
  { id: 4, name: 'Alice Brown', email: 'alice@example.com', role: 'Student', lastLogin: '2024-03-27 09:20', active: true },
];

export const DataTableExample: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'courses' | 'users'>('courses');

  const courseColumns: TableColumn<Course>[] = [
    {
      key: 'title',
      header: 'Course Title',
      render: (value) => <span className="font-medium text-gray-900">{value}</span>,
    },
    {
      key: 'students',
      header: 'Students',
      render: (value) => (
        <div className="flex items-center gap-2">
          <Users size={16} className="text-gray-400" />
          <span className="text-gray-600">{value}</span>
        </div>
      ),
    },
    {
      key: 'revenue',
      header: 'Revenue',
      render: (value) => (
        <div className="flex items-center gap-2">
          <DollarSign size={16} className="text-gray-400" />
          <span className="font-semibold text-gray-900">{value}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (value) => {
        const colors = {
          Published: 'bg-green-100 text-green-800',
          Draft: 'bg-yellow-100 text-yellow-800',
          Archived: 'bg-gray-100 text-gray-800',
        };
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[value as keyof typeof colors]}`}>
            {value}
          </span>
        );
      },
    },
    {
      key: 'createdDate',
      header: 'Created',
      render: (value) => (
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-gray-400" />
          <span className="text-gray-600">{value}</span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <button className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition">
            <Pencil size={16} />
          </button>
          <button className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  const userColumns: TableColumn<User>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (value) => <span className="font-medium text-gray-900">{value}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      render: (value) => <span className="text-gray-600">{value}</span>,
    },
    {
      key: 'role',
      header: 'Role',
      render: (value) => {
        const colors = {
          Admin: 'bg-purple-100 text-purple-800',
          Instructor: 'bg-blue-100 text-blue-800',
          Student: 'bg-green-100 text-green-800',
        };
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[value as keyof typeof colors]}`}>
            {value}
          </span>
        );
      },
    },
    {
      key: 'lastLogin',
      header: 'Last Login',
      render: (value) => <span className="text-gray-600 text-sm">{value}</span>,
    },
    {
      key: 'active',
      header: 'Status',
      render: (value) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {value ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">DataTable Component Examples</h1>
        <p className="text-gray-600">Demonstrating reusable DataTable with different data types and column configurations</p>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('courses')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'courses'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Courses Table
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'users'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Users Table
          </button>
        </nav>
      </div>

      {activeTab === 'courses' && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Courses Management</h2>
          <DataTable
            data={coursesData}
            columns={courseColumns}
            onRowClick={(row) => console.log('Course clicked:', row)}
          />
        </div>
      )}

      {activeTab === 'users' && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Users Management</h2>
          <DataTable
            data={usersData}
            columns={userColumns}
            rowClassName={(row) => row.active ? '' : 'bg-gray-50'}
            onRowClick={(row) => console.log('User clicked:', row)}
          />
        </div>
      )}
    </div>
  );
};
