"use client";

import { useState, useEffect } from "react";
import { Search, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { CourseCard } from "@/components/course-card";
import { Spinner } from "@/components/ui/spinner";

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
}

export function CoursesSection() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const coursesPerPage = 10;

  // Fetch courses data
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setIsLoading(true);

        // Simulate API call with delay
        const response = await new Promise<Response>((resolve) => {
          setTimeout(() => {
            resolve(fetch("/data/courses.json"));
          }, 1000);
        });

        if (!response.ok) {
          throw new Error("Failed to fetch courses");
        }

        const data = await response.json();
        setCourses(data.courses);
        setError(null);
      } catch (err) {
        console.error("Error fetching courses:", err);
        setError("Failed to load courses. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCourses();
  }, []);

  // Filter and sort courses
  useEffect(() => {
    if (!courses.length) return;

    // Apply search filter
    let result = courses.filter((course) => {
      const searchLower = search.toLowerCase();
      return (
        course.title.toLowerCase().includes(searchLower) ||
        course.description.toLowerCase().includes(searchLower) ||
        course.instructor.toLowerCase().includes(searchLower) ||
        course.category.toLowerCase().includes(searchLower)
      );
    });

    // Apply level filter
    if (selectedLevels.length > 0) {
      result = result.filter((course) => selectedLevels.includes(course.level));
    }

    // Apply category filter
    if (selectedCategories.length > 0) {
      result = result.filter((course) =>
        selectedCategories.includes(course.category)
      );
    }

    // Apply sorting
    switch (sortBy) {
      case "newest":
        result = [...result].sort((a, b) => b.id - a.id);
        break;
      case "price-low":
        result = [...result].sort((a, b) => a.price - b.price);
        break;
      case "price-high":
        result = [...result].sort((a, b) => b.price - a.price);
        break;
      case "rating":
        result = [...result].sort((a, b) => b.rating - a.rating);
        break;
      default:
        break;
    }

    setFilteredCourses(result);
    setTotalPages(Math.ceil(result.length / coursesPerPage));
    setCurrentPage(1); // Reset to first page when filters change
  }, [courses, search, sortBy, selectedLevels, selectedCategories]);

  // Get unique categories and levels for filters
  const uniqueCategories = Array.from(
    new Set(courses.map((course) => course.category))
  );
  const uniqueLevels = Array.from(
    new Set(courses.map((course) => course.level))
  );

  // Get current page courses
  const currentCourses = filteredCourses.slice(
    (currentPage - 1) * coursesPerPage,
    currentPage * coursesPerPage
  );

  // Handle level filter changes
  const handleLevelChange = (level: string) => {
    setSelectedLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  };

  // Handle category filter changes
  const handleCategoryChange = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  // Handle pagination
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-2">Courses</h1>
      <p className="text-muted-foreground mb-6">
        Browse our collection of blockchain and Web3 courses
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search courses...."
              className="pl-10 w-full sm:w-[280px]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
            className={
              showFilters ? "bg-muted hover:bg-blue-500" : "hover:bg-blue-500"
            }
            title="Show filters"
          >
            <Filter className="h-4 w-4" />
          </Button>
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-[200px]">
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

      {showFilters && (
        <div className="mb-8 border rounded-lg p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-card shadow-sm animate-in fade-in-50 duration-300">
          <Accordion
            type="single"
            collapsible
            className="w-full"
            defaultValue="levels"
          >
            <AccordionItem value="levels" className="border-b">
              <AccordionTrigger className="hover:no-underline hover:bg-muted/50 px-3 rounded-md">
                Course Levels
              </AccordionTrigger>
              <AccordionContent className="pt-4 px-2">
                <div className="space-y-3">
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
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <Accordion
            type="single"
            collapsible
            className="w-full"
            defaultValue="categories"
          >
            <AccordionItem value="categories" className="border-b">
              <AccordionTrigger className="hover:no-underline hover:bg-muted/50 px-3 rounded-md">
                Categories
              </AccordionTrigger>
              <AccordionContent className="pt-4 px-2">
                <div className="space-y-3">
                  {uniqueCategories.map((category) => (
                    <div key={category} className="flex items-center space-x-3">
                      <Checkbox
                        id={`category-${category}`}
                        checked={selectedCategories.includes(category)}
                        onCheckedChange={() => handleCategoryChange(category)}
                      />
                      <label
                        htmlFor={`category-${category}`}
                        className="ml-2 cursor-pointer"
                      >
                        {category}
                      </label>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentCourses.map((course) => (
              <CourseCard
                key={course.id}
                category={course.category}
                title={course.title}
                rating={course.rating}
                description={course.description}
                instructor={course.instructor}
                level={course.level}
                price={course.price}
                currency={course.currency}
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
                    variant={currentPage === page ? "default" : "outline"}
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
