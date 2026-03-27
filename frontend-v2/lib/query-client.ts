import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

type GlobalErrorHandler = (message: string) => void;
let globalErrorHandler: GlobalErrorHandler | null = null;

export function registerGlobalErrorHandler(handler: GlobalErrorHandler) {
  globalErrorHandler = handler;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 30, // 30 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
  queryCache: new QueryCache({
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "An error occurred";
      globalErrorHandler?.(message);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "An error occurred";
      globalErrorHandler?.(message);
    },
  }),
});