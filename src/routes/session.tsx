import { useEffect, useRef, useState } from "react";
import { useParams } from "@tanstack/react-router";
import { loadSession, saveSession, onSessionChanged, startWatching } from "@/lib/sessions";
import { parseSession } from "@/parser/parse";
import { serializeSession } from "@/parser/serialize";
import { diffSessions } from "@/parser/diff";
import { useDecisionStore } from "@/store/useDecisionStore";
import { AppShell } from "@/components/AppShell";

export function SessionRoute() {
  const { slug } = useParams({ from: "/sessions/$slug" });
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const session = useDecisionStore((s) => s.session);
  const baseHash = useDecisionStore((s) => s.baseHash);
  const dirty = useDecisionStore((s) => s.dirty);
  const load = useDecisionStore((s) => s.load);
  const clear = useDecisionStore((s) => s.clear);
  const markSaved = useDecisionStore((s) => s.markSaved);
  const saveTimer = useRef<number | null>(null);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setError(null);
    loadSession(slug)
      .then((loadedRaw) => {
        if (cancelled) return;
        const parsed = parseSession(loadedRaw.slug, loadedRaw.rawMarkdown);
        load(loadedRaw.slug, parsed, loadedRaw.contentHash);
        setLoaded(true);
      })
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
      clear();
    };
    // We deliberately only react to slug changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Subscribe to external file changes from the Rust watcher.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void startWatching().catch(() => {}); // idempotent
    void onSessionChanged((path) => {
      if (!path.toLowerCase().endsWith(`${slug.toLowerCase()}.md`)) return;
      const state = useDecisionStore.getState();
      loadSession(slug)
        .then((r) => {
          const parsed = parseSession(r.slug, r.rawMarkdown);
          if (state.dirty) {
            // Hold the incoming version for the user to choose (FR-sync-10).
            state.setExternalPending(parsed, r.contentHash);
          } else {
            load(r.slug, parsed, r.contentHash);
          }
        })
        .catch(() => {});
    }).then((fn) => (unlisten = fn));
    return () => unlisten?.();
  }, [slug, load]);

  // Debounced autosave with history diff (FR-hist-1/2/3).
  useEffect(() => {
    if (!dirty || !session) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      try {
        const lastSaved = useDecisionStore.getState().lastSaved;
        const toSave = structuredClone(session);
        if (lastSaved) {
          const entries = diffSessions(lastSaved, toSave);
          if (entries.length > 0) toSave.history = [...toSave.history, ...entries];
        }
        const md = serializeSession(toSave);
        const saved = await saveSession(slug, md, baseHash);
        markSaved(toSave, saved.contentHash);
      } catch (e) {
        setError(String(e));
      }
    }, 300);
    return () => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
    };
  }, [dirty, session, slug, baseHash, markSaved]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="mb-1 font-medium">Failed to load session</div>
          <div className="font-mono">{error}</div>
        </div>
      </div>
    );
  }

  if (!loaded || !session) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-neutral-500">
        Loading {slug}…
      </div>
    );
  }

  return <AppShell />;
}
