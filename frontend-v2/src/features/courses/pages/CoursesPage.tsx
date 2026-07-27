'use client';

import React, { Suspense, useState, useEffect, useMemo, useRef } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { CourseFilters } from '../components/CourseFilters';
import { CourseList } from '../components/CourseList';
import { CourseCardSkeleton } from '../components/CourseCardSkeleton';
import { useCourses } from '../hooks';
import { SectionContainer } from '@/src/shared/components/layout/SectionContainer';

const COURSES_PER_PAGE = 6;

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '...')[] = [];
  pages.push(1);
  if (current > 3) pages.push('...');
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}

function CourseGrid() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLevel, setSelectedLevel] = useState('All');
  const [priceRange, setPriceRange] = useState(500);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const { courses, isLoading, error } = useCourses();

  // #783 — press "/" to focus the search input (like GitHub / Notion / Linear)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // #269 — reset to page 1 whenever any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategories, selectedLevel, priceRange]);

  const filtered = useMemo(
    () =>
      courses.filter((course) => {
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
      }),
    [courses, searchQuery, selectedCategories, selectedLevel, priceRange]
  );

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filtered.length / COURSES_PER_PAGE)),
    [filtered.length]
  );

  const paginated = useMemo(
    () =>
      filtered.slice(
        (currentPage - 1) * COURSES_PER_PAGE,
        currentPage * COURSES_PER_PAGE
      ),
    [filtered, currentPage]
  );

  return (
    <>
      <div className="mb-8">
        <div className="relative max-w-xl">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            size={20}
          />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search courses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg bg-white focus-ring focus:border-transparent"
          />
          {/* #783 — "/" shortcut hint badge */}
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-1 rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-gray-500 select-none">
            /
          </kbd>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg border border-red-200 bg-red-50 text-red-600 text-sm">
          {error}
        </div>
      )}

      <button
        className="lg:hidden flex items-center gap-2 px-4 py-2 border rounded-lg mb-4"
        onClick={() => setShowFilters(!showFilters)}
      >
        <SlidersHorizontal size={18} />
        Filters {selectedCategories.length > 0 && `(${selectedCategories.length})`}
      </button>

      <div className="flex flex-col lg:flex-row gap-8 min-w-0">
        <div className={`${showFilters ? 'block' : 'hidden'} lg:block`}>
          <CourseFilters
            selectedCategories={selectedCategories}
            selectedLevel={selectedLevel}
            priceRange={priceRange}
            onCategoryChange={setSelectedCategories}
            onLevelChange={setSelectedLevel}
            onPriceChange={setPriceRange}
          />
        </div>

        <div className="flex-1 min-w-0">
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
            <div className="overflow-x-auto mt-8">
              <div className="flex items-center justify-center gap-2 min-w-max mx-auto">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  aria-label="Go to previous page"
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>

                {getPageNumbers(currentPage, totalPages).map((page, idx) =>
                  page === '...' ? (
                    <span key={`ellipsis-${idx}`} className="px-2 py-2 text-sm text-gray-400">...</span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page as number)}
                      aria-label={`Go to page ${page}`}
                      aria-current={currentPage === page ? 'page' : undefined}
                      className={`px-4 py-2 text-sm font-medium rounded-lg ${
                        currentPage === page
                          ? 'bg-indigo-600 text-white'
                          : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  )
                )}

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  aria-label="Go to next page"
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const CoursesGridFallback = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {Array.from({ length: COURSES_PER_PAGE }).map((_, i) => (
      <CourseCardSkeleton key={i} />
    ))}
  </div>
);

/** Fixes #346 — Suspense boundary enables Next.js HTML streaming for this page. */
export const CoursesPage = () => (
  <div className="min-h-screen bg-gray-50">
    <SectionContainer className="py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Explore Courses</h1>
        <p className="text-gray-600 mt-2">
          Discover blockchain, DeFi, NFTs, and smart contract courses.
        </p>
      </div>

      <Suspense fallback={<CoursesGridFallback />}>
        <CourseGrid />
      </Suspense>
    </SectionContainer>
  </div>
);
