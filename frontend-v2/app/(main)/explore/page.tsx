import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Explore — ChainVerse',
};

export default function ExplorePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="text-6xl" aria-hidden="true">🔭</div>
      <h1 className="text-3xl font-bold text-gray-900">Explore</h1>
      <p className="text-gray-500 max-w-md">
        Discover curated learning paths, trending courses, and community highlights. Coming soon!
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
