import { useLayoutEffect, useRef, type ReactNode } from "react";

/**
 * Renders children at their natural size, then applies CSS `zoom` so the
 * content fills the available container without scrolling.
 *
 *   one short sentence  → scales UP   (up to `maxScale`)
 *   busy slide          → scales DOWN (down to `minScale`, then clips)
 *
 * We use `zoom` (not `transform: scale`) because `zoom` re-rasterizes the
 * content at the scaled size — text, code blocks, and SVG stay crisp at any
 * zoom level. `transform: scale` rasterizes once at 1× and upscales the
 * bitmap, which looks blurry above 1×. `zoom` is non-standard CSS but
 * supported in all Chromium-based engines (which WebView2 is).
 *
 * We only observe the container — not the inner element — to avoid the
 * feedback loop where applying `zoom` itself changes the inner's reported
 * size and triggers re-measurement. Content-driven re-measures fall out of
 * React's render cycle via the `children` dep on the effect.
 */
export function ScaledSlide({
  children,
  // Base sizes inside slides are already presentation-large (~32-72px). We
  // allow a small bump for very sparse slides (up to 1.4×). The shrink path
  // is the workhorse: a busy slide scales down to fit. `minScale = 0.55`
  // keeps fenced code blocks (~27px natural) from dropping below ~15px even
  // on very dense slides; content overflowing past that point is clipped
  // rather than further compressed (split your slide instead).
  maxScale = 1.4,
  minScale = 0.55,
}: {
  children: ReactNode;
  maxScale?: number;
  minScale?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const inner = innerRef.current;
    if (!container || !inner) return;

    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // Reset to 1× before measuring so scrollWidth/Height are the natural
        // (un-zoomed) intrinsic content sizes.
        inner.style.zoom = "1";
        const cw = container.clientWidth;
        const ch = container.clientHeight;
        const iw = inner.scrollWidth;
        const ih = inner.scrollHeight;
        if (cw === 0 || ch === 0 || iw === 0 || ih === 0) return;
        const fit = Math.min(cw / iw, ch / ih);
        const scale = Math.max(minScale, Math.min(maxScale, fit));
        inner.style.zoom = String(scale);
      });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    // Re-measure once after async resources (fonts, Shiki, Mermaid) land.
    const onLoad = () => measure();
    window.addEventListener("load", onLoad);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("load", onLoad);
    };
  }, [maxScale, minScale, children]);

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full items-center justify-center overflow-hidden"
    >
      <div ref={innerRef}>{children}</div>
    </div>
  );
}
