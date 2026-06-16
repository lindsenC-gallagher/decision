import { test, expect } from "./fixtures";

test.describe("decision app", () => {
  test("home lists the seeded session", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "decision", level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: /framework-choice/ })).toBeVisible();
  });

  test("creating a new decision navigates to its session view", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder(/Decision title/).fill("Pick a database");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page).toHaveURL(/sessions\/pick-a-database/);
    await expect(page.locator("header").getByText("pick-a-database")).toBeVisible();
  });

  test("opens a session and switches between Presentation and Decision tabs", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /framework-choice/ }).click();
    await expect(page).toHaveURL(/sessions\/framework-choice/);

    // Presentation tab default — Problem slide shows the seeded problem.
    await expect(page.getByText("We need to pick a frontend stack.")).toBeVisible();

    // Switch to Decision tab via the kbd-tagged button.
    await page.locator("header button[aria-selected]").filter({ hasText: "Decision" }).click();
    await expect(page.getByText(/Criteria · 2/i)).toBeVisible();
    await expect(page.getByText(/Scoring · 2 criteria/)).toBeVisible();
  });

  test("Reveal results toggles scores + recommendation banner", async ({ page }) => {
    await page.goto("/sessions/framework-choice");
    await page.locator("header button[aria-selected]").filter({ hasText: "Decision" }).click();

    // Before reveal: no Recommendation banner; Score footer row not in the matrix.
    await expect(page.getByText("Recommendation:")).toBeHidden();
    await expect(
      page.locator("table tfoot, table tbody tr").getByText("Score", { exact: true })
    ).toBeHidden();

    // Reveal button now lives in the Scoring section header.
    await page.getByRole("button", { name: "Reveal results" }).click();

    // After reveal: the Score footer row appears.
    await expect(
      page.locator("table tfoot, table tbody tr").getByText("Score", { exact: true })
    ).toBeVisible();
  });

  test("picking a solution updates the Decision summary chosen-solution pill (FR-dec-17)", async ({
    page,
  }) => {
    await page.goto("/sessions/framework-choice");
    await page.locator("header button[aria-selected]").filter({ hasText: "Decision" }).click();

    const decisionSection = page.locator("section", {
      has: page.getByRole("heading", { name: "Decision", exact: true }),
    });

    // Before reveal: the pill is suppressed in favour of the hidden message.
    await expect(decisionSection.getByText("results hidden", { exact: false })).toBeVisible();

    // Reveal, then with nothing picked the pill reads "no solution chosen".
    await page.getByRole("button", { name: "Reveal results" }).click();
    await expect(decisionSection.getByText("no solution chosen")).toBeVisible();

    // Pick the first (top) solution; the pill updates to name it.
    const firstPick = page
      .locator("section", { has: page.getByText(/Scoring ·/) })
      .getByRole("button", { name: "Pick" })
      .first();
    await firstPick.click();
    await expect(decisionSection.getByText(/✓ Chosen:/)).toBeVisible();

    // Unpick: the pill reverts to "no solution chosen".
    await page
      .locator("section", { has: page.getByText(/Scoring ·/) })
      .getByRole("button", { name: "Picked" })
      .first()
      .click();
    await expect(decisionSection.getByText("no solution chosen")).toBeVisible();
  });

  test("clicking a score cell cycles its value", async ({ page }) => {
    await page.goto("/sessions/framework-choice");
    await page.locator("header button[aria-selected]").filter({ hasText: "Decision" }).click();

    // The very first cell of the very first criterion row.
    // Target the scoring-matrix table specifically; the criteria-editor table is first.
    const matrix = page.locator("section", { has: page.getByText(/Scoring ·/) });
    const cell = matrix.locator("table tbody tr").first().locator("td button").first();
    await expect(cell).toHaveText("✓");
    await cell.click();
    await expect(cell).toHaveText("✗");
    await cell.click();
    await expect(cell).toHaveText("?");
  });

  test("status dropdown updates the saved status", async ({ page }) => {
    await page.goto("/sessions/framework-choice");
    const select = page.locator("header select").first();
    await expect(select).toBeVisible();
    await select.selectOption("decided");
    await expect(select).toHaveValue("decided");
  });

  test("can type '#' into a slide body to write markdown", async ({ page }) => {
    await page.goto("/sessions/framework-choice");
    // Click into the Problem slide preview to enter edit mode.
    await page.getByText("We need to pick a frontend stack.").click();
    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeFocused();
    await textarea.fill("");
    await textarea.pressSequentially("# Heading\nbody text", { delay: 10 });
    await expect(textarea).toHaveValue("# Heading\nbody text");
  });

  test("F enters present mode and Esc exits", async ({ page }) => {
    await page.goto("/sessions/framework-choice");
    // Wait for the slide to render before sending keys.
    await expect(page.locator("header").getByRole("button", { name: "Present F" })).toBeVisible();

    // Tabs and outline visible by default.
    await expect(page.locator("header button[aria-selected]").first()).toBeVisible();
    await expect(page.getByText(/Outline · \d+ slides/)).toBeVisible();

    // Click the Present button → chrome hides, outline gone, Esc-pill appears.
    // Exact name "Present F" — `/Present/` also matches the "Presentation" tab.
    await page.locator("header").getByRole("button", { name: "Present F" }).click();
    await expect(page.getByText(/Outline · \d+ slides/)).toBeHidden();
    await expect(page.getByRole("button", { name: /Esc to exit/i })).toBeVisible();

    // Esc exits.
    await page.keyboard.press("Escape");
    await expect(page.getByText(/Outline · \d+ slides/)).toBeVisible();
  });

  test("hover delete in the outline removes a slide", async ({ page }) => {
    await page.goto("/sessions/framework-choice");
    await expect(page.getByText(/Outline · 2 slides/)).toBeVisible();

    // Hover the second outline item and click its delete X.
    const secondItem = page.locator("aside ul li").nth(1);
    await secondItem.hover();
    await secondItem.getByRole("button", { name: /Delete slide/i }).click();

    await expect(page.getByText(/Outline · 1 slide\b/)).toBeVisible();
  });

  test("Table / Cards layout toggle switches the scoring view", async ({ page }) => {
    await page.goto("/sessions/framework-choice");
    await page.locator("header button[aria-selected]").filter({ hasText: "Decision" }).click();

    // Default is Table — a <table> is present.
    await expect(page.locator("section table").first()).toBeVisible();

    // Click Cards.
    await page.getByRole("button", { name: "Cards", exact: true }).click();
    // The scoring matrix table is gone in cards mode (cards are <div>s).
    await expect(
      page.locator("section", { has: page.getByText(/Scoring ·/) }).locator("table")
    ).toHaveCount(0);
  });

  test("conflict banner appears when an external change arrives while dirty", async ({ page }) => {
    await page.goto("/sessions/framework-choice");
    await page.locator("header button[aria-selected]").filter({ hasText: "Decision" }).click();

    // Dirty the local state by cycling a score cell.
    // Target the scoring-matrix table specifically; the criteria-editor table is first.
    const matrix = page.locator("section", { has: page.getByText(/Scoring ·/) });
    const cell = matrix.locator("table tbody tr").first().locator("td button").first();
    await cell.click();

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

    await expect(page.getByText(/File changed externally/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Keep mine/i })).toBeVisible();
  });
});
