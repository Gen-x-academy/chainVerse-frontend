export interface AccessibilityFeatures {
  largePrint?: boolean;
  braille?: boolean;
  dyslexiaFriendly?: boolean;
  captioned?: boolean;
  transcript?: boolean;
  screenReaderCompatible?: boolean;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  instructor: string;
  category: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  price: number;
  currency: string;
  rating: number;
  students: number;
  image: string;
  thumbnailUrl?: string;
  instructorId?: string;
  studentCount?: number;
  accessibility?: AccessibilityFeatures;
}

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
  accessibility?: AccessibilityFeatures;
};