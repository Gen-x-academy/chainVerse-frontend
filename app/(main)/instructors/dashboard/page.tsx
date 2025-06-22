"use client";
import OverviewCards from "@/components/Instructor-dashboard/Overview";
import ChartsSection from "@/components/Instructor-dashboard/ChartSection";
import Main from "@/components/instructors/dashboard/main";
import { instructor } from "@/lib/mock-data/instructorsData";

const InstructorDashboard = () => {
  return (
    <>
      <Main user={instructor} />
      <OverviewCards />
      <ChartsSection />
    </>
  );
};

export default InstructorDashboard;
