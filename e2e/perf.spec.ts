import { expect, test } from "@playwright/test";

import { settle } from "./helpers";

// Dev-server numbers are looser than production. Run with E2E_STRICT=1
// against `pnpm build && pnpm start` to enforce production budgets.
const strict = !!process.env.E2E_STRICT; // guard:allow-env-credential — test runner setting, not a credential

test("landing: layout stability and largest paint", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: number; __lcp: number };
    w.__cls = 0;
    w.__lcp = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) w.__cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((list) => {
      w.__lcp = list.getEntries().at(-1)!.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });
  await page.goto("/", { waitUntil: "commit" });
  await settle(page);
  await page.waitForTimeout(1500);
  const m = await page.evaluate(() => {
    const w = window as unknown as { __cls: number; __lcp: number };
    return { cls: w.__cls, lcp: w.__lcp };
  });
  console.log("landing metrics", m);
  expect(m.cls).toBeLessThan(0.1);
  expect(m.lcp).toBeLessThan(strict ? 2500 : 8000);
});
