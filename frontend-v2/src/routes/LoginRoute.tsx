import dynamic from 'next/dynamic';

const LoginPage = dynamic(
  () => import('@/features/auth/pages/LoginPage').then((m) => ({ default: m.LoginPage })),
  { loading: () => null }
);

const LoginRoute: React.FC = () => <LoginPage />;

export default LoginRoute;
