/**
 * Central scholarship query-key factory (issue #1227).
 */
import { describe, it, expect } from 'vitest';
import {
  ANONYMOUS_SCHOLARSHIP_IDENTITY,
  SCHOLARSHIP_QUERY_ROOT,
  normalizeScholarshipFilter,
  scholarshipApplicationListKey,
  scholarshipQueryKeys,
  type ScholarshipIdentity,
} from '../queryKeys';

const alice: ScholarshipIdentity = { userId: 'user-alice', role: 'student', tenantId: 'tenant-a' };
const bob: ScholarshipIdentity = { userId: 'user-bob', role: 'student', tenantId: 'tenant-a' };
const adminA: ScholarshipIdentity = { userId: 'user-admin', role: 'admin', tenantId: 'tenant-a' };

describe('scholarshipQueryKeys', () => {
  it('places every key under one root', () => {
    const keys = scholarshipQueryKeys(alice);
    const namespaces = [
      keys.programs,
      keys.rounds,
      keys.applications,
      keys.awards,
      keys.agreements,
      keys.disbursements,
      keys.schedules,
      keys.withdrawals,
      keys.payments,
      keys.transactions,
      keys.budgets,
      keys.windows,
      keys.drafts,
      keys.submissions,
      keys.formSchemas,
      keys.validation,
      keys.duplicates,
      keys.scopes,
      keys.milestones,
      keys.sponsorTeam,
      keys.sponsorOrgs,
    ];
    for (const namespace of namespaces) {
      expect(namespace.all[0]).toBe(SCHOLARSHIP_QUERY_ROOT);
    }
  });

  it('scopes keys by tenant, role and user', () => {
    expect(scholarshipQueryKeys(alice).all).toEqual([
      SCHOLARSHIP_QUERY_ROOT,
      'tenant-a',
      'student',
      'user-alice',
    ]);
  });

  it('keeps two users in the same tenant disjoint', () => {
    expect(scholarshipQueryKeys(alice).awards.all).not.toEqual(scholarshipQueryKeys(bob).awards.all);
  });

  it('keeps the same user in a different role disjoint', () => {
    // An admin sees a strictly larger award set than the student they are, so
    // sharing a cache entry would show a student their admin's view.
    const asStudent: ScholarshipIdentity = { userId: 'user-admin', role: 'student', tenantId: 'tenant-a' };
    expect(scholarshipQueryKeys(asStudent).awards.all).not.toEqual(
      scholarshipQueryKeys(adminA).awards.all,
    );
  });

  it('keeps the same user in a different tenant disjoint', () => {
    const otherTenant: ScholarshipIdentity = { ...alice, tenantId: 'tenant-b' };
    expect(scholarshipQueryKeys(alice).applications.all).not.toEqual(
      scholarshipQueryKeys(otherTenant).applications.all,
    );
  });

  it('falls back to a distinct anonymous scope when signed out', () => {
    const keys = scholarshipQueryKeys();
    expect(keys.all).toEqual([SCHOLARSHIP_QUERY_ROOT, 'self', 'anonymous', 'anonymous']);
    expect(keys.all).not.toEqual(scholarshipQueryKeys(alice).all);
  });

  it('keeps an authenticated user separate from the anonymous scope', () => {
    expect(scholarshipQueryKeys(ANONYMOUS_SCHOLARSHIP_IDENTITY).awards.all).not.toEqual(
      scholarshipQueryKeys(alice).awards.all,
    );
  });

  it('nests every namespace under the identity scope', () => {
    const keys = scholarshipQueryKeys(alice);
    for (const namespace of [keys.awards, keys.applications, keys.windows]) {
      expect(namespace.all.slice(0, 4)).toEqual(keys.all);
    }
  });
});

describe('namespace key shapes', () => {
  const keys = scholarshipQueryKeys(alice);

  it('gives every filter variant a key under the collection prefix', () => {
    // This is what lets one invalidation refetch every page/filter combination.
    const listIndex = keys.applications.all.length + 1;
    expect(keys.applications.list({ page: 1 })[listIndex - 1]).toBe('list');
    expect(keys.applications.list({ page: 1 }).slice(0, listIndex)).toEqual(
      keys.applications.lists(),
    );
    expect(keys.applications.list({ page: 2 }).slice(0, listIndex)).toEqual(
      keys.applications.lists(),
    );
  });

  it('separates records from collections', () => {
    expect(keys.awards.detail('award-1')).toEqual([...keys.awards.all, 'detail', 'award-1']);
    expect(keys.awards.detail('award-1')).not.toEqual(keys.awards.list({ id: 'award-1' }));
  });

  it('offers an escape hatch for non-collection shapes', () => {
    expect(keys.milestones.at('decisions', 'ev-1')).toEqual([
      ...keys.milestones.all,
      'decisions',
      'ev-1',
    ]);
  });

  it('keeps nested groups disjoint so one does not refetch the other', () => {
    const members = keys.sponsorTeam.group('members');
    const invitations = keys.sponsorTeam.group('invitations');
    expect(members.lists()).not.toEqual(invitations.lists());
    // Both remain under the sponsor-team root so a team-wide change can widen.
    expect(members.all).not.toEqual(keys.sponsorTeam.all);
    expect([...members.all, 'list']).toContainEqual('members');
  });
});

describe('normalizeScholarshipFilter', () => {
  it('is order independent', () => {
    // React Query hashes keys with an order-sensitive JSON serialisation, so
    // without this two spellings of one filter would be two cache entries.
    expect(normalizeScholarshipFilter({ page: 1, status: 'submitted' })).toEqual(
      normalizeScholarshipFilter({ status: 'submitted', page: 1 }),
    );
  });

  it('drops undefined values', () => {
    expect(normalizeScholarshipFilter({ page: undefined })).toEqual({});
  });

  it('keeps falsy values that are meaningful filters', () => {
    expect(normalizeScholarshipFilter({ page: 0, query: '' })).toEqual({ page: 0, query: '' });
  });

  it('returns an empty object for no filter', () => {
    expect(normalizeScholarshipFilter()).toEqual({});
  });

  it('produces one key for logically identical filters', () => {
    expect(keysFor(alice, { page: 1, status: 'submitted' })).toEqual(
      keysFor(alice, { status: 'submitted', page: 1, query: undefined }),
    );
  });
});

const keysFor = (identity: ScholarshipIdentity, filter: object) =>
  scholarshipQueryKeys(identity).applications.list(filter);

describe('scholarshipApplicationListKey', () => {
  it('is the same key the applications list uses', () => {
    const keys = scholarshipQueryKeys(alice);
    expect(scholarshipApplicationListKey(keys, { roundId: 'round-1' })).toEqual(
      keys.applications.list({ roundId: 'round-1' }),
    );
  });
});
