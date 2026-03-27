import dynamic from 'next/dynamic';
import { Spinner } from '@/src/shared/components/ui/Spinner';

/**
 * #99 Refactor: This route file is now a thin wrapper.
 * All dashboard logic is managed within the students feature module.
 * #220: Lazy loaded via next/dynamic to reduce initial bundle size.
 */
const StudentDashboardPage = dynamic(
  () =>
    import('@/src/features/students/pages/StudentDashboardPage').then((m) => ({
      default: m.StudentDashboardPage,
    })),
  { loading: () => <Spinner size="lg" /> }
);

const StudentDashboardRoute: React.FC = () => {
  return <StudentDashboardPage />;
};

export default StudentDashboardRoute;
