import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  useDecisionStore,
  getScore,
  isSolutionEliminated,
  solutionScore,
  recommendation,
  isScoringComplete,
} from "@/store/useDecisionStore";
import type { ScoreValue, CriterionType, Solution } from "@shared/types/session";

const NEXT_VALUE: Record<ScoreValue, ScoreValue> = {
  unknown: "yes",
  yes: "no",
  no: "unknown",
};

const VALUE_GLYPH: Record<ScoreValue, string> = { yes: "✓", no: "✗", unknown: "?" };

export function DecisionTab() {
  const session = useDecisionStore((s) => s.session);
  const revealed = useDecisionStore((s) => s.revealed);
  const toggleReveal = useDecisionStore((s) => s.toggleReveal);
  const addCriterion = useDecisionStore((s) => s.addCriterion);
  const removeCriterion = useDecisionStore((s) => s.removeCriterion);
  const renameCriterion = useDecisionStore((s) => s.renameCriterion);
  const setCriterionType = useDecisionStore((s) => s.setCriterionType);
  const setCriterionContested = useDecisionStore((s) => s.setCriterionContested);
  const addSolution = useDecisionStore((s) => s.addSolution);
  const removeSolution = useDecisionStore((s) => s.removeSolution);
  const renameSolution = useDecisionStore((s) => s.renameSolution);
  const pickSolution = useDecisionStore((s) => s.pickSolution);
  const setScore = useDecisionStore((s) => s.setScore);

  const [layout, setLayout] = useState<"table" | "cards">("table");

  if (!session) return null;

  const sortedCriteria = [...session.criteria].sort((a, b) =>
    a.contested === b.contested ? 0 : a.contested ? 1 : -1
  );

  // Solutions order: when revealed, survivors first (by score desc, ties by
  // declaration), then a divider, then eliminated. When hidden, keep
  // declaration order to avoid live-scoring jitter (FR-dec-12 adapted).
  const sortedSolutions: Array<Solution & { _eliminated: boolean }> = (() => {
    const decorated = session.solutions.map((sol) => ({
      ...sol,
      _eliminated: isSolutionEliminated(session, sol.id).eliminated,
    }));
    if (!revealed) return decorated;
    const survivors = decorated.filter((s) => !s._eliminated);
    const eliminated = decorated.filter((s) => s._eliminated);
    survivors.sort(
      (a, b) => solutionScore(session, b.id).score - solutionScore(session, a.id).score
    );
    return [...survivors, ...eliminated];
  })();
  const survivorBoundary = revealed ? sortedSolutions.findIndex((s) => s._eliminated) : -1;

  const rec = revealed && isScoringComplete(session) ? recommendation(session) : null;

  return (
    <div className="h-full overflow-auto px-8 py-6">
      {rec && (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900">
          <span className="font-medium">Recommendation:</span>{" "}
          {session.solutions.find((s) => s.id === rec.id)?.name} ({rec.score}/{rec.maxScore})
        </div>
      )}

      {/* Criteria editor */}
      <section className="mb-6 rounded-lg border border-neutral-200 bg-white">
        <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-2">
          <h2 className="font-mono text-xs uppercase tracking-wider text-neutral-500">
            Criteria · {session.criteria.length}
          </h2>
          <button
            onClick={addCriterion}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-sm hover:bg-neutral-100"
          >
            + Criterion
          </button>
        </header>
        {session.criteria.length === 0 ? (
          <p className="px-4 py-6 text-sm text-neutral-500">
            No criteria yet. Add at least one to start scoring.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left font-mono text-[11px] uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="w-16 px-3 py-2">ID</th>
                <th className="px-3 py-2">Name</th>
                <th className="w-32 px-3 py-2">Type</th>
                <th className="w-32 px-3 py-2">Contested</th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {sortedCriteria.map((c) => (
                <tr key={c.id} className="border-t border-neutral-200">
                  <td className="px-3 py-2 font-mono text-xs text-neutral-500">{c.id}</td>
                  <td className="px-3 py-2">
                    <input
                      value={c.name}
                      onChange={(e) => renameCriterion(c.id, e.target.value)}
                      className="w-full bg-transparent outline-none focus:underline focus:decoration-neutral-300"
                      spellCheck={false}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={c.type}
                      onChange={(e) => setCriterionType(c.id, e.target.value as CriterionType)}
                      className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
                    >
                      <option value="Required">Required</option>
                      <option value="Preferred">Preferred</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={c.contested}
                        onChange={(e) => setCriterionContested(c.id, e.target.checked)}
                      />
                      {c.contested && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-800">
                          contested
                        </span>
                      )}
                    </label>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => removeCriterion(c.id)}
                      className="text-neutral-400 hover:text-neutral-900"
                      title="Remove criterion"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Scoring matrix */}
      <section className="mb-6 rounded-lg border border-neutral-200 bg-white">
        <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-2">
          <h2 className="font-mono text-xs uppercase tracking-wider text-neutral-500">
            Scoring · {sortedCriteria.length} criteria × {session.solutions.length} solutions
          </h2>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-neutral-300 bg-white p-0.5 text-xs">
              <button
                onClick={() => setLayout("table")}
                className={cn(
                  "rounded px-2 py-0.5",
                  layout === "table" ? "bg-neutral-900 text-white" : "text-neutral-600"
                )}
              >
                Table
              </button>
              <button
                onClick={() => setLayout("cards")}
                className={cn(
                  "rounded px-2 py-0.5",
                  layout === "cards" ? "bg-neutral-900 text-white" : "text-neutral-600"
                )}
              >
                Cards
              </button>
            </div>
            <button
              onClick={addSolution}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-sm hover:bg-neutral-100"
            >
              + Solution
            </button>
          </div>
        </header>
        {session.solutions.length === 0 || sortedCriteria.length === 0 ? (
          <p className="px-4 py-6 text-sm text-neutral-500">
            Add solutions and criteria to start scoring.
          </p>
        ) : layout === "table" ? (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-50">
                  <th className="sticky left-0 z-10 min-w-[200px] bg-neutral-50 px-3 py-2 text-left font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                    Criterion
                  </th>
                  {sortedSolutions.map((sol, colIdx) => {
                    const { eliminated, failingCriteria } = isSolutionEliminated(session, sol.id);
                    const showElim = revealed && eliminated;
                    const showPicked = revealed && session.pickedSolution === sol.id;
                    const dividerLeft =
                      revealed && colIdx === survivorBoundary && survivorBoundary > 0;
                    return (
                      <th
                        key={sol.id}
                        className={cn(
                          "min-w-[180px] cursor-pointer border-l border-neutral-200 px-3 py-2 text-left align-top",
                          dividerLeft && "border-l-4 border-l-neutral-300",
                          showElim && "bg-neutral-100 opacity-50",
                          showPicked && "bg-emerald-50"
                        )}
                        onClick={() => pickSolution(sol.id)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <input
                            value={sol.name}
                            onChange={(e) => renameSolution(sol.id, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className={cn(
                              "min-w-0 flex-1 bg-transparent font-semibold tracking-tight outline-none focus:underline focus:decoration-neutral-300",
                              showElim && "line-through"
                            )}
                            spellCheck={false}
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeSolution(sol.id);
                            }}
                            className="text-neutral-400 hover:text-neutral-900"
                            title="Remove solution"
                          >
                            ×
                          </button>
                        </div>
                        {showElim && (
                          <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-red-700">
                            Eliminated · {failingCriteria.join(", ")}
                          </div>
                        )}
                        {showPicked && !showElim && (
                          <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-emerald-700">
                            Picked
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sortedCriteria.map((c) => (
                  <tr key={c.id} className="border-t border-neutral-200">
                    <td className="sticky left-0 z-10 min-w-[200px] bg-white px-3 py-2 align-top">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-neutral-500">{c.id}</span>
                        <span className="font-medium">{c.name}</span>
                        {c.type === "Required" && (
                          <span className="rounded bg-red-50 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-red-700">
                            req
                          </span>
                        )}
                        {c.contested && (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-800">
                            contested
                          </span>
                        )}
                      </div>
                    </td>
                    {sortedSolutions.map((sol, colIdx) => {
                      const { eliminated } = isSolutionEliminated(session, sol.id);
                      const showElim = revealed && eliminated;
                      const showPicked = revealed && session.pickedSolution === sol.id;
                      const dividerLeft =
                        revealed && colIdx === survivorBoundary && survivorBoundary > 0;
                      const v = getScore(session, c.id, sol.id);
                      const pending = c.type === "Required" && v === "unknown";
                      return (
                        <td
                          key={sol.id}
                          className={cn(
                            "border-l border-neutral-200 p-0",
                            dividerLeft && "border-l-4 border-l-neutral-300",
                            showElim && "bg-neutral-100 opacity-50",
                            showPicked && "bg-emerald-50",
                            pending && !showElim && "bg-amber-50/50"
                          )}
                        >
                          <button
                            onClick={() => setScore(c.id, sol.id, NEXT_VALUE[v])}
                            className={cn(
                              "h-12 w-full text-center font-mono text-xl",
                              v === "yes" && "text-emerald-700",
                              v === "no" && "text-red-700",
                              v === "unknown" && (pending ? "text-amber-700" : "text-neutral-400")
                            )}
                            title={
                              pending
                                ? "Pending — Required criterion not yet evaluated"
                                : `${VALUE_GLYPH[v]} (click to cycle)`
                            }
                          >
                            {VALUE_GLYPH[v]}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {revealed && (
                  <tr className="border-t-2 border-neutral-300 bg-neutral-50">
                    <td className="sticky left-0 z-10 bg-neutral-50 px-3 py-2 font-mono text-xs uppercase tracking-wider text-neutral-500">
                      Score
                    </td>
                    {sortedSolutions.map((sol, colIdx) => {
                      const { eliminated } = isSolutionEliminated(session, sol.id);
                      const { score, maxScore, unknown } = solutionScore(session, sol.id);
                      const dividerLeft =
                        revealed && colIdx === survivorBoundary && survivorBoundary > 0;
                      const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
                      return (
                        <td
                          key={sol.id}
                          className={cn(
                            "border-l border-neutral-200 px-3 py-2",
                            dividerLeft && "border-l-4 border-l-neutral-300",
                            eliminated && "opacity-50"
                          )}
                        >
                          {eliminated ? (
                            <span className="font-mono text-xs text-red-700">eliminated</span>
                          ) : (
                            <div>
                              <span className="font-mono text-lg font-semibold">
                                {score} / {maxScore}
                                {unknown > 0 && (
                                  <span className="ml-1 text-xs text-neutral-500">
                                    ({unknown} unknown)
                                  </span>
                                )}
                              </span>
                              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-neutral-200">
                                <div
                                  className="h-full bg-neutral-900"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <CardsView
            sortedSolutions={sortedSolutions}
            sortedCriteria={sortedCriteria}
            survivorBoundary={survivorBoundary}
            onRenameSolution={renameSolution}
            onRemoveSolution={removeSolution}
            onPickSolution={pickSolution}
            onSetScore={setScore}
          />
        )}
      </section>

      {/* Decision summary + reveal button */}
      <section className="mb-6 rounded-lg border border-neutral-200 bg-white p-4">
        <header className="mb-2 flex items-center justify-between">
          <h2 className="font-mono text-xs uppercase tracking-wider text-neutral-500">Decision</h2>
          <button
            onClick={toggleReveal}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium",
              revealed
                ? "border border-neutral-300 bg-white hover:bg-neutral-100"
                : "bg-neutral-900 text-white hover:bg-neutral-800"
            )}
          >
            {revealed ? "Hide results" : "Reveal results"}
          </button>
        </header>
        {!revealed && (
          <p className="mb-3 rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
            — results hidden — press Reveal to view —
          </p>
        )}
        <DecisionEditor />
      </section>
    </div>
  );
}

function DecisionEditor() {
  const session = useDecisionStore((s) => s.session);
  const setDecisionText = useDecisionStore((s) => s.setDecisionText);
  if (!session) return null;
  return (
    <textarea
      value={session.decision}
      onChange={(e) => setDecisionText(e.target.value)}
      placeholder="What did we decide and why?"
      className="min-h-[120px] w-full rounded-md border border-neutral-300 bg-white p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
      spellCheck={false}
    />
  );
}

function CardsView({
  sortedSolutions,
  sortedCriteria,
  survivorBoundary,
  onRenameSolution,
  onRemoveSolution,
  onPickSolution,
  onSetScore,
}: {
  sortedSolutions: Array<Solution & { _eliminated: boolean }>;
  sortedCriteria: Array<import("@shared/types/session").Criterion>;
  survivorBoundary: number;
  onRenameSolution: (id: string, name: string) => void;
  onRemoveSolution: (id: string) => void;
  onPickSolution: (id: string) => void;
  onSetScore: (criterionId: string, solutionId: string, value: ScoreValue) => void;
}) {
  const session = useDecisionStore((s) => s.session);
  const revealed = useDecisionStore((s) => s.revealed);
  if (!session) return null;
  return (
    <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
      {sortedSolutions.map((sol, colIdx) => {
        const showElim = revealed && sol._eliminated;
        const showPicked = revealed && session.pickedSolution === sol.id;
        const showDividerHint = revealed && colIdx === survivorBoundary && survivorBoundary > 0;
        const { score, maxScore, unknown } = solutionScore(session, sol.id);
        return (
          <div
            key={sol.id}
            className={cn(
              "rounded-lg border bg-white p-4",
              showElim ? "border-neutral-200 opacity-60" : "border-neutral-200",
              showPicked && "border-emerald-300 ring-2 ring-emerald-200",
              showDividerHint && "mt-4 border-t-4 border-t-neutral-300"
            )}
          >
            <header className="mb-3 flex items-start justify-between gap-2">
              <input
                value={sol.name}
                onChange={(e) => onRenameSolution(sol.id, e.target.value)}
                className={cn(
                  "min-w-0 flex-1 bg-transparent text-lg font-semibold outline-none focus:underline focus:decoration-neutral-300",
                  showElim && "line-through"
                )}
                spellCheck={false}
              />
              <button
                onClick={() => onRemoveSolution(sol.id)}
                className="text-neutral-400 hover:text-neutral-900"
              >
                ×
              </button>
            </header>
            <ul className="mb-3 space-y-1.5 text-sm">
              {sortedCriteria.map((c) => {
                const v =
                  session.scores.find((sc) => sc.criterionId === c.id && sc.solutionId === sol.id)
                    ?.value ?? "unknown";
                const pending = c.type === "Required" && v === "unknown";
                return (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 truncate">
                      <span className="font-mono text-xs text-neutral-500">{c.id}</span>
                      <span className="truncate">{c.name}</span>
                      {c.type === "Required" && (
                        <span className="rounded bg-red-50 px-1 font-mono text-[10px] uppercase text-red-700">
                          req
                        </span>
                      )}
                    </span>
                    <button
                      onClick={() => onSetScore(c.id, sol.id, NEXT_VALUE[v])}
                      className={cn(
                        "rounded px-2 py-0.5 font-mono text-base",
                        v === "yes" && "bg-emerald-50 text-emerald-700",
                        v === "no" && "bg-red-50 text-red-700",
                        v === "unknown" &&
                          (pending ? "bg-amber-50 text-amber-700" : "text-neutral-400")
                      )}
                    >
                      {VALUE_GLYPH[v]}
                    </button>
                  </li>
                );
              })}
            </ul>
            <button
              onClick={() => onPickSolution(sol.id)}
              className={cn(
                "w-full rounded-md border px-3 py-2 text-xs",
                showPicked
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50"
              )}
            >
              {revealed
                ? showPicked
                  ? "✓ chosen solution"
                  : "pick as solution"
                : session.pickedSolution === sol.id
                  ? "marked (hidden until reveal)"
                  : "mark as choice"}
            </button>
            {revealed && !showElim && (
              <div className="mt-2 font-mono text-xs text-neutral-500">
                {score} / {maxScore}
                {unknown > 0 && <span className="ml-1">({unknown} unknown)</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
