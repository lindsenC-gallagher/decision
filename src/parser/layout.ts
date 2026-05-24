// Slide layout directive parsing + auto-selection (§7.3 of docs/spec.md).

import type { SlideLayout } from "@shared/types/session";

const VALID_LAYOUTS: SlideLayout[] = [
  "title-body",
  "split-right",
  "split-left",
  "image-full",
  "bullets",
  "quote",
];

const DIRECTIVE_RE = /^\s*<!--\s*slide:\s*layout\s*=\s*([a-z-]+)[^>]*-->\s*$/im;

/**
 * Returns `{ layout, body }` where `body` is the input with the directive line
 * stripped if present. If no directive, `layout` is undefined and body is returned as-is.
 */
export function extractLayoutDirective(md: string): { layout?: SlideLayout; body: string } {
  const lines = md.split(/\r?\n/);
  for (let i = 0; i < Math.min(lines.length, 3); i++) {
    const m = lines[i].match(DIRECTIVE_RE);
    if (m) {
      const candidate = m[1].toLowerCase();
      if ((VALID_LAYOUTS as string[]).includes(candidate)) {
        const before = lines.slice(0, i);
        const after = lines.slice(i + 1);
        return {
          layout: candidate as SlideLayout,
          body: [...before, ...after].join("\n").replace(/^\n+/, ""),
        };
      }
    }
  }
  return { body: md };
}

/**
 * Auto-detect a layout from the body content when no directive is present.
 * Rules per docs/spec.md §7.3.3.
 */
export function autoLayout(body: string): SlideLayout {
  const trimmed = body.trim();
  if (!trimmed) return "title-body";

  // Single blockquote at the very start (the whole first paragraph is quoted).
  if (/^>\s/.test(trimmed)) return "quote";

  // First non-empty line is a block image.
  const firstLine = trimmed.split(/\r?\n/, 1)[0];
  if (/^\s*!\[[^\]]*]\([^)]+\)\s*$/.test(firstLine)) return "split-right";

  // Body is entirely a list (every non-empty line is a list item).
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length > 0 && lines.every((l) => /^\s*([-*+]|\d+\.)\s/.test(l))) return "bullets";

  return "title-body";
}

export function layoutDirectiveString(layout: SlideLayout): string {
  return `<!-- slide: layout=${layout} -->`;
}
