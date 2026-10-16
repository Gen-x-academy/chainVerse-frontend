/** MENTOR-027: program catalog with filtering, sorting and facet counts. */
export type CatalogDeliveryMode = 'virtual' | 'in_person' | 'hybrid' | 'async';

export interface CatalogProgram {
  id: string;
  name: string;
  summary: string;
  topics: string[];
  deliveryMode: CatalogDeliveryMode;
  durationWeeks: number;
  applicationsOpen: boolean;
  startDate: string;
  seatsRemaining?: number;
}

export interface CatalogFilter {
  text?: string;
  topics?: string[];
  deliveryModes?: CatalogDeliveryMode[];
  openOnly?: boolean;
  maxDurationWeeks?: number;
}

export type CatalogSort = 'start_soonest' | 'name' | 'duration';

export function filterPrograms(programs: CatalogProgram[], f: CatalogFilter): CatalogProgram[] {
  const text = f.text?.trim().toLowerCase();
  return programs.filter((p) => {
    if (f.openOnly && !p.applicationsOpen) return false;
    if (f.deliveryModes?.length && !f.deliveryModes.includes(p.deliveryMode)) return false;
    if (f.topics?.length && !f.topics.every((t) => p.topics.includes(t))) return false;
    if (f.maxDurationWeeks !== undefined && p.durationWeeks > f.maxDurationWeeks) return false;
    if (text && !`${p.name} ${p.summary}`.toLowerCase().includes(text)) return false;
    return true;
  });
}

export function sortPrograms(programs: CatalogProgram[], sort: CatalogSort = 'start_soonest'): CatalogProgram[] {
  const cmp: Record<CatalogSort, (a: CatalogProgram, b: CatalogProgram) => number> = {
    start_soonest: (a, b) => Date.parse(a.startDate) - Date.parse(b.startDate),
    name: (a, b) => a.name.localeCompare(b.name),
    duration: (a, b) => a.durationWeeks - b.durationWeeks,
  };
  return [...programs].sort((a, b) => cmp[sort](a, b) || a.id.localeCompare(b.id));
}

/** Topic and delivery-mode counts for the filter sidebar. */
export function facetCounts(programs: CatalogProgram[]): { topics: Record<string, number>; modes: Record<string, number> } {
  const topics: Record<string, number> = {};
  const modes: Record<string, number> = {};
  for (const p of programs) {
    modes[p.deliveryMode] = (modes[p.deliveryMode] ?? 0) + 1;
    for (const t of p.topics) topics[t] = (topics[t] ?? 0) + 1;
  }
  return { topics, modes };
}
