'use client';

import { useSearchParams } from 'next/navigation';

export function useResetPasswordToken(): { token: string | null; email: string | null } {
  const searchParams = useSearchParams();
  return {
    token: searchParams.get('token'),
    email: searchParams.get('email'),
  };
}
