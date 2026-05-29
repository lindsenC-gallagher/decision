import { describe, it, expect } from "vitest";
import { parseSession } from "../parse";

const minimal = `---
schema: decision/v1
slug: t
title: Test
status: draft
created: 2026-05-15T10:00:00Z
updated: 2026-05-15T10:00:00Z
---

# Presentation

## Problem

We must choose a frontend stack.

## Background

A second slide for context.

## Solutions

### React + Vite

The conventional pick.

**Pros**
- Fast
- Familiar

**Cons**
- SPA only

### SvelteKit

Smaller bundles.

# Decision

## Criteria

| ID | Name | Type | Contested |
|----|------|------|-----------|
| C1 | Stateless | Required | |
| C2 | Devtools | Preferred | yes |

## Scores

|              | React + Vite | SvelteKit |
|--------------|--------------|-----------|
| C1: Stateless| ✓            | ✗         |
| C2: Devtools | ✓            | ?         |

## Decision

Pick React.

## History

- 2026-05-15T10:00:00Z — Created session
`;

describe("parseSession", () => {
  it("extracts frontmatter", () => {
    const s = parseSession("t", minimal);
    expect(s.meta.slug).toBe("t");
    expect(s.meta.title).toBe("Test");
    expect(s.meta.status).toBe("draft");
  });

  it("preserves unquoted ISO 8601 created/updated timestamps from YAML", () => {
    // gray-matter parses unquoted ISO datetimes as Date objects, not strings.
    // The parser must coerce them back to ISO strings instead of silently
    // resetting to `new Date().toISOString()`.
    const s = parseSession("t", minimal);
    expect(s.meta.created).toBe("2026-05-15T10:00:00.000Z");
    expect(s.meta.updated).toBe("2026-05-15T10:00:00.000Z");
  });

  it("extracts slides in order with arbitrary titles", () => {
    const s = parseSession("t", minimal);
    expect(s.slides).toHaveLength(2);
    expect(s.slides[0].title).toBe("Problem");
    expect(s.slides[0].body).toContain("frontend stack");
    expect(s.slides[1].title).toBe("Background");
    expect(s.slides[1].body).toContain("context");
  });

  it("extracts solutions with pros/cons", () => {
    const s = parseSession("t", minimal);
    expect(s.solutions).toHaveLength(2);
    const r = s.solutions[0];
    expect(r.name).toBe("React + Vite");
    expect(r.pros).toEqual(["Fast", "Familiar"]);
    expect(r.cons).toEqual(["SPA only"]);

    const sv = s.solutions[1];
    expect(sv.name).toBe("SvelteKit");
  });

  it("extracts criteria including the contested flag", () => {
    const s = parseSession("t", minimal);
    expect(s.criteria).toHaveLength(2);
    expect(s.criteria[0]).toMatchObject({
      id: "C1",
      name: "Stateless",
      type: "Required",
      contested: false,
    });
    expect(s.criteria[1]).toMatchObject({
      id: "C2",
      name: "Devtools",
      type: "Preferred",
      contested: true,
    });
  });

  it("extracts scores as a sparse list (no entries for unknown)", () => {
    const s = parseSession("t", minimal);
    expect(s.scores).toHaveLength(3);
    expect(s.scores.some((sc) => sc.criterionId === "C1" && sc.value === "yes")).toBe(true);
    expect(s.scores.some((sc) => sc.criterionId === "C1" && sc.value === "no")).toBe(true);
  });

  it("captures decision text and history entries", () => {
    const s = parseSession("t", minimal);
    expect(s.decision.trim()).toBe("Pick React.");
    expect(s.history).toHaveLength(1);
    expect(s.history[0].message).toBe("Created session");
  });

  it("extracts a layout directive from a slide", () => {
    const md = minimal.replace(
      "## Problem\n\nWe must",
      "## Problem\n<!-- slide: layout=image-full -->\n\nWe must"
    );
    const s = parseSession("t", md);
    expect(s.slides[0].layout).toBe("image-full");
    expect(s.slides[0].body.startsWith("<!--")).toBe(false);
  });

  it("survives a blank template", () => {
    const blank = `---
schema: decision/v1
slug: blank
title: Blank
status: draft
created: 2026-05-15T10:00:00Z
updated: 2026-05-15T10:00:00Z
---

# Presentation

## Problem

## Solutions

# Decision

## Criteria

| ID | Name | Type | Contested |
|----|------|------|-----------|

## Scores

| Solution |
|----------|

## Decision

## History

- 2026-05-15T10:00:00Z — Created session
`;
    const s = parseSession("blank", blank);
    expect(s.slides).toHaveLength(1);
    expect(s.slides[0].title).toBe("Problem");
    expect(s.solutions).toHaveLength(0);
    expect(s.criteria).toHaveLength(0);
    expect(s.scores).toHaveLength(0);
    expect(s.diagnostics.filter((d) => d.level === "error")).toHaveLength(0);
  });

  it("treats H1 / H3 markers inside slide bodies as content, not section breaks", () => {
    const md = `---
schema: decision/v1
slug: t
title: T
status: draft
created: 2026-05-15T10:00:00Z
updated: 2026-05-15T10:00:00Z
---

# Presentation

## Problem

# Background

The system was designed in 2020.

### Sub-heading

More body.

## Solutions

### Foo

# Decision

## Criteria

| ID | Name | Type | Contested |
|----|------|------|-----------|

## Scores

| Solution |
|----------|

## Decision

## History

- 2026-05-15T10:00:00Z — Created
`;
    const s = parseSession("t", md);
    expect(s.slides).toHaveLength(1);
    expect(s.slides[0].title).toBe("Problem");
    // The body should retain the user-typed H1 and H3 lines.
    expect(s.slides[0].body).toContain("# Background");
    expect(s.slides[0].body).toContain("### Sub-heading");
    expect(s.solutions.map((x) => x.name)).toEqual(["Foo"]);
  });
});
