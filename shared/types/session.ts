// Typed domain model for a decision session.
// Mirrors §6 of docs/spec.md.

export type SchemaVersion = "decision/v1";

export type SessionStatus = "draft" | "in-progress" | "decided" | "archived";

export type CriterionType = "Required" | "Preferred";

export type ScoreValue = "yes" | "no" | "unknown";

export interface SessionMeta {
  schema: SchemaVersion;
  slug: string;
  title: string;
  status: SessionStatus;
  created: string;
  updated: string;
}

export type SlideLayout =
  | "title-body"
  | "split-right"
  | "split-left"
  | "image-full"
  | "bullets"
  | "quote";

export interface Solution {
  id: string;
  name: string;
  description: string;
  pros: string[];
  cons: string[];
  layout?: SlideLayout;
}

export interface Criterion {
  id: string;
  name: string;
  type: CriterionType;
  contested: boolean;
}

export interface ScoreCell {
  solutionId: string;
  criterionId: string;
  value: ScoreValue;
}

export interface HistoryEntry {
  timestamp: string;
  message: string;
}

export interface ParseDiagnostic {
  level: "error" | "warning";
  section?:
    | "frontmatter"
    | "presentation"
    | "decision"
    | "problem"
    | "solutions"
    | "criteria"
    | "scores"
    | "decision_text"
    | "history";
  message: string;
  ref?: { kind: "solution" | "criterion" | "score"; id: string };
}

export interface PresentationSlide {
  /** Stable internal id (not serialized). */
  id: string;
  /** The H2 heading text — user-chosen. */
  title: string;
  /** Body markdown. */
  body: string;
  layout?: SlideLayout;
}

export interface Session {
  meta: SessionMeta;
  /** Free-form slides in the Presentation tab, before the `## Solutions` marker. */
  slides: PresentationSlide[];
  solutions: Solution[];
  criteria: Criterion[];
  scores: ScoreCell[];
  decision: string;
  history: HistoryEntry[];
  pickedSolution?: string;
  unknownSections?: Array<{ heading: string; rawMarkdown: string; afterHeading: string }>;
  diagnostics: ParseDiagnostic[];
}
