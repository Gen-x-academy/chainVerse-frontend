import { SponsorDashboard } from "@/components/scholarships/sponsor/SponsorDashboard";

export const metadata = {
  title: "Sponsor Dashboard | ChainVerse Academy",
  description: "Manage your scholarship programs and review submissions.",
};

export default function SponsorDashboardPage() {
  return (
    <div className="flex min-h-screen w-full">
      <SponsorDashboard />
    </div>
  );
}
