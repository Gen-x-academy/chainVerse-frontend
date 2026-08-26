'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, ChevronLeft, ChevronRight, ArrowUp, Filter, X } from 'lucide-react';
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
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { CourseCard } from '@/components/courseCard';
import { Spinner } from '@/components/ui/spinner';
import { toast } from './ui/use-toast';
import { useCartStore } from '@/store/cartStore';
import { Facet, FacetGroup, ActiveFilters } from '@/components/ui/facet';

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
  format: string;
  availability: string;
  language: string;
  subject: string;
  audience: string;
  publicationDate: string;
  location: string;
}

// Type for facet option counts
interface FacetOptionCount {
  value: string;
  label: string;
  count: number;
  disabled?: boolean;
  disabledReason?: string;
}

export function CoursesSection() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const coursesPerPage = 12;
  const addToCart = useCartStore((state) => state.addToCart);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  // New facet state
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  const [selectedAvailabilities, setSelectedAvailabilities] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedAudiences, setSelectedAudiences] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedPublicationDates, setSelectedPublicationDates] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);

  // Facet options with counts
  const [facetOptions, setFacetOptions] = useState<{
    formats: FacetOptionCount[];
    availabilities: FacetOptionCount[];
    languages: FacetOptionCount[];
    subjects: FacetOptionCount[];
    audiences: FacetOptionCount[];
    locations: FacetOptionCount[];
    levels: FacetOptionCount[];
    publicationDates: FacetOptionCount[];
  }>({
    formats: [],
    availabilities: [],
    languages: [],
    subjects: [],
    audiences: [],
    locations: [],
    levels: [],
    publicationDates: [],
  });

  // Calculate all facet counts from a list of courses
  const calculateFacetCounts = (courseList: Course[]) => {
    // Count occurrences of each value for each facet
    const formatCounts: Record<string, number> = {};
    const availabilityCounts: Record<string, number> = {};
    const languageCounts: Record<string, number> = {};
    const subjectCounts: Record<string, number> = {};
    const audienceCounts: Record<string, number> = {};
    const locationCounts: Record<string, number> = {};
    const levelCounts: Record<string, number> = {};
    const pubDateCounts: Record<string, number> = {};

    courseList.forEach(course => {
      // Format
      formatCounts[course.format] = (formatCounts[course.format] || 0) + 1;
      
      // Availability
      availabilityCounts[course.availability] = (availabilityCounts[course.availability] || 0) + 1;
      
      // Language
      languageCounts[course.language] = (languageCounts[course.language] || 0) + 1;
      
      // Subject
      subjectCounts[course.subject] = (subjectCounts[course.subject] || 0) + 1;
      
      // Audience
      audienceCounts[course.audience] = (audienceCounts[course.audience] || 0) + 1;
      
      // Location
      locationCounts[course.location] = (locationCounts[course.location] || 0) + 1;
      
      // Level
      levelCounts[course.level] = (levelCounts[course.level] || 0) + 1;
      
      // Publication date - group by year
      const year = new Date(course.publicationDate).getFullYear().toString();
      pubDateCounts[year] = (pubDateCounts[year] || 0) + 1;
    });

    // Format into FacetOptionCount objects with proper labels
    const formatLabels: Record<string, string> = {
      video: 'Video Course',
      book: 'eBook',
      audio: 'Audio Book',
      workshop: 'Workshop'
    };

    const availabilityLabels: Record<string, string> = {
      available: 'Available Now',
      'coming-soon': 'Coming Soon',
      unavailable: 'Currently Unavailable'
    };

    const locationLabels: Record<string, string> = {
      Online: 'Online Only',
      'In-Person': 'In-Person',
      Hybrid: 'Hybrid'
    };

    // Convert to FacetOptionCount arrays and mark unavailable options as disabled if they have 0 count
    setFacetOptions({
      formats: Object.entries(formatCounts).map(([value, count]) => ({
        value,
        label: formatLabels[value] || value,
        count,
        disabled: count === 0,
        disabledReason: count === 0 ? 'No courses match your current filters' : undefined
      })),
      availabilities: Object.entries(availabilityCounts).map(([value, count]) => ({
        value,
        label: availabilityLabels[value] || value,
        count,
        disabled: count === 0,
        disabledReason: count === 0 ? 'No courses match your current filters' : undefined
      })),
      languages: Object.entries(languageCounts).map(([value, count]) => ({
        value,
        label: value,
        count,
        disabled: count === 0,
        disabledReason: count === 0 ? 'No courses match your current filters' : undefined
      })),
      subjects: Object.entries(subjectCounts).map(([value, count]) => ({
        value,
        label: value,
        count,
        disabled: count === 0,
        disabledReason: count === 0 ? 'No courses match your current filters' : undefined
      })),
      audiences: Object.entries(audienceCounts).map(([value, count]) => ({
        value,
        label: value,
        count,
        disabled: count === 0,
        disabledReason: count === 0 ? 'No courses match your current filters' : undefined
      })),
      locations: Object.entries(locationCounts).map(([value, count]) => ({
        value,
        label: locationLabels[value] || value,
        count,
        disabled: count === 0,
        disabledReason: count === 0 ? 'No courses match your current filters' : undefined
      })),
      levels: Object.entries(levelCounts).map(([value, count]) => ({
        value,
        label: value,
        count,
        disabled: count === 0,
        disabledReason: count === 0 ? 'No courses match your current filters' : undefined
      })),
      publicationDates: Object.entries(pubDateCounts).map(([value, count]) => ({
        value,
        label: value,
        count,
        disabled: count === 0,
        disabledReason: count === 0 ? 'No courses match your current filters' : undefined
      }))
    });
  };

  // Apply all filters to courses
  const applyFilters = (allCourses: Course[]) => {
    let result = [...allCourses];

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(course => 
        course.title.toLowerCase().includes(searchLower) ||
        course.description.toLowerCase().includes(searchLower) ||
        course.instructor.toLowerCase().includes(searchLower)
      );
    }

    // Category filter
    if (selectedCategory !== 'All') {
      result = result.filter(course => course.category === selectedCategory);
    }

    // Level filter
    if (selectedLevels.length > 0) {
      result = result.filter(course => selectedLevels.includes(course.level));
    }

    // Format filter
    if (selectedFormats.length > 0) {
      result = result.filter(course => selectedFormats.includes(course.format));
    }

    // Availability filter
    if (selectedAvailabilities.length > 0) {
      result = result.filter(course => selectedAvailabilities.includes(course.availability));
    }

    // Language filter
    if (selectedLanguages.length > 0) {
      result = result.filter(course => selectedLanguages.includes(course.language));
    }

    // Subject filter
    if (selectedSubjects.length > 0) {
      result = result.filter(course => selectedSubjects.includes(course.subject));
    }

    // Audience filter
    if (selectedAudiences.length > 0) {
      result = result.filter(course => selectedAudiences.includes(course.audience));
    }

    // Location filter
    if (selectedLocations.length > 0) {
      result = result.filter(course => selectedLocations.includes(course.location));
    }

    // Publication date filter
    if (selectedPublicationDates.length > 0) {
      result = result.filter(course => {
        const year = new Date(course.publicationDate).getFullYear().toString();
        return selectedPublicationDates.includes(year);
      });
    }

    return result;
  };

  // Get all active filters for display
  const getActiveFilters = () => {
    const filters: { key: string; label: string; value: string; valueLabel: string }[] = [];
    
    const addFilter = (key: string, label: string, values: string[], labelMap?: Record<string, string>) => {
      values.forEach(value => {
        filters.push({
          key,
          label,
          value,
          valueLabel: labelMap?.[value] || value
        });
      });
    };

    const formatLabels: Record<string, string> = {
      video: 'Video Course',
      book: 'eBook',
      audio: 'Audio Book',
      workshop: 'Workshop'
    };

    const availabilityLabels: Record<string, string> = {
      available: 'Available Now',
      'coming-soon': 'Coming Soon',
      unavailable: 'Currently Unavailable'
    };

    const locationLabels: Record<string, string> = {
      Online: 'Online Only',
      'In-Person': 'In-Person',
      Hybrid: 'Hybrid'
    };

    addFilter('format', 'Format', selectedFormats, formatLabels);
    addFilter('availability', 'Availability', selectedAvailabilities, availabilityLabels);
    addFilter('language', 'Language', selectedLanguages);
    addFilter('subject', 'Subject', selectedSubjects);
    addFilter('audience', 'Audience', selectedAudiences);
    addFilter('location', 'Location', selectedLocations, locationLabels);
    addFilter('level', 'Level', selectedLevels);
    addFilter('publicationDate', 'Year', selectedPublicationDates);

    return filters;
  };

  // Remove a single filter
  const handleRemoveFilter = (key: string, value: string) => {
    switch (key) {
      case 'format':
        setSelectedFormats(prev => prev.filter(v => v !== value));
        break;
      case 'availability':
        setSelectedAvailabilities(prev => prev.filter(v => v !== value));
        break;
      case 'language':
        setSelectedLanguages(prev => prev.filter(v => v !== value));
        break;
      case 'subject':
        setSelectedSubjects(prev => prev.filter(v => v !== value));
        break;
      case 'audience':
        setSelectedAudiences(prev => prev.filter(v => v !== value));
        break;
      case 'location':
        setSelectedLocations(prev => prev.filter(v => v !== value));
        break;
      case 'level':
        setSelectedLevels(prev => prev.filter(v => v !== value));
        break;
      case 'publicationDate':
        setSelectedPublicationDates(prev => prev.filter(v => v !== value));
        break;
    }
  };

  // Clear all filters
  const handleClearAllFilters = () => {
    setSelectedFormats([]);
    setSelectedAvailabilities([]);
    setSelectedLanguages([]);
    setSelectedSubjects([]);
    setSelectedAudiences([]);
    setSelectedLocations([]);
    setSelectedLevels([]);
    setSelectedPublicationDates([]);
    setSelectedCategory('All');
    setSearch('');
  };

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
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/data/courses.json');
        if (!response.ok) {
          throw new Error('Failed to fetch courses');
        }
        const data = await response.json();
        setCourses(data.courses || []);
        calculateFacetCounts(data.courses || []);
        const filtered = applyFilters(data.courses || []);
        setFilteredCourses(filtered);
      } catch (err) {
        console.error('Error fetching courses:', err);
        setError('Failed to load courses. Please try again later.');
        toast({
          title: 'Error',
          description: 'Failed to load courses. Please try again later.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchCourses();
  }, []);

  // Update filtered courses whenever filters change
  useEffect(() => {
    if (courses.length > 0) {
      const filtered = applyFilters(courses);
      switch (sortBy) {
        case 'newest':
          filtered.sort((a, b) => b.id - a.id);
          break;
        case 'price-low':
          filtered.sort((a, b) => a.price - b.price);
          break;
        case 'price-high':
          filtered.sort((a, b) => b.price - a.price);
          break;
        case 'rating':
          filtered.sort((a, b) => b.rating - a.rating);
          break;
      }
      setFilteredCourses(filtered);
      setTotalPages(Math.ceil(filtered.length / coursesPerPage));
      setCurrentPage(1);
      // Recalculate facet counts based on currently filtered courses to update available options
      calculateFacetCounts(filtered);
    }
  }, [
    courses, 
    search, 
    sortBy, 
    selectedCategory, 
    selectedLevels,
    selectedFormats,
    selectedAvailabilities,
    selectedLanguages,
    selectedSubjects,
    selectedAudiences,
    selectedLocations,
    selectedPublicationDates
  ]);

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

        {/* Top bar with search, sort, and mobile filter button */}
        <div className="flex items-center justify-between w-full mb-4">
          <div className="flex items-center gap-4">
            <Sheet open={isMobileFilterOpen} onOpenChange={setIsMobileFilterOpen}>
              <SheetTrigger asChild className="lg:hidden">
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filters
                  {getActiveFilters().length > 0 && (
                    <Badge variant="secondary" className="ml-1 bg-blue-100 text-blue-800">
                      {getActiveFilters().length}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] sm:w-[400px] overflow-y-auto">
                <h2 className="text-lg font-semibold mb-4">Filters</h2>
                <FacetGroup>
                  {/* Mobile facets - same as desktop */}
                  <Facet
                    title="Format"
                    options={facetOptions.formats}
                    selectedValues={selectedFormats}
                    onChange={setSelectedFormats}
                    isLoading={isLoading}
                    defaultCollapsed={false}
                  />
                  <Facet
                    title="Availability"
                    options={facetOptions.availabilities}
                    selectedValues={selectedAvailabilities}
                    onChange={setSelectedAvailabilities}
                    isLoading={isLoading}
                    defaultCollapsed={true}
                  />
                  <Facet
                    title="Language"
                    options={facetOptions.languages}
                    selectedValues={selectedLanguages}
                    onChange={setSelectedLanguages}
                    isLoading={isLoading}
                    defaultCollapsed={true}
                  />
                  <Facet
                    title="Subject"
                    options={facetOptions.subjects}
                    selectedValues={selectedSubjects}
                    onChange={setSelectedSubjects}
                    isLoading={isLoading}
                    defaultCollapsed={true}
                  />
                  <Facet
                    title="Audience"
                    options={facetOptions.audiences}
                    selectedValues={selectedAudiences}
                    onChange={setSelectedAudiences}
                    isLoading={isLoading}
                    defaultCollapsed={true}
                  />
                  <Facet
                    title="Location"
                    options={facetOptions.locations}
                    selectedValues={selectedLocations}
                    onChange={setSelectedLocations}
                    isLoading={isLoading}
                    defaultCollapsed={true}
                  />
                  <Facet
                    title="Level"
                    options={facetOptions.levels}
                    selectedValues={selectedLevels}
                    onChange={setSelectedLevels}
                    isLoading={isLoading}
                    defaultCollapsed={true}
                  />
                  <Facet
                    title="Publication Year"
                    options={facetOptions.publicationDates}
                    selectedValues={selectedPublicationDates}
                    onChange={setSelectedPublicationDates}
                    isLoading={isLoading}
                    defaultCollapsed={true}
                  />
                </FacetGroup>
              </SheetContent>
            </Sheet>

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
        </div>
      </div>

      <div className="flex gap-6">
        {/* Desktop sidebar with all facets - hidden on mobile */}
        <aside className="hidden lg:block w-[300px] flex-shrink-0">
          <FacetGroup>
            <Facet
              title="Format"
              options={facetOptions.formats}
              selectedValues={selectedFormats}
              onChange={setSelectedFormats}
              isLoading={isLoading}
              defaultCollapsed={false}
            />
            <Facet
              title="Availability"
              options={facetOptions.availabilities}
              selectedValues={selectedAvailabilities}
              onChange={setSelectedAvailabilities}
              isLoading={isLoading}
              defaultCollapsed={false}
            />
            <Facet
              title="Language"
              options={facetOptions.languages}
              selectedValues={selectedLanguages}
              onChange={setSelectedLanguages}
              isLoading={isLoading}
              defaultCollapsed={true}
            />
            <Facet
              title="Subject"
              options={facetOptions.subjects}
              selectedValues={selectedSubjects}
              onChange={setSelectedSubjects}
              isLoading={isLoading}
              defaultCollapsed={true}
            />
            <Facet
              title="Audience"
              options={facetOptions.audiences}
              selectedValues={selectedAudiences}
              onChange={setSelectedAudiences}
              isLoading={isLoading}
              defaultCollapsed={true}
            />
            <Facet
              title="Location"
              options={facetOptions.locations}
              selectedValues={selectedLocations}
              onChange={setSelectedLocations}
              isLoading={isLoading}
              defaultCollapsed={true}
            />
            <Facet
              title="Level"
              options={facetOptions.levels}
              selectedValues={selectedLevels}
              onChange={setSelectedLevels}
              isLoading={isLoading}
              defaultCollapsed={true}
            />
            <Facet
              title="Publication Year"
              options={facetOptions.publicationDates}
              selectedValues={selectedPublicationDates}
              onChange={setSelectedPublicationDates}
              isLoading={isLoading}
              defaultCollapsed={true}
            />
          </FacetGroup>
        </aside>

        {/* Main content area with courses */}
        <main className="flex-1 min-w-0">
          {/* Active filters bar */}
          <ActiveFilters
            filters={getActiveFilters()}
            onRemove={handleRemoveFilter}
            onClearAll={handleClearAllFilters}
          />

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
      </main>
      </div>
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