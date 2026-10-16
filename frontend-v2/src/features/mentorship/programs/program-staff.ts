/** MENTOR-021: manage program facilitators and reviewers. */
export type StaffRole = 'owner' | 'facilitator' | 'reviewer';

export interface ProgramStaffMember {
  userId: string;
  role: StaffRole;
  addedAt: string;
}

const MAX_STAFF = 50;

export function staffByRole(staff: ProgramStaffMember[], role: StaffRole): ProgramStaffMember[] {
  return staff.filter((s) => s.role === role);
}

export function canManageStaff(staff: ProgramStaffMember[], actorId: string): boolean {
  return staff.some((s) => s.userId === actorId && s.role === 'owner');
}

/** Adds a member (or changes their role). Only owners may do this; a user holds one role. */
export function addOrUpdateStaff(
  staff: ProgramStaffMember[],
  actorId: string,
  userId: string,
  role: StaffRole,
  now: Date = new Date(),
): ProgramStaffMember[] {
  if (!canManageStaff(staff, actorId)) throw new Error('Only program owners can manage staff');
  if (role === 'owner') throw new Error('Ownership must be transferred, not assigned');
  const existing = staff.find((s) => s.userId === userId);
  if (existing?.role === 'owner') throw new Error('Cannot change the owner role');
  if (!existing && staff.length >= MAX_STAFF) throw new Error(`A program can have at most ${MAX_STAFF} staff`);
  const next = { userId, role, addedAt: existing?.addedAt ?? now.toISOString() };
  return existing ? staff.map((s) => (s.userId === userId ? next : s)) : [...staff, next];
}

export function removeStaff(staff: ProgramStaffMember[], actorId: string, userId: string): ProgramStaffMember[] {
  if (!canManageStaff(staff, actorId)) throw new Error('Only program owners can manage staff');
  const target = staff.find((s) => s.userId === userId);
  if (!target) return staff;
  if (target.role === 'owner') throw new Error('Cannot remove the program owner');
  return staff.filter((s) => s.userId !== userId);
}
