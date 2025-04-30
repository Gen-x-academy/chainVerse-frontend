import React from 'react';
import { Search, Funnel   } from 'lucide-react';

interface InstructorSearchProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
}

const InstructorSearch: React.FC<InstructorSearchProps> = ({ 
  searchValue, 
  onSearchChange 
}) => {
  return (
    <div className="relative w-full max-w-xs flex gap-[10px]">
      <input
        type="text"
        placeholder="Search courses..."
        value={searchValue}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-[70%] pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-[10px]  focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      <Search className="absolute left-3 top-[29%] transform -translate-y-1/2 h-4 w-4 text-gray-400" />
      <div className="border border-gray-300 rounded-[10px] w-[39px] flex justify-center items-center align-middle cursor-pointer">
      <Funnel className='text-gray-300' size={20} />
      </div>
    </div>
  );
};

export default InstructorSearch;