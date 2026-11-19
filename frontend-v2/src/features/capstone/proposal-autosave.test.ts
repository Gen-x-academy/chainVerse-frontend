import { describe, expect, it } from "vitest";
import {
  applySaveResponse,
  buildSaveRequest,
  edit,
  lastSavedLabel,
  markSaving,
  newAutosave,
  resolveConflict,
  restoreFromStorage,
  serializeForStorage,
} from "./proposal-autosave";

const t = (s: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, s));
const iso = (s: number) => t(s).toISOString();

describe("proposal autosave", () => {
  it("tracks only fields that differ from the saved base", () => {
    let s = newAutosave("d1", { title: "A" }, "tok1", iso(0));
    s = edit(s, "title", "B", t(1));
    expect(s.dirty).toEqual(["title"]);
    expect(s.status).toBe("dirty");
    s = edit(s, "title", "A", t(2)); // changed back
    expect(s.dirty).toEqual([]);
    expect(s.status).toBe("saved");
  });

  it("builds a save request with the base token, changes and field timestamps", () => {
    let s = newAutosave("d1", { title: "A" }, "tok1", iso(0));
    expect(buildSaveRequest(s)).toBeNull();
    s = edit(edit(s, "title", "B", t(1)), "abstract", "text", t(2));
    expect(buildSaveRequest(s)).toEqual({ draftId: "d1", baseToken: "tok1", changes: { abstract: "text", title: "B" }, editedAt: { abstract: iso(2), title: iso(1) } });
  });

  it("applies a successful save and keeps edits made while the request was in flight", () => {
    let s = edit(newAutosave("d1", {}, "tok1", iso(0)), "title", "B", t(1));
    const req = buildSaveRequest(s);
    if (!req) throw new Error();
    s = markSaving(s);
    expect(s.status).toBe("saving");
    s = edit(s, "abstract", "typed during save", t(2));
    s = applySaveResponse(s, req, { kind: "ok", token: "tok2", savedAt: iso(3) });
    expect(s).toMatchObject({ baseToken: "tok2", savedAt: iso(3), dirty: ["abstract"], status: "dirty" });
    expect(s.base).toEqual({ title: "B" });
  });

  it("reports saved when nothing is left dirty", () => {
    let s = edit(newAutosave("d1", {}, "tok1", iso(0)), "title", "B", t(1));
    const req = buildSaveRequest(s);
    if (!req) throw new Error();
    s = applySaveResponse(s, req, { kind: "ok", token: "tok2", savedAt: iso(2) });
    expect(s.status).toBe("saved");
    expect(s.dirty).toEqual([]);
  });

  it("goes offline on a network error and keeps the unsaved work", () => {
    let s = edit(newAutosave("d1", {}, "tok1", iso(0)), "title", "B", t(1));
    const req = buildSaveRequest(s);
    if (!req) throw new Error();
    s = applySaveResponse(s, req, { kind: "network_error" });
    expect(s).toMatchObject({ status: "offline", dirty: ["title"] });
    expect(edit(s, "abstract", "more", t(2)).status).toBe("offline");
  });

  it("merges a stale-token conflict per field and reports fields both sides changed", () => {
    let s = newAutosave("d1", { title: "Base", abstract: "Base abstract" }, "tok1", iso(0));
    s = edit(edit(s, "title", "Mine", t(10)), "abstract", "My abstract", t(11));
    const req = buildSaveRequest(s);
    if (!req) throw new Error();
    const merged = applySaveResponse(s, req, {
      kind: "conflict",
      token: "tok9",
      serverFields: { title: "Theirs", abstract: "Base abstract", problem: "New from server" },
      serverEditedAt: { title: iso(5), problem: iso(6) },
    });
    // title: both changed, my edit (t10) is newer than theirs (t5) -> mine wins, flagged as a conflict
    expect(merged.fields.title).toBe("Mine");
    // abstract: only I changed it -> mine; problem: only the server did -> theirs
    expect(merged.fields.abstract).toBe("My abstract");
    expect(merged.fields.problem).toBe("New from server");
    expect(merged).toMatchObject({ conflicts: ["title"], baseToken: "tok9", status: "conflict" });
    expect(merged.dirty).toEqual(["abstract", "title"]);
  });

  it("lets the newer server edit win when it is later than the local one", () => {
    const s = edit(newAutosave("d1", { title: "Base" }, "tok1", iso(0)), "title", "Mine", t(3));
    const merged = resolveConflict(s, "tok2", { title: "Theirs" }, { title: iso(9) });
    expect(merged.fields.title).toBe("Theirs");
    expect(merged.conflicts).toEqual(["title"]);
    expect(merged.dirty).toEqual([]);
  });

  it("is not a conflict when both sides made the same change", () => {
    const s = edit(newAutosave("d1", { title: "Base" }, "tok1", iso(0)), "title", "Same", t(3));
    const merged = resolveConflict(s, "tok2", { title: "Same" }, { title: iso(2) });
    expect(merged.conflicts).toEqual([]);
    expect(merged.status).toBe("saved");
  });

  it("recovers unsaved work from storage and ignores stale or foreign snapshots", () => {
    const s = edit(newAutosave("d1", { title: "A" }, "tok1", iso(0)), "title", "Unsaved", t(1));
    const raw = serializeForStorage(s);
    const restored = restoreFromStorage(raw, "d1");
    expect(restored).toMatchObject({ fields: { title: "Unsaved" }, dirty: ["title"], status: "offline", baseToken: "tok1" });
    expect(restoreFromStorage(raw, "other-draft")).toBeNull();
    expect(restoreFromStorage("{not json", "d1")).toBeNull();
    expect(restoreFromStorage(JSON.stringify({ v: 99, state: s }), "d1")).toBeNull();
    expect(restoreFromStorage(null, "d1")).toBeNull();
    expect(restoreFromStorage(serializeForStorage(newAutosave("d1", {}, "t", iso(0))), "d1")?.status).toBe("saved");
  });

  it("gives explicit last-saved feedback", () => {
    const saved = newAutosave("d1", {}, "tok1", iso(0));
    expect(lastSavedLabel(newAutosave("d1"), t(0))).toBe("Not saved yet");
    expect(lastSavedLabel(saved, t(3))).toBe("Saved just now");
    expect(lastSavedLabel(saved, t(30))).toBe("Saved 30 seconds ago");
    expect(lastSavedLabel(saved, t(60))).toBe("Saved 1 minute ago");
    expect(lastSavedLabel(saved, t(60 * 5))).toBe("Saved 5 minutes ago");
    expect(lastSavedLabel(saved, t(3600 * 3))).toBe("Saved 3 hours ago");
    expect(lastSavedLabel({ ...saved, status: "saving" }, t(1))).toBe("Saving…");
    expect(lastSavedLabel({ ...saved, status: "offline" }, t(1))).toMatch(/stored on this device/);
    expect(lastSavedLabel({ ...saved, status: "conflict" }, t(1))).toMatch(/Review the highlighted fields/);
    expect(lastSavedLabel({ ...saved, status: "dirty" }, t(1))).toBe("Unsaved changes");
  });
});
