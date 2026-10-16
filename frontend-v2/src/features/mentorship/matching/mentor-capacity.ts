/** MENTOR-041: mentor capacity allocation across programs. */
export interface MentorCapacity {
  mentorId: string;
  /** Total concurrent mentees the mentor will take across all programs. */
  totalSlots: number;
  /** Optional per-program caps; the sum of allocations never exceeds totalSlots. */
  allocations: Record<string, number>;
  /** Mentees currently engaged, by program. */
  used: Record<string, number>;
}

const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

export function allocatedSlots(c: MentorCapacity): number {
  return sum(c.allocations);
}

export function usedSlots(c: MentorCapacity): number {
  return sum(c.used);
}

export function remainingForProgram(c: MentorCapacity, programId: string): number {
  const cap = c.allocations[programId] ?? 0;
  const free = c.totalSlots - usedSlots(c);
  return Math.max(0, Math.min(cap - (c.used[programId] ?? 0), free));
}

export function validateAllocation(c: MentorCapacity): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(c.totalSlots) || c.totalSlots < 0) errors.push('Total slots must be a non-negative integer');
  if (Object.values(c.allocations).some((n) => !Number.isInteger(n) || n < 0)) errors.push('Allocations must be non-negative integers');
  if (allocatedSlots(c) > c.totalSlots) errors.push('Allocations exceed total slots');
  for (const [pid, n] of Object.entries(c.used)) {
    if (n > (c.allocations[pid] ?? 0)) errors.push(`Program ${pid} has more mentees than allocated slots`);
  }
  return errors;
}

/** Set a program's allocation; refuses to drop below mentees already engaged or above total capacity. */
export function setAllocation(c: MentorCapacity, programId: string, slots: number): MentorCapacity {
  const next = { ...c, allocations: { ...c.allocations, [programId]: slots } };
  if (slots < (c.used[programId] ?? 0)) throw new Error('Cannot allocate fewer slots than active mentees');
  const errors = validateAllocation(next);
  if (errors.length) throw new Error(errors.join('; '));
  return next;
}

export const canAcceptMentee = (c: MentorCapacity, programId: string): boolean => remainingForProgram(c, programId) > 0;
