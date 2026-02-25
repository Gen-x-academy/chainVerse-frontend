import React, { useState } from 'react';
import { Search, Sliders } from 'lucide-react';

interface CourseFilterBarProps {
  onSearch?: (query: string) => void;
  onFilterChange?: (filters: FilterState) => void;
}

interface FilterState {
  category: string;
  level: string;
  priceRange: [number, number];
  sortBy: string;
}

export const CourseFilterBar: React.FC<CourseFilterBarProps> = ({ onSearch, onFilterChange }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    category: 'all',
    level: 'all',
    priceRange: [0, 500],
    sortBy: 'popular',
  });

  const categories = ['Blockchain', 'DeFi', 'NFTs', 'Smart Contracts', 'Web3'];
  const levels = ['Beginner', 'Intermediate', 'Advanced'];
  const sortOptions = [
    { value: 'popular', label: 'Most Popular' },
    { value: 'newest', label: 'Newest' },
    { value: 'price-low', label: 'Price: Low to High' },
    { value: 'price-high', label: 'Price: High to Low' },
    { value: 'rating', label: 'Highest Rated' },
  ];

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    onSearch?.(value);
  };

  const handleFilterChange = (newFilters: Partial<FilterState>) => {
    const updated = { ...filters, ...newFilters };
    setFilters(updated);
    onFilterChange?.(updated);
  };

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Search Bar */}
        <div className="flex flex-col md:flex-row gap-4 items-end md:items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search courses, instructors, topics..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Sort Dropdown */}
          <select
            value={filters.sortBy}
            onChange={(e) => handleFilterChange({ sortBy: e.target.value })}
            className="hidden md:block px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {/* Filter Toggle Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            <Sliders size={20} />
            <span>Filters</span>
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-gray-200">
            {/* Category Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Category</label>
              <div className="space-y-2">
                {categories.map((cat) => (
                  <label key={cat} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.category === cat || filters.category === 'all'}
                      onChange={() => handleFilterChange({ category: filters.category === cat ? 'all' : cat })}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">{cat}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Level Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Level</label>
              <div className="space-y-2">
                {levels.map((level) => (
                  <label key={level} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="level"
                      checked={filters.level === level.toLowerCase() || filters.level === 'all'}
                      onChange={() => handleFilterChange({ level: level.toLowerCase() })}
                      className="w-4 h-4 rounded-full border-gray-300"
                    />
                    <span className="text-sm text-gray-700">{level}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Price Range Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Price Range</label>
              <div className="space-y-3">
                <input
                  type="range"
                  min="0"
                  max="500"
                  value={filters.priceRange[1]}
                  onChange={(e) => handleFilterChange({ priceRange: [0, parseInt(e.target.value)] })}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-gray-600">
                  <span>${filters.priceRange[0]}</span>
                  <span>${filters.priceRange[1]}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Active Filters */}
        {(filters.category !== 'all' || filters.level !== 'all' || filters.priceRange[1] < 500) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {filters.category !== 'all' && (
              <button
                onClick={() => handleFilterChange({ category: 'all' })}
                className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium hover:bg-blue-200 transition"
              >
                {filters.category} ✕
              </button>
            )}
            {filters.level !== 'all' && (
              <button
                onClick={() => handleFilterChange({ level: 'all' })}
                className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium hover:bg-blue-200 transition"
              >
                {filters.level} level ✕
              </button>
            )}
            {filters.priceRange[1] < 500 && (
              <button
                onClick={() => handleFilterChange({ priceRange: [0, 500] })}
                className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium hover:bg-blue-200 transition"
              >
                ${filters.priceRange[1]} max ✕
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
