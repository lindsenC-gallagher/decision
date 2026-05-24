// Lazily-initialized Shiki highlighter. Code blocks call into this via the
// `CodeBlock` component; the highlighter loads once on first use.

import { createHighlighter, type Highlighter, type BundledLanguage } from "shiki";

let highlighter: Highlighter | null = null;
let pending: Promise<Highlighter> | null = null;

const LANGS: BundledLanguage[] = [
  "typescript",
  "javascript",
  "tsx",
  "jsx",
  "python",
  "go",
  "rust",
  "bash",
  "shell",
  "json",
  "yaml",
  "markdown",
  "html",
  "css",
  "sql",
];

export async function getHighlighter(): Promise<Highlighter> {
  if (highlighter) return highlighter;
  if (!pending) {
    pending = createHighlighter({
      themes: ["github-light"],
      langs: LANGS,
    }).then((h) => {
      highlighter = h;
      return h;
    });
  }
  return pending;
}

export function highlightSync(code: string, lang: string): string | null {
  if (!highlighter) return null;
  const language = (LANGS as string[]).includes(lang) ? lang : "text";
  try {
    return highlighter.codeToHtml(code, { lang, theme: "github-light" });
  } catch {
    try {
      return highlighter.codeToHtml(code, { lang: language, theme: "github-light" });
    } catch {
      return null;
    }
  }
}
