/**
 * Capstone policy and limits (CAPSTONE-006).
 *
 * Environment-aware feature flags and limits with safe defaults. Anything
 * invalid or out of bounds falls back to the default for that key and is
 * reported, so a bad configuration value can never loosen a limit silently.
 */

export type CapstoneEnvironment = "development" | "staging" | "production";

export const SUPPORTED_ASSET_TYPES = ["pdf", "docx", "md", "csv", "png", "jpg", "zip", "link"] as const;
export type AssetType = (typeof SUPPORTED_ASSET_TYPES)[number];

export interface CapstonePolicy {
  environment: CapstoneEnvironment;
  flags: { proposalsOpen: boolean; teamFormation: boolean; peerReview: boolean; publicShowcase: boolean };
  limits: {
    teamSizeMin: number;
    teamSizeMax: number;
    maxFilesPerSubmission: number;
    maxFileSizeMb: number;
    maxProposalsPerStudent: number;
  };
  /** Days. */
  windows: { reviewWindowDays: number; proposalRevisionWindowDays: number };
  retention: { draftDays: number; submissionYears: number; auditYears: number };
  supportedAssets: readonly AssetType[];
}

interface Bounds {
  min: number;
  max: number;
}

const BOUNDS = {
  teamSizeMin: { min: 1, max: 10 },
  teamSizeMax: { min: 1, max: 12 },
  maxFilesPerSubmission: { min: 1, max: 50 },
  maxFileSizeMb: { min: 1, max: 200 },
  maxProposalsPerStudent: { min: 1, max: 10 },
  reviewWindowDays: { min: 1, max: 60 },
  proposalRevisionWindowDays: { min: 0, max: 30 },
  draftDays: { min: 7, max: 365 },
  submissionYears: { min: 1, max: 10 },
  auditYears: { min: 1, max: 10 },
} as const satisfies Record<string, Bounds>;

const DEFAULTS: Omit<CapstonePolicy, "environment" | "flags"> = {
  limits: { teamSizeMin: 1, teamSizeMax: 5, maxFilesPerSubmission: 10, maxFileSizeMb: 25, maxProposalsPerStudent: 3 },
  windows: { reviewWindowDays: 14, proposalRevisionWindowDays: 7 },
  retention: { draftDays: 90, submissionYears: 5, auditYears: 5 },
  supportedAssets: ["pdf", "docx", "md", "csv", "png", "jpg", "link"],
};

/** Production ships conservative: new capabilities stay off until explicitly enabled. */
const FLAG_DEFAULTS: Record<CapstoneEnvironment, CapstonePolicy["flags"]> = {
  development: { proposalsOpen: true, teamFormation: true, peerReview: true, publicShowcase: true },
  staging: { proposalsOpen: true, teamFormation: true, peerReview: true, publicShowcase: false },
  production: { proposalsOpen: false, teamFormation: false, peerReview: false, publicShowcase: false },
};

export interface PolicyIssue {
  key: string;
  message: string;
}

export interface PolicyResult {
  policy: CapstonePolicy;
  issues: PolicyIssue[];
}

export type PolicyOverrides = {
  flags?: Partial<CapstonePolicy["flags"]>;
  limits?: Partial<CapstonePolicy["limits"]>;
  windows?: Partial<CapstonePolicy["windows"]>;
  retention?: Partial<CapstonePolicy["retention"]>;
  supportedAssets?: readonly string[];
};

export function resolveEnvironment(value: string | undefined): CapstoneEnvironment {
  return value === "development" || value === "staging" ? value : "production"; // unknown means production
}

function bounded(key: keyof typeof BOUNDS, value: unknown, fallback: number, issues: PolicyIssue[]): number {
  if (value === undefined) return fallback;
  const { min, max } = BOUNDS[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    issues.push({ key, message: `${key} must be a whole number from ${min} to ${max}; using ${fallback}` });
    return fallback;
  }
  return value;
}

export function resolveCapstonePolicy(environment: string | undefined, overrides: PolicyOverrides = {}): PolicyResult {
  const env = resolveEnvironment(environment);
  const issues: PolicyIssue[] = [];

  const flags = { ...FLAG_DEFAULTS[env] };
  for (const [key, value] of Object.entries(overrides.flags ?? {})) {
    if (!(key in flags)) issues.push({ key, message: `unknown flag ${key}` });
    else if (typeof value !== "boolean") issues.push({ key, message: `${key} must be true or false` });
    else (flags as Record<string, boolean>)[key] = value;
  }

  const l = overrides.limits ?? {};
  const limits = {
    teamSizeMin: bounded("teamSizeMin", l.teamSizeMin, DEFAULTS.limits.teamSizeMin, issues),
    teamSizeMax: bounded("teamSizeMax", l.teamSizeMax, DEFAULTS.limits.teamSizeMax, issues),
    maxFilesPerSubmission: bounded("maxFilesPerSubmission", l.maxFilesPerSubmission, DEFAULTS.limits.maxFilesPerSubmission, issues),
    maxFileSizeMb: bounded("maxFileSizeMb", l.maxFileSizeMb, DEFAULTS.limits.maxFileSizeMb, issues),
    maxProposalsPerStudent: bounded("maxProposalsPerStudent", l.maxProposalsPerStudent, DEFAULTS.limits.maxProposalsPerStudent, issues),
  };
  if (limits.teamSizeMin > limits.teamSizeMax) {
    issues.push({ key: "teamSizeMin", message: "teamSizeMin cannot exceed teamSizeMax; using defaults" });
    limits.teamSizeMin = DEFAULTS.limits.teamSizeMin;
    limits.teamSizeMax = DEFAULTS.limits.teamSizeMax;
  }

  const w = overrides.windows ?? {};
  const windows = {
    reviewWindowDays: bounded("reviewWindowDays", w.reviewWindowDays, DEFAULTS.windows.reviewWindowDays, issues),
    proposalRevisionWindowDays: bounded("proposalRevisionWindowDays", w.proposalRevisionWindowDays, DEFAULTS.windows.proposalRevisionWindowDays, issues),
  };
  const r = overrides.retention ?? {};
  const retention = {
    draftDays: bounded("draftDays", r.draftDays, DEFAULTS.retention.draftDays, issues),
    submissionYears: bounded("submissionYears", r.submissionYears, DEFAULTS.retention.submissionYears, issues),
    auditYears: bounded("auditYears", r.auditYears, DEFAULTS.retention.auditYears, issues),
  };

  let supportedAssets: readonly AssetType[] = DEFAULTS.supportedAssets;
  if (overrides.supportedAssets !== undefined) {
    const known = overrides.supportedAssets.filter((a): a is AssetType => (SUPPORTED_ASSET_TYPES as readonly string[]).includes(a));
    const unknown = overrides.supportedAssets.filter((a) => !(SUPPORTED_ASSET_TYPES as readonly string[]).includes(a));
    if (unknown.length > 0) issues.push({ key: "supportedAssets", message: `unsupported asset types ignored: ${unknown.join(", ")}` });
    if (known.length === 0) issues.push({ key: "supportedAssets", message: "no supported asset types given; using defaults" });
    else supportedAssets = [...new Set(known)];
  }

  return { policy: { environment: env, flags, limits, windows, retention, supportedAssets }, issues };
}

/** True when a file of this type and size is allowed under the policy. */
export function isAssetAllowed(policy: CapstonePolicy, type: string, sizeMb: number): boolean {
  return (policy.supportedAssets as readonly string[]).includes(type) && sizeMb > 0 && sizeMb <= policy.limits.maxFileSizeMb;
}
