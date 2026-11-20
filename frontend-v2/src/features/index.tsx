// Barrel file — re-exports every feature slice so consumers can import from '@/src/features'
// instead of reaching into individual feature directories.
//
// Usage:
//   import { LoginForm }        from '@/src/features';
//   import { CourseCard }       from '@/src/features';
//   import { InstructorProfile } from '@/src/features';
//   import { StudentDashboard } from '@/src/features';
//   import { notesService }     from '@/src/features';
//   import { discussionsService } from '@/src/features';
//   import { reviewsService }   from '@/src/features';
//   import { revisionsService } from '@/src/features';

export * from './auth';
export * from './courses';
export * from './instructors';
export * from './notifications';
export * from './scholarships';
export * from './students';

// Workspace track (CAPSTONE-067, CAPSTONE-069, CAPSTONE-077, CAPSTONE-078)
export * from './workspace';

// Projects track (CAPSTONE-063, CAPSTONE-065, CAPSTONE-068)
export * from './projects';