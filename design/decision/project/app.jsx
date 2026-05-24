/* global React, ReactDOM, Presentation, Decision, DEFAULT_MD, DEFAULT_DEC,
   TweaksPanel, TweakSection, TweakRadio, TweakToggle, TweakSelect, useTweaks */
const { useState, useEffect, useRef, useCallback } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "layout": "table",
  "density": "comfy",
  "showRatings": true,
  "showTotals": true,
  "tabAccent": "ink"
}/*EDITMODE-END*/;

function Scaler({ children }) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    function fit() {
      const sx = window.innerWidth / 1920;
      const sy = window.innerHeight / 1080;
      setScale(Math.min(sx, sy));
    }
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return (
    <div id="stage">
      <div id="canvas" style={{ transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}

function App() {
  const [tab, setTab] = useState("presentation");
  const [md, setMd] = useState(DEFAULT_MD);
  const [slideIdx, setSlideIdx] = useState(0);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [dec, setDec] = useState(DEFAULT_DEC);
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // tab keyboard shortcut: 1 / 2
  useEffect(() => {
    function onKey(e) {
      if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (sourceOpen) return;
      if (e.key === "1") setTab("presentation");
      else if (e.key === "2") setTab("decision");
      else if ((e.key === "r" || e.key === "R") && tab === "decision") {
        setDec(d => ({ ...d, criteria: [...d.criteria, { id: "c" + Math.random().toString(36).slice(2, 8), name: "New criterion", tag: "TAG" }] }));
      } else if ((e.key === "c" || e.key === "C") && tab === "decision") {
        setDec(d => {
          const tag = `OPTION ${String.fromCharCode(65 + d.solutions.length)}`;
          return { ...d, solutions: [...d.solutions, { id: "s" + Math.random().toString(36).slice(2, 8), name: "New solution", tag }] };
        });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, sourceOpen]);

  const slidesCount = (md.split(/\n[\s]*---[\s]*\n/).length);
  const picked = dec.solutions.find(s => s.id === dec.pickedSolution);

  return (
    <Scaler>
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <span className="brand-dot" />
            <span>decision</span>
            <span className="brand-path">/ {dec.title.toLowerCase().replace(/\s+/g, "-")}</span>
          </div>
          <nav className="tabs" role="tablist">
            <button
              className="tab"
              role="tab"
              aria-selected={tab === "presentation"}
              onClick={() => setTab("presentation")}
              data-screen-label="01 Presentation"
            >
              Presentation
              <span className="count">{slidesCount}</span>
              <span className="kbd">1</span>
            </button>
            <button
              className="tab"
              role="tab"
              aria-selected={tab === "decision"}
              onClick={() => setTab("decision")}
              data-screen-label="02 Decision"
            >
              Decision
              <span className="count">{dec.criteria.length}×{dec.solutions.length}</span>
              <span className="kbd">2</span>
            </button>
          </nav>
          <div className="topbar-right">
            {picked ? (
              <span className="pill"><span className="dot" /> picked · {picked.name}</span>
            ) : (
              <span className="pill" style={{ color: "var(--ink-subtle)" }}>
                <span className="dot" style={{ background: "var(--ink-subtle)" }} /> no decision yet
              </span>
            )}
            <span>v0.3.2</span>
          </div>
        </header>

        <main className="stage-body">
          <div style={{ display: tab === "presentation" ? "block" : "none", position: "absolute", inset: 0 }} data-screen-label="01 Presentation">
            <Presentation
              md={md}
              setMd={setMd}
              slideIdx={slideIdx}
              setSlideIdx={setSlideIdx}
              sourceOpen={sourceOpen}
              setSourceOpen={setSourceOpen}
            />
          </div>
          <div style={{ display: tab === "decision" ? "block" : "none", position: "absolute", inset: 0 }} data-screen-label="02 Decision">
            <Decision dec={dec} setDec={setDec} tweaks={tweaks} />
          </div>
        </main>
      </div>

      <TweaksPanel>
        <TweakSection label="Decision table" />
        <TweakRadio
          label="Layout"
          value={tweaks.layout}
          options={["table", "cards"]}
          onChange={(v) => setTweak("layout", v)}
        />
        <TweakRadio
          label="Density"
          value={tweaks.density}
          options={["compact", "comfy"]}
          onChange={(v) => setTweak("density", v)}
        />
        <TweakToggle
          label="Star ratings"
          value={tweaks.showRatings}
          onChange={(v) => setTweak("showRatings", v)}
        />
        <TweakToggle
          label="Totals row"
          value={tweaks.showTotals}
          onChange={(v) => setTweak("showTotals", v)}
        />
      </TweaksPanel>
    </Scaler>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
