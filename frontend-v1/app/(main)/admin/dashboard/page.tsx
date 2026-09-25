import { AdminOverview } from "@/components/scholarships/admin/AdminOverview";

export const metadata = {
  title: "Admin Dashboard | ChainVerse Academy",
  description: "Platform-wide scholarship administration and oversight.",
};

export default function AdminDashboardPage() {
  return (
    <div className="flex min-h-screen w-full">
      <AdminOverview />
    </div>
  );
}
