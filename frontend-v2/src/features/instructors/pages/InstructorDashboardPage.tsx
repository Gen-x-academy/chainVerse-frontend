import React from 'react';
import { TrendingUp, Users, BookOpen, DollarSign, Eye, MessageSquare } from 'lucide-react';

export function InstructorDashboardPage() {
  // Mock data
  const stats = [
    { label: 'Total Students', value: '1,234', icon: Users, change: '+12%', color: 'bg-blue-100 text-blue-600' },
    { label: 'Total Revenue', value: '$45,320', icon: DollarSign, change: '+18%', color: 'bg-green-100 text-green-600' },
    { label: 'Active Courses', value: '8', icon: BookOpen, change: '+2', color: 'bg-purple-100 text-purple-600' },
    { label: 'Course Views', value: '12.5K', icon: Eye, change: '+5.2%', color: 'bg-orange-100 text-orange-600' },
  ];

  const recentCourses = [
    { id: 1, title: 'Advanced React Patterns', students: 234, revenue: '$5,200', status: 'Published' },
    { id: 2, title: 'TypeScript Mastery', students: 189, revenue: '$4,100', status: 'Published' },
    { id: 3, title: 'Node.js Backend Development', students: 156, revenue: '$3,800', status: 'Published' },
    { id: 4, title: 'Web3 & Smart Contracts', students: 98, revenue: '$2,200', status: 'Draft' },
  ];

  const recentReviews = [
    { student: 'John Doe', course: 'React Patterns', rating: 5, comment: 'Excellent course!' },
    { student: 'Jane Smith', course: 'TypeScript Mastery', rating: 4, comment: 'Very comprehensive' },
    { student: 'Alex Johnson', course: 'Node.js Backend', rating: 5, comment: 'Best course ever taken' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Instructor Dashboard</h1>
          <p className="text-gray-600 mt-2">Welcome back! Here's your teaching performance overview.</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition">
                <div className="flex items-center justify-between mb-4">
                  <div className={`${stat.color} p-3 rounded-lg`}>
                    <Icon size={24} />
                  </div>
                  <span className="text-sm font-semibold text-green-600">{stat.change}</span>
                </div>
                <p className="text-gray-600 text-SM text-sm font-medium mb-1">{stat.label}</p>
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
              </div>
            );
          })}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Courses */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Your Courses</h2>
                <a href="#" className="text-indigo-600 hover:text-indigo-700 text-sm font-medium">
                  View All
                </a>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Course Name</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Students</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Revenue</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentCourses.map((course) => (
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Recent Reviews */}
          <div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Recent Reviews</h2>
                <MessageSquare size={20} className="text-gray-400" />
              </div>

              <div className="space-y-5">
                {recentReviews.map((review, index) => (
                  <div key={index} className="pb-5 border-b border-gray-100 last:border-b-0 last:pb-0">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm">{review.student}</p>
                        <p className="text-xs text-gray-600">{review.course}</p>
                        <div className="flex items-center gap-1 mt-2 mb-1">
                          {[...Array(5)].map((_, i) => (
                            <span
                              key={i}
                              className={`text-xs ${i < review.rating ? '⭐' : '☆'}`}
                            >
                              {i < review.rating ? '★' : '☆'}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-gray-600 italic">"{review.comment}"</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
