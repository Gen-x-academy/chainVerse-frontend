'use client';

import React, { useState, useMemo } from 'react';
import InstructorCard from '@/components/InstructorCard';
import { instructors } from '@/data/instructors';
import InstructorSearch from '@/components/InstructorSearch';
import InstructorFilter from '@/components/InstructorFilter';
import { Star, CircleDollarSign } from 'lucide-react';

export default function InstructorsPage() {
  const [searchValue, setSearchValue] = useState('');
  const [filter, setFilter] = useState('popular');

  const filteredInstructors = useMemo(() => {
    const searchLower = searchValue.toLowerCase();
    
    // Filter by search term
    let filtered = instructors.filter((instructor) => 
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
        filtered = [...filtered].sort((a, b) => b.studentCount - a.studentCount);
        break;
      case 'popular':
      default:
        // Assume popular is a combination of rating and student count
        filtered = [...filtered].sort((a, b) => 
          (b.rating * 0.5 + b.studentCount * 0.0001) - 
          (a.rating * 0.5 + a.studentCount * 0.0001)
        );
        break;
    }
    
    return filtered;
  }, [searchValue, filter]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl md:text-[36px] font-[500px] mb-2 text-gray-900">Our Instructors</h1>
      <p className='mb-8 text-[20px] font-[400px] text-[#00000066]'>Learn from the best blockchain experts in the industry</p>
      
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
        <InstructorSearch 
          searchValue={searchValue} 
          onSearchChange={setSearchValue} 
        />
        
        <InstructorFilter 
          filter={filter} 
          onFilterChange={setFilter} 
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredInstructors.map((instructor) => (
          <InstructorCard key={instructor.id} instructor={instructor} />
        ))}
      </div>
      
      <div className="mt-16 mb-8">
        <h2 className="text-[32px] font-bold  text-gray-900">Become an Instructor</h2>
        <div className="flex flex-col items-start gap-6  bg-gray-50 rounded-lg">
          <div className="w-full flex">
            <p className="text-gray-500 flex-1 text-[20px] mb-4">
            Join our growing community of blockchain educators and share your expertise with students around the world. ChainVerse Academy instructors earn XLM through course purchases and receive ongoing royalties. </p>
            <div className='flex-1 flex justify-end'>
            <button className="w-[228px] h-[57px] rounded-[15px] bg-gradient-to-r from-[#4361EE] to-[#C48BFC] text-[20px] font-bold text-white ">
              Apply To Teach
            </button>
            </div>
          </div>
        </div>

{/* Bottom cards */}
        <div className=" mt-6 md:mt-0 ">
            <div className="flex gap-6">
              <div className="flex-1 ">
              <div className="flex items-center gap-2 mb-2 ">
              <div className="w-[64px] h-[64px] rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-600">
              <Star size={35} />
              </div>
              <div className=''>
              <h3 className="font-medium text-gray-900 text-[24px]">Build Your Reputation</h3>
              <p className="text-sm text-gray-600 text-[20px]">Establish yourself as a thought leader</p>
              </div>
              </div>
              </div>


              <div className="flex-1 ">
              <div className="flex items-center gap-2 mb-2 ">
              <div className="w-[64px] h-[64px] rounded-full bg-[#A855F71A]/80 flex items-center justify-center text-xs font-medium text-[#41047a1a]">
              <CircleDollarSign size={36} />
              </div>
              <div className=''>
              <h3 className="font-medium text-gray-900 text-[24px]">Earn Crypto</h3>
              <p className="text-sm text-gray-600 text-[20px]">Get paid in XLM for your courses</p>
              </div>
              </div>
              </div>
            </div>
          </div>

      </div>
    </div>
  );
};