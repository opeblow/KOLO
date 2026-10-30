import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { hydrated, settle } from "./helpers";

test.describe("landing page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "commit" });
    await settle(page);
    await hydrated(page);
  });

  test("hero and primary calls to action", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toContainText("kept honest");
    await expect(page.getByRole("link", { name: /Start a circle/ }).first()).toHaveAttribute("href", "/circles/new");
    await expect(page.getByRole("link", { name: "Explore a sample circle" })).toHaveAttribute("href", "/circles?sample=1");
    await expect(page).toHaveTitle(/Kolo/);
  });

  test("live matcher reads alerts, skips debits, refuses duplicates", async ({ page }) => {
    const summary = page.getByTestId("demo-summary");
    await expect(summary).toContainText("4 read");
    await expect(page.getByTestId("demo-row-match")).toHaveCount(3);
    await expect(page.getByText(/Money going out/)).toBeVisible();

    await page.getByRole("button", { name: "+ Paste a duplicate" }).click();
    await expect(summary).toContainText("5 read");
    await expect(page.getByText(/Same alert pasted twice/)).toBeVisible();

    await page.getByRole("button", { name: "+ Stranger" }).click();
    await expect(page.getByText(/No member resembles “Kunle Adeyemi”/)).toBeVisible();

    await page.getByTestId("demo-alerts").fill("");
    await expect(summary).toContainText("0 read");
  });

  test("tamper demo: an edit is caught, a rehash cover-up is caught, restore verifies", async ({ page }) => {
    const status = page.getByTestId("tamper-status");
    await expect(status).toHaveAttribute("data-ok", "true");

    await page.getByRole("button", { name: /Secretly change entry 3/ }).click();
    await expect(status).toHaveAttribute("data-ok", "false");
    await expect(status).toContainText("Entry #3 was changed");
    await expect(page.locator('[data-testid="tamper-ledger"] li[data-state="unverified"]')).toHaveCount(3);

    await page.getByRole("button", { name: /Cover it up/ }).click();
    await expect(status).toContainText(/Seal doesn.t match/);

    await page.getByRole("button", { name: /Restore the honest ledger/ }).click();
    await expect(status).toHaveAttribute("data-ok", "true");
  });

  test("FAQ opens from the keyboard", async ({ page }) => {
    await page.getByText("Does Kolo hold or move our money?").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText(/Money moves between your members/)).toBeVisible();
  });

  test("no horizontal scroll", async ({ page }) => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("no serious accessibility violations", async ({ page }) => {
    const results = await new AxeBuilder({ page }).disableRules(["color-contrast"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
  });
});
