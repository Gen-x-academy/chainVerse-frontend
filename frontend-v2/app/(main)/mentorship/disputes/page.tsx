"use client";

import React from "react";
import { useAuthStore } from "@/src/store/authStore";
import {
  MENTORSHIP_ENVIRONMENTS,
  MentorshipPageShell,
  canAccessMentorshipArea,
  toMentorshipRole,
  type MentorshipPrincipal,
} from "@/src/features/mentorship";
import { mentorshipConfigService } from "@/src/features/mentorship/config";
import type { MentorshipEnvironment } from "@/src/features/mentorship/config";
import { toIdentityRole } from "@/src/features/mentorship/identity/access";
import { SessionDisputesPanel } from "@/src/features/mentorship/disputes";

const NAV_ITEMS = [
  { href: "/mentorship", label: "Overview" },
  { href: "/mentorship/disputes", label: "Session disputes" },
];

export default function SessionDisputesPage() {
  const user = useAuthStore((state) => state.user);
  const [capabilityState, setCapabilityState] = React.useState<
    "loading" | "enabled" | "disabled"
  >("loading");
  const role = toIdentityRole(user?.role);
  const allowed = canAccessMentorshipArea(role, "disputes");
  const principal: MentorshipPrincipal = {
    userId: user?.id ?? "",
    role: toMentorshipRole(role) ?? "student",
    tenantId: user?.tenantId ?? "",
  };

  React.useEffect(() => {
    if (!allowed) {
      setCapabilityState("disabled");
      return;
    }
    const configuredEnvironment =
      process.env.NEXT_PUBLIC_MENTORSHIP_ENVIRONMENT;
    const environment = MENTORSHIP_ENVIRONMENTS.includes(
      configuredEnvironment as MentorshipEnvironment,
    )
      ? (configuredEnvironment as MentorshipEnvironment)
      : process.env.NODE_ENV === "development"
        ? "development"
        : "production";
    void mentorshipConfigService.resolve(environment).then(({ config }) => {
      setCapabilityState(config.featureFlags.disputes ? "enabled" : "disabled");
    });
  }, [allowed]);

  return (
    <MentorshipPageShell
      allowed={allowed}
      title="Session disputes"
      description="Challenge session attendance, completion, duration, or outcome before settlement."
      activeHref="/mentorship/disputes"
      navItems={NAV_ITEMS}
    >
      <SessionDisputesPanel
        principal={principal}
        capabilityState={capabilityState}
      />
    </MentorshipPageShell>
  );
}
