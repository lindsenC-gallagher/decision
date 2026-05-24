import { useEffect, useState } from "react";
import { getHighlighter, highlightSync } from "@/lib/highlighter";
import { MermaidBlock } from "./MermaidBlock";

interface Props {
  code: string;
  lang: string;
}

export function CodeBlock({ code, lang }: Props) {
  const [html, setHtml] = useState<string | null>(() => highlightSync(code, lang));
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!html) {
      void getHighlighter().then(() => {
        if (!cancelled) setHtml(highlightSync(code, lang));
      });
    } else {
      setHtml(highlightSync(code, lang));
    }
    return () => {
      cancelled = true;
    };
  }, [code, lang, html]);

  if (lang === "mermaid") return <MermaidBlock code={code} />;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard not available */
    }
  };

  return (
    <div className="group relative my-3 overflow-hidden rounded-md border border-neutral-200 bg-neutral-50 text-sm">
      <button
        onClick={onCopy}
        className="absolute right-2 top-2 rounded border border-neutral-300 bg-white px-2 py-0.5 font-mono text-xs text-neutral-600 opacity-0 transition group-hover:opacity-100"
      >
        {copied ? "copied" : "copy"}
      </button>
      {html ? (
        <div
          className="overflow-auto p-4 [&_pre]:!bg-transparent [&_pre]:!m-0 [&_pre]:!p-0"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="overflow-auto p-4 font-mono text-xs leading-relaxed">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}
