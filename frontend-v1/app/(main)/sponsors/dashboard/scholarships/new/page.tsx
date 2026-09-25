import { CreateProgramForm } from "@/components/scholarships/sponsor/CreateProgramForm";

export const metadata = {
  title: "Create Scholarship Program | ChainVerse Academy",
  description: "Create a new scholarship or bursary program for ChainVerse students.",
};

export default function NewScholarshipProgramPage() {
  return (
    <div className="flex min-h-screen w-full">
      <CreateProgramForm />
    </div>
  );
}
