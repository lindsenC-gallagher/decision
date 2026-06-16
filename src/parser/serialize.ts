// Session → canonical markdown.
// Regenerate-from-model strategy per docs/spec.md §7.

import matter from "gray-matter";
import { markdownTable } from "markdown-table";
import type { Session } from "@shared/types/session";
import { layoutDirectiveString } from "./layout";

const VALUE_GLYPH: Record<string, string> = { yes: "✓", no: "✗", unknown: "?" };

// Leading HTML comment stamped onto every session file. Invisible in rendered
// markdown, but tells anyone (human or AI assistant) who opens the raw file
// what tool produced it and where the format is documented — "decision" is a
// niche app, so the schema isn't self-evident from the file alone. The parser
// ignores it (it sits before `# Presentation`) and the serializer always emits
// exactly one, so it round-trips without duplicating. See docs/spec.md.
const DOCS_POINTER = [
  "<!--",
  '  This is a "decision" session file, created/edited by the decision desktop',
  "  app — a Tauri tool for facilitating structured team decisions. It follows a",
  "  fixed markdown schema (frontmatter + a Presentation section + a Decision",
  "  section with Criteria/Scores tables). If you are an AI assistant or editing",
  "  by hand, read the format documentation first so edits stay round-trippable:",
  "    https://lindsenc-gallagher.github.io/decision/llms.txt",
  "-->",
].join("\n");

function buildFrontmatter(s: Session): Record<string, unknown> {
  const out: Record<string, unknown> = {
    schema: s.meta.schema,
    slug: s.meta.slug,
    title: s.meta.title,
    status: s.meta.status,
    created: s.meta.created,
    updated: new Date().toISOString(),
  };
  if (s.pickedSolution) out.picked = s.pickedSolution;
  return out;
}

function buildPresentation(s: Session): string {
  const parts: string[] = ["# Presentation"];
  for (const slide of s.slides) {
    parts.push("", `## ${slide.title}`);
    if (slide.layout) parts.push(layoutDirectiveString(slide.layout));
    const body = slide.body.trim();
    if (body) parts.push("", body);
  }
  parts.push("", "## Solutions");
  if (s.solutions.length === 0) {
    parts.push("");
  } else {
    for (const sol of s.solutions) {
      parts.push("", `### ${sol.name}`);
      if (sol.layout) parts.push(layoutDirectiveString(sol.layout));
      const body = sol.description.trim();
      if (body) parts.push("", body);
      if (sol.pros.length) {
        parts.push("", "**Pros**", "");
        for (const p of sol.pros) parts.push(`- ${p}`);
      }
      if (sol.cons.length) {
        parts.push("", "**Cons**", "");
        for (const c of sol.cons) parts.push(`- ${c}`);
      }
    }
  }
  return parts.join("\n");
}

function buildDecision(s: Session): string {
  const parts: string[] = ["# Decision", "", "## Criteria", ""];

  // Criteria: contested rows last; otherwise declaration order.
  // Canonical order: Required (not contested) → Preferred (not contested) →
  // Contested (any type). Stable within each bucket.
  const sortedCriteria = [...s.criteria].sort((a, b) => {
    if (a.contested !== b.contested) return a.contested ? 1 : -1;
    if (a.type !== b.type) return a.type === "Required" ? -1 : 1;
    return 0;
  });
  const criteriaRows: string[][] = [
    ["ID", "Name", "Type", "Contested"],
    ...sortedCriteria.map((c) => [c.id, c.name, c.type, c.contested ? "yes" : ""]),
  ];
  parts.push(markdownTable(criteriaRows));

  parts.push("", "## Scores", "");
  if (sortedCriteria.length === 0 || s.solutions.length === 0) {
    // Emit an empty table skeleton so the file remains parseable.
    parts.push(markdownTable([["", ...s.solutions.map((sol) => sol.name)]]));
  } else {
    const scoreByKey = new Map(
      s.scores.map((sc) => [`${sc.criterionId}:${sc.solutionId}`, sc.value])
    );
    const header = ["", ...s.solutions.map((sol) => sol.name)];
    const rows = sortedCriteria.map((c) => [
      `${c.id}: ${c.name}`,
      ...s.solutions.map((sol) => VALUE_GLYPH[scoreByKey.get(`${c.id}:${sol.id}`) ?? "unknown"]),
    ]);
    parts.push(markdownTable([header, ...rows]));
  }

  parts.push("", "## Decision", "", s.decision.trim() || "");

  parts.push("", "## History", "");
  if (s.history.length === 0) {
    parts.push(`- ${new Date().toISOString()} — Created session`);
  } else {
    for (const h of s.history) {
      parts.push(`- ${h.timestamp} — ${h.message}`);
    }
  }

  return parts.join("\n");
}

export function serializeSession(s: Session): string {
  const body = `${DOCS_POINTER}\n\n${buildPresentation(s)}\n\n${buildDecision(s)}\n`;
  return matter.stringify(body, buildFrontmatter(s));
}

export function blankTemplate(slug: string, title?: string): string {
  const now = new Date().toISOString();
  const session: Session = {
    meta: {
      schema: "decision/v1",
      slug,
      title: title ?? "Untitled decision",
      status: "draft",
      created: now,
      updated: now,
    },
    slides: [{ id: "slide-problem-0", title: "Problem", body: "" }],
    solutions: [],
    criteria: [],
    scores: [],
    decision: "",
    history: [{ timestamp: now, message: "Created session" }],
    diagnostics: [],
  };
  return serializeSession(session);
}
