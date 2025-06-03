'use client';

import React, { useState, useMemo } from 'react';
import InstructorCard from '@/components/InstructorCard';
import { instructors } from '@/data/instructors';
import InstructorSearch from '@/components/InstructorSearch';
import InstructorFilter from '@/components/InstructorFilter';
import { Star, CircleDollarSign } from 'lucide-react';
import Link from 'next/link';

export default function InstructorsPage() {
  const [searchValue, setSearchValue] = useState('');
  const [filter, setFilter] = useState('popular');

  const filteredInstructors = useMemo(() => {
    const searchLower = searchValue.toLowerCase();

    // Filter by search term
    let filtered = instructors.filter(
      (instructor) =>
        instructor.name.toLowerCase().includes(searchLower) ||
        instructor.title.toLowerCase().includes(searchLower) ||
        instructor.bio.toLowerCase().includes(searchLower)
    );

    // Sort based on filter
    switch (filter) {
      case 'rating':
        filtered = [...filtered].sort((a, b) => b.rating - a.rating);
        break;
      case 'courses':
        filtered = [...filtered].sort((a, b) => b.courseCount - a.courseCount);
        break;
      case 'students':
        filtered = [...filtered].sort(
          (a, b) => b.studentCount - a.studentCount
        );
        break;
      case 'popular':
      default:
        // Assume popular is a combination of rating and student count
        filtered = [...filtered].sort(
          (a, b) =>
            b.rating * 0.5 +
            b.studentCount * 0.0001 -
            (a.rating * 0.5 + a.studentCount * 0.0001)
        );
        break;
    }

    return filtered;
  }, [searchValue, filter]);

  return (
    <div className="container mx-auto px-10 py-6 md:py-8">
      <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-medium mb-1 md:mb-2 text-gray-900">
        Our Instructors
      </h1>
      <p className="mb-4 md:mb-8 text-base sm:text-lg md:text-xl text-gray-500">
        Learn from the best blockchain experts in the industry
      </p>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6 md:mb-8">
        <InstructorSearch
          searchValue={searchValue}
          onSearchChange={setSearchValue}
        />

        <InstructorFilter filter={filter} onFilterChange={setFilter} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {filteredInstructors.map((instructor) => (
          <InstructorCard key={instructor.id} instructor={instructor} />
        ))}
      </div>

      <div className="mt-10 md:mt-16 mb-6 md:mb-8">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-4">
          Become an Instructor
        </h2>
        <div className="flex flex-col md:flex-row items-start gap-4 p-4 md:p-0 bg-gray-50 rounded-lg">
          <div className="md:w-[80%]">
            <p className="text-sm sm:text-base md:text-lg text-gray-500 md:flex-1 mb-4 md:mb-0 md:max-w-[60%]">
              Join our growing community of blockchain educators and share your
              expertise with students around the world. ChainVerse Academy
              instructors earn XLM through course purchases and receive ongoing
              royalties.
            </p>
          </div>
          <div className="w-full md:w-auto flex justify-center md:justify-end">
            <Link href="/instructor_register">
              <button className="w-full md:w-auto px-6 py-3 rounded-lg bg-gradient-to-r from-[#4361EE] to-[#C48BFC] text-sm sm:text-base md:text-lg font-bold text-white">
                Apply To Teach
              </button>
            </Link>
          </div>
        </div>

        {/* Bottom cards */}
        <div className="mt-6 space-y-6 md:space-y-0">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="w-full md:flex-1 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <Star size={24} className="md:w-8 md:h-8" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 text-lg md:text-xl">
                    Build Your Reputation
                  </h3>
                  <p className="text-sm md:text-base text-gray-600">
                    Establish yourself as a thought leader
                  </p>
                </div>
              </div>
            </div>

            <div className="w-full md:flex-1 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-[#A855F71A]/80 flex items-center justify-center text-purple-500">
                  <CircleDollarSign size={24} className="md:w-8 md:h-8" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 text-lg md:text-xl">
                    Earn Crypto
                  </h3>
                  <p className="text-sm md:text-base text-gray-600">
                    Get paid in XLM for your courses
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
