'use client';
import React from 'react';
import { Button } from './button';
import CourseCard from './courseCard';

const FeaturedCourses: React.FC = () => {
  const courses = [
    {
      title: {
        mainText: 'Stellar Blockchain',
        subText: 'Fundamentals',
      },
      description:
        'Learn the basics of Stellar blockchain, its architecture, and use cases.',
      instructor: 'Alex Johnson',
      level: 'Beginner',
      price: 100,
    },
    {
      title: {
        mainText: 'Smart Contracts with',
        subText: 'Soroban',
      },
      description:
        "Master Stellar's smart contract platform Soroban and build decentralized applications.",
      instructor: 'Maria Garcia',
      level: 'Intermediate',
      price: 250,
    },
    {
      title: {
        mainText: 'Web3 Development',
        subText: 'Masterclass',
      },
      description:
        'Comprehensive guide to building Web3 applications on multiple blockchain platforms.',
      instructor: 'David Chen',
      level: 'Advanced',
      price: 400,
    },
  ];

  return (
    <section className="lg:md:py-12 py-8 bg-gray-50">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold mb-2">Featured Courses</h2>
        <p className="text-gray-600">Start your blockchain journey today</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {courses.map((course, index) => (
          <CourseCard
            key={index}
            title={course.title}
            description={course.description}
            instructor={course.instructor}
            level={course.level}
            price={course.price}
          />
        ))}
      </div>

      <div className="text-center mt-10">
        <Button
          variant="outline"
          className="px-6 border border-primary text-primary hover:bg-blue-50"
        >
          View All Courses
        </Button>
      </div>
    </section>
  );
};

export default FeaturedCourses;
