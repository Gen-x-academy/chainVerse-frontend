/**
 * Mentorship activity inbox (issue #1352).
 *
 * An in-memory store that survives within the session only — persistence is
 * server-side. Access is deny-by-default: an item is only ever listed for the
 * principal whose tenant *and* user id match the item, cross-tenant reads
 * return nothing, deep links fail safely on a tenant mismatch, and the private
 * `body` text is projected away for anyone without access. Reads are
 * idempotent: replaying `markRead` or `markAllRead` never duplicates an effect.
 */

import type { MentorshipPrincipal } from '../rbac';
import type { ActivityItem, ActivityListParams, ActivityPage } from './types';

/** True when a principal may see an item at all (tenant first, then recipient). */
export function hasActivityAccess(item: ActivityItem, principal: MentorshipPrincipal): boolean {
  return item.tenantId === principal.tenantId && item.recipientId === principal.userId;
}

/**
 * The list projection: the private `body` is included only for the item's own
 * recipient inside the item's tenant, and never otherwise.
 */
export function projectActivityItem(
  item: ActivityItem,
  principal: MentorshipPrincipal,
): ActivityItem {
  if (!hasActivityAccess(item, principal)) {
    const { body: _body, ...publicItem } = item;
    return publicItem;
  }
  return item;
}

/**
 * Deep link resolution fails safely: a tenant mismatch (or a link that is not
 * an in-app path) yields `null` rather than a link the recipient cannot open.
 */
export function resolveDeepLink(item: ActivityItem, allowedTenantId: string): string | null {
  if (item.tenantId !== allowedTenantId) return null;
  if (!item.deepLink.startsWith('/')) return null;
  return item.deepLink;
}

function isExpired(item: ActivityItem, now: Date): boolean {
  if (!item.expiresAt) return false;
  const expiresAt = Date.parse(item.expiresAt);
  if (Number.isNaN(expiresAt)) return false;
  return expiresAt <= now.getTime();
}

export class ActivityStore {
  private readonly items = new Map<string, ActivityItem>();
  private readonly clock: () => Date;

  constructor(clock: () => Date = () => new Date()) {
    this.clock = clock;
  }

  add(item: ActivityItem): void {
    this.items.set(item.id, item);
  }

  /** Everything this principal may see, newest first, expiry respected. */
  private visibleTo(principal: MentorshipPrincipal): ActivityItem[] {
    const now = this.clock();
    return [...this.items.values()]
      .filter((item) => hasActivityAccess(item, principal) && !isExpired(item, now))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  list(principal: MentorshipPrincipal, params: ActivityListParams): ActivityPage {
    const visible = this.visibleTo(principal);
    const categoryFiltered = params.category
      ? visible.filter((item) => item.category === params.category)
      : visible;
    const unreadCount = categoryFiltered.filter((item) => !item.readAt).length;
    const filtered = params.unreadOnly
      ? categoryFiltered.filter((item) => !item.readAt)
      : categoryFiltered;

    const page = Math.max(1, params.page);
    const pageSize = Math.max(1, params.pageSize);
    const start = (page - 1) * pageSize;

    return {
      items: filtered.slice(start, start + pageSize).map((item) => projectActivityItem(item, principal)),
      total: filtered.length,
      page,
      pageSize,
      unreadCount,
    };
  }

  /**
   * Marks one item read. Idempotent: a replay returns the item with the same
   * `readAt`. Returns `null` when the principal has no access or the id is
   * unknown — a denial looks exactly like a miss.
   */
  markRead(id: string, principal: MentorshipPrincipal): ActivityItem | null {
    const item = this.items.get(id);
    if (!item || !hasActivityAccess(item, principal)) return null;
    if (item.readAt) return item;

    const read: ActivityItem = { ...item, readAt: this.clock().toISOString() };
    this.items.set(read.id, read);
    return read;
  }

  /**
   * Marks every unread item for this principal read. Idempotent: it returns
   * how many items changed, so a replay returns `0` and applies no second
   * effect.
   */
  markAllRead(principal: MentorshipPrincipal): number {
    let changed = 0;
    for (const item of this.visibleTo(principal)) {
      if (item.readAt) continue;
      this.items.set(item.id, { ...item, readAt: this.clock().toISOString() });
      changed += 1;
    }
    return changed;
  }

  /** Removes every item a revoked recipient could have seen. Returns the count. */
  revokeAccess(tenantId: string, recipientId: string): number {
    let removed = 0;
    for (const [id, item] of this.items) {
      if (item.tenantId === tenantId && item.recipientId === recipientId) {
        this.items.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  get(id: string): ActivityItem | undefined {
    return this.items.get(id);
  }
}
