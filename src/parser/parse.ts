// Markdown → typed Session.
// Schema reference: docs/spec.md §7.1.
//
// Strategy:
//   1. gray-matter splits frontmatter from body.
//   2. unified+remark-parse builds an mdast AST.
//   3. Walk top-level children to locate `# Presentation` and `# Decision` H1s.
//   4. Within each, find H2 sub-sections by heading text.
//   5. For free-form prose sections (Problem, Solutions/<name>, Decision),
//      slice raw markdown by mdast position offsets — preserves user formatting.
//   6. For tables (Criteria, Scores), walk the table mdast nodes.

import matter from "gray-matter";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { Root, RootContent, Heading, Table, TableRow, List } from "mdast";

import type {
  Session,
  SessionMeta,
  SessionStatus,
  PresentationSlide,
  Solution,
  Criterion,
  CriterionType,
  ScoreCell,
  ScoreValue,
  HistoryEntry,
  ParseDiagnostic,
} from "@shared/types/session";
import { extractLayoutDirective } from "./layout";
import { splitProsCons } from "./prosCons";

const processor = unified().use(remarkParse).use(remarkGfm);

// Recognized section names. Only these terminate a section's body so the user
// can freely type heading markers (`#`, `##`, `### …`) inside prose without
// the parser interpreting them as section breaks.
const KNOWN_H1_NAMES = new Set(["presentation", "decision"]);
// Known H2s under `# Decision`. Inside `# Presentation`, every H2 is a slide
// (one is special: `## Solutions` marks the start of the solutions list).
const KNOWN_H2_DECISION = new Set(["criteria", "scores", "decision", "history"]);
const SOLUTIONS_MARKER = "solutions";

function isKnownH1(c: RootContent): boolean {
  if (c.type !== "heading" || c.depth !== 1) return false;
  return KNOWN_H1_NAMES.has(headingText(c).toLowerCase());
}

function isKnownDecisionH2(c: RootContent): boolean {
  if (c.type !== "heading" || c.depth !== 2) return false;
  return KNOWN_H2_DECISION.has(headingText(c).toLowerCase());
}

function nodeText(node: { type: string; value?: string; children?: unknown[] }): string {
  if (node.type === "text" && typeof node.value === "string") return node.value;
  if (Array.isArray(node.children)) {
    return (node.children as Array<{ type: string; value?: string; children?: unknown[] }>)
      .map(nodeText)
      .join("");
  }
  return "";
}

function headingText(h: Heading): string {
  return h.children
    .map((c) => nodeText(c as never))
    .join("")
    .trim();
}

function rowCells(row: TableRow): string[] {
  return row.children.map((cell) => nodeText(cell as never).trim());
}

function findH1Bounds(
  children: RootContent[],
  name: string
): { start: number; end: number } | null {
  const target = name.toLowerCase();
  let start = -1;
  for (let i = 0; i < children.length; i++) {
    const c = children[i];
    if (c.type === "heading" && c.depth === 1 && headingText(c).toLowerCase() === target) {
      start = i;
      break;
    }
  }
  if (start < 0) return null;
  let end = children.length;
  // End only at the next known H1 ("Presentation" or "Decision") so user-typed
  // H1 markers in slide bodies don't accidentally close the section.
  for (let i = start + 1; i < children.length; i++) {
    if (isKnownH1(children[i])) {
      end = i;
      break;
    }
  }
  return { start, end };
}

function findDecisionH2Bounds(
  children: RootContent[],
  startExclusive: number,
  endExclusive: number,
  name: string
): { start: number; end: number } | null {
  const target = name.toLowerCase();
  let start = -1;
  for (let i = startExclusive; i < endExclusive; i++) {
    const c = children[i];
    if (c.type === "heading" && c.depth === 2 && headingText(c).toLowerCase() === target) {
      start = i;
      break;
    }
  }
  if (start < 0) return null;
  let end = endExclusive;
  // End on the next *known Decision-side* H2 (or any known H1).
  for (let i = start + 1; i < endExclusive; i++) {
    if (isKnownH1(children[i]) || isKnownDecisionH2(children[i])) {
      end = i;
      break;
    }
  }
  return { start, end };
}

function sliceContent(content: string, children: RootContent[], from: number, to: number): string {
  // Slice the raw body text between the END of `children[from]` (the heading)
  // and the START of `children[to]` (the next heading), if any.
  const firstNode = children[from];
  const startOffset = firstNode?.position?.end?.offset ?? 0;
  let endOffset = content.length;
  if (to < children.length) {
    endOffset = children[to]?.position?.start?.offset ?? content.length;
  }
  return content.slice(startOffset, endOffset).trim();
}

function parseMeta(slug: string, fm: Record<string, unknown>): SessionMeta {
  const status: SessionStatus =
    fm.status === "in-progress" || fm.status === "decided" || fm.status === "archived"
      ? fm.status
      : "draft";
  const now = new Date().toISOString();
  return {
    schema: "decision/v1",
    slug: typeof fm.slug === "string" ? fm.slug : slug,
    title: typeof fm.title === "string" ? fm.title : "Untitled decision",
    status,
    // YAML parses unquoted ISO 8601 datetimes (e.g. `created: 2026-05-15T10:00:00Z`)
    // as native Date objects, so accept both strings and Dates here.
    created: coerceIsoTimestamp(fm.created) ?? now,
    updated: coerceIsoTimestamp(fm.updated) ?? now,
  };
}

function coerceIsoTimestamp(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString();
  return null;
}

/**
 * Parse the Presentation H1 section into ordered slides + solutions.
 *
 * Schema (from the user's design):
 *   # Presentation
 *   ## <any title>          ← slide
 *   ## <any title>          ← slide
 *   ## Solutions            ← marker; everything after this is a solution
 *   ### <name>              ← solution
 *   ### <name>              ← solution
 */
function parsePresentation(
  content: string,
  children: RootContent[],
  start: number,
  end: number,
  diagnostics: ParseDiagnostic[]
): { slides: PresentationSlide[]; solutions: Solution[] } {
  // Find every top-level H2 inside Presentation.
  const h2Indexes: number[] = [];
  for (let i = start + 1; i < end; i++) {
    const c = children[i];
    if (c.type === "heading" && c.depth === 2) h2Indexes.push(i);
  }
  const solutionsAtIndexInList = h2Indexes.findIndex(
    (idx) => headingText(children[idx] as Heading).toLowerCase() === SOLUTIONS_MARKER
  );
  const slideHeadingIndexes =
    solutionsAtIndexInList < 0 ? h2Indexes : h2Indexes.slice(0, solutionsAtIndexInList);
  const solutionsHeadingIndex = solutionsAtIndexInList < 0 ? -1 : h2Indexes[solutionsAtIndexInList];

  // Slides: each H2 (other than `## Solutions`) is a slide.
  const slides: PresentationSlide[] = [];
  for (let k = 0; k < slideHeadingIndexes.length; k++) {
    const idx = slideHeadingIndexes[k];
    const node = children[idx] as Heading;
    const title = headingText(node);
    const nextIdx =
      k + 1 < slideHeadingIndexes.length
        ? slideHeadingIndexes[k + 1]
        : solutionsHeadingIndex >= 0
          ? solutionsHeadingIndex
          : end;
    const raw = sliceContent(content, children, idx, nextIdx);
    const { layout, body } = extractLayoutDirective(raw);
    slides.push({
      id: `slide-${k}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "untitled"}`,
      title,
      body,
      layout,
    });
  }

  // Solutions: every H3 after the `## Solutions` marker, until `# Decision`.
  const solutions: Solution[] = [];
  if (solutionsHeadingIndex >= 0) {
    const h3Indexes: number[] = [];
    for (let i = solutionsHeadingIndex + 1; i < end; i++) {
      const c = children[i];
      // Stop at any nested H2 (shouldn't happen in canonical files, but defend).
      if (c.type === "heading" && c.depth === 3) h3Indexes.push(i);
    }
    for (let k = 0; k < h3Indexes.length; k++) {
      const idx = h3Indexes[k];
      const name = headingText(children[idx] as Heading);
      if (!name) {
        diagnostics.push({
          level: "warning",
          section: "solutions",
          message: "Solution with empty name skipped",
        });
        continue;
      }
      const nextIdx = k + 1 < h3Indexes.length ? h3Indexes[k + 1] : end;
      const body = sliceContent(content, children, idx, nextIdx);
      const { layout, body: afterDirective } = extractLayoutDirective(body);
      const { description, pros, cons } = splitProsCons(afterDirective);
      solutions.push({
        id: name,
        name,
        description,
        pros,
        cons,
        layout,
      });
    }
  }

  return { slides, solutions };
}

function findFirstTable(children: RootContent[], start: number, end: number): Table | null {
  for (let i = start + 1; i < end; i++) {
    const c = children[i];
    if (c.type === "table") return c;
  }
  return null;
}

function parseCriteria(table: Table, diagnostics: ParseDiagnostic[]): Criterion[] {
  if (table.children.length < 1) return [];
  const header = rowCells(table.children[0]).map((s) => s.toLowerCase());
  const idCol = header.findIndex((h) => h === "id");
  const nameCol = header.findIndex((h) => h === "name");
  const typeCol = header.findIndex((h) => h === "type");
  const contestedCol = header.findIndex((h) => h === "contested");
  if (idCol < 0 || nameCol < 0 || typeCol < 0) {
    diagnostics.push({
      level: "error",
      section: "criteria",
      message: "Criteria table missing required columns (ID, Name, Type)",
    });
    return [];
  }
  const out: Criterion[] = [];
  for (let r = 1; r < table.children.length; r++) {
    const cells = rowCells(table.children[r]);
    const id = cells[idCol];
    const name = cells[nameCol];
    if (!id || !name) continue;
    const typeRaw = cells[typeCol]?.toLowerCase();
    const type: CriterionType = typeRaw === "required" ? "Required" : "Preferred";
    const contestedRaw = contestedCol >= 0 ? (cells[contestedCol]?.toLowerCase() ?? "") : "";
    const contested = ["yes", "y", "true"].includes(contestedRaw);
    out.push({ id, name, type, contested });
  }
  return out;
}

function parseScoreValue(raw: string): ScoreValue {
  const s = raw.trim().toLowerCase();
  if (s === "✓" || s === "yes" || s === "y" || s === "+") return "yes";
  if (s === "✗" || s === "no" || s === "n" || s === "-") return "no";
  return "unknown";
}

function parseScores(
  table: Table,
  solutionsByName: Map<string, string>,
  criteria: Criterion[],
  diagnostics: ParseDiagnostic[]
): ScoreCell[] {
  if (table.children.length < 1) return [];
  const headerCells = rowCells(table.children[0]);
  // header[0] is the (typically empty) corner label; header[1..] are solution names.
  const solutionIdsByCol: Array<string | null> = headerCells.map((cell, idx) => {
    if (idx === 0) return null;
    const id = solutionsByName.get(cell);
    if (!id) {
      diagnostics.push({
        level: "warning",
        section: "scores",
        message: `Score column "${cell}" doesn't match any solution`,
      });
      return null;
    }
    return id;
  });
  const criteriaById = new Map(criteria.map((c) => [c.id, c]));
  const out: ScoreCell[] = [];
  for (let r = 1; r < table.children.length; r++) {
    const cells = rowCells(table.children[r]);
    // First column is "<criterion-id>: <name>" or just "<criterion-id>".
    const rowLabel = cells[0] ?? "";
    const [maybeId] = rowLabel.split(":").map((s) => s.trim());
    if (!criteriaById.has(maybeId)) {
      diagnostics.push({
        level: "warning",
        section: "scores",
        message: `Score row "${rowLabel}" doesn't match any criterion`,
      });
      continue;
    }
    for (let c = 1; c < cells.length; c++) {
      const solId = solutionIdsByCol[c];
      if (!solId) continue;
      const value = parseScoreValue(cells[c] ?? "");
      if (value !== "unknown") {
        out.push({ solutionId: solId, criterionId: maybeId, value });
      }
    }
  }
  return out;
}

function parseHistory(children: RootContent[], start: number, end: number): HistoryEntry[] {
  for (let i = start + 1; i < end; i++) {
    const c = children[i];
    if (c.type === "list") {
      return (c as List).children.map((li) => {
        const txt = nodeText(li as never).trim();
        const m = /^(\S+?)\s+[—\-–]\s+(.+)$/.exec(txt);
        if (m) return { timestamp: m[1], message: m[2] };
        return { timestamp: "", message: txt };
      });
    }
  }
  return [];
}

export function parseSession(slug: string, raw: string): Session {
  const diagnostics: ParseDiagnostic[] = [];
  const parsed = matter(raw);
  const fm = parsed.data as Record<string, unknown>;
  const content = parsed.content;
  const tree = processor.parse(content) as Root;
  const children = tree.children as RootContent[];

  const meta = parseMeta(slug, fm);

  const presBounds = findH1Bounds(children, "Presentation");
  let slides: PresentationSlide[] = [];
  let solutions: Solution[] = [];
  if (presBounds) {
    const parsed = parsePresentation(
      content,
      children,
      presBounds.start,
      presBounds.end,
      diagnostics
    );
    slides = parsed.slides;
    solutions = parsed.solutions;
  } else {
    diagnostics.push({
      level: "warning",
      section: "presentation",
      message: "No '# Presentation' section found",
    });
  }

  const decBounds = findH1Bounds(children, "Decision");
  let criteria: Criterion[] = [];
  let scores: ScoreCell[] = [];
  let decision = "";
  let history: HistoryEntry[] = [];
  if (decBounds) {
    const critBounds = findDecisionH2Bounds(
      children,
      decBounds.start + 1,
      decBounds.end,
      "Criteria"
    );
    if (critBounds) {
      const t = findFirstTable(children, critBounds.start, critBounds.end);
      if (t) criteria = parseCriteria(t, diagnostics);
    }
    const scoreBounds = findDecisionH2Bounds(
      children,
      decBounds.start + 1,
      decBounds.end,
      "Scores"
    );
    if (scoreBounds) {
      const t = findFirstTable(children, scoreBounds.start, scoreBounds.end);
      if (t) {
        const solByName = new Map(solutions.map((s) => [s.name, s.id]));
        scores = parseScores(t, solByName, criteria, diagnostics);
      }
    }
    const decBounds2 = findDecisionH2Bounds(
      children,
      decBounds.start + 1,
      decBounds.end,
      "Decision"
    );
    if (decBounds2) {
      decision = sliceContent(content, children, decBounds2.start, decBounds2.end);
    }
    const histBounds = findDecisionH2Bounds(
      children,
      decBounds.start + 1,
      decBounds.end,
      "History"
    );
    if (histBounds) {
      history = parseHistory(children, histBounds.start, histBounds.end);
    }
  } else {
    diagnostics.push({
      level: "warning",
      section: "decision",
      message: "No '# Decision' section found",
    });
  }

  const pickedSolution =
    typeof fm.picked === "string" && solutions.some((s) => s.id === fm.picked)
      ? (fm.picked as string)
      : undefined;

  return {
    meta,
    slides,
    solutions,
    criteria,
    scores,
    decision,
    history,
    pickedSolution,
    diagnostics,
  };
}
