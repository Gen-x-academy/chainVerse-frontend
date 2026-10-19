"use client";

import { useParams } from "next/navigation";
import { MentorshipPageShell } from "@/src/features/mentorship/components";
import { SessionRecordingConsentPanel } from "@/src/features/mentorship/recording";
import { useAuthStore } from "@/src/store/authStore";

const SESSION_ROLES = [
  "student",
  "instructor",
  "admin",
  "administrator",
  "mentor",
  "tutor",
  "guardian",
  "moderator",
] as const;

export default function SessionRecordingPage() {
  const params = useParams<{ sessionId: string }>();
  const user = useAuthStore((state) => state.user);
  const role = user?.role;
  const allowed = Boolean(
    user?.id &&
    role &&
    SESSION_ROLES.includes(role as (typeof SESSION_ROLES)[number]),
  );
  const navItems = [
    { href: "/mentorship", label: "Overview" },
    ...(allowed
      ? [
          {
            href: `/mentorship/sessions/${encodeURIComponent(params.sessionId)}/recording`,
            label: "Session recording",
          },
        ]
      : []),
  ];

  return (
    <MentorshipPageShell
      allowed={allowed}
      title="Session recording consent"
      description="Review the session policy and each participant’s consent before recording."
      activeHref={`/mentorship/sessions/${encodeURIComponent(params.sessionId)}/recording`}
      navItems={navItems}
    >
      {allowed && user?.id && (
        <SessionRecordingConsentPanel
          sessionId={params.sessionId}
          actorId={user.id}
        />
      )}
    </MentorshipPageShell>
  );
}
