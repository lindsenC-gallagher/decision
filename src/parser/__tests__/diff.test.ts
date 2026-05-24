import { describe, it, expect } from "vitest";
import { diffSessions } from "../diff";
import type { Session } from "@shared/types/session";

function base(): Session {
  return {
    meta: {
      schema: "decision/v1",
      slug: "t",
      title: "T",
      status: "draft",
      created: "2026-05-15T10:00:00Z",
      updated: "2026-05-15T10:00:00Z",
    },
    slides: [{ id: "sl-1", title: "Problem", body: "Old problem" }],
    solutions: [{ id: "A", name: "A", description: "a body", pros: [], cons: [] }],
    criteria: [{ id: "C1", name: "Speed", type: "Preferred", contested: false }],
    scores: [{ criterionId: "C1", solutionId: "A", value: "yes" }],
    decision: "",
    history: [],
    diagnostics: [],
  };
}

describe("diffSessions (Decision-side scope)", () => {
  it("returns no entries when nothing changed", () => {
    const a = base();
    const b = structuredClone(a);
    expect(diffSessions(a, b)).toEqual([]);
  });

  it("captures title rename and status change", () => {
    const a = base();
    const b = structuredClone(a);
    b.meta.title = "T2";
    b.meta.status = "in-progress";
    const msgs = diffSessions(a, b).map((e) => e.message);
    expect(msgs).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Renamed session/),
        "Status: draft → in-progress",
      ])
    );
  });

  it("does NOT log slide additions, slide body edits, or slide renames", () => {
    const a = base();
    const b = structuredClone(a);
    b.slides.push({ id: "sl-2", title: "Background", body: "new" });
    b.slides[0].body = "Edited problem";
    b.slides[0].title = "Renamed";
    expect(diffSessions(a, b)).toEqual([]);
  });

  it("does NOT log solution add / remove / rename / body changes", () => {
    const a = base();
    const b = structuredClone(a);
    b.solutions.push({ id: "B", name: "B", description: "", pros: [], cons: [] });
    b.solutions[0].name = "A-renamed";
    b.solutions[0].description = "edited";
    expect(diffSessions(a, b)).toEqual([]);
  });

  it("captures criteria add/remove/rename and score flips", () => {
    const a = base();
    const b = structuredClone(a);
    b.criteria.push({ id: "C2", name: "Cost", type: "Required", contested: false });
    b.scores = [
      { criterionId: "C1", solutionId: "A", value: "no" },
      { criterionId: "C2", solutionId: "A", value: "yes" },
    ];
    const msgs = diffSessions(a, b).map((e) => e.message);
    expect(msgs).toEqual(
      expect.arrayContaining([
        "Added criterion C2: Cost",
        expect.stringMatching(/Set score \(A, C1\): ✓ → ✗/),
      ])
    );
  });

  it("captures pick toggles", () => {
    const a = base();
    const b = structuredClone(a);
    b.pickedSolution = "A";
    const msgs = diffSessions(a, b).map((e) => e.message);
    expect(msgs).toEqual(expect.arrayContaining(["Picked solution: A"]));
  });

  it("captures contested toggles and decision text edits", () => {
    const a = base();
    const b = structuredClone(a);
    b.criteria[0].contested = true;
    b.decision = "Picked it.";
    const msgs = diffSessions(a, b).map((e) => e.message);
    expect(msgs).toEqual(
      expect.arrayContaining(["Marked C1 as contested", "Edited decision summary"])
    );
  });
});
