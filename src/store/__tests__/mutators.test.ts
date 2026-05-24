// Exercises the Zustand store actions. Uses the real store; each test
// re-seeds via `load()` for isolation.

import { describe, it, expect, beforeEach } from "vitest";
import { useDecisionStore } from "@/store/useDecisionStore";
import type { Session } from "@shared/types/session";

function freshSession(): Session {
  return {
    meta: {
      schema: "decision/v1",
      slug: "t",
      title: "T",
      status: "draft",
      created: "2026-05-15T10:00:00Z",
      updated: "2026-05-15T10:00:00Z",
    },
    slides: [{ id: "sl-1", title: "Problem", body: "" }],
    solutions: [
      {
        id: "Alpha",
        name: "Alpha",
        description: "Alpha body.",
        pros: ["fast"],
        cons: ["expensive"],
      },
    ],
    criteria: [{ id: "C1", name: "Stateless", type: "Required", contested: false }],
    scores: [],
    decision: "",
    history: [],
    diagnostics: [],
  };
}

beforeEach(() => {
  useDecisionStore.getState().load("t", freshSession(), "hash-0");
});

describe("slide mutators", () => {
  it("addSlide appends a new slide and marks dirty", () => {
    const before = useDecisionStore.getState().session!.slides.length;
    useDecisionStore.getState().addSlide();
    const s = useDecisionStore.getState();
    expect(s.session!.slides.length).toBe(before + 1);
    expect(s.dirty).toBe(true);
    expect(s.session!.slides[before].title).toMatch(/^Slide \d+$/);
  });

  it("removeSlide drops the requested slide", () => {
    useDecisionStore.getState().addSlide();
    const toRemove = useDecisionStore.getState().session!.slides[1].id;
    useDecisionStore.getState().removeSlide(toRemove);
    expect(useDecisionStore.getState().session!.slides.some((sl) => sl.id === toRemove)).toBe(
      false
    );
  });

  it("renameSlide updates title", () => {
    const id = useDecisionStore.getState().session!.slides[0].id;
    useDecisionStore.getState().renameSlide(id, "Background");
    expect(useDecisionStore.getState().session!.slides[0].title).toBe("Background");
  });

  it("setSlideBody updates the body markdown", () => {
    const id = useDecisionStore.getState().session!.slides[0].id;
    useDecisionStore.getState().setSlideBody(id, "## Heading\n\nBody.");
    expect(useDecisionStore.getState().session!.slides[0].body).toContain("## Heading");
  });
});

describe("setSolutionFullBody", () => {
  it("splits combined body back into description + pros + cons", () => {
    const combined = "New description.\n\n**Pros**\n\n- a\n- b\n\n**Cons**\n\n- c";
    useDecisionStore.getState().setSolutionFullBody("Alpha", combined);
    const sol = useDecisionStore.getState().session!.solutions[0];
    expect(sol.description).toBe("New description.");
    expect(sol.pros).toEqual(["a", "b"]);
    expect(sol.cons).toEqual(["c"]);
  });

  it("clears pros/cons when the user removes those blocks", () => {
    useDecisionStore.getState().setSolutionFullBody("Alpha", "Just plain prose now.");
    const sol = useDecisionStore.getState().session!.solutions[0];
    expect(sol.description).toBe("Just plain prose now.");
    expect(sol.pros).toEqual([]);
    expect(sol.cons).toEqual([]);
  });
});

describe("UI state", () => {
  it("toggleReveal flips the boolean", () => {
    expect(useDecisionStore.getState().revealed).toBe(false);
    useDecisionStore.getState().toggleReveal();
    expect(useDecisionStore.getState().revealed).toBe(true);
    useDecisionStore.getState().toggleReveal();
    expect(useDecisionStore.getState().revealed).toBe(false);
  });

  it("setPresenting toggles present mode", () => {
    expect(useDecisionStore.getState().presenting).toBe(false);
    useDecisionStore.getState().setPresenting(true);
    expect(useDecisionStore.getState().presenting).toBe(true);
  });

  it("load resets revealed and presenting to false", () => {
    useDecisionStore.getState().setPresenting(true);
    useDecisionStore.getState().toggleReveal();
    useDecisionStore.getState().load("t", freshSession(), "hash-1");
    const s = useDecisionStore.getState();
    expect(s.revealed).toBe(false);
    expect(s.presenting).toBe(false);
  });
});

describe("criterion mutators", () => {
  it("addCriterion picks the next unused C-prefixed id", () => {
    useDecisionStore.getState().addCriterion();
    useDecisionStore.getState().addCriterion();
    const ids = useDecisionStore.getState().session!.criteria.map((c) => c.id);
    expect(ids).toContain("C1");
    expect(ids).toContain("C2");
    expect(ids).toContain("C3");
  });

  it("removeCriterion also drops orphan score cells", () => {
    useDecisionStore.getState().setScore("C1", "Alpha", "yes");
    expect(useDecisionStore.getState().session!.scores).toHaveLength(1);
    useDecisionStore.getState().removeCriterion("C1");
    expect(useDecisionStore.getState().session!.criteria).toHaveLength(0);
    expect(useDecisionStore.getState().session!.scores).toHaveLength(0);
  });

  it("setCriterionContested flips the flag", () => {
    useDecisionStore.getState().setCriterionContested("C1", true);
    expect(useDecisionStore.getState().session!.criteria[0].contested).toBe(true);
  });
});

describe("solution mutators", () => {
  it("addSolution defaults to 'Solution <Letter>'", () => {
    useDecisionStore.getState().addSolution();
    const sol = useDecisionStore.getState().session!.solutions[1];
    expect(sol.name).toMatch(/^Solution [B-Z]$/);
  });

  it("removeSolution drops the solution and its score cells", () => {
    useDecisionStore.getState().setScore("C1", "Alpha", "yes");
    useDecisionStore.getState().removeSolution("Alpha");
    expect(useDecisionStore.getState().session!.solutions).toHaveLength(0);
    expect(useDecisionStore.getState().session!.scores).toHaveLength(0);
  });

  it("pickSolution toggles the picked flag", () => {
    useDecisionStore.getState().pickSolution("Alpha");
    expect(useDecisionStore.getState().session!.pickedSolution).toBe("Alpha");
    useDecisionStore.getState().pickSolution("Alpha");
    expect(useDecisionStore.getState().session!.pickedSolution).toBeUndefined();
  });
});

describe("score mutator", () => {
  it("setScore adds, updates, or removes (when unknown) a cell", () => {
    useDecisionStore.getState().setScore("C1", "Alpha", "yes");
    expect(useDecisionStore.getState().session!.scores).toEqual([
      { criterionId: "C1", solutionId: "Alpha", value: "yes" },
    ]);
    useDecisionStore.getState().setScore("C1", "Alpha", "no");
    expect(useDecisionStore.getState().session!.scores[0].value).toBe("no");
    useDecisionStore.getState().setScore("C1", "Alpha", "unknown");
    expect(useDecisionStore.getState().session!.scores).toHaveLength(0);
  });
});
