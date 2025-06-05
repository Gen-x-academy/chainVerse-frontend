"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import InstructorProfile from "@/components/Instructor-profiles/InstructorProfile";
import { Instructor } from "@/lib/types";
import { instructorsData } from "@/lib/mock-data/instructorsData";

export default function InstructorPage() {
  const [instructor, setInstructor] = useState<Instructor | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const params = useParams();

  useEffect(() => {
    // In a real app, we'd fetch instructor data from an API
    // Here we're using the static data from our instructors page
    if (params?.id) {
      const id = Array.isArray(params.id) ? params.id[0] : params.id;
      const foundInstructor = instructorsData.find(
        (inst) => inst.id === parseInt(id)
      );
      setInstructor(foundInstructor || null);
    }
    setLoading(false);
  }, [params]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-20 px-4 text-center">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mx-auto mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
        </div>
      </div>
    );
  }

  return <InstructorProfile instructor={instructor} />;
}
