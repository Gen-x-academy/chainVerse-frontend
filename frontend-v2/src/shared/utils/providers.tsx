"use client";

import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "@/lib/query-client";
import { ToastProvider } from "@/src/context/ToastContext";
import { WalletProvider } from "@/src/context/WalletContext";

export default function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <ToastProvider>{children}</ToastProvider>
      </WalletProvider>
      {/* Devtools panel — tree-shaken out of production builds automatically */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}