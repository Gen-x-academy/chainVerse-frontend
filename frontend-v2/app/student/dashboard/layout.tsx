import { InstructorDashboardLayout } from "@/src/components/dashboard/instructor/InstructorDashboardLayout";

export default function StudentDashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <InstructorDashboardLayout>{children}</InstructorDashboardLayout>;
}
