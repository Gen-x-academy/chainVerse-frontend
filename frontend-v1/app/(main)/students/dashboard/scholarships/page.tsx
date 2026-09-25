import { ScholarshipList } from "@/components/scholarships/student/ScholarshipList";

export const metadata = {
  title: "Scholarships & Bursaries | ChainVerse Academy",
  description:
    "Browse and apply for scholarship and bursary programs available to ChainVerse students.",
};

export default function ScholarshipsPage() {
  return (
    <div className="flex min-h-screen w-full">
      <ScholarshipList />
    </div>
  );
}
