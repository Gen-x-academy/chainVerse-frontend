import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { MentorshipPrincipal } from '../../rbac';
import { ActivityStore, resolveDeepLink } from '../service';
import { ActivityInbox } from '../components/ActivityInbox';
import type { ActivityItem } from '../types';

const NOW = new Date('2026-05-01T12:00:00.000Z');

const RECIPIENT: MentorshipPrincipal = {
  userId: 'student-1',
  role: 'student',
  tenantId: 'tenant-a',
};
const SAME_TENANT_OTHER: MentorshipPrincipal = {
  userId: 'mentor-1',
  role: 'mentor',
  tenantId: 'tenant-a',
};
const FOREIGN: MentorshipPrincipal = {
  userId: 'student-1',
  role: 'student',
  tenantId: 'tenant-b',
};

function item(overrides: Partial<ActivityItem> = {}): ActivityItem {
  return {
    id: 'act-1',
    category: 'session',
    title: 'Session starts soon',
    body: 'Private detail for the recipient only.',
    tenantId: 'tenant-a',
    actorId: 'mentor-1',
    recipientId: 'student-1',
    deepLink: '/mentorship/sessions/session-1',
    createdAt: '2026-05-01T10:00:00.000Z',
    ...overrides,
  };
}

function seededStore(): ActivityStore {
  const store = new ActivityStore(() => NOW);
  store.add(item());
  store.add(
    item({
      id: 'act-2',
      category: 'task',
      title: 'Task due',
      body: 'Task body.',
      deepLink: '/mentorship/tasks/task-1',
      createdAt: '2026-05-01T11:00:00.000Z',
    }),
  );
  store.add(
    item({
      id: 'act-foreign',
      tenantId: 'tenant-b',
      recipientId: 'someone-else',
      title: 'Foreign item',
    }),
  );
  return store;
}

describe('ActivityStore.list', () => {
  it('is deny-by-default: cross-tenant and non-recipient reads return nothing', () => {
    const store = seededStore();
    expect(store.list(FOREIGN, { page: 1, pageSize: 10 }).items).toHaveLength(0);
    expect(store.list(SAME_TENANT_OTHER, { page: 1, pageSize: 10 }).items).toHaveLength(0);
    // The recipient sees their own items and never the foreign tenant's row.
    const page = store.list(RECIPIENT, { page: 1, pageSize: 10 });
    expect(page.items.map((entry) => entry.id)).toEqual(['act-2', 'act-1']);
    expect(page.total).toBe(2);
    expect(page.unreadCount).toBe(2);
  });

  it('filters by category and unread only, and paginates', () => {
    const store = seededStore();
    const tasks = store.list(RECIPIENT, { category: 'task', page: 1, pageSize: 10 });
    expect(tasks.items.map((entry) => entry.id)).toEqual(['act-2']);
    expect(tasks.unreadCount).toBe(1);

    const firstPage = store.list(RECIPIENT, { page: 1, pageSize: 1 });
    expect(firstPage.items.map((entry) => entry.id)).toEqual(['act-2']);
    expect(firstPage.total).toBe(2);

    store.markRead('act-2', RECIPIENT);
    const unread = store.list(RECIPIENT, { unreadOnly: true, page: 1, pageSize: 10 });
    expect(unread.items.map((entry) => entry.id)).toEqual(['act-1']);
  });

  it('drops expired items', () => {
    const store = new ActivityStore(() => NOW);
    store.add(item({ id: 'act-expired', expiresAt: '2026-05-01T11:00:00.000Z' }));
    expect(store.list(RECIPIENT, { page: 1, pageSize: 10 }).items).toHaveLength(0);
  });
});

describe('read idempotency', () => {
  it('markRead applies once and denies without access', () => {
    const store = seededStore();
    const first = store.markRead('act-1', RECIPIENT);
    expect(first?.readAt).toBe('2026-05-01T12:00:00.000Z');

    const second = store.markRead('act-1', RECIPIENT);
    expect(second?.readAt).toBe(first?.readAt);

    expect(store.markRead('act-1', FOREIGN)).toBeNull();
    expect(store.markRead('act-1', SAME_TENANT_OTHER)).toBeNull();
    expect(store.markRead('missing', RECIPIENT)).toBeNull();
  });

  it('markAllRead does not duplicate effects', () => {
    const store = seededStore();
    expect(store.markAllRead(RECIPIENT)).toBe(2);
    expect(store.markAllRead(RECIPIENT)).toBe(0);
    expect(store.list(RECIPIENT, { page: 1, pageSize: 10 }).unreadCount).toBe(0);
    expect(store.markAllRead(FOREIGN)).toBe(0);
  });
});

describe('revokeAccess', () => {
  it('removes every item for the tenant + recipient pair only', () => {
    const store = seededStore();
    expect(store.revokeAccess('tenant-a', 'student-1')).toBe(2);
    expect(store.list(RECIPIENT, { page: 1, pageSize: 10 }).items).toHaveLength(0);
    // The foreign item is untouched.
    expect(store.get('act-foreign')).toBeDefined();
    expect(store.revokeAccess('tenant-a', 'student-1')).toBe(0);
  });
});

describe('resolveDeepLink', () => {
  it('returns the link for a tenant match and null on mismatch', () => {
    expect(resolveDeepLink(item(), 'tenant-a')).toBe('/mentorship/sessions/session-1');
    expect(resolveDeepLink(item(), 'tenant-b')).toBeNull();
    expect(resolveDeepLink(item({ deepLink: 'javascript:alert(1)' }), 'tenant-a')).toBeNull();
  });
});

describe('ActivityInbox', () => {
  const items = [
    item({ id: 'act-1', title: 'Session starts soon' }),
    item({
      id: 'act-2',
      category: 'task' as const,
      title: 'Task due',
      deepLink: '/mentorship/tasks/task-1',
      readAt: '2026-05-01T11:30:00.000Z',
    }),
  ];

  it('renders the empty state', () => {
    render(<ActivityInbox items={[]} unreadCount={0} />);
    expect(screen.getByText('No activity yet.')).toBeInTheDocument();
    expect(screen.queryByRole('feed')).toBeNull();
  });

  it('renders items with deep links, bodies, and unread markers', () => {
    render(<ActivityInbox items={items} unreadCount={1} onMarkRead={() => undefined} />);
    expect(screen.getByRole('feed')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Session starts soon' })).toHaveAttribute(
      'href',
      '/mentorship/sessions/session-1',
    );
    expect(screen.getByText('Task due')).toBeInTheDocument();
    expect(screen.getByLabelText('Unread: Session starts soon')).toBeInTheDocument();
    expect(screen.queryByLabelText('Unread: Task due')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Mark "Session starts soon" as read' }),
    ).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Mark "Task due" as read' })).toBeDisabled();
  });

  it('shows the loading state instead of the feed', () => {
    render(<ActivityInbox items={items} unreadCount={1} loading />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading activity…');
    expect(screen.queryByRole('feed')).toBeNull();
  });

  it('shows the error state with a retry affordance', () => {
    const onRetry = vi.fn();
    render(<ActivityInbox items={[]} unreadCount={0} error="Service unavailable" onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Service unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading activity' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('feed')).toBeNull();
  });

  it('exposes accessible names, feed semantics, and live counts', () => {
    const onMarkAllRead = vi.fn();
    const onMarkRead = vi.fn();
    render(
      <ActivityInbox
        items={items}
        unreadCount={1}
        onMarkRead={onMarkRead}
        onMarkAllRead={onMarkAllRead}
      />,
    );

    expect(screen.getByRole('feed')).toHaveAttribute('aria-label', 'Activity feed');
    expect(screen.getByTestId('unread-count')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByTestId('unread-count')).toHaveTextContent('1 unread');
    expect(screen.getByTestId('activity-summary')).toHaveAttribute('aria-live', 'polite');

    const sessionFilter = screen.getByRole('button', { name: 'Sessions' });
    expect(sessionFilter).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(sessionFilter);
    expect(screen.getByRole('button', { name: 'Sessions' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('link', { name: 'Session starts soon' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Task due' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Mark all 1 notifications as read' }));
    expect(onMarkAllRead).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole('button', { name: 'Mark "Session starts soon" as read' }),
    );
    expect(onMarkRead).toHaveBeenCalledWith('act-1');
  });

  it('hides mark-all when there is nothing to mark', () => {
    render(<ActivityInbox items={items} unreadCount={0} onMarkAllRead={() => undefined} />);
    expect(
      screen.getByRole('button', { name: 'Mark all 0 notifications as read' }),
    ).toBeDisabled();
  });
});
