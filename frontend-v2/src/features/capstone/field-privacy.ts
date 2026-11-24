/**
 * Project field-level privacy controls (CAPSTONE-106 / issue #1532).
 *
 * Allows authorized project owners, supervisors, and administrators to configure
 * audience visibility boundaries across 9 project field categories.
 *
 * Security & authorization boundaries:
 * - Deny-by-default access control with tenant boundary verification.
 * - Client-side role checks are paired with backend authorization rejection handling.
 * - Consequential transitions to `public` visibility require explicit confirmation.
 * - Policy-locked fields (e.g. compliance-locked funding or restricted locations) cannot
 *   be modified.
 * - Pure data sanitization function `filterProjectFieldsByAudience` guarantees restricted
 *   field values do not leak into unauthorized views.
 */

export const FIELD_CATEGORIES = [
  "profiles",
  "proposals",
  "membership",
  "notes",
  "progress",
  "outputs",
  "locations",
  "funding",
  "achievements",
] as const;

export type FieldCategory = (typeof FIELD_CATEGORIES)[number];

export const AUDIENCES = [
  "owner",
  "members",
  "collaborators",
  "providers",
  "organization_admin",
  "public",
] as const;

export type Audience = (typeof AUDIENCES)[number];

export interface AudienceDefinition {
  audience: Audience;
  label: string;
  description: string;
  rank: number; // 0 = owner only, 5 = public internet
}

export const AUDIENCE_DEFINITIONS: Readonly<Record<Audience, AudienceDefinition>> = {
  owner: {
    audience: "owner",
    label: "Project Owner Only",
    description: "Visible only to the project creator or primary supervisor.",
    rank: 0,
  },
  members: {
    audience: "members",
    label: "Project Members",
    description: "Visible to all accepted team members and assigned supervisors.",
    rank: 1,
  },
  collaborators: {
    audience: "collaborators",
    label: "Invited Collaborators",
    description: "Visible to active members plus officially invited peer collaborators.",
    rank: 2,
  },
  providers: {
    audience: "providers",
    label: "Authorized Providers",
    description: "Visible to certified external computational, review, and AI service providers.",
    rank: 3,
  },
  organization_admin: {
    audience: "organization_admin",
    label: "Organization Administrators",
    description: "Visible to sponsoring university, lab, or organization administrators.",
    rank: 4,
  },
  public: {
    audience: "public",
    label: "Public (Worldwide)",
    description: "Visible to anyone with the link and unauthenticated visitors on the web.",
    rank: 5,
  },
};

export interface FieldCategoryDefinition {
  category: FieldCategory;
  name: string;
  description: string;
  defaultAudience: Audience;
  allowedAudiences: readonly Audience[];
  isPolicyLocked?: boolean;
  policyLockReason?: string;
  consequentialThreshold: Audience; // transitions at or above this trigger a public exposure warning
}

export const CATEGORY_DEFINITIONS: Readonly<Record<FieldCategory, FieldCategoryDefinition>> = {
  profiles: {
    category: "profiles",
    name: "Participant Profiles",
    description: "Participant biographies, institutional affiliations, and social links.",
    defaultAudience: "collaborators",
    allowedAudiences: ["owner", "members", "collaborators", "organization_admin", "public"],
    consequentialThreshold: "public",
  },
  proposals: {
    category: "proposals",
    name: "Research Proposals",
    description: "Detailed problem statements, research methodologies, and hypothesis drafts.",
    defaultAudience: "members",
    allowedAudiences: ["owner", "members", "collaborators", "organization_admin", "public"],
    consequentialThreshold: "public",
  },
  membership: {
    category: "membership",
    name: "Team Membership",
    description: "Roster of contributors, individual workload allocations, and assigned roles.",
    defaultAudience: "collaborators",
    allowedAudiences: ["owner", "members", "collaborators", "organization_admin", "public"],
    consequentialThreshold: "public",
  },
  notes: {
    category: "notes",
    name: "Collaborative Notes",
    description: "Internal discussion minutes, meeting agendas, and working draft reflections.",
    defaultAudience: "members",
    allowedAudiences: ["owner", "members", "collaborators", "organization_admin"],
    consequentialThreshold: "organization_admin",
  },
  progress: {
    category: "progress",
    name: "Milestone Progress",
    description: "Sprint velocity, milestone completion checklists, and current blockers.",
    defaultAudience: "collaborators",
    allowedAudiences: ["owner", "members", "collaborators", "organization_admin", "public"],
    consequentialThreshold: "public",
  },
  outputs: {
    category: "outputs",
    name: "Project Deliverables & Outputs",
    description: "Submitted manuscripts, demo artifacts, and code repository links.",
    defaultAudience: "members",
    allowedAudiences: ["owner", "members", "collaborators", "providers", "organization_admin", "public"],
    consequentialThreshold: "public",
  },
  locations: {
    category: "locations",
    name: "Field Research Locations",
    description: "Precise GPS coordinates, field site addresses, and physical safety zones.",
    defaultAudience: "members",
    allowedAudiences: ["owner", "members", "organization_admin"],
    isPolicyLocked: true,
    policyLockReason: "Precise research locations are locked to project members and safety administrators by ethics policy.",
    consequentialThreshold: "organization_admin",
  },
  funding: {
    category: "funding",
    name: "Funding & Financial Records",
    description: "Pledged budgets, expense reimbursement invoices, and escrow disbursements.",
    defaultAudience: "organization_admin",
    allowedAudiences: ["owner", "members", "organization_admin"],
    consequentialThreshold: "organization_admin",
  },
  achievements: {
    category: "achievements",
    name: "Credentials & Badges",
    description: "Verified completion milestones and decentralized credential references.",
    defaultAudience: "public",
    allowedAudiences: ["owner", "members", "collaborators", "organization_admin", "public"],
    consequentialThreshold: "public",
  },
};

export interface FieldPrivacySetting {
  category: FieldCategory;
  effectiveAudience: Audience;
  isLocked: boolean;
  lockReason?: string;
  updatedAt: string;
  updatedBy: string;
}

export interface ProjectPrivacyPolicy {
  projectId: string;
  organizationId: string;
  revision: number;
  updatedAt: string;
  settings: Record<FieldCategory, FieldPrivacySetting>;
}

export interface PrivacyActor {
  id: string;
  organizationId: string;
  role: string;
  isProjectOwner?: boolean;
  isSupervisor?: boolean;
}

export type PrivacyErrorCode =
  | "UNKNOWN_CATEGORY"
  | "UNKNOWN_AUDIENCE"
  | "AUDIENCE_NOT_ALLOWED"
  | "FIELD_LOCKED"
  | "TENANT_MISMATCH"
  | "NOT_PERMITTED"
  | "STALE_REVISION"
  | "POLICY_NOT_FOUND";

export type PrivacyResult<T> =
  | { ok: true; value: T; replayed?: boolean }
  | { ok: false; code: PrivacyErrorCode; message: string };

const PRIVACY_ERROR_MESSAGES: Record<PrivacyErrorCode, string> = {
  UNKNOWN_CATEGORY: "The requested field category does not exist.",
  UNKNOWN_AUDIENCE: "The requested audience is not valid.",
  AUDIENCE_NOT_ALLOWED: "This audience level is not supported for this field category.",
  FIELD_LOCKED: "This field's privacy setting is locked by policy and cannot be altered.",
  TENANT_MISMATCH: "Operation rejected across organization boundaries.",
  NOT_PERMITTED: "You do not have permission to modify project privacy controls.",
  STALE_REVISION: "Privacy settings were modified by another user. Reload before saving.",
  POLICY_NOT_FOUND: "Project privacy policy could not be found.",
};

export function privacyFail<T>(code: PrivacyErrorCode, detail?: string): PrivacyResult<T> {
  return { ok: false, code, message: detail ?? PRIVACY_ERROR_MESSAGES[code] };
}

/**
 * Initializes default privacy settings for a project.
 */
export function initializeProjectPrivacy(
  projectId: string,
  organizationId: string,
  now: string,
  actorId: string,
): ProjectPrivacyPolicy {
  const settings = {} as Record<FieldCategory, FieldPrivacySetting>;

  for (const cat of FIELD_CATEGORIES) {
    const def = CATEGORY_DEFINITIONS[cat];
    settings[cat] = {
      category: cat,
      effectiveAudience: def.defaultAudience,
      isLocked: Boolean(def.isPolicyLocked),
      lockReason: def.policyLockReason,
      updatedAt: now,
      updatedBy: actorId,
    };
  }

  return {
    projectId,
    organizationId,
    revision: 1,
    updatedAt: now,
    settings,
  };
}

export interface UpdateFieldPrivacyInput {
  requestId: string;
  projectId: string;
  organizationId: string;
  category: FieldCategory;
  newAudience: Audience;
  expectedRevision: number;
  actor: PrivacyActor;
  now: string;
}

export type PrivacyLedger = Map<string, PrivacyResult<ProjectPrivacyPolicy>>;

/**
 * Updates a single field category's visibility setting.
 */
export function updateFieldPrivacy(
  currentPolicy: ProjectPrivacyPolicy,
  input: UpdateFieldPrivacyInput,
  ledger: PrivacyLedger = new Map(),
): PrivacyResult<ProjectPrivacyPolicy> {
  const cached = ledger.get(input.requestId);
  if (cached) {
    return cached.ok ? { ...cached, replayed: true } : cached;
  }

  const recordResult = (res: PrivacyResult<ProjectPrivacyPolicy>): PrivacyResult<ProjectPrivacyPolicy> => {
    ledger.set(input.requestId, res);
    return res;
  };

  if (!FIELD_CATEGORIES.includes(input.category)) {
    return recordResult(privacyFail("UNKNOWN_CATEGORY"));
  }

  if (!AUDIENCES.includes(input.newAudience)) {
    return recordResult(privacyFail("UNKNOWN_AUDIENCE"));
  }

  if (input.actor.organizationId !== currentPolicy.organizationId) {
    return recordResult(privacyFail("TENANT_MISMATCH"));
  }

  // Authorization check: only project owners, supervisors, or administrators can change privacy
  const isAuthorized =
    Boolean(input.actor.isProjectOwner) ||
    Boolean(input.actor.isSupervisor) ||
    input.actor.role === "administrator" ||
    input.actor.role === "organization_staff";

  if (!isAuthorized) {
    return recordResult(privacyFail("NOT_PERMITTED"));
  }

  if (input.expectedRevision !== currentPolicy.revision) {
    return recordResult(privacyFail("STALE_REVISION"));
  }

  const def = CATEGORY_DEFINITIONS[input.category];
  const currentSetting = currentPolicy.settings[input.category];

  if (currentSetting?.isLocked) {
    return recordResult(
      privacyFail(
        "FIELD_LOCKED",
        currentSetting.lockReason ?? "Visibility for this field is locked by policy."
      )
    );
  }

  if (!def.allowedAudiences.includes(input.newAudience)) {
    return recordResult(
      privacyFail(
        "AUDIENCE_NOT_ALLOWED",
        `Audience '${input.newAudience}' is not allowed for category '${def.name}'.`
      )
    );
  }

  const updatedSettings = {
    ...currentPolicy.settings,
    [input.category]: {
      category: input.category,
      effectiveAudience: input.newAudience,
      isLocked: false,
      updatedAt: input.now,
      updatedBy: input.actor.id,
    },
  };

  const updatedPolicy: ProjectPrivacyPolicy = {
    ...currentPolicy,
    revision: currentPolicy.revision + 1,
    updatedAt: input.now,
    settings: updatedSettings,
  };

  return recordResult({ ok: true, value: updatedPolicy });
}

/**
 * Checks if a requested audience change is consequential (exposing private data to wider audiences).
 */
export function isConsequentialPrivacyChange(
  category: FieldCategory,
  currentAudience: Audience,
  newAudience: Audience,
): { isConsequential: boolean; warning?: string } {
  const currentRank = AUDIENCE_DEFINITIONS[currentAudience].rank;
  const newRank = AUDIENCE_DEFINITIONS[newAudience].rank;

  if (newRank > currentRank) {
    if (newAudience === "public") {
      return {
        isConsequential: true,
        warning: `Publishing '${CATEGORY_DEFINITIONS[category].name}' to the Public internet will make this information viewable by unauthenticated users worldwide.`,
      };
    }
    if (newAudience === "organization_admin" && currentRank <= 2) {
      return {
        isConsequential: true,
        warning: `Broadening visibility to Organization Administrators will expose team-internal deliberations outside the project group.`,
      };
    }
  }

  return { isConsequential: false };
}

export type ViewerRole = "owner" | "member" | "collaborator" | "provider" | "organization_admin" | "anonymous";

/**
 * Determines whether a viewer with a specific role satisfies the target audience requirement.
 */
export function viewerSatisfiesAudience(viewerRole: ViewerRole, targetAudience: Audience): boolean {
  if (targetAudience === "public") return true;
  if (viewerRole === "anonymous") return false;

  switch (targetAudience) {
    case "owner":
      return viewerRole === "owner";
    case "members":
      return viewerRole === "owner" || viewerRole === "member";
    case "collaborators":
      return viewerRole === "owner" || viewerRole === "member" || viewerRole === "collaborator";
    case "providers":
      return viewerRole === "owner" || viewerRole === "member" || viewerRole === "provider";
    case "organization_admin":
      return (
        viewerRole === "owner" ||
        viewerRole === "organization_admin"
      );
    default:
      return false;
  }
}

export interface ProjectDataFields {
  profiles?: Record<string, unknown>[];
  proposals?: Record<string, unknown>;
  membership?: Record<string, unknown>[];
  notes?: Record<string, unknown>[];
  progress?: Record<string, unknown>;
  outputs?: Record<string, unknown>[];
  locations?: Record<string, unknown>[];
  funding?: Record<string, unknown>;
  achievements?: Record<string, unknown>[];
  [key: string]: unknown;
}

/**
 * Pure data-filtering function.
 * Removes restricted field categories if the viewer's role does not meet the category's effective audience.
 */
export function filterProjectFieldsByAudience(
  data: ProjectDataFields,
  policy: ProjectPrivacyPolicy,
  viewerRole: ViewerRole,
): ProjectDataFields {
  const filtered: ProjectDataFields = {};

  for (const cat of FIELD_CATEGORIES) {
    const setting = policy.settings[cat];
    const allowed = setting ? viewerSatisfiesAudience(viewerRole, setting.effectiveAudience) : false;

    if (allowed && data[cat] !== undefined) {
      (filtered as Record<string, unknown>)[cat] = data[cat];
    }
  }

  return filtered;
}
