'use client';

import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { CourseFilters } from '../components/CourseFilters';
import { CourseList } from '../components/CourseList';

const MOCK_COURSES = [
  { id: '1', title: 'Introduction to Blockchain', instructor: 'Jane Doe', category: 'Blockchain', level: 'Beginner', price: 49.99, rating: 4.8, students: 1234, image: '' },
  { id: '2', title: 'Advanced Smart Contracts', instructor: 'John Smith', category: 'Smart Contracts', level: 'Advanced', price: 89.99, rating: 4.9, students: 892, image: '' },
  { id: '3', title: 'DeFi Fundamentals', instructor: 'Alex Rivera', category: 'DeFi', level: 'Beginner', price: 39.99, rating: 4.7, students: 2105, image: '' },
  { id: '4', title: 'NFT Development Workshop', instructor: 'Sarah Chen', category: 'NFTs', level: 'Intermediate', price: 69.99, rating: 4.6, students: 756, image: '' },
  { id: '5', title: 'Solidity Masterclass', instructor: 'Mike Johnson', category: 'Smart Contracts', level: 'Advanced', price: 99.99, rating: 4.9, students: 1567, image: '' },
  { id: '6', title: 'Blockchain for Business', instructor: 'Emma Wilson', category: 'Blockchain', level: 'Beginner', price: 0, rating: 4.5, students: 3420, image: '' },
  { id: '7', title: 'Yield Farming Strategies', instructor: 'David Lee', category: 'DeFi', level: 'Advanced', price: 79.99, rating: 4.8, students: 645, image: '' },
  { id: '8', title: 'NFT Art & Collectibles', instructor: 'Lisa Park', category: 'NFTs', level: 'Beginner', price: 29.99, rating: 4.4, students: 1890, image: '' },
  { id: '9', title: 'Ethereum Development', instructor: 'Chris Brown', category: 'Blockchain', level: 'Intermediate', price: 59.99, rating: 4.7, students: 1102, image: '' },
  { id: '10', title: 'DeFi Protocol Design', instructor: 'Anna Martinez', category: 'DeFi', level: 'Intermediate', price: 74.99, rating: 4.6, students: 534, image: '' },
  { id: '11', title: 'Smart Contract Security', instructor: 'Tom Harris', category: 'Smart Contracts', level: 'Advanced', price: 109.99, rating: 4.9, students: 423, image: '' },
  { id: '12', title: 'Web3 & NFT Marketplace', instructor: 'Rachel Kim', category: 'NFTs', level: 'Intermediate', price: 64.99, rating: 4.5, students: 978, image: '' },
];

export const CoursesPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLevel, setSelectedLevel] = useState('All');
  const [priceRange, setPriceRange] = useState(500);
  const [currentPage, setCurrentPage] = useState(1);
  const coursesPerPage = 6;

  const totalPages = Math.ceil(MOCK_COURSES.length / coursesPerPage);
  const startIndex = (currentPage - 1) * coursesPerPage;
  const paginatedCourses = MOCK_COURSES.slice(startIndex, startIndex + coursesPerPage);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Explore Courses</h1>
          <p className="text-gray-600 mt-2">Discover blockchain, DeFi, NFTs, and smart contract courses.</p>
        </div>

        {/* Search Bar */}
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

        {/* Main Layout: Sidebar + Grid */}
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
            <CourseList courses={paginatedCourses} />

            {/* Pagination */}
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
          </div>
        </div>
      </div>
    </div>
  );
};
