'use client';
import React from 'react';

import Link from 'next/link';
import { Button } from './ui/button';
import { Card } from './ui/card';

interface CourseProps {
  id: number;
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
  id,
  title,
  description,
  instructor,
  level,
  price,
  currency = 'XLM',
}) => {
  return (
    <Card className="overflow-hidden flex flex-col h-full">
      <div className="p-6 flex flex-col h-full">
        <div className="font-bold mb-2">
          <div className="text-lg">{title.mainText}</div>
          <div className="text-lg">{title.subText}</div>
        </div>
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
            <span className="text-primary font-semibold">
              {price} {currency}
            </span>
          </div>
          <Link href={`courses/${id}`}>
            <Button className="w-full mt-4 bg-primary hover:bg-blue-700 text-white">
              Enroll Now
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
};

export default CourseCard;
