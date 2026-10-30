import { expect, test } from "@playwright/test";

const strict = !!process.env.E2E_STRICT; // guard:allow-env-credential — test runner setting, not a credential

test("public API answers quickly, including for bad tokens", async ({ request }) => {
  const url = "/api/public/circle/00000000000000000000000000000000";
  // Warm-up: on the dev server the first hit also compiles the route.
  expect((await request.get(url, { timeout: 120_000 })).status()).toBe(404);

  const t0 = Date.now();
  const r = await request.get(url);
  const ms = Date.now() - t0;
  console.log("public API warm response", ms, "ms");
  expect(r.status()).toBe(404);
  expect(ms).toBeLessThan(strict ? 200 : 1500);
});
