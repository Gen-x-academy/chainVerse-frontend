export type Course = {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  instructorId?: string;
  instructor?: string;
  category?: string;
  level?: string;
  rating?: number;
  studentCount?: number;
  price?: number;
};

export type CourseListResponse = {
  data: Course[];
  total: number;
};

export type CoursePayload = {
  title: string;
  description?: string;
  thumbnailUrl?: string;
  instructorId?: string;
  price?: number;
};
