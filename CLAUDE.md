# decision

A **Tauri desktop app** for facilitating structured team decisions in meetings. Two tabs: **Presentation** (markdown-driven slides) and **Decision** (criteria × solutions scoring matrix). Sessions persist as `.md` files in a user-chosen folder.

## Spec is the source of truth — keep it in sync

The canonical product specification lives at `docs/spec.md`. **Always update the spec in the same change as any user-visible behavior change.** Specifically, update the spec when you:

- Add, remove, or modify any feature or UI behavior
- Change the markdown file schema (sections, tables, frontmatter, slide directives)
- Modify scoring logic, elimination rules, or terminology (Required / Preferred / Contested / etc.)
- Change keyboard shortcuts or interaction patterns
- Add, remove, or replace dependencies on either side (TypeScript or Rust)
- Add, remove, or rename a Tauri command
- Change empty-state, error, or conflict behavior

If a code change and the spec ever disagree, update one or the other in the same commit — never leave them out of sync. When implementing a new feature, write or update the corresponding FR-*/AC-*/Q* lines in `docs/spec.md` before or alongside the code.

The spec uses these conventions:
- `FR-<area>-N` for functional requirements
- `NFR-N` for non-functional requirements
- `AC N` for acceptance criteria
- `Q<N>` for open questions with applied defaults
- §11 for Given/When/Then behavioral specs

When you add behavior, allocate the next free FR/AC/Q number rather than reusing.

## Architecture

**Single-process desktop app.** No Node server, no HTTP, no WebSocket — the React renderer talks to a Rust backend via Tauri's `invoke()` IPC and event bus.

```
┌────────────────────────────────────────────────────────────┐
│  Tauri window                                              │
│  ┌──────────────────────────┐    ┌──────────────────────┐ │
│  │  React renderer          │    │  Rust core           │ │
│  │  (Vite, TS, Tailwind v4, │◀──▶│  (commands, watcher) │ │
│  │   shadcn, TanStack)      │ IPC│                      │ │
│  └──────────────────────────┘    └──────────┬───────────┘ │
└─────────────────────────────────────────────┼─────────────┘
                                              │ fs I/O + notify
                                              ▼
                                   ┌──────────────────────┐
                                   │  ~/decisions/*.md    │
                                   │  (user-chosen path)  │
                                   └──────────────────────┘
                                              ▲
                                              │ external edits
                                   ┌──────────┴───────────┐
                                   │ Claude Code / Desktop│
                                   │ VS Code, plain edit  │
                                   └──────────────────────┘
```

External edits are picked up by the Rust watcher (`notify`) and broadcast via Tauri events (`decisions://changed`) to the React side.

## Project structure

- `src/` — React renderer
  - `main.tsx` — entry point; mounts RouterProvider + QueryClientProvider
  - `router.tsx` — TanStack Router setup
  - `routes/` — route components (`home.tsx`, `session.tsx`)
  - `components/` — `ui/` (shadcn), `presentation/`, `decision/`
  - `lib/sessions.ts` — typed wrappers around Tauri commands
  - `lib/utils.ts` — shadcn `cn()` helper
  - `store/` — Zustand
  - `hooks/`
  - `index.css` — Tailwind v4 entry
- `src-tauri/` — Rust shell
  - `Cargo.toml`, `tauri.conf.json`, `build.rs`
  - `capabilities/default.json` — Tauri v2 capability allowlist
  - `src/main.rs` — Rust entry
  - `src/lib.rs` — Tauri builder + plugin registration
  - `src/commands.rs` — `#[tauri::command]` functions (the IPC surface)
  - `src/state.rs` — process-wide state (decisions dir, self-write hash set)
  - `src/watcher.rs` — `notify`-based file watcher
  - `icons/` — placeholder icons (to be replaced with real artwork)
- `shared/types/` — TypeScript types (mirrors Rust serde structs)
- `docs/spec.md` — canonical specification
- `prototype/` — original Claude Design HTML prototype (visual reference)
- `design/` — original Claude Design handoff bundle (read-only)

## Tauri IPC surface

Defined in `src-tauri/src/commands.rs`, wrapped in `src/lib/sessions.ts`. Current commands:

| Command | Purpose |
|---------|---------|
| `list_sessions` | List `*.md` files in the current decisions folder |
| `load_session(slug)` | Read one `.md` file → `{ rawMarkdown, contentHash }` |
| `save_session(req)` | Atomic write of a session with optimistic concurrency (`baseHash` check) |
| `pick_decisions_dir` | Native folder picker dialog |
| `get_decisions_dir` / `set_decisions_dir` | Read / mutate the current decisions folder |
| `start_watching` / `stop_watching` | Start/stop the notify watcher; emits `decisions://changed` events |

Adding a command → declare it in `commands.rs`, register in `lib.rs`'s `invoke_handler!`, wrap in `src/lib/sessions.ts`, and add an FR line in `docs/spec.md`.

## Dev workflow

- `npm run dev` — Vite dev server (port 1420) for renderer-only iteration. UI loads but no Tauri commands work.
- `npm run tauri:dev` — full Tauri desktop app with HMR; this is the primary dev command.
- `npm run lint` / `npm run format` — ESLint + Prettier on the TS side.
- `cargo fmt && cargo clippy` inside `src-tauri/` for the Rust side.

## Tests

- **Unit tests** (Vitest): `npm run test` (CI) / `npm run test:watch` (dev). Lives next to the code under `src/**/__tests__/*.test.ts`. Heaviest coverage on the parser, serializer, history diff, and store selectors — the parts most likely to silently break round-trip integrity.
- **E2E** (Playwright): `npm run test:e2e`. Lives in `e2e/`. First run requires `npm run test:e2e:install` (downloads Chromium). Tests boot Vite (`npm run dev`) and run against the renderer with a Tauri-stub injected via `page.addInitScript` — see `e2e/fixtures.ts` for the stub. The stub intercepts `window.__TAURI_INTERNALS__.invoke` (including `plugin:event|listen` for events) so the renderer thinks it has a real shell.

**Rule**: when adding a feature that touches the parser/serializer schema, the store mutators, or any user flow (create session, edit, save, reveal, switch tabs, conflict resolution), add or update a test in the same change. Schema changes especially need a round-trip test entry in `src/parser/__tests__/serialize.test.ts`.

## Git workflow

- **Push directly to `main`.** This is a solo/personal repo — commit and push straight to `main`; no feature branches, no pull requests, no review gate required. Skip the branch-and-PR flow for routine changes.

## Default data folder

`$HOME/decisions/` on first run. User can pick a different folder via the native dialog (`pick_decisions_dir` command); the choice is held in process memory only — persistent storage of the user's preference is a TODO (will move to `tauri-plugin-store` or `$APPCONFIG/decision/settings.json`).
