'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { authService } from '../services/auth.service';

type Props = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

export function PageAuthGuard({ children, fallback }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      router.replace('/auth/login?reason=unauthorized');
    }
  }, [router]);

  if (!authService.isAuthenticated()) {
    return fallback ?? null;
  }

  return <>{children}</>;
}
