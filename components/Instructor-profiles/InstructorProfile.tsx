'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Star } from 'lucide-react';
import Link from 'next/link';
import { Instructor } from '@/types';
import AboutProfile from './about-profile';
import CoursesProfile from './courses-profile';
import ReviewProfile from './review-profile';

interface InstructorProfileProps {
  instructor: Instructor | null;
}

export default function InstructorProfile({
  instructor,
}: InstructorProfileProps) {
  const [activeTab, setActiveTab] = useState<string>('about');

  // Early return if no instructor data
  if (!instructor) {
    return (
      <div className="max-w-7xl mx-auto py-10 px-4 text-center">
        <h2 className="text-2xl font-semibold mb-4">Instructor not found</h2>
        <p className="text-gray-500">
          This instructor does not exist or has been removed.
        </p>
        <Link href="/instructors">
          <Button className="mt-6">Return to Instructors</Button>
        </Link>
      </div>
    );
  }

  return (
    <div
      className="w-full"
      style={{
        backgroundImage: "url('/instructorProfile.png')",
        backgroundPosition: 'top',
        backgroundRepeat: 'no-repeat',
        backgroundSize: '100% auto',
      }}
    >
      <div className="max-w-7xl mx-auto py-10 px-4">
        <Link
          href="/instructors"
          className="flex items-center mb-6 text-black font-bold hover:text-blue-900"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-2"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Instructors
        </Link>

        <div className="flex flex-col md:flex-row">
          {/* Left sidebar with instructor info - fixed width on all tabs */}
          <div className="w-full md:w-96 md:min-w-96 md:mr-8 mb-8 md:mb-0">
            <Card className="bg-white border border-[#D9D9D9] p-5 mb-8">
              <div className="flex flex-col items-center mb-8">
                <div className="w-32 h-32 rounded-full bg-blue-100 flex items-center justify-center font-semibold text-4xl mb-4">
                  {instructor.initials}
                </div>
                <h1 className="text-2xl font-bold text-center">
                  {instructor.name}
                </h1>
                <p className="text-gray-500 text-center">{instructor.title}</p>

                <div className="flex items-center mt-2">
                  <Star className="h-4 w-4 text-yellow-500 mr-1 fill-current" />
                  <Star className="h-4 w-4 text-yellow-500 mr-1 fill-current" />
                  <Star className="h-4 w-4 text-yellow-500 mr-1 fill-current" />
                  <Star className="h-4 w-4 text-yellow-500 mr-1 fill-current" />
                  <Star className="h-4 w-4 text-gray-300 mr-1 fill-current" />
                  <span className="ml-1">{instructor.rating}</span>
                </div>

                <Button className="w-full mt-6">Contact Instructor</Button>
                <Button variant="outline" className="w-full mt-3">
                  View All Courses
                </Button>
              </div>
            </Card>

            <Card className="mb-6 bg-white border border-[#D9D9D9]">
              <CardContent className="p-4">
                <h3 className="font-semibold mb-2">Instructor Stats</h3>

                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Total Students</span>
                  <span className="font-medium">
                    {instructor.students?.toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Courses</span>
                  <span className="font-medium">{instructor.courses}</span>
                </div>

                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Reviews</span>
                  <span className="font-medium">
                    {instructor.reviews || 387}
                  </span>
                </div>

                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Avg. Response Time</span>
                  <span className="font-medium">{'< 24 hours'}</span>
                </div>

                <div className="flex justify-between py-2">
                  <span className="text-gray-600">Member Since</span>
                  <span className="font-medium">January 2023</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border border-[#D9D9D9]">
              <CardContent className="p-4">
                <h3 className="font-semibold mb-2">Areas of Expertise</h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="bg-purple-500 text-white text-xs py-1 px-3 rounded-full">
                    Stellar Blockchain
                  </span>
                  <span className="bg-purple-500 text-white text-xs py-1 px-3 rounded-full">
                    Smart Contracts
                  </span>
                  <span className="bg-purple-500 text-white text-xs py-1 px-3 rounded-full">
                    Cross-Border Payments
                  </span>
                  <span className="bg-purple-500 text-white text-xs py-1 px-3 rounded-full">
                    Distributed Systems
                  </span>
                  <span className="bg-purple-500 text-white text-xs py-1 px-3 rounded-full">
                    Cryptography
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6 bg-white border border-[#D9D9D9]">
              <CardContent className="p-4">
                <h3 className="font-semibold mb-2">Social Links</h3>

                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Website</span>
                  <a
                    href="#"
                    className="text-blue-500 hover:text-blue-700 flex items-center"
                  >
                    Visit
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="ml-1"
                    >
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Github</span>
                  <a
                    href="#"
                    className="text-blue-500 hover:text-blue-700 flex items-center"
                  >
                    Visit
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="ml-1"
                    >
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">LinkedIn</span>
                  <a
                    href="#"
                    className="text-blue-500 hover:text-blue-700 flex items-center"
                  >
                    Visit
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="ml-1"
                    >
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                </div>

                <div className="flex items-center justify-between py-2">
                  <span className="text-gray-600">Twitter</span>
                  <a
                    href="#"
                    className="text-blue-500 hover:text-blue-700 flex items-center"
                  >
                    Visit
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="ml-1"
                    >
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main content area with tabs */}
          <div className="flex-grow">
            {/* Tab navigation - matches the image design */}
            <div className="mb-6 bg-[#F5F5F5] rounded-[6.46px] p-2 w-fit border-[0.65px] border-[#CBC7C7] mx-auto md:mx-0">
              <div className="flex gap-2">
                <button
                  className={`p-1 font-medium text-sm ${
                    activeTab === 'about'
                      ? 'border border-[#CBC7C7] font-bold rounded-[6.46px] text-black bg-[#FFFFFF]'
                      : 'text-black font-bold hover:text-gray-700'
                  }`}
                  onClick={() => setActiveTab('about')}
                >
                  About
                </button>
                <button
                  className={`p-1 font-medium text-sm ${
                    activeTab === 'courses'
                      ? 'border border-[#CBC7C7] font-bold rounded-[6.46px] text-black bg-[#FFFFFF]'
                      : 'text-black font-bold hover:text-gray-700'
                  }`}
                  onClick={() => setActiveTab('courses')}
                >
                  Courses
                </button>
                <button
                  className={`p-1 font-medium text-sm ${
                    activeTab === 'review'
                      ? 'border border-[#CBC7C7] font-bold text-black bg-[#FFFFFF] rounded-[6.46px]'
                      : 'text-black font-bold hover:text-gray-700'
                  }`}
                  onClick={() => setActiveTab('review')}
                >
                  Review
                </button>
              </div>
            </div>
            {/* Content for About tab */}
            {activeTab === 'about' && <AboutProfile instructor={instructor} />}
            {/* Content for Courses tab */}
            {activeTab === 'courses' && (
              <CoursesProfile instructor={instructor} />
            )}
            {/* Content for Review tab */}
            {activeTab === 'review' && (
              <ReviewProfile instructor={instructor} />
            )}
          </div>
        </div>

        {/* footer */}
        <footer className="mt-20 border-t border-gray-300 py-4">
          <div className="flex flex-col md:flex-row md:justify-between">
            <p className="text-gray-600">
              © 2025 ChainVerse Academy. All rights reserved.
            </p>
            <div className="mt-4 md:mt-0 space-x-6">
              <span className="text-gray-500">Terms</span>
              <span className="text-gray-500">Privacy</span>
              <span className="text-gray-500">FAQ</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
