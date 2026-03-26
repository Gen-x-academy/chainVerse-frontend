"use client";

import React from "react";
import { Clock, User } from "lucide-react";

export interface CourseCardProps {
  title: string;
  description: string;
  instructor: string;
  duration: string;
  category: string;
}

export function CourseCard({ title, description, instructor, duration, category }: CourseCardProps) {
  return (
    <article
      aria-label={`Course: ${title} by ${instructor}`}
      className="
        relative flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden
        cursor-pointer
        transition-all duration-200 ease-in-out
        hover:shadow-md hover:border-gray-300 hover:-translate-y-0.5
        transform-gpu
        group
      "
    >
      {/* Optional: A subtle accent bar at the top instead of an image for a clean UI */}
      <div className="h-1.5 w-full bg-gray-100 group-hover:bg-gray-800 transition-colors duration-200" />
      
      <div className="p-5 flex flex-col flex-grow">
        {/* Category Badge */}
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
          {category}
        </span>
        
        {/* Title & Description */}
        <h3 className="text-lg font-semibold text-gray-900 mb-1.5 group-hover:text-gray-700 transition-colors">
          {title}
        </h3>
        <p className="text-sm text-gray-500 line-clamp-2 mb-6 flex-grow">
          {description}
        </p>
        
        {/* Footer Meta Details */}
        <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100 text-sm text-gray-600">
          <div className="flex items-center gap-1.5">
            <User className="w-4 h-4 text-gray-400" aria-hidden="true" />
            <span className="font-medium text-gray-900">{instructor}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-gray-400" aria-hidden="true" />
            <span aria-label={`Duration: ${duration}`}>{duration}</span>
          </div>
        </div>
      </div>
    </article>
  );
}