/** MENTOR-033: eligibility preflight run before an applicant starts an application. */
export interface EligibilityRule {
  id: string;
  label: string;
  /** Actionable message shown when the rule fails. */
  failureMessage: string;
  check: (ctx: EligibilityContext) => boolean;
}

export interface EligibilityContext {
  authenticated: boolean;
  roles: string[];
  walletConnected: boolean;
  profileComplete: boolean;
  blocked: boolean;
  activeApplicationsForProgram: number;
  programOpen: boolean;
  programFull: boolean;
}

export interface PreflightResult {
  eligible: boolean;
  failures: { ruleId: string; message: string }[];
}

export const DEFAULT_ELIGIBILITY_RULES: EligibilityRule[] = [
  { id: 'auth', label: 'Signed in', failureMessage: 'Sign in to apply.', check: (c) => c.authenticated },
  { id: 'role', label: 'Mentee role', failureMessage: 'Only mentees can apply to programs.', check: (c) => c.roles.includes('mentee') },
  { id: 'wallet', label: 'Wallet connected', failureMessage: 'Connect your wallet to continue.', check: (c) => c.walletConnected },
  { id: 'profile', label: 'Profile complete', failureMessage: 'Complete your profile before applying.', check: (c) => c.profileComplete },
  { id: 'blocked', label: 'Account in good standing', failureMessage: 'Your account cannot apply right now.', check: (c) => !c.blocked },
  { id: 'open', label: 'Program accepting applications', failureMessage: 'This program is not accepting applications.', check: (c) => c.programOpen },
  { id: 'capacity', label: 'Capacity available', failureMessage: 'This program is full.', check: (c) => !c.programFull },
  { id: 'duplicate', label: 'No active application', failureMessage: 'You already have an active application for this program.', check: (c) => c.activeApplicationsForProgram === 0 },
];

/** Deny by default: a throwing rule counts as a failure. */
export function runEligibilityPreflight(
  ctx: EligibilityContext,
  rules: EligibilityRule[] = DEFAULT_ELIGIBILITY_RULES,
): PreflightResult {
  const failures: PreflightResult['failures'] = [];
  for (const rule of rules) {
    let ok = false;
    try {
      ok = rule.check(ctx);
    } catch {
      ok = false;
    }
    if (!ok) failures.push({ ruleId: rule.id, message: rule.failureMessage });
  }
  return { eligible: failures.length === 0, failures };
}
