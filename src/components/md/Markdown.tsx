import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { convertFileSrc } from "@tauri-apps/api/core";
import { CodeBlock } from "./CodeBlock";

/**
 * Wraps react-markdown with the project's customizations:
 *   - GFM (tables, strikethrough, task lists)
 *   - Fenced code blocks → Shiki-highlighted with copy button
 *   - `language=mermaid` → diagram
 *   - Local image paths via Tauri's `convertFileSrc`
 *   - HTML disabled (skipHtml) for safety
 */
export function Markdown({ md, baseDir }: { md: string; baseDir?: string }) {
  return (
    <div className="prose prose-neutral max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          code({ className, children, ...rest }) {
            const text = String(children).replace(/\n$/, "");
            // react-markdown invokes this for both inline `code` and fenced blocks.
            // Inline code has no `language-*` class; fenced blocks do.
            const match = /language-(\w+)/.exec(className ?? "");
            if (!match) {
              return (
                <code
                  className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-[0.9em]"
                  {...rest}
                >
                  {children}
                </code>
              );
            }
            return <CodeBlock code={text} lang={match[1]} />;
          },
          img({ src, alt }) {
            const resolved = resolveImageSrc(src ?? "", baseDir);
            return <img src={resolved} alt={alt ?? ""} className="my-3 max-w-full rounded-md" />;
          },
        }}
      >
        {md}
      </ReactMarkdown>
    </div>
  );
}

function resolveImageSrc(src: string, baseDir?: string): string {
  if (!src) return "";
  if (/^https?:|^data:|^asset:|^tauri:/i.test(src)) return src;
  // Treat as a path relative to baseDir (the session's folder).
  if (baseDir) {
    // Strip a leading "./" if present.
    const rel = src.replace(/^\.\//, "");
    return convertFileSrc(`${baseDir.replace(/[/\\]$/, "")}/${rel}`);
  }
  return convertFileSrc(src);
}
