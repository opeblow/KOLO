import { expect, test } from "@playwright/test";

import { seedSample, signInAsDev } from "./helpers";

test("public member page re-verifies the ledger without signing in", async ({ browser, page }) => {
  await signInAsDev(page);
  await seedSample(page);
  const href = await page.getByRole("link", { name: /View as member/ }).getAttribute("href");
  const token = href?.match(/\/v\/([0-9a-f]{32})/)?.[1];
  expect(token).toBeTruthy();

  // Fresh context with no cookies, like a member opening a WhatsApp link.
  const anon = await browser.newContext();
  const member = await anon.newPage();
  await member.goto(`/v/${token}`, { waitUntil: "commit" });
  await expect(member.getByTestId("verify-status")).toHaveAttribute("data-state", "ok", { timeout: 300_000 });
  await expect(member.getByText("Ledger", { exact: true })).toBeVisible();
  expect(await member.locator('meta[name="robots"]').getAttribute("content")).toContain("noindex");

  await member.goto("/v/00000000000000000000000000000000", { waitUntil: "commit" });
  await expect(member.getByText(/open this circle/)).toBeVisible({ timeout: 300_000 });
  await anon.close();
});
