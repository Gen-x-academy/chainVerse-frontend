import { QueryClient } from '@tanstack/react-query';

type ErrorHandler = (message: string) => void;

let globalErrorHandler: ErrorHandler | null = null;

export function registerGlobalErrorHandler(handler: ErrorHandler) {
  globalErrorHandler = handler;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (error) => {
        const message =
          error instanceof Error ? error.message : 'An unexpected error occurred';
        globalErrorHandler?.(message);
      },
    },
  },
});

export { queryClient };
