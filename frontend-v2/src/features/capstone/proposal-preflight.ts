/**
 * Proposal eligibility preflight (CAPSTONE-037).
 *
 * Before submission the current call rules are evaluated against the proposal.
 * The result is `pass`, `fail` or `needs_information`, and every finding has a
 * safe explanation (no private profile data) and a remediation step.
 */

export type CheckOutcome = "pass" | "fail" | "unknown";
export type PreflightStatus = "pass" | "fail" | "needs_information";

export interface PreflightContext {
  now: string;
  callStatus: "open" | "closed" | "draft";
  callClosesAt: string;
  /** Team size on the proposal, once known. */
  teamSize?: number;
  minTeamSize: number;
  maxTeamSize: number;
  /** Whether the lead's profile meets the call's profile requirements, once checked. */
  profileComplete?: boolean;
  /** Whether the participant already has an active submission to this call. */
  hasActiveSubmission?: boolean;
  requiredDocuments: string[];
  providedDocuments: string[];
  /** Whether a required supervisor has been named, when the call needs one. */
  supervisorRequired: boolean;
  supervisorNamed?: boolean;
}

export interface PreflightRule {
  id: string;
  title: string;
  evaluate: (ctx: PreflightContext) => CheckOutcome;
  /** Shown when the rule fails. Must not contain private data. */
  failMessage: string;
  remediation: string;
  /** Shown when the rule cannot be decided yet. */
  unknownMessage: string;
}

export interface PreflightFinding {
  ruleId: string;
  title: string;
  outcome: CheckOutcome;
  message: string;
  remediation: string;
}

export interface PreflightResult {
  status: PreflightStatus;
  findings: PreflightFinding[];
  checkedAt: string;
}

export const PREFLIGHT_RULES: readonly PreflightRule[] = [
  {
    id: "call-open",
    title: "Call is open",
    evaluate: (c) => (c.callStatus === "open" && Date.parse(c.now) < Date.parse(c.callClosesAt) ? "pass" : "fail"),
    failMessage: "This call is not accepting proposals.",
    remediation: "Look for another open call.",
    unknownMessage: "",
  },
  {
    id: "team-size",
    title: "Team size fits the call",
    evaluate: (c) => (c.teamSize === undefined ? "unknown" : c.teamSize >= c.minTeamSize && c.teamSize <= c.maxTeamSize ? "pass" : "fail"),
    failMessage: "The team size is outside what the call allows.",
    remediation: "Add or remove members so the team fits the allowed size.",
    unknownMessage: "Add your team members so the size can be checked.",
  },
  {
    id: "profile-complete",
    title: "Profile is complete",
    evaluate: (c) => (c.profileComplete === undefined ? "unknown" : c.profileComplete ? "pass" : "fail"),
    failMessage: "Your profile does not yet meet the call's requirements.",
    remediation: "Finish the missing profile sections, then check again.",
    unknownMessage: "Your profile has not been checked yet.",
  },
  {
    id: "no-duplicate",
    title: "No other active submission",
    evaluate: (c) => (c.hasActiveSubmission === undefined ? "unknown" : c.hasActiveSubmission ? "fail" : "pass"),
    failMessage: "You already have an active submission to this call.",
    remediation: "Withdraw the earlier submission before submitting again.",
    unknownMessage: "Existing submissions could not be checked.",
  },
  {
    id: "documents",
    title: "Required documents provided",
    evaluate: (c) => (c.requiredDocuments.every((d) => c.providedDocuments.includes(d)) ? "pass" : "fail"),
    failMessage: "Some required documents are missing.",
    remediation: "Attach the documents listed as required by the call.",
    unknownMessage: "",
  },
  {
    id: "supervisor",
    title: "Supervisor named",
    evaluate: (c) => (!c.supervisorRequired ? "pass" : c.supervisorNamed === undefined ? "unknown" : c.supervisorNamed ? "pass" : "fail"),
    failMessage: "This call needs a named supervisor.",
    remediation: "Invite a supervisor to the proposal.",
    unknownMessage: "Name a supervisor so this can be checked.",
  },
];

/** Run every rule. Any failure makes the result `fail`; otherwise any unknown makes it `needs_information`. */
export function runPreflight(ctx: PreflightContext, rules: readonly PreflightRule[] = PREFLIGHT_RULES): PreflightResult {
  const findings: PreflightFinding[] = rules.map((rule) => {
    const outcome = rule.evaluate(ctx);
    return {
      ruleId: rule.id,
      title: rule.title,
      outcome,
      message: outcome === "pass" ? "" : outcome === "fail" ? rule.failMessage : rule.unknownMessage,
      remediation: outcome === "pass" ? "" : rule.remediation,
    };
  });
  const status: PreflightStatus = findings.some((f) => f.outcome === "fail") ? "fail" : findings.some((f) => f.outcome === "unknown") ? "needs_information" : "pass";
  return { status, findings, checkedAt: ctx.now };
}

/** Findings the participant still has to act on, failures first. */
export function actionableFindings(result: PreflightResult): PreflightFinding[] {
  return result.findings.filter((f) => f.outcome !== "pass").sort((a, b) => Number(b.outcome === "fail") - Number(a.outcome === "fail"));
}

/** A passing preflight goes stale as soon as the call or the proposal changes. */
export function isPreflightCurrent(result: PreflightResult, ctx: PreflightContext): boolean {
  return result.status === "pass" && runPreflight(ctx).status === "pass";
}
