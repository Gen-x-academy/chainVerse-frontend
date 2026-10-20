import { describe, expect, it } from 'vitest';
import {
  FIXTURE_MENTEE_ID,
  FIXTURE_MENTOR_ID,
  FIXTURE_REVIEWER_ID,
  PRIVATE_NOTE_FIXTURES,
} from '../private-notes.fixtures';
import {
  NOTE_BODY_MAX_LENGTH,
  PrivateNoteError,
  buildNotesExport,
  evaluateNoteDeletion,
  listOwnNotes,
  redactNoteForLog,
  searchOwnNotes,
  toPrivateNoteError,
  validateNoteBody,
} from '../private-notes';

const mentor = { userId: FIXTURE_MENTOR_ID };
const notes = PRIVATE_NOTE_FIXTURES;
const byId = (id: string) => notes.find((note) => note.id === id)!;

describe('authorization is owner-only and deny-by-default', () => {
  it('lists only the owner’s active notes, newest first', () => {
    expect(listOwnNotes(mentor, notes).map((n) => n.id)).toEqual(['note_002', 'note_001']);
  });

  it.each([
    ['counterpart', { userId: FIXTURE_MENTEE_ID }, ['note_003']],
    ['reviewer', { userId: FIXTURE_REVIEWER_ID }, []],
    ['anonymous', { userId: null }, []],
    ['empty id', { userId: '' }, []],
  ])('%s sees only their own notes', (_label, viewer, ids) => {
    expect(listOwnNotes(viewer, notes).map((n) => n.id)).toEqual(ids);
  });
});

describe('validation', () => {
  it('trims and accepts valid text', () => {
    expect(validateNoteBody('  hi  ')).toBe('hi');
  });
  it.each(['', '   ', 'x'.repeat(NOTE_BODY_MAX_LENGTH + 1), 42, null])('rejects %p', (value) => {
    expect(() => validateNoteBody(value)).toThrow(PrivateNoteError);
  });
});

describe('search cannot leak', () => {
  it('returns ids only, with no snippet fields', () => {
    const hits = searchOwnNotes(mentor, notes, 'ESCROW');
    expect(hits).toEqual([{ id: 'note_001' }]);
    expect(Object.keys(hits[0])).toEqual(['id']);
  });
  it('never matches another user’s or deleted notes', () => {
    expect(searchOwnNotes(mentor, notes, 'portfolio')).toEqual([]);
    expect(searchOwnNotes(mentor, notes, 'draft')).toEqual([]);
    expect(searchOwnNotes({ userId: null }, notes, 'escrow')).toEqual([]);
  });
  it('rejects too-short queries', () => {
    expect(() => searchOwnNotes(mentor, notes, 'a')).toThrow(/at least/);
  });
});

describe('export', () => {
  it('contains only the requester’s active notes', () => {
    const bundle = buildNotesExport(mentor, notes, new Date('2026-02-01T00:00:00Z'));
    expect(bundle.requesterId).toBe(FIXTURE_MENTOR_ID);
    expect(bundle.exportedAt).toBe('2026-02-01T00:00:00.000Z');
    expect(bundle.notes.map((n) => n.id)).toEqual(['note_002', 'note_001']);
    expect(JSON.stringify(bundle)).not.toContain('portfolio');
    expect(JSON.stringify(bundle)).not.toContain('ownerId');
  });
  it('denies anonymous requesters', () => {
    expect(() => buildNotesExport({ userId: undefined }, notes)).toThrowError(
      expect.objectContaining({ code: 'NOT_AUTHORIZED' }),
    );
  });
});

describe('deletion policy', () => {
  it('allows the owner', () => {
    expect(evaluateNoteDeletion(mentor, byId('note_001'))).toBe('delete');
  });
  it('is a no-op when already deleted (retry safe)', () => {
    expect(evaluateNoteDeletion(mentor, byId('note_004'))).toBe('already-deleted');
  });
  it('blocks retention holds', () => {
    expect(() => evaluateNoteDeletion(mentor, byId('note_002'))).toThrowError(
      expect.objectContaining({ code: 'DELETION_BLOCKED' }),
    );
  });
  it('denies non-owners', () => {
    expect(() => evaluateNoteDeletion({ userId: FIXTURE_MENTEE_ID }, byId('note_001'))).toThrowError(
      expect.objectContaining({ code: 'NOT_AUTHORIZED' }),
    );
  });
});

describe('logging and errors', () => {
  it('redacts note text from log payloads', () => {
    const logged = redactNoteForLog(byId('note_001'));
    expect(JSON.stringify(logged)).not.toContain('escrow');
    expect(logged.bodyLength).toBe(byId('note_001').body.length);
  });
  it('maps API statuses to stable codes without echoing messages', () => {
    expect(toPrivateNoteError({ status: 403, message: 'secret text' }).code).toBe('NOT_AUTHORIZED');
    expect(toPrivateNoteError({ status: 404 }).code).toBe('NOT_FOUND');
    expect(toPrivateNoteError({ status: 409 }).code).toBe('VERSION_CONFLICT');
    expect(toPrivateNoteError({ status: 422 }).code).toBe('INVALID_NOTE');
    expect(toPrivateNoteError(new Error('secret text')).message).not.toContain('secret');
  });
});
