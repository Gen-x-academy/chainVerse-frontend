'use client';

import { useMemo, useState } from 'react';
import { ACTIVITY_CATEGORIES, type ActivityCategory, type ActivityItem } from '../types';

export type ActivityInboxProps = {
  items: ActivityItem[];
  unreadCount: number;
  loading?: boolean;
  error?: string | null;
  onMarkRead?: (id: string) => void;
  onMarkAllRead?: () => void;
  onRetry?: () => void;
};

type CategoryFilter = ActivityCategory | 'all';

const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  application: 'Applications',
  proposal: 'Proposals',
  session: 'Sessions',
  task: 'Tasks',
  milestone: 'Milestones',
  review: 'Reviews',
  payment: 'Payments',
};

const styles = {
  panel: {
    border: '1px solid #d0d5dd',
    borderRadius: '8px',
    padding: '16px',
    fontFamily: 'inherit',
  } as const,
  header: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '8px',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    borderRadius: '999px',
    background: '#175cd3',
    color: '#fff',
    fontSize: '12px',
    padding: '2px 10px',
  },
  button: {
    border: '1px solid #d0d5dd',
    borderRadius: '6px',
    background: '#fff',
    padding: '6px 12px',
    cursor: 'pointer',
    font: 'inherit',
  },
  activeButton: {
    border: '1px solid #175cd3',
    borderRadius: '6px',
    background: '#eff4ff',
    color: '#175cd3',
    padding: '6px 12px',
    cursor: 'pointer',
    font: 'inherit',
    fontWeight: 600,
  },
  filters: {
    display: 'flex' as const,
    flexWrap: 'wrap' as const,
    gap: '8px',
    margin: '12px 0',
  },
  item: {
    borderTop: '1px solid #eaecf0',
    padding: '12px 0',
    display: 'flex' as const,
    gap: '8px',
    alignItems: 'flex-start' as const,
    justifyContent: 'space-between' as const,
  },
  unread: {
    background: '#fef0c7',
    color: '#93370d',
    borderRadius: '999px',
    fontSize: '12px',
    padding: '2px 10px',
  },
  muted: { color: '#667085', fontSize: '13px' },
  error: { color: '#b42318', margin: '12px 0' } as const,
  empty: { color: '#667085', margin: '12px 0' } as const,
} as const;

/**
 * Activity inbox with explicit loading / empty / error / success states,
 * category filters, unread badges, and deep links. The list is a `feed`, the
 * counts are announced politely, and every control is a focusable button with
 * an accessible name.
 */
export function ActivityInbox({
  items,
  unreadCount,
  loading = false,
  error = null,
  onMarkRead,
  onMarkAllRead,
  onRetry,
}: ActivityInboxProps) {
  const [category, setCategory] = useState<CategoryFilter>('all');
  const visible = useMemo(
    () => (category === 'all' ? items : items.filter((item) => item.category === category)),
    [items, category],
  );

  return (
    <section style={styles.panel} aria-label="Mentorship activity">
      <div style={styles.header}>
        <h2 style={{ fontSize: '16px', margin: 0 }}>Activity</h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={styles.badge} aria-live="polite" data-testid="unread-count">
            {unreadCount} unread
          </span>
          {onMarkAllRead ? (
            <button
              type="button"
              style={styles.button}
              onClick={onMarkAllRead}
              disabled={loading || unreadCount === 0}
              aria-label={`Mark all ${unreadCount} notifications as read`}
            >
              Mark all read
            </button>
          ) : null}
        </div>
      </div>

      <div style={styles.filters} role="group" aria-label="Filter activity by category">
        <button
          type="button"
          style={category === 'all' ? styles.activeButton : styles.button}
          aria-pressed={category === 'all'}
          onClick={() => setCategory('all')}
        >
          All
        </button>
        {ACTIVITY_CATEGORIES.map((value) => (
          <button
            key={value}
            type="button"
            style={category === value ? styles.activeButton : styles.button}
            aria-pressed={category === value}
            onClick={() => setCategory(value)}
          >
            {CATEGORY_LABELS[value]}
          </button>
        ))}
      </div>

      {loading ? (
        <p role="status" style={styles.empty}>
          Loading activity…
        </p>
      ) : error ? (
        <div role="alert" style={styles.error}>
          <p style={{ margin: '0 0 8px' }}>{error}</p>
          {onRetry ? (
            <button type="button" style={styles.button} onClick={onRetry} aria-label="Retry loading activity">
              Retry
            </button>
          ) : null}
        </div>
      ) : visible.length === 0 ? (
        <p role="status" style={styles.empty}>
          No activity yet.
        </p>
      ) : (
        <div role="feed" aria-label="Activity feed" aria-busy={loading}>
          {visible.map((item) => (
            <article key={item.id} style={styles.item} aria-label={item.title}>
              <div>
                <a
                  href={item.deepLink}
                  style={{ color: '#175cd3', fontWeight: item.readAt ? 400 : 600 }}
                >
                  {item.title}
                </a>
                {item.body ? <p style={{ margin: '4px 0 0' }}>{item.body}</p> : null}
                <time dateTime={item.createdAt} style={styles.muted}>
                  {item.createdAt}
                </time>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {item.readAt ? null : (
                  <span style={styles.unread} aria-label={`Unread: ${item.title}`}>
                    Unread
                  </span>
                )}
                {onMarkRead ? (
                  <button
                    type="button"
                    style={styles.button}
                    onClick={() => onMarkRead(item.id)}
                    disabled={Boolean(item.readAt)}
                    aria-label={`Mark "${item.title}" as read`}
                  >
                    Mark read
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}

      <p aria-live="polite" style={styles.muted} data-testid="activity-summary">
        Showing {visible.length} of {items.length} items, {unreadCount} unread.
      </p>
    </section>
  );
}

export default ActivityInbox;
