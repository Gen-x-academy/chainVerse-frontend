import { ReviewQueue } from "@/components/scholarships/reviewer/ReviewQueue";

export const metadata = {
  title: "Review Queue | ChainVerse Academy",
  description: "Review and decide on pending scholarship applications.",
};

export default function ReviewerDashboardPage() {
  return (
    <div className="flex min-h-screen w-full">
      <ReviewQueue />
    </div>
  );
}
