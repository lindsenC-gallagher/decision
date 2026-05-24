// Produce HistoryEntry one-liners by diffing two Session snapshots.
//
// Scope per the schema: the `## History` section lives under `# Decision`, so
// only Decision-side changes are logged. Slide content edits and solution
// rename/add/remove (which live under `# Presentation`) are intentionally
// not surfaced. Score cell flips for surviving (solution, criterion) pairs
// are tracked because the Scores table itself is a Decision-side section.

import type { HistoryEntry, Session, ScoreValue } from "@shared/types/session";

const GLYPH: Record<ScoreValue, string> = { yes: "✓", no: "✗", unknown: "?" };

function getScore(s: Session, criterionId: string, solutionId: string): ScoreValue {
  return (
    s.scores.find((sc) => sc.criterionId === criterionId && sc.solutionId === solutionId)?.value ??
    "unknown"
  );
}

export function diffSessions(prev: Session, next: Session): HistoryEntry[] {
  const timestamp = new Date().toISOString();
  const msgs: string[] = [];

  // Frontmatter metadata (status + title) — treated as decision context.
  if (prev.meta.status !== next.meta.status) {
    msgs.push(`Status: ${prev.meta.status} → ${next.meta.status}`);
  }
  if (prev.meta.title !== next.meta.title) {
    msgs.push(`Renamed session: "${prev.meta.title}" → "${next.meta.title}"`);
  }

  // Picked solution (the chosen outcome).
  if (prev.pickedSolution !== next.pickedSolution) {
    if (next.pickedSolution) {
      const sol = next.solutions.find((s) => s.id === next.pickedSolution);
      msgs.push(`Picked solution: ${sol?.name ?? next.pickedSolution}`);
    } else {
      const prevSol = prev.solutions.find((s) => s.id === prev.pickedSolution);
      msgs.push(`Unpicked solution: ${prevSol?.name ?? prev.pickedSolution}`);
    }
  }

  // Criteria (## Criteria).
  const prevCrit = new Map(prev.criteria.map((c) => [c.id, c]));
  const nextCrit = new Map(next.criteria.map((c) => [c.id, c]));
  for (const [id, c] of nextCrit) {
    const old = prevCrit.get(id);
    if (!old) {
      msgs.push(`Added criterion ${id}: ${c.name}${c.contested ? " (contested)" : ""}`);
    } else {
      if (old.name !== c.name) msgs.push(`Renamed ${id}: ${old.name} → ${c.name}`);
      if (old.type !== c.type) msgs.push(`Changed ${id} type: ${old.type} → ${c.type}`);
      if (old.contested !== c.contested)
        msgs.push(`${c.contested ? "Marked" : "Unmarked"} ${id} as contested`);
    }
  }
  for (const [id, old] of prevCrit) {
    if (!nextCrit.has(id)) msgs.push(`Removed criterion ${id}: ${old.name}`);
  }

  // Decision body (## Decision).
  if (prev.decision.trim() !== next.decision.trim()) {
    msgs.push("Edited decision summary");
  }

  // Score cell flips for solutions/criteria that exist in both snapshots.
  const prevSols = new Map(prev.solutions.map((s) => [s.id, s]));
  const nextSols = new Map(next.solutions.map((s) => [s.id, s]));
  const sharedSols = new Set([...prevSols.keys()].filter((id) => nextSols.has(id)));
  const sharedCrit = new Set([...prevCrit.keys()].filter((id) => nextCrit.has(id)));
  for (const cid of sharedCrit) {
    for (const sid of sharedSols) {
      const a = getScore(prev, cid, sid);
      const b = getScore(next, cid, sid);
      if (a !== b) {
        const sol = next.solutions.find((s) => s.id === sid)!;
        msgs.push(`Set score (${sol.name}, ${cid}): ${GLYPH[a]} → ${GLYPH[b]}`);
      }
    }
  }

  return msgs.map((message) => ({ timestamp, message }));
}
