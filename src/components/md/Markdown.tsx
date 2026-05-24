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
  // Presentation-scale base sizes. Body paragraphs land around 36px (twice
  // a normal doc), headings scale up proportionally via prose's em-based
  // sizing. `<ScaledSlide>` zooms the whole slide DOWN if there's too much
  // content, so it's safe to start big here.
  return (
    <div
      // Presentation-scaled, code-emphasised. Code blocks sit *above* body
      // prose so a technical slide (e.g. the SQL on the Current state slide)
      // reads as the focal element while supporting paragraphs feel like
      // context. Inline code stays close to body so it doesn't dominate
      // mid-sentence.
      //   body 28px (1.75rem)
      //   pre  35px (1.25em of body)  ← larger than body for emphasis
      //   inline code 24px (0.85em of body)
      //   prose's em-scaled h1≈63px / h2≈42px / h3≈35px (inside body)
      className="prose prose-neutral max-w-none [&_pre]:text-[1.25em] [&_code]:text-[0.85em] [&_pre]:leading-snug [&_pre]:my-3 [&_pre]:py-3"
      style={{ fontSize: "1.75rem" }}
    >
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
