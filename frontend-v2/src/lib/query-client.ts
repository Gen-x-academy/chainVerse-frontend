import { MutationCache, QueryClient } from '@tanstack/react-query';
import { ApiConflictError } from '@/lib/api-errors';

type ErrorHandler = (message: string) => void;

let globalErrorHandler: ErrorHandler | null = null;

export function registerGlobalErrorHandler(handler: ErrorHandler) {
  globalErrorHandler = handler;
}

function isConflictError(error: unknown): boolean {
  if (error instanceof ApiConflictError) {
    return true;
  }
  if (error && typeof error === 'object') {
    const status = (error as { status?: unknown }).status;
    if (status === 409 || status === 412) {
      return true;
    }
    const response = (error as { response?: { status?: unknown } }).response;
    if (response && (response.status === 409 || response.status === 412)) {
      return true;
    }
  }
  return false;
}

const mutationCache = new MutationCache({
  onError: (error) => {
    // Conflict (409/412) states are surfaced by the calling UI so it can
    // present an actionable, stale-transition message. Do not raise a global
    // toast for these, and never auto-retry mutations without an idempotency
    // key supplied by the caller.
    if (isConflictError(error)) {
      return;
    }
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred';
    globalErrorHandler?.(message);
  },
});

const queryClient = new QueryClient({
  mutationCache,
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Idempotency keys are supplied by callers; automatic retries must not
      // fire without one, otherwise side effects could be duplicated.
      retry: 0,
    },
  },
});

export { queryClient };