"use client";

import { useAuthStore } from "@/store/authStore";

export default function FinanceDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated || user?.role !== "finance") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div role="alert" className="max-w-sm text-center space-y-3">
          <h1 className="text-xl font-semibold text-gray-900">
            Access restricted
          </h1>
          <p className="text-sm text-gray-500">
            This portal is only available to finance team members.
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
