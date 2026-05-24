# decision

A desktop app (Tauri + React) for facilitating structured team decisions in meetings. Two tabs — **Presentation** (markdown-driven slides) and **Decision** (criteria × solutions scoring matrix) — backed by a single `.md` file per session that's the canonical source of truth.

```
npm install
npm run tauri:dev      # boot the desktop app
npm run test           # vitest unit tests
npm run test:e2e       # playwright (after `npm run test:e2e:install` once)
```

The full spec lives at [`docs/spec.md`](./docs/spec.md). Coding conventions and the spec-sync rule are in [`CLAUDE.md`](./CLAUDE.md).

---

## Markdown schema

Each decision session is one `.md` file in your decisions folder (default `~/decisions/`, change via the app's folder picker). The schema is designed to be (a) readable in any editor, (b) editable by humans and LLMs without surprises, and (c) unambiguous for the app's parser.

### File layout

```markdown
---
schema: decision/v1
slug: choose-frontend-framework
title: Choose a frontend framework
status: in-progress
created: 2026-05-15T10:00:00Z
updated: 2026-05-15T16:02:44Z
picked: React + Vite           # optional — name of the chosen solution
---

# Presentation

## Problem
…anything markdown…

## Background
…another slide…

## Solutions
### React + Vite
…description…

### SvelteKit
…description…

# Decision

## Criteria
| ID | Name | Type | Contested |
| -- | ---- | ---- | --------- |
| C1 | Team can ship in 6 weeks  | Required  |     |
| C2 | Built-in SSR              | Preferred |     |
| C3 | Bundle size under 200 KB  | Preferred | yes |

## Scores
|                       | React + Vite | SvelteKit |
| --------------------- | ------------ | --------- |
| C1: Team can ship…    | ✓            | ✗         |
| C2: Built-in SSR      | ✗            | ✓         |
| C3: Bundle < 200 KB   | ✓            | ✓         |

## Decision
**Chosen: React + Vite.** SvelteKit eliminated by C1…

## History
- 2026-05-15T10:00:00Z — Created session
- 2026-05-15T15:14:30Z — Added criteria C1–C3
- 2026-05-15T16:02:44Z — Picked solution: React + Vite
```

### Frontmatter

YAML, leading `---` block. All fields are optional except `schema` (the parser fills sensible defaults for the rest if missing).

| Field | Meaning |
|-------|---------|
| `schema` | Version string. Currently `decision/v1`. |
| `slug` | Filename stem; the canonical session ID. |
| `title` | Display title shown in the header (and on the deck). |
| `status` | One of `draft`, `in-progress`, `decided`, `archived`. |
| `created` / `updated` | ISO 8601 timestamps. `updated` is rewritten on every in-app save. |
| `picked` | Name of the chosen solution (matches a `### <name>` under `## Solutions`). |

### `# Presentation`

Anything under this H1 is rendered as the Presentation tab. It contains two kinds of content:

**Slides** — every `## <anything>` heading *before* `## Solutions` is a slide. The H2 text is the slide title; the body is the markdown between this H2 and the next H2. Slide titles can be anything (`## Problem`, `## Background`, `## Demo`, …).

**Solutions** — the literal heading `## Solutions` is a marker. Everything below it (until `# Decision`) is parsed as a list of solutions, one per `### <name>` heading. Each solution renders as its own slide in the deck and as a column in the Scoring matrix.

#### Slide body — what's allowed

Standard GFM markdown. Code fences with language tags get syntax-highlighted (Shiki). Fenced blocks tagged `mermaid` render as diagrams. Images use the usual `![alt](path)` syntax — paths are resolved relative to the decisions folder, so storing them under `decisions/images/<slug>/` works.

You can freely type heading markers (`# Foo`, `### Sub`) inside a slide body; the parser only treats *known* section names as section breaks, so `# Foo` stays as content. The one exception: a literal `## <anything>` inside a slide body will be parsed as a new slide (that's how slides are delimited).

#### Solution body

Same markdown as a slide body, plus the conventional `**Pros**` and `**Cons**` blocks:

```markdown
### React + Vite

The conventional pick.

**Pros**
- Fast dev server
- Team already knows it

**Cons**
- No built-in SSR
```

The Pros/Cons lists are extracted by the parser and rendered with semantic styling on the Solution slide. You can omit them.

### `# Decision`

This H1 contains the working surface. The recognized H2s are fixed:

#### `## Criteria`

A single GFM table. Columns (case-insensitive, order-tolerant):

| Column | Required? | Meaning |
|--------|-----------|---------|
| `ID` | yes | A short identifier like `C1`, `C2`. Used as a stable key by the scores table. |
| `Name` | yes | What you're evaluating. |
| `Type` | yes | `Required` (binary gate — a `✗` eliminates the solution) or `Preferred` (counts toward score). |
| `Contested` | no | `yes` if the team hasn't agreed on this criterion. Contested rows sort to the bottom and get a yellow chip; they still score normally. |

Contested criteria sort below non-contested when serialized. Adding `Contested` mid-life of an existing file is fine — old rows default to non-contested.

#### `## Scores`

A single GFM table. Rows are criteria, columns are solutions:

```markdown
|                  | React + Vite | SvelteKit |
| ---------------- | ------------ | --------- |
| C1: Stateless    | ✓            | ✗         |
| C2: Devtools     | ✓            | ?         |
```

- The first column carries the criterion (`<ID>: <name>` — the name part is for human readability, only the ID is matched).
- Header columns are solution names — they must match a `### <name>` under `## Solutions`. Mismatched columns produce a warning diagnostic, not an error.
- Cell values: `✓` (met), `✗` (not met), `?` (unknown — the default). The parser also accepts `yes` / `no` / `Y` / `N` / `+` / `-` and normalizes.
- A missing cell is implicitly `?`. Sparse scores are valid.

Scoring rules:

- A solution is **eliminated** when any Required cell is `✗`.
- A Required cell at `?` shows a yellow "Pending" chip but does *not* eliminate.
- A solution's **score** = count of Preferred criteria with `✓` for that solution.
- The **recommendation** is the surviving solution with the highest score; ties break by declaration order.

In the UI, scores and the elimination/recommendation styling are hidden until you press **Reveal results** (a deliberate "score privately, reveal together" workflow).

#### `## Decision`

Free-form markdown describing the chosen outcome and rationale.

#### `## History`

A bulleted list. Each entry is `<ISO 8601 timestamp> — <message>`. The app auto-appends entries on save for Decision-side changes (status, title, criteria changes, score flips, pick, decision text). Presentation-side edits (slide content, solution name/body) are intentionally not logged — `## History` lives under `# Decision`, so it scopes to Decision-side changes.

External edits (Claude editing the file, you editing in VS Code) are not auto-logged.

### Optional: per-slide layout directive

Each slide or solution can specify a layout. The parser recognises an HTML comment on the first line under the heading:

```markdown
## Problem
<!-- slide: layout=image-full -->

![p99 latency](./images/p99.png)

…
```

| Layout | When to use |
|--------|-------------|
| `title-body` *(default)* | Title at top, prose below. |
| `split-right` | Image right, content left. Auto-selected when the body starts with an image. |
| `split-left` | Image left, content right. |
| `image-full` | Image fills the slide; title + body overlaid. |
| `bullets` | Title + a single bullet list. Auto-selected when the body is one list. |
| `quote` | Centered large quote. Auto-selected when the body starts with `>`. |

If no directive is present and no auto-detection rule fires, the layout is `title-body`. You can also switch layout per-slide from the slide toolbar in the app — it edits the directive in-place.

### Parser tolerance

The parser is **strict on the structure that matters** (the two H1s, the named H2s under `# Decision`, the table shape of Criteria/Scores), **tolerant on the things that don't** (heading case, column order, score-cell spellings, missing optional sections, user-typed heading markers inside body content).

Anything between `# Presentation` and `# Decision` that isn't a recognised slide/solution still parses cleanly; anything between `# Decision` H2s that isn't recognised is preserved verbatim by the writer when you save in the UI.

### Round-trip guarantee

`parse(serialize(s))` returns a session structurally equal to `s` for every valid `Session` (modulo `meta.updated` and history timestamps). The unit test suite enforces this — see [`src/parser/__tests__/serialize.test.ts`](./src/parser/__tests__/serialize.test.ts).
