'use client';

import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { CourseFilters } from '../components/CourseFilters';
import { CourseList } from '../components/CourseList';
import { CourseCardSkeleton } from '../components/CourseCardSkeleton';
import { useCourses } from '../hooks';
import { SectionContainer } from '@/shared/components/layout/SectionContainer';

const COURSES_PER_PAGE = 6;

export const CoursesPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLevel, setSelectedLevel] = useState('All');
  const [priceRange, setPriceRange] = useState(500);
  const [currentPage, setCurrentPage] = useState(1);

  const { courses, isLoading, error } = useCourses();

  // #269 — reset to page 1 whenever any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategories, selectedLevel, priceRange]);

  const filtered = courses.filter((course) => {
    const matchesSearch =
      !searchQuery ||
      course.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategories.length === 0 ||
      selectedCategories.includes(course.category ?? '');
    const matchesLevel =
      selectedLevel === 'All' ||
      (course.level ?? '').toLowerCase() === selectedLevel.toLowerCase();
    const matchesPrice =
      course.price == null || course.price <= priceRange;
    return matchesSearch && matchesCategory && matchesLevel && matchesPrice;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / COURSES_PER_PAGE));
  const paginated = filtered.slice(
    (currentPage - 1) * COURSES_PER_PAGE,
    currentPage * COURSES_PER_PAGE
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <SectionContainer className="py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Explore Courses</h1>
          <p className="text-gray-600 mt-2">Discover blockchain, DeFi, NFTs, and smart contract courses.</p>
        </div>

        <div className="mb-8">
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search courses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg border border-red-200 bg-red-50 text-red-600 text-sm">
            {error}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-8">
          <CourseFilters
            selectedCategories={selectedCategories}
            selectedLevel={selectedLevel}
            priceRange={priceRange}
            onCategoryChange={setSelectedCategories}
            onLevelChange={setSelectedLevel}
            onPriceChange={setPriceRange}
          />

          <div className="flex-1">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: COURSES_PER_PAGE }).map((_, i) => (
                  <CourseCardSkeleton key={i} />
                ))}
              </div>
            ) : (
              <CourseList courses={paginated} />
            )}

            {!isLoading && totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg ${
                      currentPage === page
                        ? 'bg-indigo-600 text-white'
                        : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </SectionContainer>
    </div>
  );
};
