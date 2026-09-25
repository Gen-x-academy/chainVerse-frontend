import { ScholarshipDetail } from "@/components/scholarships/student/ScholarshipDetail";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  return {
    title: `Scholarship Details | ChainVerse Academy`,
    description: `View details and eligibility for scholarship program ${id}.`,
  };
}

export default async function ScholarshipDetailPage({ params }: Props) {
  const { id } = await params;
  return (
    <div className="flex min-h-screen w-full">
      <ScholarshipDetail programId={id} />
    </div>
  );
}
