import { describe, it, expect } from "vitest";
import {
  getScore,
  isSolutionEliminated,
  solutionScore,
  recommendation,
  isScoringComplete,
} from "@/store/useDecisionStore";
import type { Session } from "@shared/types/session";

function session(): Session {
  return {
    meta: {
      schema: "decision/v1",
      slug: "t",
      title: "T",
      status: "draft",
      created: "2026-05-15T10:00:00Z",
      updated: "2026-05-15T10:00:00Z",
    },
    slides: [],
    solutions: [
      { id: "A", name: "A", description: "", pros: [], cons: [] },
      { id: "B", name: "B", description: "", pros: [], cons: [] },
      { id: "C", name: "C", description: "", pros: [], cons: [] },
    ],
    criteria: [
      { id: "R1", name: "Required 1", type: "Required", contested: false },
      { id: "P1", name: "Preferred 1", type: "Preferred", contested: false },
      { id: "P2", name: "Preferred 2", type: "Preferred", contested: false },
    ],
    scores: [
      { criterionId: "R1", solutionId: "A", value: "yes" },
      { criterionId: "P1", solutionId: "A", value: "yes" },
      { criterionId: "P2", solutionId: "A", value: "yes" },

      { criterionId: "R1", solutionId: "B", value: "no" },
      { criterionId: "P1", solutionId: "B", value: "yes" },
      // P2 left unknown for B

      // C: all unknown
    ],
    decision: "",
    history: [],
    diagnostics: [],
  };
}

describe("getScore", () => {
  it("returns the score value or unknown", () => {
    const s = session();
    expect(getScore(s, "R1", "A")).toBe("yes");
    expect(getScore(s, "R1", "B")).toBe("no");
    expect(getScore(s, "P2", "B")).toBe("unknown");
    expect(getScore(s, "R1", "C")).toBe("unknown");
  });
});

describe("isSolutionEliminated", () => {
  it("eliminates a solution that fails any Required", () => {
    const s = session();
    expect(isSolutionEliminated(s, "B")).toEqual({
      eliminated: true,
      failingCriteria: ["R1"],
    });
  });

  it("does not eliminate when Required is yes", () => {
    const s = session();
    expect(isSolutionEliminated(s, "A").eliminated).toBe(false);
  });

  it("does not eliminate when Required is unknown (pending)", () => {
    const s = session();
    expect(isSolutionEliminated(s, "C").eliminated).toBe(false);
  });
});

describe("solutionScore", () => {
  it("counts met Preferred, total, and unknown", () => {
    const s = session();
    expect(solutionScore(s, "A")).toEqual({ score: 2, maxScore: 2, unknown: 0 });
    expect(solutionScore(s, "B")).toEqual({ score: 1, maxScore: 2, unknown: 1 });
    expect(solutionScore(s, "C")).toEqual({ score: 0, maxScore: 2, unknown: 2 });
  });
});

describe("recommendation", () => {
  it("returns kind=winner with the highest-scoring survivor", () => {
    const s = session();
    const r = recommendation(s);
    expect(r.kind).toBe("winner");
    if (r.kind === "winner") {
      expect(r.id).toBe("A");
      expect(r.score).toBe(2);
    }
  });

  it("returns kind=none when nothing survives", () => {
    const s = session();
    s.scores = [
      { criterionId: "R1", solutionId: "A", value: "no" },
      { criterionId: "R1", solutionId: "B", value: "no" },
      { criterionId: "R1", solutionId: "C", value: "no" },
    ];
    expect(recommendation(s).kind).toBe("none");
  });

  it("returns kind=tie when leaders are tied — no algorithmic winner", () => {
    const s = session();
    // Both A and C survive and have 2/2 → tie, not a winner.
    s.scores = [
      { criterionId: "R1", solutionId: "A", value: "yes" },
      { criterionId: "R1", solutionId: "C", value: "yes" },
      { criterionId: "P1", solutionId: "A", value: "yes" },
      { criterionId: "P1", solutionId: "C", value: "yes" },
      { criterionId: "P2", solutionId: "A", value: "yes" },
      { criterionId: "P2", solutionId: "C", value: "yes" },
      { criterionId: "R1", solutionId: "B", value: "no" },
    ];
    const r = recommendation(s);
    expect(r.kind).toBe("tie");
    if (r.kind === "tie") {
      expect(r.ids.sort()).toEqual(["A", "C"]);
      expect(r.score).toBe(2);
    }
  });
});

describe("isScoringComplete", () => {
  it("is false when any surviving solution has unknown Preferred cells", () => {
    expect(isScoringComplete(session())).toBe(false);
  });

  it("is true when all survivors are fully scored", () => {
    const s = session();
    s.scores.push({ criterionId: "P2", solutionId: "B", value: "no" });
    // C is still a "survivor" with unknowns, so still incomplete unless we eliminate or fill.
    s.scores.push({ criterionId: "R1", solutionId: "C", value: "yes" });
    s.scores.push({ criterionId: "P1", solutionId: "C", value: "yes" });
    s.scores.push({ criterionId: "P2", solutionId: "C", value: "yes" });
    expect(isScoringComplete(s)).toBe(true);
  });
});
