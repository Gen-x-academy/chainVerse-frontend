"use client";

import { useAuthStore } from "@/src/store/authStore";
import {
  MentorshipPageShell,
  SessionSummaryList,
} from "@/src/features/mentorship";
import { toIdentityRole } from "@/src/features/mentorship/identity/access";

const NAV_ITEMS = [
  { href: "/mentorship", label: "Overview" },
  { href: "/mentorship/sessions", label: "Session summaries" },
];

export default function MentorshipSessionsPage() {
  const user = useAuthStore((state) => state.user);
  const role = toIdentityRole(user?.role);
  const allowed = Boolean(
    user?.id && (role === "mentor" || role === "student"),
  );

  return (
    <MentorshipPageShell
      allowed={allowed}
      title="Session summaries"
      description="Review completed sessions and create a shared record of what you covered."
      activeHref="/mentorship/sessions"
      navItems={NAV_ITEMS}
    >
      {allowed && <SessionSummaryList />}
    </MentorshipPageShell>
  );
}
