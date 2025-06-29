'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, ChevronLeft, ChevronRight, ArrowUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { CourseCard } from '@/components/courseCard';
import { Spinner } from '@/components/ui/spinner';
import { toast } from './ui/use-toast';
import { useCartStore } from '@/store/cartStore';

interface Course {
  id: number;
  category: string;
  title: string;
  rating: number;
  description: string;
  instructor: string;
  level: string;
  price: number;
  currency: string;
  image: string;
}

export function CoursesSection() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const coursesPerPage = 12;
  const addToCart = useCartStore((state) => state.addToCart);

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } =
        scrollContainerRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 1);
    }
  };

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      handleScroll(); // Initial check
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 200);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch courses
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/data/courses.json');
        if (!response.ok) {
          throw new Error('Failed to fetch courses');
        }
        const data = await response.json();
        setCourses(data.courses || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching courses:', err);
        setError('Failed to load courses. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCourses();
  }, []);

  // Filtering Logic
  useEffect(() => {
    if (!courses.length) return;

    let result = courses.filter((course) => {
      const searchLower = search.toLowerCase();
      return (
        course.title.toLowerCase().includes(searchLower) ||
        course.category.toLowerCase().includes(searchLower) ||
        course.instructor.toLowerCase().includes(searchLower)
      );
    });

    if (selectedLevels.length > 0) {
      result = result.filter((course) => selectedLevels.includes(course.level));
    }

    if (selectedCategory !== 'All') {
      result = result.filter((course) => course.category === selectedCategory);
    }

    switch (sortBy) {
      case 'newest':
        result = result.sort((a, b) => b.id - a.id);
        break;
      case 'price-low':
        result = result.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        result = result.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        result = result.sort((a, b) => b.rating - a.rating);
        break;
    }

    setFilteredCourses(result);
    setTotalPages(Math.ceil(result.length / coursesPerPage));
    setCurrentPage(1);
  }, [courses, search, selectedLevels, selectedCategory, sortBy]);

  // Get current page courses
  const currentCourses = filteredCourses.slice(
    (currentPage - 1) * coursesPerPage,
    currentPage * coursesPerPage
  );

  // Unique values for filters
  const uniqueCategories = [
    'All',
    ...Array.from(new Set(courses.map((c) => c.category))),
  ];
  const uniqueLevels = Array.from(new Set(courses.map((c) => c.level)));

  // Handle filtering
  const handleLevelChange = (level: string) => {
    setSelectedLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="container px-4 sm:px-8 lg:px-10 mx-auto py-8">
      {/* Search Bar */}
      <div className="relative flex items-center justify-center mx-auto w-1/2 mb-8">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-black w-5 h-5" />
        <Input
          type="text"
          placeholder="Search"
          className="pl-10 bg-[#F2F2F2] border-gray-200 h-10 rounded-full text-base"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Category Filter Buttons */}
      <div className="flex items-center flex-col justify-between mb-8">
        <div className="relative w-full">
          <div
            ref={scrollContainerRef}
            className="flex w-full overflow-x-auto scrollbar-hide"
          >
            <div className="flex gap-2 pb-2 px-1">
              {uniqueCategories.map((category) => (
                <Badge
                  key={category}
                  variant={
                    selectedCategory === category ? 'default' : 'secondary'
                  }
                  className={`px-4 py-2 text-sm rounded-full font-medium cursor-pointer whitespace-nowrap ${
                    selectedCategory === category
                      ? 'bg-[#4361EE] text-white '
                      : 'bg-transparent border border-[#B2B2B2] text-[#B2B2B2] hover:bg-gray-200'
                  }`}
                  onClick={() => handleCategoryChange(category)}
                >
                  <span className="text-sm">{category}</span>
                </Badge>
              ))}
            </div>
          </div>

          {/* Left Arrow */}
          {showLeftArrow && (
            <button
              onClick={scrollLeft}
              className="absolute left-0 top-[40%] -translate-y-1/2 bg-white/80 hover:bg-white shadow-md rounded-full p-2 z-10 transition-opacity duration-200"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-5 h-5 text-[#4361EE]" />
            </button>
          )}

          {/* Right Arrow */}
          {showRightArrow && (
            <button
              onClick={scrollRight}
              className="absolute right-0 top-[40%] -translate-y-1/2 bg-white/80 hover:bg-white shadow-md rounded-full p-2 z-10 transition-opacity duration-200"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-5 h-5 text-[#4361EE]" />
            </button>
          )}
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center justify-between w-full">
          <div className="ml-4 flex self-end items-center gap-2">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[200px]">
                <img src="/3vertical.png" alt="Sort" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
                <SelectItem value="rating">Highest Rated</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            {uniqueLevels.map((level) => (
              <div key={level} className="flex items-center space-x-3">
                <Checkbox
                  id={`level-${level}`}
                  checked={selectedLevels.includes(level)}
                  onCheckedChange={() => handleLevelChange(level)}
                />
                <label
                  htmlFor={`level-${level}`}
                  className="ml-2 cursor-pointer"
                >
                  {level}
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center min-h-[400px]">
          <Spinner size={40} />
        </div>
      ) : error ? (
        <div className="text-center text-red-500 py-8">{error}</div>
      ) : filteredCourses.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-lg font-medium">No courses found</p>
          <p className="text-muted-foreground mt-2">
            Try adjusting your search or filters
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {currentCourses.map((course) => (
              <CourseCard
                key={course.id}
                {...course}
                onAddToCart={() => {
                  const added = addToCart({
                    id: course.id,
                    title: course.title,
                    price: course.price,
                    currency: course.currency,
                    image: course.image,
                  });
                  if (!added) {
                    toast({
                      title: 'Already in cart',
                      description: 'This course is already in your cart.',
                    });
                  }
                }}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center space-x-2 mt-8">
              <Button
                variant="outline"
                size="icon"
                disabled={currentPage === 1}
                onClick={() => goToPage(currentPage - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (page) => (
                  <Button
                    key={page}
                    variant={currentPage === page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => goToPage(page)}
                    className="w-10 h-10"
                  >
                    {page}
                  </Button>
                )
              )}

              <Button
                variant="outline"
                size="icon"
                disabled={currentPage === totalPages}
                onClick={() => goToPage(currentPage + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
          {showScrollTop && (
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="fixed bottom-14 right-1 z-[100] bg-[#4361EE] text-white rounded-full shadow-lg p-3 hover:bg-[#3551b7] transition-colors"
              aria-label="Scroll to top"
            >
              <ArrowUp className="h-6 w-6" />
            </button>
          )}
        </>
      )}
      <div className="flex md:flex-row flex-col items-center justify-between mt-10">
        <p>© 2025 ChainVerse Academy. All rights reserved.</p>
        <div className="flex items-center gap-10">
          <a href="#" className="text-muted-foreground">
            Terms
          </a>
          <a href="#" className="text-muted-foreground">
            Privacy
          </a>
          <a href="#" className="text-muted-foreground">
            FAQ
          </a>
        </div>
      </div>
    </div>
  );
}
