"use client"; // Add this directive at the top

import * as React from "react";
import HeroSection from "@/components/ui/HeroSection";
import FeaturedCourses from "@/components/ui/FeaturedCourses";
import KeyFeatures from "@/components/ui/KeyFeatures";
import Footer from "@/components/ui/Footer";
import { CourseSortDropdown } from "@/components/CourseSortDropdown";

interface Course {
  id: string;
  title: string;
  price: number;
  rating: number;
  createdAt: Date;
}

export default function Home() {
  const [courses, setCourses] = React.useState<Course[]>([
    {
      id: "1",
      title: "Course A",
      price: 100,
      rating: 4.5,
      createdAt: new Date("2024-01-01"),
    },
    {
      id: "2",
      title: "Course B",
      price: 50,
      rating: 4.0,
      createdAt: new Date("2024-03-01"),
    },
    {
      id: "3",
      title: "Course C",
      price: 150,
      rating: 4.8,
      createdAt: new Date("2024-02-01"),
    },
  ]);

  return (
    <div className="container mx-auto">
      <HeroSection />
      <KeyFeatures />
      <div className="flex justify-end p-4">
        <CourseSortDropdown courses={courses} onSortChange={setCourses} />
      </div>
      <FeaturedCourses />
      <Footer />
    </div>
  );
}
