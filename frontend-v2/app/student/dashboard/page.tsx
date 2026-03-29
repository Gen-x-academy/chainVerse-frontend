import React from "react";
import { Clock, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Users, Clock, TrendingUp } from "lucide-react";
import { RevenueChart } from "@/src/features/instructors/components/RevenueChart";

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

            {/* Charts + content row */}
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                {/* Revenue chart — spans 3/5 columns on xl */}
                <div className="xl:col-span-3">
                    <RevenueChart />
                </div>

                {/* Recent Enrollments panel — spans 2/5 columns on xl */}
                <Card className="border-none shadow-sm xl:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-base font-semibold text-gray-800">Recent Enrollments</CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center justify-center h-52">
                        <div className="text-center">
                            <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Users className="text-gray-300 h-6 w-6" />
                            </div>
                            <p className="text-gray-400 text-sm">No recent enrollments to show.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
