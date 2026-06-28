'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { authService } from '../services/auth.service';

type Props = {
  children: React.ReactNode;
  redirectTo?: string;
};

export function RequireAuth({ children, redirectTo = '/auth/login' }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      router.replace(`${redirectTo}?reason=unauthorized`);
    }
  }, [router, redirectTo]);

  if (!authService.isAuthenticated()) {
    return null;
  }

  return <>{children}</>;
}
