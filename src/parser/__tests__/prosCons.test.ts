import { describe, it, expect } from "vitest";
import { splitProsCons, combineProsCons } from "../prosCons";

describe("splitProsCons", () => {
  it("returns the input as description when no pros/cons present", () => {
    const r = splitProsCons("Just some prose.");
    expect(r.description).toBe("Just some prose.");
    expect(r.pros).toEqual([]);
    expect(r.cons).toEqual([]);
  });

  it("extracts a Pros block and strips it from description", () => {
    const md = "Intro line.\n\n**Pros**\n\n- Fast\n- Cheap";
    const r = splitProsCons(md);
    expect(r.description).toBe("Intro line.");
    expect(r.pros).toEqual(["Fast", "Cheap"]);
    expect(r.cons).toEqual([]);
  });

  it("extracts both Pros and Cons blocks", () => {
    const md = "Body.\n\n**Pros**\n- A\n- B\n\n**Cons**\n- C";
    const r = splitProsCons(md);
    expect(r.description).toBe("Body.");
    expect(r.pros).toEqual(["A", "B"]);
    expect(r.cons).toEqual(["C"]);
  });

  it("is case-insensitive on the **Pros** / **Cons** markers", () => {
    const md = "**pros**\n- yes\n\n**CONS**\n- no";
    const r = splitProsCons(md);
    expect(r.pros).toEqual(["yes"]);
    expect(r.cons).toEqual(["no"]);
  });

  it("ignores items that aren't list bullets in the Pros/Cons block", () => {
    const md = "**Pros**\n\nThis is plain text\n- Real item";
    const r = splitProsCons(md);
    expect(r.pros).toEqual(["Real item"]);
  });
});

describe("combineProsCons", () => {
  it("returns plain description when both lists empty", () => {
    expect(combineProsCons("Body.", [], [])).toBe("Body.");
  });

  it("appends Pros block when description is empty", () => {
    expect(combineProsCons("", ["A"], [])).toBe("**Pros**\n\n- A");
  });

  it("appends both blocks separated by blank lines", () => {
    const out = combineProsCons("Body.", ["A", "B"], ["C"]);
    expect(out).toBe("Body.\n\n**Pros**\n\n- A\n- B\n\n**Cons**\n\n- C");
  });
});

describe("split / combine round-trip", () => {
  it("recovers the original description and lists", () => {
    const md = "Some description.\n\n**Pros**\n\n- one\n- two\n\n**Cons**\n\n- three";
    const split = splitProsCons(md);
    const recombined = combineProsCons(split.description, split.pros, split.cons);
    const split2 = splitProsCons(recombined);
    expect(split2).toEqual(split);
  });
});
