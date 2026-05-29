// Regression tests for bugs found during exploratory testing.
// Each describe-block names the bug; tests should start RED (demonstrating the
// bug) and turn GREEN once the fix lands.

import { test, expect } from "./fixtures";

test.describe("bug: pluralization in counts", () => {
  test("outline header pluralizes slide count when only one slide remains", async ({ page }) => {
    // Seeded session has 2 slides (Problem, Background) + 2 solutions.
    await page.goto("/sessions/framework-choice");

    // Plural form first — 2 slides / 2 solutions.
    const outline = page.locator("aside").getByText(/Outline ·/i);
    let text = (await outline.textContent()) ?? "";
    expect(text).toMatch(/\b2 slides\b/);
    expect(text).toMatch(/\b2 solutions\b/);

    // Remove the Background slide → expect singular "1 slide".
    const backgroundItem = page.locator("aside ul li").nth(1);
    await backgroundItem.hover();
    await backgroundItem.getByRole("button", { name: /Delete slide/i }).click();

    text = (await outline.textContent()) ?? "";
    expect(text).toMatch(/\b1 slide\b/); // singular
    expect(text).not.toMatch(/\b1 slides\b/);
  });

  test("Scoring header pluralizes solution count when only one remains", async ({ page }) => {
    await page.goto("/sessions/framework-choice");
    await page.locator("header button[aria-selected]").filter({ hasText: "Decision" }).click();

    // Remove SvelteKit (2nd column in the scoring matrix) so we have 1
    // solution × 2 criteria. The scoring matrix is the 2nd table on the page.
    const scoringHeaderCells = page.locator("section table").nth(1).locator("thead th");
    await scoringHeaderCells.nth(2).getByRole("button", { name: "×" }).click();

    const heading = page.getByText(/Scoring · /i);
    const txt = (await heading.textContent()) ?? "";
    expect(txt).toMatch(/2 criteria/);
    expect(txt).toMatch(/\b1 solution\b/); // singular
    expect(txt).not.toMatch(/\b1 solutions\b/);
  });
});

test.describe("bug: arrow keys leak between tabs", () => {
  test("ArrowRight on Decision tab does NOT advance the hidden Presentation deck", async ({
    page,
  }) => {
    await page.goto("/sessions/framework-choice");

    // Confirm we start on Presentation, slide 01. The deck size is dictated
    // by the fixture (2 slides + 2 solutions = 4 items), so match only the
    // leading index — the total may evolve as the fixture does.
    await expect(page.getByText(/^01 \/ \d{2}$/)).toBeVisible();

    // Switch to Decision tab.
    await page.locator("header button[aria-selected]").filter({ hasText: "Decision" }).click();

    // Press arrow keys — these should NOT mutate the presentation index.
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");

    // Switch back to Presentation. Index should still be 01.
    await page.locator("header button[aria-selected]").filter({ hasText: "Presentation" }).click();
    await expect(page.getByText(/^01 \/ \d{2}$/)).toBeVisible();
  });
});

test.describe("bug: removing a criterion silently drops scores", () => {
  test("removing a criterion that has scores asks for confirmation", async ({ page }) => {
    await page.goto("/sessions/framework-choice");
    await page.locator("header button[aria-selected]").filter({ hasText: "Decision" }).click();

    // Decline the confirmation — criterion should remain.
    page.once("dialog", (dialog) => {
      expect(dialog.type()).toBe("confirm");
      void dialog.dismiss();
    });

    // The criteria editor is the first <table>. C1's row is the first tbody row.
    const critTable = page.locator("main table").first();
    const c1Row = critTable.locator("tbody tr").first();
    const nameInput = c1Row.locator("input[type='text'], input:not([type])").first();
    await expect(nameInput).toHaveValue("Stateless");

    await c1Row.getByRole("button", { name: "×" }).click();

    // C1 should still be in the criteria editor — the input value is preserved.
    await expect(nameInput).toHaveValue("Stateless");
  });
});

test.describe("bug: no UI when all solutions are eliminated", () => {
  test("eliminating all solutions surfaces a banner explaining the state", async ({ page }) => {
    await page.goto("/sessions/framework-choice");
    await page.locator("header button[aria-selected]").filter({ hasText: "Decision" }).click();
    await page.getByRole("button", { name: "Reveal results" }).click();

    // Remove React+Vite (the only surviving solution). SvelteKit is already
    // eliminated by C1=✗. After reveal, sortedSolutions puts survivors first,
    // so React+Vite is column index 0 (the first non-criterion th).
    const matrix = page.locator("section", { has: page.getByText(/Scoring ·/) });
    const headerCells = matrix.locator("table thead th");
    // Column 0 = "Criterion" label, column 1 = first solution (React+Vite after reveal sort).
    await headerCells.nth(1).getByRole("button", { name: "×" }).click();

    // Banner should now explain no candidates survive.
    await expect(page.getByText(/all solutions eliminated|no surviving|no candidates/i)).toBeVisible();
  });
});

test.describe("bug: missing 'synced from disk' toast on external clean edit", () => {
  test("external edit while clean surfaces a 2-second toast", async ({ page }) => {
    await page.goto("/sessions/framework-choice");

    // Confirm we are clean.
    await expect(page.locator("header").getByText(/^saved$/)).toBeVisible();

    // Simulate the Rust watcher firing for the same session file with new bytes.
    await page.evaluate(() => {
      const w = window as unknown as {
        __TEST_TAURI__: {
          emit: (e: string, p: string) => void;
          sessions: Map<string, string>;
        };
      };
      const slug = "framework-choice";
      const cur = w.__TEST_TAURI__.sessions.get(slug) ?? "";
      w.__TEST_TAURI__.sessions.set(slug, cur + "\n<!-- externally edited -->\n");
      w.__TEST_TAURI__.emit("decisions://changed", `/tmp/decisions/${slug}.md`);
    });

    await expect(page.getByText(/synced from disk/i)).toBeVisible();
  });
});

test.describe("bug: slide body wraps a <button> around the markdown (invalid HTML)", () => {
  test("clicking a Copy button inside a code block does NOT enter slide edit mode", async ({
    page,
  }) => {
    await page.goto("/sessions/framework-choice");

    // Put a fenced code block into the Problem slide body via the test stub.
    await page.evaluate(() => {
      const w = window as unknown as {
        __TEST_TAURI__: { sessions: Map<string, string>; emit: (e: string, p: string) => void };
      };
      const slug = "framework-choice";
      // Replace the problem body to include a code block.
      const cur = w.__TEST_TAURI__.sessions.get(slug) ?? "";
      const next = cur.replace(
        "We need to pick a frontend stack.",
        "We need to pick a frontend stack.\n\n```typescript\nconst x = 1;\n```"
      );
      w.__TEST_TAURI__.sessions.set(slug, next);
      w.__TEST_TAURI__.emit("decisions://changed", `/tmp/decisions/${slug}.md`);
    });

    // Wait for the code block to render.
    await expect(page.locator("main pre, main [data-language='typescript']").first()).toBeVisible({
      timeout: 5000,
    });

    // The slide body wrapper should not be a <button>. Drill into the slide
    // area and assert no <button> ancestor wraps a <pre>.
    const nestedButtonExists = await page.evaluate(() => {
      const pres = Array.from(document.querySelectorAll("main pre"));
      return pres.some((pre) => {
        // Walk up; if we find any <button> ancestor inside <main>, that's the bug.
        let el: HTMLElement | null = pre.parentElement;
        while (el && el.tagName !== "MAIN") {
          if (el.tagName === "BUTTON") return true;
          el = el.parentElement;
        }
        return false;
      });
    });
    expect(nestedButtonExists).toBe(false);
  });
});
