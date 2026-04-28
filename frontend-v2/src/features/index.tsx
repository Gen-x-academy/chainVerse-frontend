// Barrel file — re-exports every feature slice so consumers can import from '@/src/features'
// instead of reaching into individual feature directories.
//
// Usage:
//   import { LoginForm }        from '@/src/features';
//   import { CourseCard }       from '@/src/features';
//   import { InstructorProfile } from '@/src/features';
//   import { StudentDashboard } from '@/src/features';

export * from './auth';
export * from './courses';
export * from './instructors';
export * from './students';
