import type { ActivityLog } from '@/components/elibrary/ItemConditionReport';

export type LostItemStatus = 'found' | 'paid' | 'replaced' | 'waived' | 'disputed';

/**
 * Minimal lost-item summary returned by the reports API.
 * The full resolution UI (LostItemResolution component) extends this with
 * patron-consequence configuration supplied by the page.
 */
export interface LostItemSummary {
  itemId: string;
  itemTitle: string;
  replacementCost: number;
  status: LostItemStatus;
  patronId?: string;
  patronName?: string;
  activityHistory: ActivityLog[];
}
