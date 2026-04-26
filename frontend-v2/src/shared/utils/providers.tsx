"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { ToastProvider } from "@/src/context/ToastContext";
import { WishlistProvider } from "@/src/context/WishlistContext";

export default function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <WishlistProvider>{children}</WishlistProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}