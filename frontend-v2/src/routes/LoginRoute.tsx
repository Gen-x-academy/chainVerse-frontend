import dynamic from 'next/dynamic';

const LoginPage = dynamic(
  () => import('@/features/auth/pages/LoginPage').then((m) => ({ default: m.LoginPage })),
  { loading: () => null }
);

const LoginRoute: React.FC = () => <LoginPage />;

import { Spinner } from '@/src/shared/components/ui/Spinner';

/**
 * #102 Refactor: Login Route is now a thin wrapper.
 * #220: Lazy loaded via next/dynamic to reduce initial bundle size.
 */
const LoginPage = dynamic(
  () => import('@/src/features/auth/pages/LoginPage').then((m) => ({ default: m.LoginPage })),
  { loading: () => <Spinner size="lg" /> }
);

const LoginRoute: React.FC = () => {
  return <LoginPage />;
};

export default LoginRoute;
