// Zustand store for the active session.
// Holds parsed Session, baseHash for optimistic-concurrency, dirty flag.

import { create } from "zustand";
import type {
  Session,
  SessionStatus,
  Solution,
  Criterion,
  CriterionType,
  ScoreValue,
  SlideLayout,
} from "@shared/types/session";

interface DecisionState {
  slug: string | null;
  session: Session | null;
  /** Snapshot of last successfully-saved session — used for history diffing. */
  lastSaved: Session | null;
  baseHash: string;
  dirty: boolean;
  revealed: boolean;
  /** External edit arrived while dirty: stashed for user choice. */
  pendingExternal: { session: Session; baseHash: string } | null;

  load: (slug: string, session: Session, baseHash: string) => void;
  clear: () => void;
  markSaved: (newSession: Session, newHash: string) => void;
  toggleReveal: () => void;

  setExternalPending: (session: Session, baseHash: string) => void;
  takeExternal: () => void;
  keepMine: () => void;

  // Slide mutators (Presentation tab, before the `## Solutions` marker).
  addSlide: () => void;
  removeSlide: (id: string) => void;
  renameSlide: (id: string, title: string) => void;
  setSlideBody: (id: string, body: string) => void;
  setSlideLayout: (id: string, layout: SlideLayout | undefined) => void;

  setDecisionText: (md: string) => void;
  setTitle: (title: string) => void;
  setStatus: (status: SessionStatus) => void;

  addSolution: () => void;
  removeSolution: (id: string) => void;
  renameSolution: (id: string, name: string) => void;
  setSolutionDescription: (id: string, md: string) => void;
  setSolutionLayout: (id: string, layout: SlideLayout | undefined) => void;
  pickSolution: (id: string | undefined) => void;

  addCriterion: () => void;
  removeCriterion: (id: string) => void;
  renameCriterion: (id: string, name: string) => void;
  setCriterionType: (id: string, type: CriterionType) => void;
  setCriterionContested: (id: string, contested: boolean) => void;

  setScore: (criterionId: string, solutionId: string, value: ScoreValue) => void;
}

function uid(prefix: string): string {
  return prefix + Math.random().toString(36).slice(2, 8);
}

function nextCriterionId(criteria: Criterion[]): string {
  let n = criteria.length + 1;
  while (criteria.some((c) => c.id === `C${n}`)) n++;
  return `C${n}`;
}

export const useDecisionStore = create<DecisionState>((set, get) => {
  // Helper to keep mutators DRY.
  const mut = (fn: (s: Session) => void) => {
    const cur = get().session;
    if (!cur) return;
    const next = structuredClone(cur);
    fn(next);
    set({ session: next, dirty: true });
  };

  return {
    slug: null,
    session: null,
    lastSaved: null,
    baseHash: "",
    dirty: false,
    revealed: false,
    pendingExternal: null,

    load: (slug, session, baseHash) =>
      set({
        slug,
        session,
        lastSaved: structuredClone(session),
        baseHash,
        dirty: false,
        revealed: false,
        pendingExternal: null,
      }),
    clear: () =>
      set({
        slug: null,
        session: null,
        lastSaved: null,
        baseHash: "",
        dirty: false,
        revealed: false,
        pendingExternal: null,
      }),
    markSaved: (newSession, newHash) =>
      set({
        session: newSession,
        lastSaved: structuredClone(newSession),
        baseHash: newHash,
        dirty: false,
      }),
    toggleReveal: () => set((s) => ({ revealed: !s.revealed })),

    setExternalPending: (session, baseHash) => set({ pendingExternal: { session, baseHash } }),
    takeExternal: () => {
      const pe = get().pendingExternal;
      if (!pe) return;
      set({
        session: pe.session,
        lastSaved: structuredClone(pe.session),
        baseHash: pe.baseHash,
        dirty: false,
        pendingExternal: null,
      });
    },
    keepMine: () => set({ pendingExternal: null }),

    addSlide: () =>
      mut((s) => {
        const n = s.slides.length + 1;
        s.slides.push({ id: uid("sl-"), title: `Slide ${n}`, body: "" });
      }),
    removeSlide: (id) =>
      mut((s) => {
        s.slides = s.slides.filter((sl) => sl.id !== id);
      }),
    renameSlide: (id, title) =>
      mut((s) => {
        const sl = s.slides.find((x) => x.id === id);
        if (sl) sl.title = title;
      }),
    setSlideBody: (id, body) =>
      mut((s) => {
        const sl = s.slides.find((x) => x.id === id);
        if (sl) sl.body = body;
      }),
    setSlideLayout: (id, layout) =>
      mut((s) => {
        const sl = s.slides.find((x) => x.id === id);
        if (sl) sl.layout = layout;
      }),

    setDecisionText: (md) => mut((s) => void (s.decision = md)),
    setTitle: (title) => mut((s) => void (s.meta.title = title)),
    setStatus: (status) => mut((s) => void (s.meta.status = status)),

    addSolution: () =>
      mut((s) => {
        const name = `Solution ${String.fromCharCode(65 + s.solutions.length)}`;
        const sol: Solution = { id: uid("s-"), name, description: "", pros: [], cons: [] };
        s.solutions.push(sol);
      }),
    removeSolution: (id) =>
      mut((s) => {
        s.solutions = s.solutions.filter((x) => x.id !== id);
        s.scores = s.scores.filter((sc) => sc.solutionId !== id);
        if (s.pickedSolution === id) s.pickedSolution = undefined;
      }),
    renameSolution: (id, name) =>
      mut((s) => {
        const sol = s.solutions.find((x) => x.id === id);
        if (sol) sol.name = name;
      }),
    setSolutionDescription: (id, md) =>
      mut((s) => {
        const sol = s.solutions.find((x) => x.id === id);
        if (sol) sol.description = md;
      }),
    setSolutionLayout: (id, layout) =>
      mut((s) => {
        const sol = s.solutions.find((x) => x.id === id);
        if (sol) sol.layout = layout;
      }),
    pickSolution: (id) =>
      mut((s) => {
        s.pickedSolution = s.pickedSolution === id ? undefined : id;
      }),

    addCriterion: () =>
      mut((s) => {
        const id = nextCriterionId(s.criteria);
        s.criteria.push({ id, name: "New criterion", type: "Preferred", contested: false });
      }),
    removeCriterion: (id) =>
      mut((s) => {
        s.criteria = s.criteria.filter((x) => x.id !== id);
        s.scores = s.scores.filter((sc) => sc.criterionId !== id);
      }),
    renameCriterion: (id, name) =>
      mut((s) => {
        const c = s.criteria.find((x) => x.id === id);
        if (c) c.name = name;
      }),
    setCriterionType: (id, type) =>
      mut((s) => {
        const c = s.criteria.find((x) => x.id === id);
        if (c) c.type = type;
      }),
    setCriterionContested: (id, contested) =>
      mut((s) => {
        const c = s.criteria.find((x) => x.id === id);
        if (c) c.contested = contested;
      }),

    setScore: (criterionId, solutionId, value) =>
      mut((s) => {
        const i = s.scores.findIndex(
          (sc) => sc.criterionId === criterionId && sc.solutionId === solutionId
        );
        if (value === "unknown") {
          if (i >= 0) s.scores.splice(i, 1);
        } else if (i >= 0) {
          s.scores[i].value = value;
        } else {
          s.scores.push({ criterionId, solutionId, value });
        }
      }),
  };
});

/* Derived helpers (not part of the store; selectors over current state) */

export function getScore(session: Session, criterionId: string, solutionId: string): ScoreValue {
  return (
    session.scores.find((sc) => sc.criterionId === criterionId && sc.solutionId === solutionId)
      ?.value ?? "unknown"
  );
}

export function isSolutionEliminated(
  session: Session,
  solutionId: string
): {
  eliminated: boolean;
  failingCriteria: string[];
} {
  const failing = session.criteria
    .filter((c) => c.type === "Required")
    .filter((c) => getScore(session, c.id, solutionId) === "no")
    .map((c) => c.id);
  return { eliminated: failing.length > 0, failingCriteria: failing };
}

export function solutionScore(
  session: Session,
  solutionId: string
): {
  score: number;
  maxScore: number;
  unknown: number;
} {
  const preferred = session.criteria.filter((c) => c.type === "Preferred");
  let score = 0;
  let unknown = 0;
  for (const c of preferred) {
    const v = getScore(session, c.id, solutionId);
    if (v === "yes") score++;
    else if (v === "unknown") unknown++;
  }
  return { score, maxScore: preferred.length, unknown };
}

export function recommendation(
  session: Session
): { id: string; score: number; maxScore: number } | null {
  const survivors = session.solutions.filter(
    (sol) => !isSolutionEliminated(session, sol.id).eliminated
  );
  if (survivors.length === 0) return null;
  const scored = survivors.map((sol) => ({
    id: sol.id,
    ...solutionScore(session, sol.id),
  }));
  // Tie-break by declaration order (same as `survivors` order).
  let best = scored[0];
  for (const s of scored) if (s.score > best.score) best = s;
  return { id: best.id, score: best.score, maxScore: best.maxScore };
}

export function isScoringComplete(session: Session): boolean {
  return session.solutions
    .filter((sol) => !isSolutionEliminated(session, sol.id).eliminated)
    .every((sol) => solutionScore(session, sol.id).unknown === 0);
}
