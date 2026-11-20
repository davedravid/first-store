/**
 * Same 5 screens at 390 px and 1280 px, for before/after comparisons. API mocked except the
 * clarify question, which code answers for inputs under 4 words (no model call, no quota).
 * Run: node --import tsx tests/ui/compare.mts <baseUrl> <outDir>
 */
import { chromium, type Route } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3100";
const OUT = process.argv[3] ?? "docs/screenshots/after";
mkdirSync(OUT, { recursive: true });
const fx = JSON.parse(readFileSync("tests/ui/fixture.json", "utf8"));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const json = (route: Route, status: number, body: unknown, delayMs = 0) =>
  sleep(delayMs).then(() => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }));

const browser = await chromium.launch();
for (const [w, h, tag] of [[390, 844, "390"], [1280, 800, "1280"]] as const) {
  const mobile = w < 800;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  let mode: "ready" | "broken" = "ready";
  await page.route("**/api/generate*", (route) => {
    const body = route.request().postDataJSON();
    if (body.description.trim().split(/\s+/).length < 4) return route.continue();
    return mode === "ready" ? json(route, 200, { ok: true, status: "ready", storefront: fx.storefront, meta: {} }, 4000) : json(route, 503, { ok: false, error: { code: "LLM_UNAVAILABLE", retryable: true, message: "x" }, meta: {} });
  });
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const box = page.getByLabel("What do you do and who do you help?");
  await box.waitFor();
  await sleep(500);
  await page.screenshot({ path: `${OUT}/input-${tag}.png` });

  await box.fill(fx.input.description);
  await page.getByRole("button", { name: "5K to 25K" }).click();
  await page.getByRole("button", { name: "Build my store" }).click();
  await sleep(1500);
  await page.screenshot({ path: `${OUT}/loading-${tag}.png` });
  await page.getByText("What I offer").first().waitFor({ timeout: 15000 });
  await sleep(500);
  await page.screenshot({ path: `${OUT}/editor-${tag}.png` });

  // error state
  await page.getByRole("button", { name: /Edit my words/ }).first().click();
  mode = "broken";
  await page.getByRole("button", { name: "Build my store" }).click();
  await page.getByRole("button", { name: "Try again" }).waitFor();
  await page.screenshot({ path: `${OUT}/error-${tag}.png` });

  // clarify (real API, answered by code)
  await page.getByRole("button", { name: "Edit my words" }).click();
  await box.fill("fitness");
  await page.getByRole("button", { name: "Build my store" }).click();
  await page.getByText("One quick question").waitFor({ timeout: 15000 });
  await page.screenshot({ path: `${OUT}/clarify-${tag}.png` });
  console.log("done", tag);
  await ctx.close();
}
await browser.close();
