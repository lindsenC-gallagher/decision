/* global React */
const { useState, useEffect, useMemo, useRef, useCallback } = React;

// Default fixture aligned with the presentation md
const DEFAULT_DEC = {
  title: "State management for the new editor",
  context: "Evaluated Q2 2026 · 3 candidates · 6 criteria",
  solutions: [
    { id: "s1", name: "Zustand", tag: "OPTION A" },
    { id: "s2", name: "Redux Toolkit", tag: "OPTION B" },
    { id: "s3", name: "Jotai", tag: "OPTION C" },
  ],
  criteria: [
    { id: "c1", name: "Bundle size impact", tag: "PERF" },
    { id: "c2", name: "Devtools & time-travel", tag: "DX" },
    { id: "c3", name: "Fit for collab patches", tag: "ARCHITECTURE" },
    { id: "c4", name: "Team familiarity", tag: "RISK" },
    { id: "c5", name: "TS ergonomics", tag: "DX" },
    { id: "c6", name: "Migration cost from current", tag: "EFFORT" },
  ],
  // cells keyed by `${criterionId}:${solutionId}`
  cells: {
    "c1:s1": { rating: 5, note: "≈ 1.2 KB gz. Negligible." },
    "c1:s2": { rating: 2, note: "RTK + middleware ~ 12 KB. Heavy for our budget." },
    "c1:s3": { rating: 4, note: "~ 3 KB gz. Tree-shakeable atoms." },

    "c2:s1": { rating: 3, note: "Redux DevTools adapter works, no built-in time-travel." },
    "c2:s2": { rating: 5, note: "First-class. Action log, jump-to-state, replay." },
    "c2:s3": { rating: 2, note: "Per-atom devtools, no global timeline." },

    "c3:s1": { rating: 4, note: "Single store fits Yjs/Loro patch model cleanly." },
    "c3:s2": { rating: 5, note: "Action-shaped patches map 1:1 to CRDT updates." },
    "c3:s3": { rating: 2, note: "Atom-per-entity fights coarse-grained collab ops." },

    "c4:s1": { rating: 4, note: "3 of 5 engineers shipped with it. Low ramp." },
    "c4:s2": { rating: 5, note: "Everyone knows Redux. Reducers are muscle memory." },
    "c4:s3": { rating: 2, note: "Only one engineer has used atoms in production." },

    "c5:s1": { rating: 4, note: "Inference is fine. Slice typing requires care." },
    "c5:s2": { rating: 5, note: "createSlice gives near-perfect inference." },
    "c5:s3": { rating: 5, note: "Atoms typed by their initial value. Clean." },

    "c6:s1": { rating: 4, note: "~ 1 week. Mostly replace contexts with stores." },
    "c6:s2": { rating: 2, note: "~ 3 weeks. Need to retrofit selectors everywhere." },
    "c6:s3": { rating: 3, note: "~ 2 weeks. Atom graph needs design first." },
  },
  pickedSolution: "s2",
};

function uid(prefix) { return prefix + Math.random().toString(36).slice(2, 8); }

function Stars({ value, onChange, max = 5, color }) {
  return (
    <div className="rating" role="radiogroup" aria-label="rating">
      {Array.from({ length: max }, (_, i) => (
        <button
          key={i}
          className={"rating-btn" + (i < value ? " on" : "")}
          onClick={(e) => { e.stopPropagation(); onChange(i + 1 === value ? 0 : i + 1); }}
          aria-checked={i < value}
          role="radio"
          tabIndex={-1}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 1.5l1.9 4.2 4.6.4-3.5 3 1.1 4.5L8 11.3l-4.1 2.3L5 9.1 1.5 6.1l4.6-.4L8 1.5z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

function CellEditor({ value, onChange, placeholder }) {
  const ref = useRef(null);
  const autosize = useCallback(() => {
    const el = ref.current; if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, []);
  useEffect(autosize, [value]);
  return (
    <textarea
      ref={ref}
      className="cell-edit"
      value={value}
      placeholder={placeholder}
      rows={1}
      onChange={(e) => { onChange(e.target.value); }}
      onInput={autosize}
      spellCheck={false}
    />
  );
}

function Decision({ dec, setDec, tweaks, revealed, setRevealed }) {
  const setCell = (cid, sid, patch) => {
    setDec(d => ({
      ...d,
      cells: { ...d.cells, [`${cid}:${sid}`]: { ...(d.cells[`${cid}:${sid}`] || { rating: 0, note: "" }), ...patch } },
    }));
  };

  const addCriterion = () => {
    setDec(d => ({
      ...d,
      criteria: [...d.criteria, { id: uid("c"), name: "New criterion", tag: "TAG" }],
    }));
  };
  const removeCriterion = (cid) => {
    setDec(d => ({
      ...d,
      criteria: d.criteria.filter(c => c.id !== cid),
      cells: Object.fromEntries(Object.entries(d.cells).filter(([k]) => !k.startsWith(cid + ":"))),
    }));
  };
  const renameCriterion = (cid, name) => {
    setDec(d => ({ ...d, criteria: d.criteria.map(c => c.id === cid ? { ...c, name } : c) }));
  };

  const addSolution = () => {
    setDec(d => {
      const tag = `OPTION ${String.fromCharCode(65 + d.solutions.length)}`;
      return { ...d, solutions: [...d.solutions, { id: uid("s"), name: "New solution", tag }] };
    });
  };
  const removeSolution = (sid) => {
    setDec(d => ({
      ...d,
      solutions: d.solutions.filter(s => s.id !== sid),
      cells: Object.fromEntries(Object.entries(d.cells).filter(([k]) => !k.endsWith(":" + sid))),
      pickedSolution: d.pickedSolution === sid ? null : d.pickedSolution,
    }));
  };
  const renameSolution = (sid, name) => {
    setDec(d => ({ ...d, solutions: d.solutions.map(s => s.id === sid ? { ...s, name } : s) }));
  };
  const pickSolution = (sid) => {
    setDec(d => ({ ...d, pickedSolution: d.pickedSolution === sid ? null : sid }));
  };

  const totals = useMemo(() => {
    const out = {};
    dec.solutions.forEach(s => {
      let sum = 0;
      dec.criteria.forEach(c => { sum += (dec.cells[`${c.id}:${s.id}`]?.rating || 0); });
      out[s.id] = sum;
    });
    return out;
  }, [dec]);
  const maxPossible = dec.criteria.length * 5;

  const picked = dec.solutions.find(s => s.id === dec.pickedSolution);

  const isCardLayout = tweaks.layout === "cards";

  return (
    <div className="dec-shell" data-density={tweaks.density}>
      <header className="dec-header">
        <div>
          <div className="dec-eyebrow">
            <span>Decision</span>
            <span className="sep">/</span>
            <span>{dec.criteria.length} criteria × {dec.solutions.length} solutions</span>
            <span className="sep">/</span>
            <span>{dec.context.split("·")[0].trim()}</span>
          </div>
          <h1 className="dec-title">
            <input
              value={dec.title}
              onChange={(e) => setDec(d => ({ ...d, title: e.target.value }))}
              spellCheck={false}
            />
          </h1>
        </div>
        <div className="dec-summary">
          <span><b>{dec.criteria.length}</b> criteria</span>
          <span><b>{dec.solutions.length}</b> solutions</span>
          <span><b>{Object.values(dec.cells).filter(c => c.note).length}</b> notes</span>
        </div>
      </header>

      {isCardLayout ? (
        <CardLayout
          dec={dec}
          setCell={setCell}
          renameSolution={renameSolution}
          removeSolution={removeSolution}
          pickSolution={pickSolution}
          totals={totals}
          maxPossible={maxPossible}
          tweaks={tweaks}
          revealed={revealed}
        />
      ) : (
        <TableLayout
          dec={dec}
          setCell={setCell}
          renameSolution={renameSolution}
          removeSolution={removeSolution}
          pickSolution={pickSolution}
          renameCriterion={renameCriterion}
          removeCriterion={removeCriterion}
          addCriterion={addCriterion}
          addSolution={addSolution}
          totals={totals}
          maxPossible={maxPossible}
          tweaks={tweaks}
          revealed={revealed}
        />
      )}

      <footer className="dec-footer">
        <div className="dec-decision">
          <span className="label">Decision</span>
          {!revealed ? (
            <span className="chosen empty">— results hidden — press Reveal to view —</span>
          ) : picked ? (
            <span className="chosen">✓ {picked.name}</span>
          ) : (
            <span className="chosen empty">— click a solution to pick a winner —</span>
          )}
          {revealed && picked && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--ink-muted)" }}>
              score {totals[picked.id]}/{maxPossible}
            </span>
          )}
          <button
            className={"btn" + (revealed ? "" : " primary")}
            onClick={() => setRevealed(!revealed)}
            style={{ marginLeft: 16 }}
          >
            {revealed ? "Hide results" : "Reveal results"}
          </button>
        </div>
        <div className="dec-shortcuts">
          <span><b>1</b> presentation</span>
          <span><b>2</b> decision</span>
          <span><b>R</b> add row</span>
          <span><b>C</b> add column</span>
        </div>
      </footer>
    </div>
  );
}

function TableLayout({
  dec, setCell, renameSolution, removeSolution, pickSolution,
  renameCriterion, removeCriterion, addCriterion, addSolution,
  totals, maxPossible, tweaks, revealed
}) {
  return (
    <div className="dec-table-wrap">
      <div className="dec-toolbar">
        <span className="meta">criteria.csv</span>
        <span className="grow" />
        <span className="meta">density · {tweaks.density}</span>
        <button className="btn" onClick={addCriterion}>＋ Criterion</button>
        <button className="btn" onClick={addSolution}>＋ Solution</button>
      </div>
      <div className="dec-table">
        <table>
          <thead>
            <tr>
              <th>
                <div className="row-head" style={{ paddingLeft: 22 }}>
                  <div className="row-tag">CRITERIA ↓</div>
                  <div className="row-name" style={{ color: "var(--ink-muted)", fontWeight: 500 }}>
                    Solutions →
                  </div>
                </div>
              </th>
              {dec.solutions.map(sol => (
                <th key={sol.id}>
                  <div className="col-head" data-picked={revealed && dec.pickedSolution === sol.id} onClick={() => pickSolution(sol.id)}>
                    <button
                      className="col-rm"
                      title="Remove solution"
                      onClick={(e) => { e.stopPropagation(); removeSolution(sol.id); }}
                    >×</button>
                    <div className="col-tag">{sol.tag}{revealed ? ` · ${totals[sol.id]}/${maxPossible}` : ""}</div>
                    <div className="col-name">
                      <input
                        value={sol.name}
                        onChange={(e) => renameSolution(sol.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        spellCheck={false}
                      />
                    </div>
                    <span
                      className="pick"
                      title={dec.pickedSolution === sol.id ? (revealed ? "Picked" : "Marked (hidden until reveal)") : "Pick this"}
                      onClick={(e) => { e.stopPropagation(); pickSolution(sol.id); }}
                    />
                  </div>
                </th>
              ))}
              <th style={{ width: 200 }}>
                <button className="add-col" style={{ width: "100%", height: "100%", border: 0, padding: 16 }} onClick={addSolution}>
                  ＋ Add solution
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {dec.criteria.map(cr => (
              <tr key={cr.id}>
                <td>
                  <div className="row-head">
                    <div className="row-tag">{cr.tag}</div>
                    <div className="row-name">
                      <input
                        value={cr.name}
                        onChange={(e) => renameCriterion(cr.id, e.target.value)}
                        spellCheck={false}
                      />
                    </div>
                    <button className="row-rm" onClick={() => removeCriterion(cr.id)} title="Remove">×</button>
                  </div>
                </td>
                {dec.solutions.map(sol => {
                  const cell = dec.cells[`${cr.id}:${sol.id}`] || { rating: 0, note: "" };
                  return (
                    <td key={sol.id}>
                      <div className={"dec-cell" + (revealed && dec.pickedSolution === sol.id ? " picked-col" : "")}>
                        {tweaks.showRatings && (
                          <Stars
                            value={cell.rating}
                            onChange={(v) => setCell(cr.id, sol.id, { rating: v })}
                          />
                        )}
                        <CellEditor
                          value={cell.note}
                          onChange={(v) => setCell(cr.id, sol.id, { note: v })}
                          placeholder="—"
                        />
                      </div>
                    </td>
                  );
                })}
                <td style={{ background: "var(--surface-2)" }} />
              </tr>
            ))}
            {revealed && tweaks.showTotals && (
              <tr>
                <td>
                  <div className="row-head" style={{ background: "var(--surface-2)" }}>
                    <div className="row-tag">SCORE</div>
                    <div className="row-name" style={{ fontFamily: "var(--font-mono)", fontSize: 14 }}>
                      Σ rating / {maxPossible}
                    </div>
                  </div>
                </td>
                {dec.solutions.map(sol => (
                  <td key={sol.id} style={{ background: dec.pickedSolution === sol.id ? "var(--accent-soft)" : "var(--surface-2)" }}>
                    <div className="dec-cell" style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 600, color: dec.pickedSolution === sol.id ? "var(--accent)" : "var(--ink)" }}>
                        {totals[sol.id]}
                      </span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--ink-muted)" }}>
                        / {maxPossible}
                      </span>
                    </div>
                  </td>
                ))}
                <td style={{ background: "var(--surface-2)" }} />
              </tr>
            )}
            <tr>
              <td colSpan={dec.solutions.length + 2} style={{ padding: 0 }}>
                <button className="add-row" onClick={addCriterion}>＋ Add criterion</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CardLayout({ dec, setCell, renameSolution, removeSolution, pickSolution, totals, maxPossible, tweaks, revealed }) {
  return (
    <div className="dec-table-wrap">
      <div className="dec-toolbar">
        <span className="meta">card view · {dec.solutions.length} solutions</span>
        <span className="grow" />
      </div>
      <div className="dec-cards">
        {dec.solutions.map(sol => (
          <div key={sol.id} className="dec-card" data-picked={revealed && dec.pickedSolution === sol.id}>
            <div className="card-head">
              <div>
                <div className="card-tag">{sol.tag}{revealed ? ` · ${totals[sol.id]}/${maxPossible}` : ""}</div>
                <div className="card-name">
                  <input
                    value={sol.name}
                    onChange={(e) => renameSolution(sol.id, e.target.value)}
                    spellCheck={false}
                    style={{ background: "transparent", border: 0, outline: "none", font: "inherit", color: "inherit", width: "100%", padding: 0 }}
                  />
                </div>
              </div>
              <button
                onClick={() => removeSolution(sol.id)}
                style={{ background: "transparent", border: 0, color: "var(--ink-subtle)", fontFamily: "var(--font-mono)", fontSize: 16, cursor: "pointer" }}
                title="Remove"
              >×</button>
            </div>
            <div className="card-rows">
              {dec.criteria.map(cr => {
                const cell = dec.cells[`${cr.id}:${sol.id}`] || { rating: 0, note: "" };
                return (
                  <div key={cr.id} className="card-row">
                    <div className="card-criterion">{cr.name}</div>
                    <div className="card-value">
                      {tweaks.showRatings && (
                        <Stars value={cell.rating} onChange={(v) => setCell(cr.id, sol.id, { rating: v })} />
                      )}
                      <CellEditor value={cell.note} onChange={(v) => setCell(cr.id, sol.id, { note: v })} placeholder="—" />
                    </div>
                  </div>
                );
              })}
            </div>
            <button className="card-pick" onClick={() => pickSolution(sol.id)}>
              {revealed
                ? (dec.pickedSolution === sol.id ? "✓ chosen solution" : "pick as solution")
                : (dec.pickedSolution === sol.id ? "marked (hidden until reveal)" : "mark as choice")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

window.Decision = Decision;
window.DEFAULT_DEC = DEFAULT_DEC;
