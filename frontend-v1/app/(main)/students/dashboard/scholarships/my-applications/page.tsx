import { MyApplications } from "@/components/scholarships/student/MyApplications";

export const metadata = {
  title: "My Applications | ChainVerse Academy",
  description: "Track the status of all your scholarship applications.",
};

export default function MyApplicationsPage() {
  return (
    <div className="flex min-h-screen w-full">
      <MyApplications />
    </div>
  );
}
