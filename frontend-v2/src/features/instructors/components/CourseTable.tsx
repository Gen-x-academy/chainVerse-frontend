"use client";

import React from "react";
import { Pencil, Trash2 } from "lucide-react";
import { DataTable, TableColumn } from "@/components/ui/DataTable";

interface Course {
  id: number;
  title: string;
  students: number;
  revenue: string;
  status: "Published" | "Draft" | "Archived";
}

const courses: Course[] = [
  {
    id: 1,
    title: "Advanced React Patterns",
    students: 234,
    revenue: "$5,200",
    status: "Published",
  },
  {
    id: 2,
    title: "TypeScript Mastery",
    students: 189,
    revenue: "$4,100",
    status: "Published",
  },
  {
    id: 3,
    title: "Node.js Backend Development",
    students: 156,
    revenue: "$3,800",
    status: "Published",
  },
  {
    id: 4,
    title: "Web3 & Smart Contracts",
    students: 98,
    revenue: "$2,200",
    status: "Draft",
  },
  {
    id: 5,
    title: "Solidity for Beginners",
    students: 67,
    revenue: "$1,500",
    status: "Draft",
  },
];

export const CourseTable: React.FC = () => {
  const columns: TableColumn<Course>[] = [
    {
      key: "title",
      header: "Title",
      render: (value) => (
        <span className="font-medium text-gray-900">{value}</span>
      ),
    },
    {
      key: "students",
      header: "Students",
      render: (value) => <span className="text-gray-600">{value}</span>,
    },
    {
      key: "revenue",
      header: "Revenue",
      render: (value) => (
        <span className="font-semibold text-gray-900">{value}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (value) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            value === "Published"
              ? "bg-green-100 text-green-800"
              : value === "Draft"
                ? "bg-yellow-100 text-yellow-800"
                : "bg-gray-100 text-gray-800"
          }`}
        >
          {value}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Your Courses</h2>
      <DataTable
        data={courses}
        columns={columns}
        onRowClick={(row) => console.log("Course clicked:", row)}
      />
    </div>
  );
};
