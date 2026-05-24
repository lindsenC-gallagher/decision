import { describe, it, expect } from "vitest";
import { serializeSession, blankTemplate } from "../serialize";
import { parseSession } from "../parse";
import type { Session } from "@shared/types/session";

function fixture(): Session {
  return {
    meta: {
      schema: "decision/v1",
      slug: "rt",
      title: "Round trip",
      status: "in-progress",
      created: "2026-05-15T10:00:00Z",
      updated: "2026-05-15T10:00:00Z",
    },
    slides: [
      { id: "sl-1", title: "Problem", body: "Some problem text.", layout: "image-full" },
      { id: "sl-2", title: "Background", body: "Context lives here." },
    ],
    solutions: [
      {
        id: "Alpha",
        name: "Alpha",
        description: "Alpha description.",
        pros: ["fast", "simple"],
        cons: ["limited"],
        layout: "split-right",
      },
      {
        id: "Beta",
        name: "Beta",
        description: "",
        pros: [],
        cons: [],
      },
    ],
    criteria: [
      { id: "C1", name: "Stateless", type: "Required", contested: false },
      { id: "C2", name: "Devtools", type: "Preferred", contested: true },
    ],
    scores: [
      { solutionId: "Alpha", criterionId: "C1", value: "yes" },
      { solutionId: "Beta", criterionId: "C1", value: "no" },
      { solutionId: "Alpha", criterionId: "C2", value: "yes" },
    ],
    decision: "Picked Alpha.",
    history: [{ timestamp: "2026-05-15T10:00:00Z", message: "Created session" }],
    pickedSolution: "Alpha",
    diagnostics: [],
  };
}

describe("serializeSession", () => {
  it("emits canonical sections", () => {
    const md = serializeSession(fixture());
    expect(md).toContain("# Presentation");
    expect(md).toContain("# Decision");
    expect(md).toContain("## Problem");
    expect(md).toContain("## Background");
    expect(md).toContain("## Solutions");
    expect(md).toContain("## Criteria");
    expect(md).toContain("## Scores");
    expect(md).toContain("## Decision");
    expect(md).toContain("## History");
  });

  it("emits arbitrary slide titles in declaration order", () => {
    const md = serializeSession(fixture());
    const problemIdx = md.indexOf("## Problem");
    const backgroundIdx = md.indexOf("## Background");
    const solutionsIdx = md.indexOf("## Solutions");
    expect(problemIdx).toBeGreaterThan(0);
    expect(backgroundIdx).toBeGreaterThan(problemIdx);
    expect(solutionsIdx).toBeGreaterThan(backgroundIdx);
  });

  it("emits layout directives on slides and solutions", () => {
    const md = serializeSession(fixture());
    expect(md).toMatch(/## Problem\s*\n<!-- slide: layout=image-full -->/);
    expect(md).toMatch(/### Alpha\s*\n<!-- slide: layout=split-right -->/);
  });

  it("emits Pros / Cons lists", () => {
    const md = serializeSession(fixture());
    expect(md).toContain("**Pros**");
    expect(md).toContain("- fast");
    expect(md).toContain("**Cons**");
    expect(md).toContain("- limited");
  });

  it("emits the picked solution into frontmatter", () => {
    const md = serializeSession(fixture());
    expect(md).toMatch(/picked:\s*Alpha/);
  });

  it("sorts contested criteria last", () => {
    const md = serializeSession(fixture());
    const c1 = md.indexOf("| C1 |");
    const c2 = md.indexOf("| C2 |");
    expect(c1).toBeGreaterThan(0);
    expect(c2).toBeGreaterThan(c1);
  });

  it("orders criteria as Required → Preferred → Contested", () => {
    const md = serializeSession({
      ...fixture(),
      criteria: [
        // Declared in random order, including a contested Required.
        { id: "C1", name: "Preferred non-contested", type: "Preferred", contested: false },
        { id: "C2", name: "Required contested", type: "Required", contested: true },
        { id: "C3", name: "Required non-contested", type: "Required", contested: false },
        { id: "C4", name: "Preferred contested", type: "Preferred", contested: true },
      ],
    });
    // Pull the IDs in the order they appear in the Criteria table.
    const ids = ["C1", "C2", "C3", "C4"]
      .map((id) => ({ id, idx: md.indexOf(`| ${id} |`) }))
      .sort((a, b) => a.idx - b.idx)
      .map((x) => x.id);
    expect(ids).toEqual(["C3", "C1", "C2", "C4"]);
    // C3 = Required non-contested, C1 = Preferred non-contested,
    // C2 = Required contested, C4 = Preferred contested.
  });
});

describe("parse / serialize round-trip", () => {
  it("produces a stable structural equivalent", () => {
    const s = fixture();
    const md = serializeSession(s);
    const reparsed = parseSession(s.meta.slug, md);

    expect(reparsed.meta.slug).toBe(s.meta.slug);
    expect(reparsed.meta.title).toBe(s.meta.title);
    expect(reparsed.meta.status).toBe(s.meta.status);

    expect(reparsed.slides.map((x) => x.title)).toEqual(["Problem", "Background"]);
    expect(reparsed.slides[0].body.trim()).toBe("Some problem text.");
    expect(reparsed.slides[0].layout).toBe("image-full");
    expect(reparsed.slides[1].body.trim()).toBe("Context lives here.");

    expect(reparsed.solutions.map((x) => x.name)).toEqual(["Alpha", "Beta"]);
    const alpha = reparsed.solutions.find((x) => x.name === "Alpha")!;
    expect(alpha.pros).toEqual(["fast", "simple"]);
    expect(alpha.cons).toEqual(["limited"]);
    expect(alpha.layout).toBe("split-right");

    expect(reparsed.criteria.map((c) => c.id).sort()).toEqual(["C1", "C2"]);
    const c2 = reparsed.criteria.find((c) => c.id === "C2")!;
    expect(c2.contested).toBe(true);

    expect(reparsed.scores).toHaveLength(3);
    expect(reparsed.pickedSolution).toBe("Alpha");
    expect(reparsed.decision.trim()).toBe("Picked Alpha.");
  });
});

describe("body content with heading markers (regression)", () => {
  // User can freely type `#`, `##`, `### …` inside any prose section body.
  // Only the known section headers (`# Presentation`, `# Decision`,
  // `## Criteria`, `## Scores`, `## Decision`, `## History`, and `## Solutions`
  // for the solutions marker) terminate sections. Free-form slide H2s do split
  // slides — that's how slides are structured — but H1/H3 markers inside a
  // slide body stay as content.

  function withFirstSlideBody(body: string): Session {
    return {
      ...fixture(),
      slides: [{ id: "sl-1", title: "Problem", body }],
      solutions: [],
      scores: [],
    };
  }

  it("round-trips a lone '#' in slide body", () => {
    const s = withFirstSlideBody("#");
    const md = serializeSession(s);
    const reparsed = parseSession(s.meta.slug, md);
    expect(reparsed.slides[0].body.trim()).toBe("#");
  });

  it("round-trips '# Heading' inside slide body", () => {
    const s = withFirstSlideBody("# Background\n\nThe system was originally designed in 2020.");
    const md = serializeSession(s);
    const reparsed = parseSession(s.meta.slug, md);
    expect(reparsed.slides[0].body).toContain("# Background");
    expect(reparsed.slides[0].body).toContain("originally designed");
  });

  it("round-trips '### Sub' inside slide body", () => {
    const s = withFirstSlideBody("Intro\n\n### Sub\n\nMore body.");
    const md = serializeSession(s);
    const reparsed = parseSession(s.meta.slug, md);
    expect(reparsed.slides[0].body).toContain("### Sub");
  });

  it("round-trips '## Subsection' inside decision body", () => {
    const s = { ...fixture(), decision: "## Rationale\n\nWe picked Alpha because…" };
    const md = serializeSession(s);
    const reparsed = parseSession(s.meta.slug, md);
    expect(reparsed.decision).toContain("## Rationale");
  });
});

describe("blankTemplate", () => {
  it("produces a parseable, well-formed empty session with a seed slide", () => {
    const md = blankTemplate("my-slug", "My title");
    const s = parseSession("my-slug", md);
    expect(s.meta.slug).toBe("my-slug");
    expect(s.meta.title).toBe("My title");
    expect(s.slides).toHaveLength(1);
    expect(s.slides[0].title).toBe("Problem");
    expect(s.solutions).toHaveLength(0);
    expect(s.criteria).toHaveLength(0);
    expect(s.scores).toHaveLength(0);
    expect(s.history).toHaveLength(1);
    expect(s.diagnostics.filter((d) => d.level === "error")).toHaveLength(0);
  });
});
