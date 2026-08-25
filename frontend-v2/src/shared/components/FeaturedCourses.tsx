'use client';
import React from 'react';
import { Button } from './ui/button';
import Link from 'next/link';
import { CourseCard } from '@/src/features/courses/components/courseCard';
import { CourseCardSkeleton } from '@/src/features/courses/components/CourseCardSkeleton';
import { toast } from './ui/use-toast';
import { useCartStore } from '@/store/cartStore';
import { useFeaturedCourses } from '@/src/features/courses/hooks/useFeaturedCourses';

const FeaturedCourses: React.FC = () => {
  const addToCart = useCartStore((state) => state.addToCart);
  const { data: courses = [], isLoading } = useFeaturedCourses();

  return (
    <section className="py-8 md:py-12 bg-gray-50">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold mb-2">Featured Courses</h2>
        <p className="text-gray-600">Start your blockchain journey today</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {isLoading ? (
          <>
            <CourseCardSkeleton />
            <CourseCardSkeleton />
            <CourseCardSkeleton />
          </>
        ) : (
          courses.map((course) => (
            <CourseCard
              key={course.id}
              id={typeof course.id === 'string' ? parseInt(course.id, 10) || 0 : course.id}
              category={course.category ?? 'General'}
              title={course.title}
              rating={course.rating ?? 0}
              description={course.description ?? ''}
              instructor={course.instructor ?? 'Instructor'}
              level={course.level ?? 'All'}
              price={course.price ?? 0}
              currency="XLM"
              image={course.thumbnailUrl ?? '/cart.svg'}
              onAddToCart={() => {
                const added = addToCart({
                  id: String(course.id),
                  title: course.title,
                  price: course.price ?? 0,
                  currency: 'XLM',
                  image: course.thumbnailUrl ?? '/cart.svg',
                  quantity: 1,
                });
                if (!added) {
                  toast({
                    title: 'Already in cart',
                    description: 'This course is already in your cart.',
                  });
                }
              }}
            />
          ))
        )}
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

