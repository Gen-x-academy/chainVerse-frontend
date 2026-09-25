/**
 * Sponsor dashboard layout.
 *
 * Role guard: renders a permission-denied message for non-sponsor users.
 * In production this would be enforced server-side via middleware/session;
 * here it is a client-side guard consistent with the rest of the project.
 */
"use client";

import { useAuthStore } from "@/store/authStore";

export default function SponsorDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated || user?.role !== "sponsor") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div
          role="alert"
          className="max-w-sm text-center space-y-3"
        >
          <h1 className="text-xl font-semibold text-gray-900">
            Access restricted
          </h1>
          <p className="text-sm text-gray-500">
            This portal is only available to approved sponsors. If you believe
            this is an error, please contact support.
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
