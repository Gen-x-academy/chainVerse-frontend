/**
 * Shared types for the library reports feature:
 * item condition reports, repair tickets, and lost-item cases.
 */

// ─── Condition Reports ────────────────────────────────────────────────────────

export type ItemCondition = 'good' | 'worn' | 'damaged' | 'lost' | 'in-repair';
export type RepairStatusValue =
  | 'not-needed'
  | 'scheduled'
  | 'in-progress'
  | 'completed'
  | 'unrepairable';

export interface EvidenceAttachment {
  id: string;
  name: string;
  /** MIME type, e.g. "image/jpeg" */
  type: string;
  /** Presigned URL returned by the server. Never a local blob URL in production. */
  url: string;
  uploadedAt: string;
}

export interface ActivityLog {
  id: string;
  action: string;
  /** Display name of the staff member who performed the action. */
  user: string;
  timestamp: string;
  notes?: string;
}

export interface ConditionReport {
  itemId: string;
  title: string;
  currentCondition: ItemCondition;
  repairStatus: RepairStatusValue;
  notes: string;
  evidence: EvidenceAttachment[];
  activityHistory: ActivityLog[];
  /** Patron ID — visible to staff with `patrons` permission only. */
  patronId?: string;
  /** Display name — visible to staff with `patrons` permission only. */
  patronName?: string;
}

export interface UpdateConditionPayload {
  currentCondition: ItemCondition;
  repairStatus: RepairStatusValue;
  notes: string;
}

// ─── Repair Tickets ───────────────────────────────────────────────────────────

export type RepairPriority = 'low' | 'medium' | 'high' | 'critical';
export type RepairStatus =
  | 'scheduled'
  | 'in-progress'
  | 'waiting-for-parts'
  | 'completed'
  | 'cancelled';

export interface RepairLog {
  id: string;
  date: string;
  technician: string;
  notes: string;
  /** Restricted to roles with cost-data permission. */
  cost?: number;
}

export interface RepairTicket {
  id: string;
  itemId: string;
  itemTitle: string;
  issueDescription: string;
  priority: RepairPriority;
  status: RepairStatus;
  createdAt: string;
  scheduledDate?: string;
  completedDate?: string;
  /** Restricted to roles with cost-data permission. */
  estimatedCost?: number;
  /** Restricted to roles with cost-data permission. */
  actualCost?: number;
  repairLogs: RepairLog[];
  /** Evidence file URLs — presigned; never local blob URLs in production. */
  evidence: string[];
}

export type CreateRepairTicketPayload = Omit<RepairTicket, 'id' | 'createdAt' | 'repairLogs'>;
export type UpdateRepairTicketPayload = Partial<RepairTicket>;

// ─── Lost-Item Cases ──────────────────────────────────────────────────────────

export type LostItemStatus = 'found' | 'paid' | 'replaced' | 'waived' | 'disputed';

export interface LostItemCase {
  id: string;
  itemId: string;
  itemTitle: string;
  replacementCost: number;
  status: LostItemStatus;
  /** Patron display name — role-restricted. */
  patronName?: string;
  /** Patron ID — role-restricted. */
  patronId?: string;
  activityHistory: ActivityLog[];
  createdAt: string;
  updatedAt: string;
}

export interface ResolveLostItemPayload {
  status: LostItemStatus;
  notes: string;
}

// ─── Paginated response wrapper ───────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  nextCursor: string | null;
  prevCursor: string | null;
}
