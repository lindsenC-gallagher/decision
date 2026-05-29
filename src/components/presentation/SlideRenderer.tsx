import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { autoLayout } from "@/parser/layout";
import { combineProsCons } from "@/parser/prosCons";
import type { SlideLayout } from "@shared/types/session";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/md/Markdown";
import { ScaledSlide } from "./ScaledSlide";
import { useDecisionStore } from "@/store/useDecisionStore";

const ALL_LAYOUTS: SlideLayout[] = [
  "title-body",
  "split-right",
  "split-left",
  "image-full",
  "bullets",
  "quote",
];

interface Props {
  title: string;
  body: string;
  pros?: string[];
  cons?: string[];
  layout?: SlideLayout;
  baseDir?: string;
  slug: string;
  onTitleChange?: (s: string) => void;
  /**
   * For slides: receives the body markdown.
   * For solutions: receives the **combined** body (description + Pros + Cons
   * blocks as typed in the textarea); the caller is responsible for splitting
   * via `setSolutionFullBody` in the store. The body prop is still the
   * description-only string used in the preview.
   */
  onBodyChange: (md: string) => void;
  onLayoutChange?: (l: SlideLayout | undefined) => void;
}

export function SlideRenderer({
  title,
  body,
  pros,
  cons,
  layout,
  baseDir,
  slug,
  onTitleChange,
  onBodyChange,
  onLayoutChange,
}: Props) {
  const [editing, setEditing] = useState(false);
  const presenting = useDecisionStore((s) => s.presenting);
  const effectiveLayout = useMemo<SlideLayout>(() => layout ?? autoLayout(body), [layout, body]);

  // For solutions (where pros/cons are tracked separately), the textarea
  // shows the *combined* body so the user can edit pros/cons inline alongside
  // the description.
  const isSolution = pros !== undefined || cons !== undefined;
  const editingBody = useMemo(
    () => (isSolution ? combineProsCons(body, pros ?? [], cons ?? []) : body),
    [isSolution, body, pros, cons]
  );

  const insertImage = async () => {
    const selected = await openDialog({
      multiple: false,
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg"] }],
    });
    if (!selected || typeof selected !== "string") return;
    const rel = await invoke<string>("import_image", { slug, sourcePath: selected });
    const insertion = `\n![](${rel})\n`;
    onBodyChange((body || "") + insertion);
  };

  const firstImageSrc = extractFirstImage(body);
  const bodyWithoutFirstImage = firstImageSrc
    ? body.replace(/^\s*!\[[^\]]*]\([^)]+\)\s*\n?/, "")
    : body;

  return (
    <div className="relative h-full">
      {!presenting && (
        <SlideToolbar
          editing={editing}
          layout={effectiveLayout}
          isExplicit={!!layout}
          onSetEditing={setEditing}
          onSetLayout={onLayoutChange}
          onAddImage={insertImage}
        />
      )}

      {editing ? (
        <div className="h-full overflow-auto p-12">
          <EditorTextarea
            body={editingBody}
            onBodyChange={onBodyChange}
            onBlur={() => setEditing(false)}
          />
        </div>
      ) : (
        <ScaledSlide>
          <div className="p-12">
            <SlideBody
              layout={effectiveLayout}
              title={title}
              body={body}
              bodyWithoutFirstImage={bodyWithoutFirstImage}
              firstImageSrc={firstImageSrc}
              pros={pros}
              cons={cons}
              baseDir={baseDir}
              onTitleChange={onTitleChange}
              onEdit={() => setEditing(true)}
            />
          </div>
        </ScaledSlide>
      )}
    </div>
  );
}

/**
 * Edit-mode textarea. Owns its own ref so focus is set imperatively on mount
 * (more reliable than the `autoFocus` attribute, which has lost focus races
 * inside Tauri's WebView2 webview), and stops keydown propagation so no
 * window-level handler (tab switch, fullscreen, slide nav) can interfere
 * with characters that happen to be typed via Shift/AltGr combos.
 */
function EditorTextarea({
  body,
  onBodyChange,
  onBlur,
}: {
  body: string;
  onBodyChange: (md: string) => void;
  onBlur: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    // Position cursor at end for "click-to-edit" continuity.
    const end = el.value.length;
    el.setSelectionRange(end, end);
  }, []);
  return (
    <textarea
      ref={ref}
      value={body}
      onChange={(e) => onBodyChange(e.target.value)}
      onBlur={onBlur}
      className="min-h-[400px] w-full rounded-md border border-neutral-300 bg-white p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
      spellCheck={false}
      placeholder="Markdown supported. Use ![alt](path) for images, fenced code blocks with language tags, and ```mermaid for diagrams."
    />
  );
}

function SlideToolbar({
  editing,
  layout,
  isExplicit,
  onSetEditing,
  onSetLayout,
  onAddImage,
}: {
  editing: boolean;
  layout: SlideLayout;
  isExplicit: boolean;
  onSetEditing: (v: boolean) => void;
  onSetLayout?: (l: SlideLayout | undefined) => void;
  onAddImage: () => void;
}) {
  return (
    <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
      <select
        value={isExplicit ? layout : ""}
        onChange={(e) => onSetLayout?.((e.target.value || undefined) as SlideLayout | undefined)}
        className="rounded-md border border-neutral-300 bg-white px-2 py-1 font-mono text-xs"
        title="Layout"
      >
        <option value="">auto ({layout})</option>
        {ALL_LAYOUTS.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
      <button
        onClick={onAddImage}
        className="rounded-md border border-neutral-300 bg-white px-2 py-1 font-mono text-xs hover:bg-neutral-50"
      >
        + image
      </button>
      <button
        onClick={() => onSetEditing(!editing)}
        className="rounded-md border border-neutral-300 bg-white px-2 py-1 font-mono text-xs hover:bg-neutral-50"
      >
        {editing ? "preview" : "edit md"}
      </button>
    </div>
  );
}

/**
 * Click-to-edit shell that wraps slide-body content. Implemented as a
 * `<div role="button">` rather than a `<button>` so the slide body can safely
 * contain other interactive elements (e.g. the Copy button inside a code
 * block) without producing nested-button HTML.
 */
function EditableArea({
  onEdit,
  className,
  children,
}: {
  onEdit: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => {
        // Avoid swallowing clicks targeted at nested controls (links, the
        // Copy button on a code block, etc.).
        if ((e.target as HTMLElement).closest("button, a, input, textarea")) return;
        onEdit();
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit();
        }
      }}
      className={cn("block w-full cursor-text text-left", className)}
    >
      {children}
    </div>
  );
}

function SlideBody({
  layout,
  title,
  body,
  bodyWithoutFirstImage,
  firstImageSrc,
  pros,
  cons,
  baseDir,
  onTitleChange,
  onEdit,
}: {
  layout: SlideLayout;
  title: string;
  body: string;
  bodyWithoutFirstImage: string;
  firstImageSrc: string | null;
  pros?: string[];
  cons?: string[];
  baseDir?: string;
  onTitleChange?: (s: string) => void;
  onEdit: () => void;
}) {
  const titleEl = onTitleChange ? (
    <input
      value={title}
      onChange={(e) => onTitleChange(e.target.value)}
      className="w-full bg-transparent text-5xl font-semibold tracking-tight outline-none focus:underline focus:decoration-neutral-300"
      spellCheck={false}
    />
  ) : (
    <h1 className="text-5xl font-semibold tracking-tight">{title}</h1>
  );

  const empty = !body.trim() && !pros?.length && !cons?.length;

  switch (layout) {
    case "split-right":
    case "split-left": {
      const imgPane = firstImageSrc ? (
        <ImagePanel src={firstImageSrc} baseDir={baseDir} />
      ) : (
        <PlaceholderPanel hint="Add an image to fill this pane (see + image)." />
      );
      const textPane = (
        <EditableArea onEdit={onEdit}>
          <Markdown md={bodyWithoutFirstImage || body} baseDir={baseDir} />
          <ProsCons pros={pros} cons={cons} />
        </EditableArea>
      );
      return (
        <div className="mx-auto max-w-6xl">
          <div className="mb-6">{titleEl}</div>
          <div className="grid grid-cols-2 gap-6">
            {layout === "split-left" ? imgPane : textPane}
            {layout === "split-left" ? textPane : imgPane}
          </div>
        </div>
      );
    }
    case "image-full": {
      return (
        <div className="mx-auto max-w-5xl">
          {firstImageSrc && (
            <div className="relative mb-4 overflow-hidden rounded-md">
              <ImagePanel src={firstImageSrc} baseDir={baseDir} large />
            </div>
          )}
          <div className="mb-4">{titleEl}</div>
          <EditableArea onEdit={onEdit}>
            <Markdown md={bodyWithoutFirstImage || body} baseDir={baseDir} />
            <ProsCons pros={pros} cons={cons} />
          </EditableArea>
        </div>
      );
    }
    case "bullets": {
      return (
        <div className="mx-auto max-w-3xl">
          <div className="mb-6">{titleEl}</div>
          <EditableArea onEdit={onEdit}>
            <div className="prose prose-xl prose-neutral max-w-none">
              <Markdown md={body} baseDir={baseDir} />
            </div>
            <ProsCons pros={pros} cons={cons} />
          </EditableArea>
        </div>
      );
    }
    case "quote": {
      return (
        <div className="mx-auto flex max-w-3xl flex-col justify-center text-center">
          <div className="mb-8">{titleEl}</div>
          <EditableArea onEdit={onEdit}>
            <div className="prose prose-xl prose-neutral max-w-none italic">
              <Markdown md={body} baseDir={baseDir} />
            </div>
            <ProsCons pros={pros} cons={cons} />
          </EditableArea>
        </div>
      );
    }
    case "title-body":
    default:
      return (
        <div className="mx-auto max-w-3xl">
          <div className="mb-6">{titleEl}</div>
          <EditableArea
            onEdit={onEdit}
            className="rounded-md p-2 hover:bg-neutral-100"
          >
            {empty ? (
              <span className="text-neutral-400">Click to add content. Markdown supported.</span>
            ) : (
              <>
                <Markdown md={body} baseDir={baseDir} />
                <ProsCons pros={pros} cons={cons} />
              </>
            )}
          </EditableArea>
        </div>
      );
  }
}

function ProsCons({ pros, cons }: { pros?: string[]; cons?: string[] }) {
  if (!pros?.length && !cons?.length) return null;
  // Sized to match the body markdown (32px) so the slide reads consistently.
  // ScaledSlide can still shrink the whole slide if there's too much content.
  return (
    <div className="mt-8 grid grid-cols-2 gap-8">
      {!!pros?.length && (
        <div>
          <div className="mb-3 font-mono text-xl uppercase tracking-wider text-emerald-700">
            Pros
          </div>
          <ul className="list-disc space-y-2 pl-6 text-3xl leading-snug">
            {pros.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      {!!cons?.length && (
        <div>
          <div className="mb-3 font-mono text-xl uppercase tracking-wider text-red-700">Cons</div>
          <ul className="list-disc space-y-2 pl-6 text-3xl leading-snug">
            {cons.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ImagePanel({ src, baseDir, large }: { src: string; baseDir?: string; large?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-md bg-neutral-100",
        large ? "p-2" : "p-4"
      )}
    >
      <Markdown md={`![](${src})`} baseDir={baseDir} />
    </div>
  );
}

function PlaceholderPanel({ hint }: { hint: string }) {
  return (
    <div className="flex items-center justify-center rounded-md border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
      {hint}
    </div>
  );
}

function extractFirstImage(body: string): string | null {
  const m = body.match(/^\s*!\[[^\]]*]\(([^)]+)\)\s*$/m);
  return m ? m[1] : null;
}
