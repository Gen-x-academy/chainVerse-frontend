import React from 'react';
import { Star } from 'lucide-react';
import { Instructor } from '@/data/instructors';

interface InstructorCardProps {
  instructor: Instructor;
}

const InstructorCard: React.FC<InstructorCardProps> = ({ instructor }) => {
  const { 
    initials, 
    name, 
    title, 
    bio, 
    rating, 
    courseCount, 
    studentCount, 
    avatarColor 
  } = instructor;

  return (
    <div className="flex flex-col p-4 border border-gray-300 rounded-lg shadow-5xl shadow-black">
      <div className="flex items-start gap-4 mb-3">
        <div className={`flex items-center justify-center w-[100px] h-[100px] rounded-full ${avatarColor} text-[#4361EE]/80 text-[32px] font-bold`}>
          {initials}
        </div>
        <div className="flex-1 h-full align-baseline flex items-center">
          <div>
          <h3 className="text-[24px] font-semibold text-gray-900">{name}</h3>
          <p className="text-[16px] text-[text-[16px] text-[#4a444466]/90 font-semibold ">{title}</p>
          </div>
        </div>
      </div>
      
      <p className="mb-4 text-[15px] text-[text-[16px] text-[#4a444466]/90 font-semibold line-clamp-3">
        {bio}
      </p>
      
      <div className="mt-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            <span className="ml-1 text-sm font-medium">{rating}</span>
          </div>
          <div className="flex justify-between w-[60%] gap-4">
            <div className="text-sm text-gray-600">
              <span className="font-medium">{courseCount}</span> Courses
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-medium">{studentCount.toLocaleString()}</span> Students
            </div>
          </div>
        </div>
        
        <button className="w-full py-2 text-sm font-medium text-center bg-[#D9D9D94D] text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
          View Profile
        </button>
      </div>
    </div>
  );
};

export default InstructorCard;