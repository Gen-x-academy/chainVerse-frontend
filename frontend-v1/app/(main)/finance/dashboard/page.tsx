import { DisbursementQueue } from "@/components/scholarships/finance/DisbursementQueue";

export const metadata = {
  title: "Disbursements | ChainVerse Academy",
  description: "Manage and track scholarship payment disbursements.",
};

export default function FinanceDashboardPage() {
  return (
    <div className="flex min-h-screen w-full">
      <DisbursementQueue />
    </div>
  );
}
