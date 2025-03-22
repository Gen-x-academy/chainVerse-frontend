"use client";
import React from "react";
import { Button } from "./button";
import { Card } from "./card";

interface CourseProps {
  title: {
    mainText: string;
    subText: string;
  };
  description: string;
  instructor: string;
  level: string;
  price: number;
  currency?: string;
}

const CourseCard: React.FC<CourseProps> = ({
  title,
  description,
  instructor,
  level,
  price,
  currency = "XLM",
}) => {
  return (
    <Card className="overflow-hidden flex flex-col h-full">
      <div className="p-6 flex flex-col h-full">
        <h3 className="font-bold mb-2">
          <div className="text-lg">{title.mainText}</div>
          <div className="text-lg">{title.subText}</div>
        </h3>
        <p className="text-sm text-gray-600 mb-4">{description}</p>

        <div className="mt-auto space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-semibold">Instructor:</span>
            <span>{instructor}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="font-semibold">Level:</span>
            <span>{level}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="font-semibold">Price:</span>
            <span className="text-blue-600 font-semibold">
              {price} {currency}
            </span>
          </div>

          <Button className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white">
            Enroll Now
          </Button>
        </div>
      </div>
    </Card>
  );
};

const FeaturedCourses: React.FC = () => {
  const courses = [
    {
      title: {
        mainText: "Stellar Blockchain",
        subText: "Fundamentals",
      },
      description:
        "Learn the basics of Stellar blockchain, its architecture, and use cases.",
      instructor: "Alex Johnson",
      level: "Beginner",
      price: 100,
    },
    {
      title: {
        mainText: "Smart Contracts with",
        subText: "Soroban",
      },
      description:
        "Master Stellar's smart contract platform Soroban and build decentralized applications.",
      instructor: "Maria Garcia",
      level: "Intermediate",
      price: 250,
    },
    {
      title: {
        mainText: "Web3 Development",
        subText: "Masterclass",
      },
      description:
        "Comprehensive guide to building Web3 applications on multiple blockchain platforms.",
      instructor: "David Chen",
      level: "Advanced",
      price: 400,
    },
  ];

  return (
    <section className="py-12 bg-gray-50">
      <div className="container mx-auto px-4">
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
            className="px-6 border border-blue-600 text-blue-600 hover:bg-blue-50"
          >
            View All Courses
          </Button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedCourses;
