'use client';

import { useEffect } from 'react';
import { ErrorFallback } from '@/src/shared/components/ErrorFallback';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error boundary caught:', error);
  }, [error]);

  return <ErrorFallback error={error} reset={reset} />;
}
