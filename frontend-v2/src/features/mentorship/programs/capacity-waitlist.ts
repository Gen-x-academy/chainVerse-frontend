/** MENTOR-019: program capacity and FIFO waitlists. */
export interface SeatedProgram {
  programId: string;
  capacity: number;
  /** Applicant ids holding a seat. */
  seated: string[];
  /** Applicant ids waiting, in join order. */
  waitlist: string[];
}

export const seatsLeft = (p: SeatedProgram): number => Math.max(0, p.capacity - p.seated.length);

/** Join the program: seated if there is room, otherwise waitlisted. Idempotent. */
export function join(p: SeatedProgram, applicantId: string): { program: SeatedProgram; outcome: 'seated' | 'waitlisted' } {
  if (p.seated.includes(applicantId)) return { program: p, outcome: 'seated' };
  if (p.waitlist.includes(applicantId)) return { program: p, outcome: 'waitlisted' };
  if (seatsLeft(p) > 0) return { program: { ...p, seated: [...p.seated, applicantId] }, outcome: 'seated' };
  return { program: { ...p, waitlist: [...p.waitlist, applicantId] }, outcome: 'waitlisted' };
}

/** Promote waitlisted applicants into any freed seats, in order. */
function promote(p: SeatedProgram): SeatedProgram {
  const n = Math.min(seatsLeft(p), p.waitlist.length);
  return n === 0 ? p : { ...p, seated: [...p.seated, ...p.waitlist.slice(0, n)], waitlist: p.waitlist.slice(n) };
}

export function leave(p: SeatedProgram, applicantId: string): SeatedProgram {
  return promote({ ...p, seated: p.seated.filter((id) => id !== applicantId), waitlist: p.waitlist.filter((id) => id !== applicantId) });
}

/** Changing capacity never evicts seated people; lowering it simply stops new seating. */
export function setCapacity(p: SeatedProgram, capacity: number): SeatedProgram {
  if (!Number.isInteger(capacity) || capacity < 0) throw new Error('Capacity must be a non-negative integer');
  return promote({ ...p, capacity });
}

/** 1-based waitlist position, or undefined if not waiting. */
export const waitlistPosition = (p: SeatedProgram, applicantId: string): number | undefined => {
  const i = p.waitlist.indexOf(applicantId);
  return i === -1 ? undefined : i + 1;
};
