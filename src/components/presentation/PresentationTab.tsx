import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useDecisionStore } from "@/store/useDecisionStore";
import { SlideRenderer } from "./SlideRenderer";
import { cn } from "@/lib/utils";
import { getDecisionsDir } from "@/lib/sessions";

type DeckItem =
  | { kind: "slide"; id: string; title: string }
  | { kind: "solution"; id: string; title: string };

export function PresentationTab() {
  const session = useDecisionStore((s) => s.session);
  const presenting = useDecisionStore((s) => s.presenting);
  const renameSlide = useDecisionStore((s) => s.renameSlide);
  const setSlideBody = useDecisionStore((s) => s.setSlideBody);
  const setSlideLayout = useDecisionStore((s) => s.setSlideLayout);
  const addSlide = useDecisionStore((s) => s.addSlide);
  const removeSlide = useDecisionStore((s) => s.removeSlide);
  const removeSolution = useDecisionStore((s) => s.removeSolution);
  const setSolutionFullBody = useDecisionStore((s) => s.setSolutionFullBody);
  const setSolutionLayout = useDecisionStore((s) => s.setSolutionLayout);
  const renameSolution = useDecisionStore((s) => s.renameSolution);
  const addSolution = useDecisionStore((s) => s.addSolution);
  const [idx, setIdx] = useState(0);
  const [baseDir, setBaseDir] = useState<string | undefined>(undefined);

  useEffect(() => {
    void getDecisionsDir()
      .then(setBaseDir)
      .catch(() => undefined);
  }, []);

  const deck = useMemo<DeckItem[]>(() => {
    if (!session) return [];
    return [
      ...session.slides.map<DeckItem>((sl) => ({ kind: "slide", id: sl.id, title: sl.title })),
      ...session.solutions.map<DeckItem>((sol) => ({
        kind: "solution",
        id: sol.id,
        title: sol.name,
      })),
    ];
  }, [session]);

  useEffect(() => {
    if (idx >= deck.length) setIdx(Math.max(0, deck.length - 1));
  }, [deck.length, idx]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        setIdx((i) => Math.min(i + 1, deck.length - 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setIdx((i) => Math.max(i - 1, 0));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deck.length]);

  if (!session) return null;
  if (deck.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-12 text-center text-neutral-500">
        <div>
          <p className="mb-4">No slides yet.</p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={addSlide}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-100"
            >
              + Slide
            </button>
            <button
              onClick={addSolution}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-100"
            >
              + Solution
            </button>
          </div>
        </div>
      </div>
    );
  }

  const current = deck[Math.min(idx, deck.length - 1)];

  return (
    // grid-rows-[1fr] pins the row to the available height so a tall solution
    // body can't push the prev/next footer off-screen — ScaledSlide will shrink
    // the content instead.
    <div
      className={cn(
        "grid h-full grid-rows-[1fr]",
        presenting ? "grid-cols-1" : "grid-cols-[280px_1fr]"
      )}
    >
      {!presenting && (
        <aside className="flex flex-col border-r border-neutral-200 bg-white">
          <div className="border-b border-neutral-200 px-4 py-3">
            <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
              Outline · {session.slides.length} slides · {session.solutions.length} solutions
            </div>
          </div>
          <ul className="flex-1 overflow-auto p-3">
            {deck.map((item, i) => (
              <li key={`${item.kind}-${item.id}`} className="group relative mb-2">
                <button
                  onClick={() => setIdx(i)}
                  aria-current={i === idx}
                  className={cn(
                    "grid w-full grid-cols-[28px_1fr] items-start gap-2 rounded-md border p-3 pr-8 text-left text-sm",
                    i === idx
                      ? "border-neutral-900 bg-white shadow-[inset_0_0_0_1px_#0a0a0a]"
                      : "border-neutral-200 bg-white hover:bg-neutral-50"
                  )}
                >
                  <span className="pt-0.5 font-mono text-xs text-neutral-400">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {item.kind === "solution" && (
                      <span className="rounded bg-neutral-100 px-1 font-mono text-[9px] uppercase tracking-wider text-neutral-500">
                        sol
                      </span>
                    )}
                    <span className="font-medium text-neutral-900">{item.title}</span>
                  </span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (item.kind === "slide") removeSlide(item.id);
                    else removeSolution(item.id);
                  }}
                  title={`Delete ${item.kind}`}
                  className="absolute right-2 top-2 hidden h-6 w-6 items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-red-600 group-hover:flex"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-2 gap-2 border-t border-neutral-200 p-3">
            <button
              onClick={addSlide}
              className="rounded-md border border-dashed border-neutral-300 px-3 py-2 font-mono text-xs text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
            >
              + Slide
            </button>
            <button
              onClick={addSolution}
              className="rounded-md border border-dashed border-neutral-300 px-3 py-2 font-mono text-xs text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
            >
              + Solution
            </button>
          </div>
        </aside>
      )}
      <section className="relative flex min-h-0 flex-col bg-neutral-50">
        <div className="min-h-0 flex-1 overflow-hidden">
          {current.kind === "slide"
            ? (() => {
                const sl = session.slides.find((x) => x.id === current.id);
                if (!sl) return null;
                return (
                  <SlideRenderer
                    title={sl.title}
                    body={sl.body}
                    layout={sl.layout}
                    baseDir={baseDir}
                    slug={session.meta.slug}
                    onTitleChange={(t) => renameSlide(sl.id, t)}
                    onBodyChange={(md) => setSlideBody(sl.id, md)}
                    onLayoutChange={(l) => setSlideLayout(sl.id, l)}
                  />
                );
              })()
            : (() => {
                const sol = session.solutions.find((s) => s.id === current.id);
                if (!sol) return null;
                return (
                  <SlideRenderer
                    title={sol.name}
                    body={sol.description}
                    pros={sol.pros}
                    cons={sol.cons}
                    layout={sol.layout}
                    baseDir={baseDir}
                    slug={session.meta.slug}
                    onTitleChange={(n) => renameSolution(sol.id, n)}
                    onBodyChange={(md) => setSolutionFullBody(sol.id, md)}
                    onLayoutChange={(l) => setSolutionLayout(sol.id, l)}
                  />
                );
              })()}
        </div>

        <footer className="flex items-center gap-3 border-t border-neutral-200 bg-white px-6 py-3">
          <button
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-100 disabled:opacity-40"
            onClick={() => setIdx((i) => Math.max(i - 1, 0))}
            disabled={idx === 0}
          >
            ← Prev
          </button>
          <span className="font-mono text-xs text-neutral-500">
            {String(idx + 1).padStart(2, "0")} / {String(deck.length).padStart(2, "0")}
          </span>
          <div className="mx-2 h-1 flex-1 overflow-hidden rounded-full bg-neutral-200">
            <div
              className="h-full bg-neutral-900 transition-[width]"
              style={{ width: `${((idx + 1) / deck.length) * 100}%` }}
            />
          </div>
          <button
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-800 disabled:opacity-40"
            onClick={() => setIdx((i) => Math.min(i + 1, deck.length - 1))}
            disabled={idx === deck.length - 1}
          >
            Next →
          </button>
        </footer>
      </section>
    </div>
  );
}
