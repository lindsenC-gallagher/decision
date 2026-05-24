# Presentation & Decision Slide Switcher

_Started 2026-05-15 04:29 UTC_

---

## User

i have an app with two pages that i can switch back and forth. One to show presentation slides, another to show decision slide. The decision slide is mostly a table with some text on it.

## Assistant

_[tool: read_file]_

_[tool: list_files]_

_[tool: list_files]_

_[tool: read_file]_

_[tool: questions_v2]_

The napkin sketch is empty, so I'll need a bit more from you before I start designing. Let me ask a few key questions to make sure I build the right thing.

## User

Questions answered:
- context: developers
- decision_table_content: criterias x solutions
- interaction_model: Tab-style switcher
- table_interactions: Add/remove rows, pick one as the solution
- presentation_content: dynamic based on md file
- slide_count: 4
- variations: Decide for me
- tweaks: Decision table layout
- fidelity: Fully clickable prototype with state
- device: Fullscreen presentation (1920×1080)
- brand_check: No — neutral / generic look

## Assistant

_[tool: update_todos]_

_[tool: copy_starter_component]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: read_file]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: done]_

_[tool: fork_verifier_agent]_

Built. Two-tab app at 1920×1080 with a developer-neutral aesthetic (IBM Plex Sans + JetBrains Mono, near-mono palette with green only for the picked solution).

**Presentation tab** — markdown-driven slides with `---` as separator, outline rail on the right, prev/next + progress bar, and an "edit source" drawer (`⌘E`) so you can swap the md live. Default content is a real decision doc that pairs with the table.

**Decision tab** — criteria (rows) × solutions (columns). Click any column header (or its circle) to mark the winner — the column turns green and shows in the top bar pill. Add/remove criteria and solutions, inline-edit names, scores, and notes. Footer shows the picked solution + total.

**Keyboard** — `1` / `2` swap tabs, `←/→` step slides, `R` adds a criterion row, `C` adds a solution column, `⌘E` opens markdown source.

**Tweaks** (toolbar toggle): layout (table ↔ cards), density (comfy/compact), star ratings on/off, totals row on/off.

