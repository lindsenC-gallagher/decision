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
  // FR-sync-9: 2-second "synced from disk" toast after an external clean sync.
  const [syncedToast, setSyncedToast] = useState(false);
  const session = useDecisionStore((s) => s.session);
  const dirty = useDecisionStore((s) => s.dirty);
  const load = useDecisionStore((s) => s.load);
  const clear = useDecisionStore((s) => s.clear);
  const markSaved = useDecisionStore((s) => s.markSaved);
  const saveTimer = useRef<number | null>(null);
  const toastTimer = useRef<number | null>(null);
  // Hashes of content this app has written. The Rust watcher echoes our own
  // saves back as `decisions://changed`; without this ledger a late/duplicate
  // echo can reload over (or pop a spurious conflict prompt during) live edits.
  const selfWrites = useRef<Set<string>>(new Set());

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
      loadSession(slug)
        .then((r) => {
          const state = useDecisionStore.getState();
          // Drop echoes of our own writes (and no-op changes that already match
          // the concurrency base) so live typing isn't interrupted by a
          // self-inflicted reload or a spurious conflict prompt.
          if (selfWrites.current.has(r.contentHash) || r.contentHash === state.baseHash) return;
          const parsed = parseSession(r.slug, r.rawMarkdown);
          if (state.dirty) {
            // Hold the incoming version for the user to choose (FR-sync-10).
            state.setExternalPending(parsed, r.contentHash);
          } else {
            load(r.slug, parsed, r.contentHash);
            setSyncedToast(true);
            if (toastTimer.current) window.clearTimeout(toastTimer.current);
            toastTimer.current = window.setTimeout(() => setSyncedToast(false), 2000);
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
        // Read fresh state at fire time so we snapshot — and reconcile against —
        // the exact live session object, not a stale render closure.
        const store = useDecisionStore.getState();
        const sourceSession = store.session;
        if (!sourceSession) return;
        const toSave = structuredClone(sourceSession);
        if (store.lastSaved) {
          const entries = diffSessions(store.lastSaved, toSave);
          if (entries.length > 0) toSave.history = [...toSave.history, ...entries];
        }
        const md = serializeSession(toSave);
        const saved = await saveSession(slug, md, store.baseHash);
        // Remember our own write so the watcher echo is ignored (ring-capped).
        selfWrites.current.add(saved.contentHash);
        if (selfWrites.current.size > 24) {
          selfWrites.current.delete(selfWrites.current.values().next().value!);
        }
        markSaved(toSave, saved.contentHash, sourceSession);
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
    // `session` stays a dep so each edit reschedules the 300ms timer; baseHash
    // is read fresh from the store at fire time, so it's intentionally omitted.
  }, [dirty, session, slug, markSaved]);

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

  return (
    <>
      <AppShell />
      {syncedToast && (
        <div
          role="status"
          className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md bg-neutral-900 px-3 py-1.5 text-xs text-white shadow-lg"
        >
          synced from disk
        </div>
      )}
    </>
  );
}
