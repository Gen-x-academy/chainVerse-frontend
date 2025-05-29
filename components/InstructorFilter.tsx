import React from 'react';
import { ChevronDown, ArrowDownWideNarrow } from 'lucide-react';

interface InstructorFilterProps {
  filter: string;
  onFilterChange: (value: string) => void;
}

const InstructorFilter: React.FC<InstructorFilterProps> = ({ 
  filter, 
  onFilterChange 
}) => {
  const options = [
    { value: 'popular', label: 'Newest' },
    { value: 'rating', label: 'Highest Rated' },
    { value: 'courses', label: 'Most Courses' },
    { value: 'students', label: 'Most Students' },
  ];

  return (
    <div className="relative flex poniter-cursor">
        <div className='absolute top-[20%] pl-2'>
        <ArrowDownWideNarrow   />
        </div>
      <select
        value={filter}
        onChange={(e) => onFilterChange(e.target.value)}
        className="appearance-none w-[200px] bg-white border border-gray-300 pl-[50px] px-4 py-2 pr-8 rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown size={25} className="absolute right-3 top-[13px] transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
    </div>
  );
};

export default InstructorFilter;