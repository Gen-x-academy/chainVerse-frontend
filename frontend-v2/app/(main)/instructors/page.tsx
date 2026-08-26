'use client';

import React from 'react';
import { SectionContainer } from '@/shared/components/layout/SectionContainer';
import InstructorCard from '@/src/features/instructors/components/InstructorCard';
import { useInstructors } from '@/src/features/instructors/hooks/useInstructors';

export default function InstructorsPage() {
  const { data: instructors, isLoading, error } = useInstructors();

  if (isLoading) {
    return (
      <SectionContainer className="py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Our Instructors</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse border border-gray-200 rounded-lg p-4 space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-[100px] h-[100px] rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-6 bg-gray-200 rounded w-2/3" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
              <div className="h-16 bg-gray-200 rounded" />
              <div className="h-10 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </SectionContainer>
    );
  }

  if (error) {
    return (
      <SectionContainer className="py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Our Instructors</h1>
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">Failed to load instructors.</p>
          <p className="text-gray-400 text-sm mt-2">Please try again later.</p>
        </div>
      </SectionContainer>
    );
  }

  const instructorList = instructors ?? [];

  if (instructorList.length === 0) {
    return (
      <SectionContainer className="py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Our Instructors</h1>
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No instructors available yet.</p>
        </div>
      </SectionContainer>
    );
  }

  return (
    <SectionContainer className="py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Our Instructors</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {instructorList.map((instructor) => (
          <InstructorCard key={instructor.id} instructor={instructor} />
        ))}
      </div>
    </SectionContainer>
  );
}
