import React from "react";
import { Clock, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalyticsGrid } from "@/src/components/dashboard/instructor/AnalyticsGrid";

// ─── Empty-state placeholder ──────────────────────────────────────────────────

interface EmptyPlaceholderProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

const EmptyPlaceholder: React.FC<EmptyPlaceholderProps> = ({
  icon: Icon,
  label,
}) => (
  <div className="flex flex-col items-center justify-center h-full gap-3 text-center select-none">
    <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center">
      <Icon className="text-gray-300 h-6 w-6" aria-hidden="true" />
    </div>
    <p className="text-gray-400 text-sm">{label}</p>
  </div>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * InstructorDashboardPage
 *
 * Top-level dashboard overview page.
 * Analytics metrics are delegated entirely to <AnalyticsGrid />,
 * keeping this page thin and composable.
 */
export default function InstructorDashboardPage() {
  return (
    <div className="space-y-8">
      {/* Page heading */}
      <header>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
          Dashboard Overview
        </h2>
        <p className="text-gray-500 mt-1 text-sm">
          Here&apos;s what&apos;s happening with your courses today.
        </p>
      </header>

      {/* Analytics metric cards */}
      <AnalyticsGrid />

      {/* Secondary content panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-none shadow-sm h-80">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-800">
              Recent Enrollments
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[calc(100%-4rem)]">
            <EmptyPlaceholder
              icon={Users}
              label="No recent enrollments to show."
            />
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm h-80">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-800">
              Upcoming Sessions
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[calc(100%-4rem)]">
            <EmptyPlaceholder
              icon={Clock}
              label="No upcoming sessions scheduled."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
