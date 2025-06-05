'use client';
import React from 'react';
import { Button } from './ui/button';
import Link from 'next/link';
import { CourseCard } from './CourseCard';
import { toast } from './ui/use-toast';
import { useCartStore } from '@/store/cartStore';

const FeaturedCourses: React.FC = () => {
  const addToCart = useCartStore((state) => state.addToCart);
  const courses = [
    {
      id: 1,
      category: 'Blockchain basics',
      title: 'Stellar Blockchain Fundamentals',
      rating: 2.8,
      description:
        'Learn the basics of Stellar blockchain, its architecture, and use cases.',
      instructor: 'Alex Johnson',
      level: 'Beginner',
      price: 100,
      currency: 'XLM',
      image: "/cart.svg"
    },
    {
      id: 2,
      category: 'Smart Contracts',
      title: 'Smart Contracts with Soroban',
      rating: 4.6,
      description:
        "Master Stellar's smart contract platform Soroban and build decentralized applications.",
      instructor: 'Maria Garcia',
      level: 'Intermediate',
      price: 250,
      currency: 'XLM',
      image: "/cart.svg"
    },
    {
      id: 3,
      category: 'Web3 Development',
      title: 'Web3 Development Masterclass',
      rating: 4.9,
      description:
        'Comprehensive guide to building Web3 applications on multiple blockchain platforms',
      instructor: 'David Chen',
      level: 'Advanced',
      price: 400,
      currency: 'XLM',
      image: "/cart.svg"
    },
  ];

  return (
    <section className="lg:md:py-12 py-8 bg-gray-50">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold mb-2">Featured Courses</h2>
        <p className="text-gray-600">Start your blockchain journey today</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {courses.map((course) => (
          <CourseCard key={course.id} {...course} onAddToCart={() => {
            const added = addToCart({
              id: course.id,
              title: course.title,
              price: course.price,
              currency: course.currency,
              image: course.image,
            })
            if (!added) {
              toast({ title: "Already in cart", description: "This course is already in your cart." })
            }
          }} />
        ))}
      </div>

      <div className="text-center mt-10">
        <Link href="/courses">
          <Button
            variant="outline"
            className="px-6 border border-primary text-primary hover:bg-blue-50"
          >
            View All Courses
          </Button>
        </Link>
      </div>
    </section>
  );
};

export default FeaturedCourses;
