import dynamic from 'next/dynamic';

const StudentDashboardPage = dynamic(
  () =>
    import('@/features/students/pages/StudentDashboardPage').then((m) => ({
      default: m.StudentDashboardPage,
    })),
  { loading: () => null }
);

const StudentDashboardRoute: React.FC = () => <StudentDashboardPage />;

export default StudentDashboardRoute;
