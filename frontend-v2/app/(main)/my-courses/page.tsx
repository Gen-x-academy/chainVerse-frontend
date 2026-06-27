import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Courses — ChainVerse',
};

export default function MyCoursesPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="text-6xl" aria-hidden="true">📚</div>
      <h1 className="text-3xl font-bold text-gray-900">My Courses</h1>
      <p className="text-gray-500 max-w-md">
        Your enrolled courses and learning progress will appear here. Full course tracking coming soon!
      </p>
      <Link
        href="/courses"
        className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
      >
        Browse Courses
      </Link>
    </div>
  );
}
