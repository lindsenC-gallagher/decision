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
      // Sizes chosen to match PowerPoint defaults at slide-display zoom:
      //   body 32px ≈ 24pt, code 32px ≈ 24pt (body-equivalent for legibility),
      //   inline code 27px, prose's em-scaled h1=72px / h2=48px / h3=40px.
      className="prose prose-neutral max-w-none [&_pre]:text-[1em] [&_code]:text-[0.85em] [&_pre]:leading-snug [&_pre]:my-3 [&_pre]:py-3"
      style={{ fontSize: "2rem" }}
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
