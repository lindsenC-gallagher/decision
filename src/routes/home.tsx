import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  getDecisionsDir,
  listSessions,
  pickDecisionsDir,
  saveSession,
  setDecisionsDir,
  startWatching,
  type SessionListEntry,
} from "@/lib/sessions";
import { blankTemplate } from "@/parser/serialize";

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || `decision-${Math.random().toString(36).slice(2, 7)}`
  );
}

export function HomeRoute() {
  const navigate = useNavigate();
  const [dir, setDir] = useState<string>("");
  const [sessions, setSessions] = useState<SessionListEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const refresh = async () => {
    try {
      const d = await getDecisionsDir();
      setDir(d);
      setSessions(await listSessions());
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  };

  useEffect(() => {
    void refresh();
    void startWatching().catch(() => {});
  }, []);

  const pickFolder = async () => {
    const chosen = await pickDecisionsDir();
    if (chosen) {
      await setDecisionsDir(chosen);
      await startWatching().catch(() => {});
      await refresh();
    }
  };

  const createSession = async () => {
    const title = newTitle.trim() || "Untitled decision";
    const slug = slugify(title);
    if (sessions.some((s) => s.slug === slug)) {
      setError(`A session named "${slug}" already exists.`);
      return;
    }
    const md = blankTemplate(slug, title);
    try {
      await saveSession(slug, md, "");
      setNewTitle("");
      void navigate({ to: "/sessions/$slug", params: { slug } });
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-12 font-sans">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">decision</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Open an existing decision or start a new one.
        </p>
      </header>

      <section className="mb-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-neutral-500">Folder</div>
            <div className="truncate font-mono text-sm text-neutral-700" title={dir}>
              {dir || "—"}
            </div>
          </div>
          <button
            onClick={pickFolder}
            className="shrink-0 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-100"
          >
            Change…
          </button>
        </div>
      </section>

      <section className="mb-6 rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-medium text-neutral-700">New decision</h2>
        <div className="flex gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void createSession();
            }}
            placeholder="Decision title (e.g. Choose a frontend framework)"
            className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
          />
          <button
            onClick={createSession}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Create
          </button>
        </div>
      </section>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <section>
        <h2 className="mb-2 text-sm font-medium text-neutral-700">Sessions in this folder</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No decisions yet. Use “Create” above to start one.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
            {sessions.map((s) => (
              <li key={s.slug}>
                <button
                  onClick={() => void navigate({ to: "/sessions/$slug", params: { slug: s.slug } })}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-neutral-50"
                >
                  <span className="font-medium text-neutral-900">{s.slug}</span>
                  <span className="font-mono text-xs text-neutral-500">
                    {s.modified ? new Date(s.modified * 1000).toLocaleString() : "—"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
