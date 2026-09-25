import { ApplicationForm } from "@/components/scholarships/student/ApplicationForm";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  return {
    title: "Apply for Scholarship | ChainVerse Academy",
    description: `Submit your application for scholarship program ${id}.`,
  };
}

export default async function ApplyPage({ params }: Props) {
  const { id } = await params;
  return (
    <div className="flex min-h-screen w-full">
      <ApplicationForm programId={id} />
    </div>
  );
}
