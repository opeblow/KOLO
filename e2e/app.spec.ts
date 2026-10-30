import { expect, test } from "@playwright/test";

import { callAction, seedSample, settle, signInAsDev } from "./helpers";

test.describe("organizer workflow", () => {
  test("sample circle: locked payout, server refusal, inbox, ledger verification", async ({ page }) => {
    await signInAsDev(page);
    const circleId = await seedSample(page);

    // Two members are late, so the UI locks the payout...
    await expect(page.getByRole("button", { name: /Payout locked/ })).toBeDisabled();
    await expect(page.getByText(/Waiting on/)).toBeVisible();

    // ...and the server refuses it too, whoever calls.
    const refusal = await callAction(page, "record-payout", { circleId, round: 4 });
    expect(refusal.status).toBeGreaterThanOrEqual(400);
    expect(refusal.text).toMatch(/round_not_funded|short/);

    const tabs = page.getByRole("navigation", { name: "Circle sections" });
    await tabs.getByRole("button", { name: /^inbox/i }).click();
    await expect(page).toHaveURL(/tab=inbox/);
    await expect(page.getByRole("region", { name: "Payments to match" })).toBeVisible();

    await tabs.getByRole("button", { name: /^ledger$/i }).click();
    await page.getByRole("button", { name: "Verify in this browser" }).click();
    await expect(page.getByText(/verified/i).first()).toBeVisible();
  });

  test("circles list shows the summary strip and circle cards", async ({ page }) => {
    await signInAsDev(page);
    await page.goto("/circles", { waitUntil: "commit" });
    await settle(page);
    await expect(page.getByRole("heading", { name: "Your circles" })).toBeVisible();
    await expect(page.getByText("Active circles")).toBeVisible();
    await expect(page.getByTestId("circle-card").first()).toBeVisible();
  });
});
