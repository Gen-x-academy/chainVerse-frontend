import { describe, expect, it } from 'vitest';
import {
  WorkspaceError,
  applyWorkspaceCommand,
  redactWorkspaceForLog,
  toWorkspaceError,
  viewWorkspace,
  visibleResources,
  workspacePermissions,
  workspaceRole,
  workspaceSections,
  type SessionWorkspaceData,
  type WorkspaceCommand,
} from '../workspace';
import {
  FIXTURE_MENTEE,
  FIXTURE_MENTOR,
  FIXTURE_OUTSIDER,
  FIXTURE_STAFF,
  FIXTURE_WORKSPACE as W,
  NOW,
} from '../workspace.fixtures';

const mentor = { userId: FIXTURE_MENTOR };
const staff = { userId: FIXTURE_STAFF };
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as WorkspaceError).code;
  }
  return null;
};
const apply = (ws: SessionWorkspaceData, id: string, command: WorkspaceCommand, viewer = mentor, now = NOW) =>
  applyWorkspaceCommand(ws, viewer, { commandId: id, baseVersion: ws.version, command }, now);

describe('access is deny-by-default', () => {
  it.each([
    ['outsider', { userId: FIXTURE_OUTSIDER }],
    ['anonymous', { userId: null }],
    ['empty id', { userId: '' }],
  ])('%s cannot enter', (_l, viewer) => {
    expect(workspaceRole(viewer, W)).toBe('none');
    expect(workspacePermissions(viewer, W, NOW).canEnter).toBe(false);
    expect(viewWorkspace(viewer, W, NOW)).toBeNull();
    expect(workspaceSections(viewer, W, NOW)).toEqual([]);
    expect(visibleResources(viewer, W)).toEqual([]);
    expect(code(() => apply(W, 'x', { type: 'add-follow-up', title: 't', ownerId: FIXTURE_MENTOR }, viewer))).toBe('NOT_AUTHORIZED');
  });

  it('lets participants and scoped staff in', () => {
    expect(workspaceRole(mentor, W)).toBe('participant');
    expect(workspaceRole(staff, W)).toBe('staff');
    expect(workspaceRole({ userId: 'other_staff' }, W)).toBe('none');
  });
});

describe('sections and privacy separation', () => {
  it('offers private notes to participants only, as a separate section', () => {
    expect(workspaceSections(mentor, W, NOW)).toEqual(['overview', 'agenda', 'goals', 'resources', 'attendance', 'follow-ups', 'private-notes']);
    expect(workspaceSections(staff, W, NOW)).not.toContain('private-notes');
  });

  it('never carries note content in the workspace model', () => {
    const view = viewWorkspace(mentor, W, NOW)!;
    expect(Object.keys(view)).not.toContain('notes');
    expect(Object.keys(view)).not.toContain('privateNotes');
  });
});

describe('resources', () => {
  it('filters by audience and drops non-https urls', () => {
    const forMentor = visibleResources(mentor, W);
    expect(forMentor.map((r) => r.id)).toEqual(['r1', 'r2', 'r3']);
    expect(forMentor.find((r) => r.id === 'r3')!.url).toBeUndefined();
    expect(forMentor.find((r) => r.id === 'r1')!.url).toBe('https://developers.stellar.org');
    expect(visibleResources(staff, W).map((r) => r.id)).toEqual(['r1']);
  });
});

describe('cancelled, staff and expired workspaces are read-only', () => {
  const cancelled = { ...W, status: 'cancelled' as const };
  it('blocks changes for cancelled sessions but keeps content visible', () => {
    const perms = workspacePermissions(mentor, cancelled, NOW);
    expect(perms).toMatchObject({ readOnly: true, readOnlyReason: 'cancelled', canEditFollowUps: false });
    expect(viewWorkspace(mentor, cancelled, NOW)!.goals).toHaveLength(2);
    expect(code(() => apply(cancelled, 'c', { type: 'set-follow-up-done', followUpId: 'fu_1', done: true }))).toBe('READ_ONLY');
  });

  it('keeps staff read-only', () => {
    expect(workspacePermissions(staff, W, NOW).readOnlyReason).toBe('staff');
    expect(code(() => apply(W, 'c', { type: 'add-follow-up', title: 't', ownerId: FIXTURE_MENTOR }, staff))).toBe('READ_ONLY');
  });

  it('withholds content after the agreement retention date', () => {
    const later = new Date('2027-03-03T00:00:00.000Z');
    expect(workspacePermissions(mentor, W, later)).toMatchObject({ expired: true, readOnlyReason: 'expired' });
    const view = viewWorkspace(mentor, W, later)!;
    expect([view.agenda, view.goals, view.resources, view.attendance, view.followUps].every((a) => a.length === 0)).toBe(true);
    expect(workspaceSections(mentor, W, later)).toEqual(['overview']);
    expect(code(() => apply(W, 'e', { type: 'add-follow-up', title: 't', ownerId: FIXTURE_MENTOR }, mentor, later))).toBe('EXPIRED');
  });

  it('keeps content when no retention date is set', () => {
    const open = { ...W, retainUntil: undefined };
    expect(workspacePermissions(mentor, open, new Date('2100-01-01')).expired).toBe(false);
  });
});

describe('follow-up commands', () => {
  it('adds a follow-up with creator and bumps the version', () => {
    const next = apply(W, 'new1', { type: 'add-follow-up', title: ' Book next session ', ownerId: FIXTURE_MENTEE, dueDate: '2026-03-10' });
    expect(next.version).toBe(W.version + 1);
    expect(next.followUps.at(-1)).toMatchObject({ id: 'fu_new1', title: 'Book next session', ownerId: FIXTURE_MENTEE, createdBy: FIXTURE_MENTOR, done: false });
    expect(W.followUps).toHaveLength(1);
  });

  it('toggles done', () => {
    expect(apply(W, 'd', { type: 'set-follow-up-done', followUpId: 'fu_1', done: true }).followUps[0].done).toBe(true);
    expect(code(() => apply(W, 'd2', { type: 'set-follow-up-done', followUpId: 'nope', done: true }))).toBe('NOT_FOUND');
  });

  it('applies a retried command once', () => {
    const env = { commandId: 'once', baseVersion: W.version, command: { type: 'add-follow-up', title: 'x', ownerId: FIXTURE_MENTOR } } as const;
    const first = applyWorkspaceCommand(W, mentor, env, NOW);
    expect(applyWorkspaceCommand(first, mentor, env, NOW)).toBe(first);
  });

  it('detects stale versions', () => {
    const env = { commandId: 'stale', baseVersion: W.version - 1, command: { type: 'add-follow-up', title: 'x', ownerId: FIXTURE_MENTOR } } as const;
    expect(code(() => applyWorkspaceCommand(W, mentor, env, NOW))).toBe('VERSION_CONFLICT');
  });

  it('validates and rejects unsafe text', () => {
    const add = (title: string, over: object = {}) => () => apply(W, 'v', { type: 'add-follow-up', title, ownerId: FIXTURE_MENTOR, ...over });
    expect(code(add('<img src=x>'))).toBe('UNSAFE_CONTENT');
    expect(code(add('javascript:alert(1)'))).toBe('UNSAFE_CONTENT');
    expect(code(add('  '))).toBe('INVALID_ITEM');
    expect(code(add('x'.repeat(201)))).toBe('INVALID_ITEM');
    expect(code(add('ok', { ownerId: FIXTURE_OUTSIDER }))).toBe('INVALID_ITEM');
    expect(code(add('ok', { dueDate: 'soon' }))).toBe('INVALID_ITEM');
  });
});

describe('logging and errors', () => {
  it('redacts content from logs', () => {
    expect(redactWorkspaceForLog(W)).toEqual({ sessionId: 'ses_fixture_1', status: 'scheduled', version: 3, followUpCount: 1 });
  });
  it('maps statuses to stable codes', () => {
    expect(toWorkspaceError({ status: 409 }).code).toBe('VERSION_CONFLICT');
    expect(toWorkspaceError({ status: 410 }).code).toBe('EXPIRED');
    expect(toWorkspaceError({ status: 423 }).code).toBe('READ_ONLY');
    expect(toWorkspaceError({ status: 404 }).code).toBe('NOT_FOUND');
    expect(toWorkspaceError(new Error('secret')).message).not.toContain('secret');
  });
});
