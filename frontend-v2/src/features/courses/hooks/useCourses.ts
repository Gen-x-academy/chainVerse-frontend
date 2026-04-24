'use client';

import { useState, useEffect, useCallback } from 'react';
import { courseService } from '../services/course.service';
import type { Course } from '../types';

interface UseCoursesReturn {
  courses: Course[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useCourses(page = 1, pageSize = 10): UseCoursesReturn {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCourses = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await courseService.list(page, pageSize);
      setCourses(res.data);
    } catch {
      setError('Failed to load courses. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  return { courses, isLoading, error, refresh: fetchCourses };
}
