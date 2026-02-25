import React from 'react';
import { BookOpen, Clock, Trophy, TrendingUp } from 'lucide-react';

export const StudentDashboardPage: React.FC = () => {
  // Mock data
  const enrolledCourses = [
    {
      id: 1,
      title: 'Advanced React Patterns',
      instructor: 'Jane Doe',
      progress: 65,
      image: 'bg-blue-500',
      completedLessons: 13,
      totalLessons: 20,
    },
    {
      id: 2,
      title: 'TypeScript Mastery',
      instructor: 'John Smith',
      progress: 42,
      image: 'bg-purple-500',
      completedLessons: 8,
      totalLessons: 19,
    },
    {
      id: 3,
      title: 'Node.js Backend Development',
      instructor: 'Alex Johnson',
      progress: 28,
      image: 'bg-green-500',
      completedLessons: 5,
      totalLessons: 18,
    },
  ];

  const stats = [
    { label: 'Courses Enrolled', value: '6', icon: BookOpen, color: 'bg-blue-100 text-blue-600' },
    { label: 'Learning Hours', value: '24.5', icon: Clock, color: 'bg-orange-100 text-orange-600' },
    { label: 'Certificates Earned', value: '2', icon: Trophy, color: 'bg-green-100 text-green-600' },
    { label: 'Avg. Rating', value: '4.8', icon: TrendingUp, color: 'bg-purple-100 text-purple-600' },
  ];

  const recentActivity = [
    { course: 'React Patterns', action: 'Completed lesson: Advanced Hooks', time: '2 hours ago' },
    { course: 'TypeScript Mastery', action: 'Started new section: Generics', time: '1 day ago' },
    { course: 'Node.js Backend', action: 'Submitted assignment', time: '3 days ago' },
    { course: 'React Patterns', action: 'Earned certificate', time: '1 week ago' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl p-8 mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome back, Alex! 👋</h1>
          <p className="text-blue-100">You're making great progress! Keep up the momentum and complete your courses.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium mb-1">{stat.label}</p>
                    <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                  <div className={`${stat.color} p-3 rounded-lg`}>
                    <Icon size={24} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Enrolled Courses */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Your Learning Path</h2>
                <a href="/courses" className="text-indigo-600 hover:text-indigo-700 text-sm font-medium">
                  View All
                </a>
              </div>

              <div className="space-y-5">
                {enrolledCourses.map((course) => (
                  <div key={course.id} className="flex gap-4 p-4 border border-gray-100 rounded-lg hover:shadow-md transition">
                    <div className={`${course.image} w-24 h-24 rounded-lg flex-shrink-0`} />

                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 mb-1">{course.title}</h3>
                      <p className="text-sm text-gray-600 mb-3">by {course.instructor}</p>

                      {/* Progress */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-gray-600">
                          <span>{course.completedLessons} of {course.totalLessons} lessons</span>
                          <span className="font-semibold">{course.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-indigo-600 h-2 rounded-full transition-all"
                            style={{ width: `${course.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Recent Activity</h2>

              <div className="space-y-4">
                {recentActivity.map((activity, index) => (
                  <div key={index} className="pb-4 border-b border-gray-100 last:border-b-0 last:pb-0">
                    <div className="flex gap-3">
                      <div className="w-2 h-2 bg-indigo-600 rounded-full mt-2 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{activity.course}</p>
                        <p className="text-xs text-gray-600 mt-1">{activity.action}</p>
                        <p className="text-xs text-gray-500 mt-2">{activity.time}</p>
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
};
