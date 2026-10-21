"use client";

import { useParams } from "next/navigation";
import {
  MentorshipPageShell,
  SessionSummaryPanel,
} from "@/src/features/mentorship";
import { toIdentityRole } from "@/src/features/mentorship/identity/access";
import { useAuthStore } from "@/src/store/authStore";

const NAV_ITEMS = [
  { href: "/mentorship", label: "Overview" },
  { href: "/mentorship/sessions", label: "Session summaries" },
];

export default function SessionSummaryPage() {
  const params = useParams<{ sessionId: string }>();
  const user = useAuthStore((state) => state.user);
  const role = toIdentityRole(user?.role);
  const allowed = Boolean(
    user?.id && (role === "mentor" || role === "student"),
  );

  return (
    <MentorshipPageShell
      allowed={allowed}
      title="Shared session summary"
      description="Capture the session together. Private notes are not part of this shared record."
      activeHref="/mentorship/sessions"
      navItems={NAV_ITEMS}
    >
      {allowed && user?.id && (role === "mentor" || role === "student") && (
        <SessionSummaryPanel
          key={params.sessionId}
          sessionId={params.sessionId}
          currentUserId={user.id}
          role={role}
        />
      )}
    </MentorshipPageShell>
  );
}
