import { useEffect, useRef, useState } from "react";

let mermaidInitialized = false;
async function ensureMermaid() {
  const mod = await import("mermaid");
  const mermaid = mod.default;
  if (!mermaidInitialized) {
    mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "loose" });
    mermaidInitialized = true;
  }
  return mermaid;
}

let nextId = 0;

export function MermaidBlock({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const id = `mermaid-${++nextId}`;
    void ensureMermaid().then(async (m) => {
      try {
        const { svg } = await m.render(id, code);
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) {
    return (
      <div className="my-3 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
        <div className="mb-1 font-medium">Mermaid parse error</div>
        <pre className="overflow-auto font-mono">{code}</pre>
      </div>
    );
  }

  return <div ref={ref} className="my-3 flex justify-center overflow-auto" />;
}
