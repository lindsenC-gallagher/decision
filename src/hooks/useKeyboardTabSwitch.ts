import { useEffect } from "react";

type Tab = "presentation" | "decision";

export function useKeyboardTabSwitch(setTab: (t: Tab) => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      if (e.key === "1") setTab("presentation");
      else if (e.key === "2") setTab("decision");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setTab]);
}
