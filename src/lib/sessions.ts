// Typed wrappers around the Tauri commands defined in src-tauri/src/commands.rs.
// The React side never touches the filesystem directly; it always goes through these.

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface SessionListEntry {
  slug: string;
  path: string;
  modified: number | null;
}

export interface LoadedSession {
  slug: string;
  path: string;
  rawMarkdown: string;
  contentHash: string;
}

interface RawLoaded {
  slug: string;
  path: string;
  raw_markdown: string;
  content_hash: string;
}

const normalize = (r: RawLoaded): LoadedSession => ({
  slug: r.slug,
  path: r.path,
  rawMarkdown: r.raw_markdown,
  contentHash: r.content_hash,
});

export const listSessions = () => invoke<SessionListEntry[]>("list_sessions");

export const loadSession = async (slug: string): Promise<LoadedSession> => {
  const r = await invoke<RawLoaded>("load_session", { slug });
  return normalize(r);
};

export const saveSession = async (
  slug: string,
  rawMarkdown: string,
  baseHash: string
): Promise<LoadedSession> => {
  const r = await invoke<RawLoaded>("save_session", {
    req: { slug, raw_markdown: rawMarkdown, base_hash: baseHash },
  });
  return normalize(r);
};

export const pickDecisionsDir = () => invoke<string | null>("pick_decisions_dir");
export const getDecisionsDir = () => invoke<string>("get_decisions_dir");
export const setDecisionsDir = (path: string) => invoke<void>("set_decisions_dir", { path });

export const startWatching = () => invoke<void>("start_watching");
export const stopWatching = () => invoke<void>("stop_watching");

export const importImage = (slug: string, sourcePath: string) =>
  invoke<string>("import_image", { slug, sourcePath });

/**
 * Subscribe to file-change events emitted by the Rust watcher.
 * The callback receives the absolute path that changed.
 */
export const onSessionChanged = (cb: (path: string) => void): Promise<UnlistenFn> =>
  listen<string>("decisions://changed", (e) => cb(e.payload));
