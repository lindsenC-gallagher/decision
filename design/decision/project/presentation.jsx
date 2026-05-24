/* global React, marked */
const { useState, useEffect, useMemo, useRef, useCallback } = React;

const DEFAULT_MD = `# State Management for the New Editor

A decision doc for the team — Q2 2026.
We need to pick a state-management approach for the canvas editor before kick-off.

---

## What we're solving

The current editor leans on prop drilling and a few ad-hoc context providers. As we add multiplayer cursors, autosave, and undo/redo, the seams are showing.

- Re-renders cascading through unrelated subtrees
- Undo state interleaving with collab patches
- Devtools blind to where state actually lives
- New contributors can't trace a change from event to render

> If you can't draw the data flow on a whiteboard in under 60 seconds, ship a different abstraction.

---

## The candidates

Three options on the table, each with a small spike already in main:

1. **Zustand** — atomic, hooks-first, tiny API
2. **Redux Toolkit** — boring, batteries-included, time-travel
3. **Jotai** — atomic primitives, fine-grained reactivity

We're evaluating across cost, fit for collab, devtools, and team familiarity. The decision tab has the scoring.

\`\`\`ts
// what the API should feel like, regardless of pick
const sel = useSelection();
selection.move({ dx: 10, dy: 0 });
// no extra hops, no boilerplate
\`\`\`

---

## Next steps

Switch to the **Decision** tab to see the scoring grid. Mark a winner, then we'll:

- Stub the chosen store in \`packages/editor-state\`
- Migrate \`Selection\` and \`Viewport\` first (smallest surface)
- Set a 2-week migration budget for \`Document\`

*Discussion at standup, Thursday.*
`;

function parseSlides(md) {
  // Split on lines that are exactly --- (horizontal rule used as slide break)
  const parts = md.split(/\n[\s]*---[\s]*\n/);
  return parts.map((src, i) => {
    const trimmed = src.trim();
    const firstHeading = trimmed.match(/^#{1,3}\s+(.+)$/m);
    const title = firstHeading ? firstHeading[1].trim() : `Slide ${i + 1}`;
    // First non-heading paragraph for subtitle
    const lines = trimmed.split("\n");
    let sub = "";
    let foundHead = false;
    for (const ln of lines) {
      if (/^#{1,3}\s/.test(ln)) { foundHead = true; continue; }
      if (foundHead && ln.trim() && !/^[#>\-*\d]/.test(ln.trim())) {
        sub = ln.trim();
        break;
      }
    }
    return { src: trimmed, title, sub };
  });
}

function renderMarkdown(src) {
  if (typeof marked === "undefined") return src;
  marked.setOptions({ breaks: false, gfm: true });
  return marked.parse(src);
}

function Presentation({ md, setMd, slideIdx, setSlideIdx, sourceOpen, setSourceOpen }) {
  const slides = useMemo(() => parseSlides(md), [md]);
  const total = slides.length;
  const idx = Math.min(slideIdx, total - 1);
  const current = slides[idx] || { src: "", title: "", sub: "" };

  const next = () => setSlideIdx(i => Math.min(i + 1, total - 1));
  const prev = () => setSlideIdx(i => Math.max(i - 1, 0));

  // keyboard
  useEffect(() => {
    function onKey(e) {
      if (sourceOpen) return;
      if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); prev(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total, sourceOpen]);

  const html = useMemo(() => renderMarkdown(current.src), [current.src]);

  return (
    <div className="pres-shell">
      <div className="slide-area">
        <div className="slide-frame">
          <div className="slide-inner">
            <div
              className="slide-content"
              dangerouslySetInnerHTML={{ __html: html }}
            />
            <div className="slide-meta">
              {String(idx + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </div>
          </div>
        </div>
      </div>

      <div className="pres-footer">
        <button className="btn ghost" onClick={prev} disabled={idx === 0}>
          ← Prev
        </button>
        <div className="pres-counter">{idx + 1} of {total}</div>
        <div className="pres-progress"><div style={{ width: `${((idx + 1) / total) * 100}%` }} /></div>
        <button className="btn ghost" onClick={() => setSourceOpen(true)} title="Edit markdown">
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{ }</span>
          edit source
        </button>
        <button className="btn primary" onClick={next} disabled={idx === total - 1}>
          Next →
        </button>
      </div>

      <aside className="outline">
        <div className="outline-head">
          <div className="outline-title">Outline · {total} slides</div>
          <button
            className="btn ghost"
            onClick={() => setSourceOpen(true)}
            style={{ padding: "4px 8px", fontFamily: "var(--font-mono)", fontSize: 12 }}
          >
            slides.md
          </button>
        </div>
        <div className="outline-list">
          {slides.map((s, i) => (
            <button
              key={i}
              className="outline-item"
              aria-current={i === idx}
              onClick={() => setSlideIdx(i)}
            >
              <div className="outline-num">{String(i + 1).padStart(2, "0")}</div>
              <div>
                <div className="outline-text">{s.title}</div>
                {s.sub && <div className="outline-sub">{s.sub}</div>}
              </div>
            </button>
          ))}
        </div>
        <div className="source-toggle">
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-muted)" }}>
            Source · markdown
          </span>
          <div style={{ marginLeft: "auto" }}>
            <button className="btn" onClick={() => setSourceOpen(true)}>Edit ⌘E</button>
          </div>
        </div>
      </aside>

      {sourceOpen && (
        <SourceDrawer md={md} setMd={setMd} onClose={() => setSourceOpen(false)} />
      )}
    </div>
  );
}

function SourceDrawer({ md, setMd, onClose }) {
  const [draft, setDraft] = useState(md);
  const taRef = useRef(null);
  useEffect(() => { if (taRef.current) taRef.current.focus(); }, []);
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className="source-drawer" onClick={onClose}>
      <div className="source-panel" onClick={(e) => e.stopPropagation()}>
        <div className="source-head">
          <h3>slides.md</h3>
          <span className="hint">Separate slides with <code style={{ fontFamily: "var(--font-mono)" }}>---</code> on its own line</span>
        </div>
        <textarea
          ref={taRef}
          className="source-ta"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          spellCheck={false}
        />
        <div className="source-foot">
          <span className="hint" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-muted)" }}>
            {draft.split(/\n[\s]*---[\s]*\n/).length} slides · {draft.length} chars
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={onClose}>Cancel</button>
            <button
              className="btn primary"
              onClick={() => { setMd(draft); onClose(); }}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.Presentation = Presentation;
window.DEFAULT_MD = DEFAULT_MD;
