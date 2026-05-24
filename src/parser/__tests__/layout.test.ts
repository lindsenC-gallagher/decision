import { describe, it, expect } from "vitest";
import { extractLayoutDirective, autoLayout, layoutDirectiveString } from "../layout";

describe("extractLayoutDirective", () => {
  it("returns undefined layout when no directive present", () => {
    const { layout, body } = extractLayoutDirective("Hello world");
    expect(layout).toBeUndefined();
    expect(body).toBe("Hello world");
  });

  it("extracts a known layout and strips the comment", () => {
    const md = `<!-- slide: layout=image-full -->\n\nHello`;
    const { layout, body } = extractLayoutDirective(md);
    expect(layout).toBe("image-full");
    expect(body).toBe("Hello");
  });

  it("ignores an unknown layout value", () => {
    const md = `<!-- slide: layout=spaghetti -->\nHello`;
    const { layout, body } = extractLayoutDirective(md);
    expect(layout).toBeUndefined();
    expect(body).toBe(md);
  });

  it("only checks the first few lines", () => {
    const md = `line1\nline2\nline3\nline4\n<!-- slide: layout=quote -->\n`;
    const { layout } = extractLayoutDirective(md);
    expect(layout).toBeUndefined();
  });
});

describe("autoLayout", () => {
  it("returns title-body for empty body", () => {
    expect(autoLayout("")).toBe("title-body");
  });

  it("returns quote for a leading blockquote", () => {
    expect(autoLayout("> A quote\n— Author")).toBe("quote");
  });

  it("returns split-right for a leading block image", () => {
    expect(autoLayout("![alt](./img.png)\n\nText after")).toBe("split-right");
  });

  it("returns bullets for a pure list", () => {
    expect(autoLayout("- One\n- Two\n- Three")).toBe("bullets");
    expect(autoLayout("1. One\n2. Two")).toBe("bullets");
  });

  it("returns title-body otherwise", () => {
    expect(autoLayout("Paragraph here.")).toBe("title-body");
  });
});

describe("layoutDirectiveString", () => {
  it("emits the canonical comment", () => {
    expect(layoutDirectiveString("split-right")).toBe("<!-- slide: layout=split-right -->");
  });
});
