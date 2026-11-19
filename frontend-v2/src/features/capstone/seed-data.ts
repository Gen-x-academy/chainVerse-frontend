/**
 * Deterministic capstone seed data (CAPSTONE-007).
 *
 * Everything is synthetic: names come from fixed word lists, emails use the
 * reserved `example.test` domain, and the same seed always yields the same data
 * with consistent cross references. No real personal data is involved.
 */

export interface SeedOptions {
  seed?: number;
  supervisors?: number;
  calls?: number;
  proposalsPerCall?: number;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GIVEN = ["Ada", "Bola", "Chen", "Dara", "Eli", "Femi", "Gita", "Hana", "Ivo", "Juno", "Kofi", "Lena"];
const FAMILY = ["Okoye", "Silva", "Novak", "Haddad", "Lindqvist", "Mensah", "Tanaka", "Moreau", "Petrov", "Rahman"];
const THEMES = ["decentralized identity", "climate data", "public health", "education access", "supply chain", "open science"];
const SKILLS = ["rust", "typescript", "data analysis", "ux research", "statistics", "smart contracts", "writing"];

export type SeedProposalState = "draft" | "submitted" | "screening" | "approved" | "rejected";
export type SeedReviewVerdict = "accept" | "revise" | "reject";

export interface SeedSupervisor { id: string; name: string; email: string; expertise: string[]; capacity: number }
export interface SeedCall { id: string; title: string; theme: string; supervisorId: string; seats: number; opensOn: string; closesOn: string }
export interface SeedProposal { id: string; callId: string; title: string; state: SeedProposalState; teamId: string }
export interface SeedTeam { id: string; name: string; memberIds: string[] }
export interface SeedMilestone { id: string; proposalId: string; title: string; dueOn: string; done: boolean }
export interface SeedSubmission { id: string; milestoneId: string; submittedOn: string; digest: string }
export interface SeedReview { id: string; submissionId: string; reviewerId: string; verdict: SeedReviewVerdict }
export interface SeedBudget { id: string; proposalId: string; currency: "USD"; amountMinor: string }
export interface SeedPublication { id: string; proposalId: string; title: string; publishedOn: string }
export interface SeedDispute { id: string; proposalId: string; reason: "authorship" | "deadline" | "evaluation"; status: "open" | "resolved" }

export interface CapstoneSeed {
  seed: number;
  supervisors: SeedSupervisor[];
  calls: SeedCall[];
  proposals: SeedProposal[];
  teams: SeedTeam[];
  milestones: SeedMilestone[];
  submissions: SeedSubmission[];
  reviews: SeedReview[];
  budgets: SeedBudget[];
  publications: SeedPublication[];
  disputes: SeedDispute[];
}

const pad = (n: number, w = 3) => String(n).padStart(w, "0");
const isoDay = (base: number, offsetDays: number) => new Date(base + offsetDays * 86_400_000).toISOString().slice(0, 10);
const BASE = Date.UTC(2026, 0, 12); // fixed so output never depends on "today"

export function buildCapstoneSeed(options: SeedOptions = {}): CapstoneSeed {
  const seed = options.seed ?? 1;
  const r = rng(seed);
  const pick = <T,>(items: readonly T[]) => items[Math.floor(r() * items.length)];
  const int = (min: number, max: number) => min + Math.floor(r() * (max - min + 1));

  const supervisors: SeedSupervisor[] = Array.from({ length: options.supervisors ?? 4 }, (_, i) => {
    const name = `${pick(GIVEN)} ${pick(FAMILY)}`;
    return { id: `sup_${pad(i + 1)}`, name, email: `supervisor${i + 1}@example.test`, expertise: [...new Set([pick(SKILLS), pick(SKILLS)])].sort(), capacity: int(2, 6) };
  });

  const calls: SeedCall[] = Array.from({ length: options.calls ?? 3 }, (_, i) => {
    const theme = THEMES[i % THEMES.length];
    return {
      id: `call_${pad(i + 1)}`,
      title: `Capstone call: ${theme}`,
      theme,
      supervisorId: supervisors[i % supervisors.length].id,
      seats: int(3, 8),
      opensOn: isoDay(BASE, i * 7),
      closesOn: isoDay(BASE, i * 7 + 30),
    };
  });

  const proposals: SeedProposal[] = [];
  const teams: SeedTeam[] = [];
  const milestones: SeedMilestone[] = [];
  const submissions: SeedSubmission[] = [];
  const reviews: SeedReview[] = [];
  const budgets: SeedBudget[] = [];
  const publications: SeedPublication[] = [];
  const disputes: SeedDispute[] = [];
  const STATES: SeedProposalState[] = ["draft", "submitted", "screening", "approved", "rejected"];
  const VERDICTS: SeedReviewVerdict[] = ["accept", "revise", "reject"];

  let n = 0;
  for (const call of calls) {
    for (let p = 0; p < (options.proposalsPerCall ?? 3); p += 1) {
      n += 1;
      const teamId = `team_${pad(n)}`;
      const proposalId = `prop_${pad(n)}`;
      const state = STATES[(n + int(0, 2)) % STATES.length];
      teams.push({ id: teamId, name: `Team ${pick(FAMILY)}`, memberIds: Array.from({ length: int(2, 4) }, (_, m) => `stu_${pad(n)}_${m + 1}`) });
      proposals.push({ id: proposalId, callId: call.id, title: `Study of ${call.theme} (${n})`, state, teamId });
      budgets.push({ id: `bud_${pad(n)}`, proposalId, currency: "USD", amountMinor: String(int(5, 50) * 100_000) });
      if (state === "approved") {
        for (let m = 0; m < 2; m += 1) {
          const milestoneId = `ms_${pad(n)}_${m + 1}`;
          milestones.push({ id: milestoneId, proposalId, title: `Milestone ${m + 1}`, dueOn: isoDay(BASE, 60 + m * 30), done: m === 0 });
          if (m === 0) {
            const submissionId = `sub_${pad(n)}`;
            submissions.push({ id: submissionId, milestoneId, submittedOn: isoDay(BASE, 75), digest: (n.toString(16).padStart(8, "0")).repeat(8) });
            reviews.push({ id: `rev_${pad(n)}`, submissionId, reviewerId: call.supervisorId, verdict: pick(VERDICTS) });
          }
        }
        if (n % 3 === 0) publications.push({ id: `pub_${pad(n)}`, proposalId, title: `Findings: ${call.theme}`, publishedOn: isoDay(BASE, 200) });
      }
      if (state === "rejected" && n % 2 === 0) {
        disputes.push({ id: `dis_${pad(n)}`, proposalId, reason: pick(["authorship", "deadline", "evaluation"] as const), status: n % 4 === 0 ? "resolved" : "open" });
      }
    }
  }

  return { seed, supervisors, calls, proposals, teams, milestones, submissions, reviews, budgets, publications, disputes };
}
