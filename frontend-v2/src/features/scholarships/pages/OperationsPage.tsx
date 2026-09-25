import { ScholarshipsNav } from "../components/ScholarshipsNav";
import { ScholarshipOperationsPanel } from "../components/ScholarshipOperationsPanel";
import { useAuthStore } from "@/src/store/authStore";
import { ScholarshipPageShell } from "../components/ScholarshipPageShell";
import { canAccessScholarshipArea } from "../utils/scholarshipRoles";

export function OperationsPage() {
  const user = useAuthStore((state) => state.user);
  return (
    <>
      <ScholarshipsNav />
      <ScholarshipPageShell
        allowed={canAccessScholarshipArea(user?.role, "manage")}
        title="Scholarship Operations"
        description="Measure deadline readiness without exposing applicant data."
        activeHref="/scholarships/operations"
        navItems={[
          { href: "/scholarships", label: "Overview" },
          { href: "/scholarships/operations", label: "Operations" },
        ]}
      >
        <ScholarshipOperationsPanel />
      </ScholarshipPageShell>
    </>
  );
}

export default OperationsPage;
