/**
 * Mentorship activity inbox types (issue #1352).
 *
 * An activity item is a tenant-scoped, recipient-scoped notification row with
 * a deep link into the app. The private `body` text is only projected to
 * recipients with access; anything else never reaches the list.
 */

export type ActivityCategory =
  | 'application'
  | 'proposal'
  | 'session'
  | 'task'
  | 'milestone'
  | 'review'
  | 'payment';

export const ACTIVITY_CATEGORIES: readonly ActivityCategory[] = [
  'application',
  'proposal',
  'session',
  'task',
  'milestone',
  'review',
  'payment',
];

export type ActivityItem = {
  id: string;
  category: ActivityCategory;
  title: string;
  /** Private detail text; only projected for recipients with access. */
  body?: string;
  tenantId: string;
  actorId?: string;
  /** The single user this item is addressed to. */
  recipientId: string;
  /** In-app path for this item, e.g. `/mentorship/sessions/session-1`. */
  deepLink: string;
  createdAt: string;
  /** Optional expiry; expired items are hidden from the list. */
  expiresAt?: string;
  readAt?: string;
};

export type ActivityListParams = {
  category?: ActivityCategory;
  unreadOnly?: boolean;
  /** 1-based page number. */
  page: number;
  pageSize: number;
};

export type ActivityPage = {
  items: ActivityItem[];
  total: number;
  page: number;
  pageSize: number;
  unreadCount: number;
};
