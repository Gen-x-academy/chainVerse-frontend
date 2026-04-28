'use client';
import { ErrorFallback } from '@/src/shared/components/ErrorFallback';
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return <ErrorFallback error={error} reset={reset} />;
}
