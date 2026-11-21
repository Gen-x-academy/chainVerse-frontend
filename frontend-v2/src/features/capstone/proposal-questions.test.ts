import { describe, expect, it } from "vitest";
import { publishNextVersion, reorderQuestion, toSafeText, validateAnswers, validateQuestionSet, visibleQuestions, type ProposalQuestion, type QuestionSet } from "./proposal-questions";

const q = (id: string, order: number, over: Partial<ProposalQuestion> = {}): ProposalQuestion => ({ id, type: "short_text", label: `Question ${id}`, required: false, order, ...over });
const set = (): QuestionSet => ({
  callId: "call-1",
  version: 1,
  questions: [
    q("team", 1, { type: "boolean", required: true }),
    q("why", 2, { type: "long_text", required: true, visibleWhen: { questionId: "team", equals: true } }),
    q("size", 3, { type: "number", min: 1, max: 6 }),
    q("area", 4, { type: "single_choice", options: ["ai", "health"] }),
  ],
});
const paths = (issues: { path: string }[]) => issues.map((i) => i.path);

describe("question set validation", () => {
  it("accepts a well formed set", () => {
    expect(validateQuestionSet(set())).toEqual([]);
  });

  it("rejects duplicate ids, order gaps and bad choice options", () => {
    const bad = set();
    bad.questions[1] = q("team", 3);
    bad.questions[3] = q("area", 4, { type: "single_choice", options: ["only"] });
    expect(paths(validateQuestionSet(bad))).toEqual(["questions[1].id", "questions[1].order", "questions[3].options"]);
  });

  it("only allows conditions on earlier questions", () => {
    const bad = set();
    (bad.questions[0] as ProposalQuestion).visibleWhen = { questionId: "why", equals: true };
    expect(paths(validateQuestionSet(bad))).toEqual(["questions[0].visibleWhen"]);
  });
});

describe("conditional visibility and answers", () => {
  it("hides a question until its condition is met", () => {
    expect(visibleQuestions(set(), { team: false }).map((x) => x.id)).toEqual(["team", "size", "area"]);
    expect(visibleQuestions(set(), { team: true }).map((x) => x.id)).toEqual(["team", "why", "size", "area"]);
  });

  it("does not require answers to hidden questions", () => {
    expect(validateAnswers(set(), { team: false })).toEqual([]);
    expect(paths(validateAnswers(set(), { team: true }))).toEqual(["answers.why"]);
  });

  it("checks types, ranges and choices", () => {
    const issues = validateAnswers(set(), { team: true, why: "because", size: 9, area: "space" });
    expect(paths(issues)).toEqual(["answers.size", "answers.area"]);
  });
});

describe("versioning and rendering", () => {
  it("publishes the next version without touching the old one", () => {
    const v1 = set();
    const v2 = publishNextVersion(v1, [q("a", 7), q("b", 9)]);
    expect(v2.version).toBe(2);
    expect(v2.questions.map((x) => x.order)).toEqual([1, 2]);
    expect(v1.version).toBe(1);
    expect(v1.questions).toHaveLength(4);
  });

  it("reorders without changing the input", () => {
    const original = set().questions;
    const moved = reorderQuestion(original, "area", 1);
    expect(moved.map((x) => x.id)).toEqual(["area", "team", "why", "size"]);
    expect(original[0]?.id).toBe("team");
  });

  it("escapes markup", () => {
    expect(toSafeText(`<b onclick="x">&</b>`)).toBe("&lt;b onclick=&quot;x&quot;&gt;&amp;&lt;/b&gt;");
  });
});
