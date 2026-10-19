import { describe, expect, it } from 'vitest';
import {
  AgendaError,
  agendaExportToText,
  applyAgendaCommand,
  canViewAgenda,
  exportAgenda,
  isAgendaLocked,
  redactAgendaForLog,
  toAgendaError,
  type Agenda,
  type AgendaCommand,
} from '../agenda';
import {
  AFTER_CUTOFF,
  BEFORE_CUTOFF,
  FIXTURE_AGENDA,
  FIXTURE_COORDINATOR,
  FIXTURE_MENTEE,
  FIXTURE_MENTOR,
  FIXTURE_OUTSIDER,
  envelope,
} from '../agenda.fixtures';

const mentor = { userId: FIXTURE_MENTOR };
const mentee = { userId: FIXTURE_MENTEE };
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as AgendaError).code;
  }
  return null;
};

function run(
  agenda: Agenda,
  viewer: { userId: string },
  commandId: string,
  command: AgendaCommand,
  now = BEFORE_CUTOFF,
) {
  return applyAgendaCommand(agenda, viewer, envelope(commandId, agenda.version, command), now);
}

function seeded(): Agenda {
  let a = run(FIXTURE_AGENDA, mentor, 'a', { type: 'propose', title: 'Escrow basics' });
  a = run(a, mentee, 'b', { type: 'propose', title: 'Portfolio review', notes: 'Bring links' });
  a = run(a, mentor, 'c', { type: 'propose', title: 'Next steps' });
  return a;
}

describe('authorization (deny-by-default)', () => {
  it('rejects outsiders, anonymous users and coordinators for changes', () => {
    const cmd = { type: 'propose', title: 'x' } as const;
    for (const viewer of [{ userId: FIXTURE_OUTSIDER }, { userId: '' }, { userId: FIXTURE_COORDINATOR, isCoordinator: true }]) {
      expect(code(() => applyAgendaCommand(FIXTURE_AGENDA, viewer, envelope('x', 0, cmd), BEFORE_CUTOFF))).toBe('NOT_AUTHORIZED');
    }
  });

  it('lets coordinators view but not outsiders', () => {
    expect(canViewAgenda({ userId: FIXTURE_COORDINATOR, isCoordinator: true }, FIXTURE_AGENDA)).toBe(true);
    expect(canViewAgenda({ userId: FIXTURE_OUTSIDER }, FIXTURE_AGENDA)).toBe(false);
    expect(canViewAgenda({ userId: null }, FIXTURE_AGENDA)).toBe(false);
  });
});

describe('propose, edit, withdraw with visible authorship', () => {
  it('records the author and a revision per command', () => {
    const a = seeded();
    expect(a.items.map((i) => [i.title, i.authorId])).toEqual([
      ['Escrow basics', FIXTURE_MENTOR],
      ['Portfolio review', FIXTURE_MENTEE],
      ['Next steps', FIXTURE_MENTOR],
    ]);
    expect(a.version).toBe(3);
    expect(a.history.map((h) => [h.version, h.action, h.actorId])).toEqual([
      [1, 'proposed', FIXTURE_MENTOR],
      [2, 'proposed', FIXTURE_MENTEE],
      [3, 'proposed', FIXTURE_MENTOR],
    ]);
  });

  it('does not mutate the input agenda', () => {
    const before = JSON.stringify(FIXTURE_AGENDA);
    run(FIXTURE_AGENDA, mentor, 'a', { type: 'propose', title: 'x' });
    expect(JSON.stringify(FIXTURE_AGENDA)).toBe(before);
  });

  it('only the author can edit or withdraw', () => {
    const a = seeded();
    const id = a.items[0].id;
    expect(code(() => run(a, mentee, 'e', { type: 'edit', itemId: id, title: 'Hijack' }))).toBe('NOT_AUTHORIZED');
    expect(code(() => run(a, mentee, 'w', { type: 'withdraw', itemId: id }))).toBe('NOT_AUTHORIZED');
    const edited = run(a, mentor, 'e', { type: 'edit', itemId: id, title: 'Escrow deep dive' });
    expect(edited.items[0].title).toBe('Escrow deep dive');
    const withdrawn = run(edited, mentor, 'w', { type: 'withdraw', itemId: id });
    expect(withdrawn.items[0].state).toBe('withdrawn');
    expect(code(() => run(withdrawn, mentor, 'e2', { type: 'edit', itemId: id, title: 'again' }))).toBe('ITEM_LOCKED');
  });

  it('enforces the item limit and unknown items', () => {
    expect(code(() => applyAgendaCommand(seeded(), mentor, envelope('z', 3, { type: 'propose', title: 'x' }), BEFORE_CUTOFF, { cutoffMinutesBeforeStart: 60, maxItems: 3 }))).toBe('LIMIT_REACHED');
    expect(code(() => run(seeded(), mentor, 'z', { type: 'edit', itemId: 'nope', title: 'x' }))).toBe('NOT_FOUND');
  });
});

describe('unsafe content is rejected', () => {
  it.each([
    '<script>alert(1)</script>',
    'click <b>here</b>',
    'javascript:alert(1)',
    ' DATA : text/html',
    'bad\u0000char',
    'rtl‮override',
  ])('rejects %j', (title) => {
    expect(code(() => run(FIXTURE_AGENDA, mentor, 'a', { type: 'propose', title }))).toBe('UNSAFE_CONTENT');
  });

  it('validates length and emptiness', () => {
    expect(code(() => run(FIXTURE_AGENDA, mentor, 'a', { type: 'propose', title: '   ' }))).toBe('INVALID_ITEM');
    expect(code(() => run(FIXTURE_AGENDA, mentor, 'a', { type: 'propose', title: 'x'.repeat(121) }))).toBe('INVALID_ITEM');
    expect(code(() => run(FIXTURE_AGENDA, mentor, 'a', { type: 'propose', title: 'ok', notes: 'n'.repeat(1001) }))).toBe('INVALID_ITEM');
  });

  it('allows ordinary punctuation', () => {
    const a = run(FIXTURE_AGENDA, mentor, 'a', { type: 'propose', title: "Q&A: what's next? (50% done)" });
    expect(a.items[0].title).toBe("Q&A: what's next? (50% done)");
  });
});

describe('reorder and assign', () => {
  it('moves items and keeps the order stable', () => {
    const a = seeded();
    const moved = run(a, mentee, 'm', { type: 'reorder', itemId: a.items[2].id, toIndex: 0 });
    expect(moved.items.map((i) => i.title)).toEqual(['Next steps', 'Escrow basics', 'Portfolio review']);
    expect(code(() => run(a, mentee, 'm', { type: 'reorder', itemId: a.items[0].id, toIndex: 9 }))).toBe('INVALID_ITEM');
  });

  it('assigns only to participants', () => {
    const a = seeded();
    const assigned = run(a, mentor, 'as', { type: 'assign', itemId: a.items[0].id, assigneeId: FIXTURE_MENTEE });
    expect(assigned.items[0].assigneeId).toBe(FIXTURE_MENTEE);
    expect(run(assigned, mentor, 'un', { type: 'assign', itemId: a.items[0].id, assigneeId: null }).items[0].assigneeId).toBeUndefined();
    expect(code(() => run(a, mentor, 'bad', { type: 'assign', itemId: a.items[0].id, assigneeId: FIXTURE_OUTSIDER }))).toBe('INVALID_ITEM');
  });
});

describe('concurrent edits and retries', () => {
  it('detects a stale base version', () => {
    const a = seeded();
    const stale = envelope('late', 2, { type: 'propose', title: 'Late' });
    expect(code(() => applyAgendaCommand(a, mentee, stale, BEFORE_CUTOFF))).toBe('VERSION_CONFLICT');
  });

  it('applies a retried command exactly once', () => {
    const a = seeded();
    const env = envelope('retry', a.version, { type: 'propose', title: 'Once' });
    const first = applyAgendaCommand(a, mentor, env, BEFORE_CUTOFF);
    const again = applyAgendaCommand(first, mentor, env, BEFORE_CUTOFF);
    expect(again).toBe(first);
    expect(again.items.filter((i) => i.title === 'Once')).toHaveLength(1);
  });

  it('two users editing from the same version: the second conflicts', () => {
    const a = seeded();
    const byMentor = applyAgendaCommand(a, mentor, envelope('m1', a.version, { type: 'propose', title: 'M' }), BEFORE_CUTOFF);
    expect(code(() => applyAgendaCommand(byMentor, mentee, envelope('e1', a.version, { type: 'propose', title: 'E' }), BEFORE_CUTOFF))).toBe('VERSION_CONFLICT');
  });
});

describe('pre-session cutoff', () => {
  it('locks structural edits but still allows resolve/reopen', () => {
    const a = seeded();
    expect(isAgendaLocked(a, BEFORE_CUTOFF)).toBe(false);
    expect(isAgendaLocked(a, AFTER_CUTOFF)).toBe(true);
    for (const command of [
      { type: 'propose', title: 'x' },
      { type: 'edit', itemId: a.items[0].id, title: 'x' },
      { type: 'reorder', itemId: a.items[0].id, toIndex: 1 },
      { type: 'assign', itemId: a.items[0].id, assigneeId: null },
      { type: 'withdraw', itemId: a.items[0].id },
    ] as AgendaCommand[]) {
      expect(code(() => run(a, mentor, `cut-${command.type}`, command, AFTER_CUTOFF))).toBe('CUTOFF_PASSED');
    }
    const resolved = run(a, mentee, 'r', { type: 'resolve', itemId: a.items[0].id, outcome: 'covered' }, AFTER_CUTOFF);
    expect(resolved.items[0].state).toBe('resolved');
    expect(run(resolved, mentor, 'o', { type: 'reopen', itemId: a.items[0].id }, AFTER_CUTOFF).items[0].state).toBe('open');
  });
});

describe('resolved items stay traceable', () => {
  it('keeps the item, resolution and history', () => {
    const a = seeded();
    const id = a.items[1].id;
    const resolved = run(a, mentor, 'r', { type: 'resolve', itemId: id, outcome: 'deferred', note: 'Next week' });
    expect(resolved.items[1]).toMatchObject({
      state: 'resolved',
      resolution: { outcome: 'deferred', resolvedBy: FIXTURE_MENTOR, note: 'Next week' },
    });
    expect(resolved.items).toHaveLength(3);
    expect(code(() => run(resolved, mentor, 'r2', { type: 'resolve', itemId: id, outcome: 'covered' }))).toBe('ITEM_LOCKED');
    const reopened = run(resolved, mentee, 'o', { type: 'reopen', itemId: id });
    expect(reopened.items[1].resolution).toBeUndefined();
    expect(reopened.history.map((h) => h.action).slice(-2)).toEqual(['resolved', 'reopened']);
    expect(code(() => run(a, mentor, 'o', { type: 'reopen', itemId: id }))).toBe('ITEM_LOCKED');
  });
});

describe('export', () => {
  it('preserves order, resolved items and numbering', () => {
    let a = seeded();
    a = run(a, mentee, 'mv', { type: 'reorder', itemId: a.items[2].id, toIndex: 0 });
    a = run(a, mentor, 'rs', { type: 'resolve', itemId: a.items[1].id, outcome: 'covered' });
    const out = exportAgenda({ userId: FIXTURE_COORDINATOR, isCoordinator: true }, a, new Date('2026-03-01T13:00:00Z'));
    expect(out.items.map((i) => [i.position, i.title, i.state])).toEqual([
      [1, 'Next steps', 'open'],
      [2, 'Escrow basics', 'resolved'],
      [3, 'Portfolio review', 'open'],
    ]);
    expect(agendaExportToText(out)).toBe('1. Next steps [open]\n2. Escrow basics [resolved: covered]\n3. Portfolio review [open]');
    expect(JSON.stringify(out)).not.toContain('history');
  });

  it('denies outsiders', () => {
    expect(code(() => exportAgenda({ userId: FIXTURE_OUTSIDER }, seeded(), new Date()))).toBe('NOT_AUTHORIZED');
  });
});

describe('logging and errors', () => {
  it('redacts agenda text from logs', () => {
    const logged = redactAgendaForLog(seeded());
    expect(logged).toEqual({ sessionId: 'ses_fixture_1', version: 3, itemCount: 3 });
  });

  it('maps statuses to stable codes', () => {
    expect(toAgendaError({ status: 409 }).code).toBe('VERSION_CONFLICT');
    expect(toAgendaError({ status: 423 }).code).toBe('CUTOFF_PASSED');
    expect(toAgendaError({ status: 404 }).code).toBe('NOT_FOUND');
    expect(toAgendaError({ status: 422 }).code).toBe('INVALID_ITEM');
    expect(toAgendaError(new Error('secret')).message).not.toContain('secret');
  });
});
