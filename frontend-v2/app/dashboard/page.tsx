import dynamic from "next/dynamic";
import Link from "next/link";

const DashboardChart = dynamic(
  () => import("@/components/dashboard/DashboardChart"),
  {
    loading: () => <p>Loading chart...</p>,
    ssr: false,
  }
);

export default function DashboardPage() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-600">Overview of learning progress and research commitments.</p>
        </div>
        <Link
          href="/projects/dashboard"
          className="inline-flex items-center rounded-md bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          View Participant Projects Dashboard &rarr;
        </Link>
      </div>
      <DashboardChart />
    </div>
  );
}