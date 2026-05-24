// Playwright fixture that installs an in-page Tauri stub before the renderer
// boots. The stub backs sessions with an in-memory map so we can drive the UI
// without launching the actual Rust process.

import { test as base, expect } from "@playwright/test";

const STUB = `
(() => {
  const seedTimestamp = "2026-05-15T10:00:00Z";
  const sessions = new Map();
  // Seed with one sample so the home page has something to click into.
  const sample = [
    "---",
    "schema: decision/v1",
    "slug: framework-choice",
    "title: Choose a frontend framework",
    "status: draft",
    "created: " + seedTimestamp,
    "updated: " + seedTimestamp,
    "---",
    "",
    "# Presentation",
    "",
    "## Problem",
    "",
    "We need to pick a frontend stack.",
    "",
    "## Background",
    "",
    "The old admin app is unmaintainable.",
    "",
    "## Solutions",
    "",
    "### React + Vite",
    "",
    "The conventional pick.",
    "",
    "**Pros**",
    "- Fast",
    "",
    "**Cons**",
    "- SPA only",
    "",
    "### SvelteKit",
    "",
    "Smaller bundles.",
    "",
    "# Decision",
    "",
    "## Criteria",
    "",
    "| ID | Name | Type | Contested |",
    "| -- | ---- | ---- | --------- |",
    "| C1 | Stateless | Required | |",
    "| C2 | Devtools | Preferred | |",
    "",
    "## Scores",
    "",
    "|              | React + Vite | SvelteKit |",
    "| ------------ | ------------ | --------- |",
    "| C1: Stateless | ✓ | ✗ |",
    "| C2: Devtools  | ✓ | ? |",
    "",
    "## Decision",
    "",
    "",
    "## History",
    "",
    "- " + seedTimestamp + " — Created session",
    "",
  ].join("\\n");
  sessions.set("framework-choice", sample);

  let decisionsDir = "/tmp/decisions";

  function sha256(text) {
    // Trivial 32-bit djb2 hash, hex-padded — only used by the renderer as a
    // baseHash token in tests. The real Rust uses SHA-256 but we don't need
    // cryptographic strength here.
    let h = 5381;
    for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
    return ("0000000000000000" + h.toString(16)).slice(-16);
  }

  // listeners: event name -> Set of callback IDs (registered via transformCallback)
  const listeners = new Map();
  let nextEventId = 1;
  function emit(event, payload) {
    const ids = listeners.get(event);
    if (!ids) return;
    const next = nextEventId++;
    for (const id of ids) {
      const cb = window["_" + id];
      if (typeof cb === "function") {
        try { cb({ event, id: next, payload }); } catch (_) {}
      }
    }
  }

  const invokeImpl = async (cmd, args = {}) => {
    switch (cmd) {
      case "plugin:event|listen": {
        // @tauri-apps/api/event routes listen() through invoke() with this magic command.
        const event = args.event;
        const id = args.handler;
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event).add(id);
        return id;
      }
      case "plugin:event|unlisten": {
        for (const set of listeners.values()) set.delete(args.eventId ?? args.id);
        return null;
      }
      case "list_sessions":
        return [...sessions.keys()].map((slug) => ({
          slug, path: decisionsDir + "/" + slug + ".md", modified: 1700000000,
        }));
      case "load_session": {
        const raw = sessions.get(args.slug);
        if (!raw) throw "no such session";
        return { slug: args.slug, path: decisionsDir + "/" + args.slug + ".md", raw_markdown: raw, content_hash: sha256(raw) };
      }
      case "save_session": {
        const req = args.req;
        const md = req.raw_markdown;
        sessions.set(req.slug, md);
        return { slug: req.slug, path: decisionsDir + "/" + req.slug + ".md", raw_markdown: md, content_hash: sha256(md) };
      }
      case "pick_decisions_dir":
        return "/tmp/chosen";
      case "get_decisions_dir":
        return decisionsDir;
      case "set_decisions_dir":
        decisionsDir = args.path;
        return null;
      case "start_watching":
      case "stop_watching":
        return null;
      case "import_image":
        return "./images/" + args.slug + "/" + (args.sourcePath.split(/[\\\\/]/).pop() || "img.png");
      default:
        throw new Error("Tauri stub: unhandled command " + cmd);
    }
  };

  // Tauri 2 reads from window.__TAURI_INTERNALS__ for invoke + event APIs.
  // We provide the minimal surface used by @tauri-apps/api/core and /event.
  window.__TAURI_INTERNALS__ = {
    invoke: (cmd, args) => invokeImpl(cmd, args),
    transformCallback: (cb) => {
      const id = Math.floor(Math.random() * 1e9);
      window["_" + id] = cb;
      return id;
    },
    metadata: { currentWebview: { label: "main" }, currentWindow: { label: "main" } },
  };
  // Expose helpers for tests to inject events.
  window.__TEST_TAURI__ = { emit, sessions };
})();
`;

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript({ content: STUB });
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") {
        // eslint-disable-next-line no-console
        console.log(`[browser:${msg.type()}]`, msg.text());
      }
    });
    page.on("pageerror", (err) => {
      // eslint-disable-next-line no-console
      console.log("[pageerror]", err.message);
    });
    await use(page);
  },
});

export { expect };
