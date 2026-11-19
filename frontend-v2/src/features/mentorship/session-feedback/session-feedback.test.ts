import { describe, expect, it } from "vitest";
import {
  DEFAULT_POLICY,
  aggregate,
  editFeedback,
  isRevealed,
  submitFeedback,
  viewFeedback,
  type FeedbackResponse,
  type SessionInfo,
} from "./session-feedback";

const session: SessionInfo = { id: "s1", mentorId: "mentor", menteeId: "mentee", completedAt: "2026-03-01T10:00:00Z", cancelled: false };
const at = (h: number) => new Date(Date.parse("2026-03-01T10:00:00Z") + h * 3_600_000);
const ratings = { preparation: 4 as const, communication: 5 as const };

function must(r: ReturnType<typeof submitFeedback>): FeedbackResponse[] {
  if (!r.ok) throw new Error(r.error);
  return r.responses;
}

describe("session feedback", () => {
  it("lets each participant role submit once per session", () => {
    let list = must(submitFeedback([], session, "mentee", { ratings }, at(1)));
    list = must(submitFeedback(list, session, "mentor", { ratings: { respect: 5 } }, at(2)));
    expect(list.map((r) => r.role)).toEqual(["mentee", "mentor"]);
    expect(submitFeedback(list, session, "mentee", { ratings }, at(3))).toEqual({ ok: false, error: "ALREADY_SUBMITTED" });
  });

  it("is limited to participants of completed, non-cancelled sessions inside the window", () => {
    expect(submitFeedback([], session, "stranger", { ratings }, at(1))).toEqual({ ok: false, error: "NOT_PARTICIPANT" });
    expect(submitFeedback([], { ...session, cancelled: true }, "mentee", { ratings }, at(1))).toEqual({ ok: false, error: "SESSION_NOT_ELIGIBLE" });
    expect(submitFeedback([], { ...session, completedAt: undefined }, "mentee", { ratings }, at(1))).toEqual({ ok: false, error: "SESSION_NOT_ELIGIBLE" });
    expect(submitFeedback([], session, "mentee", { ratings }, at(72)).ok).toBe(true);
    expect(submitFeedback([], session, "mentee", { ratings }, at(73))).toEqual({ ok: false, error: "WINDOW_CLOSED" });
    expect(submitFeedback([], session, "mentee", { ratings }, at(-1))).toEqual({ ok: false, error: "WINDOW_CLOSED" });
  });

  it("validates ratings and comment length", () => {
    expect(submitFeedback([], session, "mentee", { ratings: {} }, at(1))).toEqual({ ok: false, error: "NO_RATINGS" });
    expect(submitFeedback([], session, "mentee", { ratings: { preparation: 6 as never } }, at(1))).toEqual({ ok: false, error: "INVALID_RATING" });
    expect(submitFeedback([], session, "mentee", { ratings: { vibes: 3 } as never }, at(1))).toEqual({ ok: false, error: "INVALID_RATING" });
    expect(submitFeedback([], session, "mentee", { ratings, comment: "x".repeat(1001) }, at(1))).toEqual({ ok: false, error: "COMMENT_TOO_LONG" });
  });

  it("follows the edit policy: window, limit and authorship", () => {
    let list = must(submitFeedback([], session, "mentee", { ratings }, at(1)));
    const edit = (user: string, h: number, patch = { comment: "later" }) => editFeedback(list, "s1", user, patch, at(h));
    expect(edit("mentee", 5).ok).toBe(true);
    expect(edit("mentee", 26)).toEqual({ ok: false, error: "EDIT_WINDOW_CLOSED" });
    expect(edit("mentor", 5)).toEqual({ ok: false, error: "NOT_AUTHOR" });
    expect(editFeedback(list, "nope", "mentee", { comment: "x" }, at(5))).toEqual({ ok: false, error: "NOT_FOUND" });
    for (const h of [2, 3]) {
      const r = editFeedback(list, "s1", "mentee", { comment: `edit ${h}` }, at(h));
      if (!r.ok) throw new Error(r.error);
      list = r.responses;
    }
    expect(edit("mentee", 4)).toEqual({ ok: false, error: "EDIT_LIMIT_REACHED" });
    expect(list[0].edits).toBe(2);
  });

  it("holds feedback back until both roles respond by default (retaliation protection)", () => {
    const mentee = must(submitFeedback([], session, "mentee", { ratings }, at(1)));
    expect(isRevealed(mentee, mentee[0], "mentor", at(2))).toBe(false);
    expect(isRevealed(mentee, mentee[0], "mentee", at(2))).toBe(true); // authors always see their own
    const both = must(submitFeedback(mentee, session, "mentor", { ratings }, at(3)));
    expect(isRevealed(both, both[0], "mentor", at(4))).toBe(true);
  });

  it("supports immediate and delayed reveal policies", () => {
    const list = must(submitFeedback([], session, "mentee", { ratings }, at(1)));
    expect(isRevealed(list, list[0], "mentor", at(1), { ...DEFAULT_POLICY, reveal: "immediate" })).toBe(true);
    const delayed = { ...DEFAULT_POLICY, reveal: "after_delay" as const, revealDelayHours: 48 };
    expect(isRevealed(list, list[0], "mentor", at(48), delayed)).toBe(false);
    expect(isRevealed(list, list[0], "mentor", at(49), delayed)).toBe(true);
  });

  it("keeps comments restricted unless the author shares them", () => {
    let list = must(submitFeedback([], session, "mentee", { ratings, comment: "Private concern" }, at(1)));
    list = must(submitFeedback(list, session, "mentor", { ratings }, at(2)));
    const private_ = viewFeedback(list, list[0], "mentor", at(3));
    expect(private_).toEqual({ role: "mentee", ratings });
    expect(JSON.stringify(private_)).not.toContain("Private concern");
    expect(viewFeedback(list, list[0], "mentee", at(3))?.comment).toBe("Private concern");
    const shared = editFeedback(list, "s1", "mentee", { commentSharedWithCounterpart: true }, at(4));
    if (!shared.ok) throw new Error();
    expect(viewFeedback(shared.responses, shared.responses[0], "mentor", at(5))?.comment).toBe("Private concern");
  });

  it("returns nothing before reveal", () => {
    const list = must(submitFeedback([], session, "mentee", { ratings, comment: "hi", commentSharedWithCounterpart: true }, at(1)));
    expect(viewFeedback(list, list[0], "mentor", at(2))).toBeNull();
  });

  it("aggregates only consented responses and never invents values for missing dimensions", () => {
    let list = must(submitFeedback([], session, "mentee", { ratings: { preparation: 4, communication: 5 }, analyticsConsent: true }, at(1)));
    list = must(submitFeedback(list, session, "mentor", { ratings: { preparation: 5 }, analyticsConsent: true }, at(2)));
    const other: SessionInfo = { ...session, id: "s2" };
    list = must(submitFeedback(list, other, "mentee", { ratings: { preparation: 1 } }, at(3))); // no consent
    const a = aggregate(list);
    expect(a.responses).toBe(2);
    expect(a.averages).toEqual({ preparation: 4.5, communication: 5, usefulness: null, respect: null });
    expect(a.counts).toEqual({ preparation: 2, communication: 1, usefulness: 0, respect: 0 });
    expect(aggregate([]).averages.preparation).toBeNull();
  });
});
