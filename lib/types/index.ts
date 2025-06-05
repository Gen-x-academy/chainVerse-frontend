// Define the Instructor type interface first
// File: types/index.ts
export interface Instructor {
    id: number;
    name: string;
    title: string;
    description: string;
    rating: number;
    courses: number;
    students: number;
    initials: string;
    reviews?: number;
  }
  