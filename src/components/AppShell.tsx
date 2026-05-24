import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { cn } from "@/lib/utils";
import { useDecisionStore } from "@/store/useDecisionStore";
import { PresentationTab } from "@/components/presentation/PresentationTab";
import { DecisionTab } from "@/components/decision/DecisionTab";
import { useKeyboardTabSwitch } from "@/hooks/useKeyboardTabSwitch";
import type { SessionStatus } from "@shared/types/session";

const STATUSES: SessionStatus[] = ["draft", "in-progress", "decided", "archived"];

type Tab = "presentation" | "decision";

export function AppShell() {
  const session = useDecisionStore((s) => s.session);
  const dirty = useDecisionStore((s) => s.dirty);
  const setTitle = useDecisionStore((s) => s.setTitle);
  const setStatus = useDecisionStore((s) => s.setStatus);
  const pendingExternal = useDecisionStore((s) => s.pendingExternal);
  const takeExternal = useDecisionStore((s) => s.takeExternal);
  const keepMine = useDecisionStore((s) => s.keepMine);
  const [tab, setTab] = useState<Tab>("presentation");

  useKeyboardTabSwitch(setTab);

  // Fullscreen toggle (FR-pres-6) — `F` when no input focused.
  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        const w = getCurrentWindow();
        const cur = await w.isFullscreen();
        await w.setFullscreen(!cur);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!session) return null;

  return (
    <div className="flex h-full flex-col bg-neutral-50 font-sans">
      <header className="flex items-center gap-4 border-b border-neutral-200 bg-white px-6 py-3">
        <Link to="/" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← All
        </Link>
        <input
          value={session.meta.title}
          onChange={(e) => setTitle(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-lg font-semibold tracking-tight outline-none focus:underline focus:decoration-neutral-300"
          spellCheck={false}
        />
        <span className="font-mono text-xs text-neutral-500">{session.meta.slug}</span>
        <select
          value={session.meta.status}
          onChange={(e) => setStatus(e.target.value as SessionStatus)}
          className="rounded-md border border-neutral-300 bg-white px-2 py-0.5 font-mono text-xs"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 font-mono text-xs",
            dirty ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
          )}
        >
          {dirty ? "saving…" : "saved"}
        </span>
      </header>

      {pendingExternal && (
        <div className="flex items-center justify-between border-b border-amber-200 bg-amber-50 px-6 py-2 text-sm text-amber-900">
          <span>
            <strong>File changed externally</strong> while you have unsaved edits. Pick a side.
          </span>
          <div className="flex gap-2">
            <button
              onClick={keepMine}
              className="rounded-md border border-amber-300 bg-white px-3 py-1 text-xs font-medium hover:bg-amber-100"
            >
              Keep mine
            </button>
            <button
              onClick={takeExternal}
              className="rounded-md bg-amber-900 px-3 py-1 text-xs font-medium text-white hover:bg-amber-800"
            >
              Take theirs
            </button>
          </div>
        </div>
      )}

      <nav className="flex border-b border-neutral-200 bg-white px-6">
        <TabButton active={tab === "presentation"} onClick={() => setTab("presentation")} kbd="1">
          Presentation
        </TabButton>
        <TabButton active={tab === "decision"} onClick={() => setTab("decision")} kbd="2">
          Decision
        </TabButton>
      </nav>

      <main className="relative flex-1 overflow-hidden">
        <div className={cn("absolute inset-0", tab === "presentation" ? "block" : "hidden")}>
          <PresentationTab />
        </div>
        <div className={cn("absolute inset-0", tab === "decision" ? "block" : "hidden")}>
          <DecisionTab />
        </div>
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  kbd,
  children,
}: {
  active: boolean;
  onClick: () => void;
  kbd: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-selected={active}
      className={cn(
        "relative flex items-center gap-2 px-4 py-3 text-sm font-medium",
        active ? "text-neutral-900" : "text-neutral-500 hover:text-neutral-700"
      )}
    >
      {children}
      <span className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500">
        {kbd}
      </span>
      {active && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-neutral-900" />}
    </button>
  );
}
