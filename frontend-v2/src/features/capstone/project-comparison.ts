/**
 * Project comparison workflow (CAPSTONE-028).
 *
 * Compares a small, fixed number of opportunities across normalized skills,
 * schedule, mode, funding, team needs, prerequisites and verified trust
 * signals. It highlights where they differ and which value is objectively
 * highest or earliest; it deliberately produces no overall winner or score.
 */

export const MAX_COMPARED = 4;
export const MIN_COMPARED = 2;

export interface ComparableOpportunity {
  id: string;
  title: string;
  skills: string[];
  startsOn: string;
  endsOn: string;
  mode: string;
  /** Minor units, integer string; undefined when unfunded. */
  fundingMinor?: string;
  currency?: string;
  teamSize: { min: number; max: number };
  prerequisites: string[];
  /** Only signals the platform has verified (e.g. "sponsor-verified"). */
  trustSignals: string[];
}

export type ComparisonRowKey = "skills" | "schedule" | "mode" | "funding" | "teamSize" | "prerequisites" | "trustSignals";

export interface ComparisonCell {
  opportunityId: string;
  /** Human-readable value. */
  display: string;
  /** True for the objectively best value in rows where "best" is defined (funding, start date). */
  highlight: boolean;
}

export interface ComparisonRow {
  key: ComparisonRowKey;
  label: string;
  differs: boolean;
  cells: ComparisonCell[];
}

export type CompareResult =
  | { ok: true; rows: ComparisonRow[]; commonSkills: string[]; titles: Record<string, string> }
  | { ok: false; error: "TOO_FEW" | "TOO_MANY" | "DUPLICATE" };

const norm = (s: string) => s.trim().toLowerCase();
const list = (items: readonly string[]) => (items.length ? [...items].map(norm).sort().join(", ") : "None");

export function compareOpportunities(items: readonly ComparableOpportunity[]): CompareResult {
  if (items.length < MIN_COMPARED) return { ok: false, error: "TOO_FEW" };
  if (items.length > MAX_COMPARED) return { ok: false, error: "TOO_MANY" };
  if (new Set(items.map((i) => i.id)).size !== items.length) return { ok: false, error: "DUPLICATE" };

  const row = (key: ComparisonRowKey, label: string, display: (o: ComparableOpportunity) => string, best?: (o: ComparableOpportunity) => boolean): ComparisonRow => {
    const values = items.map(display);
    return {
      key,
      label,
      differs: new Set(values).size > 1,
      cells: items.map((o, i) => ({ opportunityId: o.id, display: values[i], highlight: best ? best(o) : false })),
    };
  };

  const funding = (o: ComparableOpportunity) => (o.fundingMinor === undefined ? null : { amount: BigInt(o.fundingMinor), currency: o.currency ?? "" });
  const sameCurrency = new Set(items.map((o) => funding(o)?.currency).filter((c) => c !== undefined)).size <= 1;
  const maxFunding = sameCurrency ? items.reduce<bigint | null>((m, o) => { const f = funding(o); return f && (m === null || f.amount > m) ? f.amount : m; }, null) : null;
  const earliest = items.map((o) => o.startsOn).sort()[0];

  const commonSkills = items.map((o) => new Set(o.skills.map(norm))).reduce((acc, s) => new Set([...acc].filter((x) => s.has(x))));

  return {
    ok: true,
    commonSkills: [...commonSkills].sort(),
    titles: Object.fromEntries(items.map((o) => [o.id, o.title])),
    rows: [
      row("skills", "Skills", (o) => list(o.skills)),
      row("schedule", "Schedule", (o) => `${o.startsOn} to ${o.endsOn}`, (o) => o.startsOn === earliest),
      row("mode", "Mode", (o) => o.mode.replace("_", "-")),
      row("funding", "Funding", (o) => { const f = funding(o); return f ? `${f.amount.toString()} ${f.currency}`.trim() : "Unfunded"; }, (o) => maxFunding !== null && funding(o)?.amount === maxFunding),
      row("teamSize", "Team size", (o) => (o.teamSize.min === o.teamSize.max ? `${o.teamSize.min}` : `${o.teamSize.min}-${o.teamSize.max}`)),
      row("prerequisites", "Prerequisites", (o) => list(o.prerequisites)),
      row("trustSignals", "Verified trust signals", (o) => list(o.trustSignals)),
    ],
  };
}

/** Add to a comparison set, keeping it within the limit and free of duplicates. */
export function addToComparison(ids: readonly string[], id: string): { ok: true; ids: string[] } | { ok: false; error: "FULL" | "DUPLICATE" } {
  if (ids.includes(id)) return { ok: false, error: "DUPLICATE" };
  if (ids.length >= MAX_COMPARED) return { ok: false, error: "FULL" };
  return { ok: true, ids: [...ids, id] };
}
