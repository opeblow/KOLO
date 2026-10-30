import { expect, type Page } from "@playwright/test";

/** Waits past the dev server's first-compile reloads until real content renders. */
export async function settle(page: Page) {
  await page.waitForFunction(
    () =>
      document.body &&
      document.body.innerText.trim().length > 40 &&
      !document.querySelector('[role="status"][aria-label="Loading application"]'),
    null,
    { timeout: 300_000 },
  );
}

/** Waits until React has hydrated the landing page, so clicks do something. */
export async function hydrated(page: Page) {
  await page.locator('[data-hydrated="true"]').waitFor({ timeout: 120_000 });
}

export async function signInAsDev(page: Page) {
  await page.goto("/circles", { waitUntil: "commit" });
  await settle(page);
  if (page.url().includes("sign-in")) {
    await page.getByRole("button", { name: "Continue as local dev" }).click();
    await page.waitForURL(/\/circles|\/home/);
  }
}

/** Creates a fresh sample circle from the circles page (no extra full reload) and returns its id. */
export async function seedSample(page: Page): Promise<string> {
  if (!/\/circles$/.test(new URL(page.url()).pathname)) {
    await page.goto("/circles", { waitUntil: "commit" });
    await settle(page);
  }
  await page.getByRole("button", { name: /Add sample|Explore a sample/ }).first().click();
  await page.waitForURL(/\/circles\/[0-9a-f-]{36}/, { timeout: 300_000 });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 300_000 });
  return page.url().match(/circles\/([0-9a-f-]{36})/)![1]!;
}

/** Calls an action over HTTP from the signed-in page, like any client would. */
export async function callAction(page: Page, name: string, body: Record<string, unknown>) {
  return page.evaluate(
    async ([n, b]) => {
      const r = await fetch(`/_agent-native/actions/${n}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(b),
      });
      return { status: r.status, text: await r.text() };
    },
    [name, body] as const,
  );
}
