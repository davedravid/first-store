/**
 * Screenshots of every screen and error state at 390 px, with the API mocked (no model calls, no quota).
 * Run: node --import tsx tests/ui/screens.mts [baseUrl]
 */
import { chromium, type Page, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3100";
const OUT = "docs/screenshots";
const fx = JSON.parse(readFileSync("tests/ui/fixture.json", "utf8"));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const json = (route: Route, status: number, body: unknown, delayMs = 0) =>
  sleep(delayMs).then(() => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }));
const ready = { ok: true, status: "ready", storefront: fx.storefront, meta: {} };
const err = (code: string) => ({ ok: false, error: { code, retryable: true, message: "x" }, meta: {} });

async function shot(page: Page, name: string, full = false) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  console.log("shot", name);
}

async function fillInput(page: Page) {
  await page.getByLabel("What do you do and who do you help?").fill(fx.input.description);
  await page.getByLabel(/Your name/).fill("Priya");
  await page.getByLabel(/Instagram handle/).fill("https://www.instagram.com/priya.yoga.blr/");
  await page.getByText("+ Paste your Instagram bio").click();
  await page.getByLabel(/Your Instagram bio/).fill("Yoga for busy moms | Bangalore | 15 min a day");
  await page.getByRole("button", { name: "5K to 25K" }).click();
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
let mode: "ready" | "slow-ready" | "timeout" | "busy" | "daily" | "broken" = "ready";
await page.route("**/api/generate*", (route) => {
  if (mode === "ready") return json(route, 200, ready, 2500);
  if (mode === "slow-ready") return json(route, 200, ready, 14000);
  if (mode === "timeout") return json(route, 504, err("LLM_TIMEOUT"));
  if (mode === "busy") return json(route, 429, err("RATE_LIMITED"));
  if (mode === "daily") return json(route, 429, { ...err("RATE_LIMITED"), error: { code: "RATE_LIMITED", retryable: true, message: "x", detail: { reason: "daily" } } });
  return json(route, 503, err("LLM_UNAVAILABLE"));
});
await page.route("**/api/regenerate*", async (route) => {
  const body = route.request().postDataJSON();
  const sf = structuredClone(body.storefront);
  if (body.target.kind === "product") {
    const p = sf.products.find((x: { id: string }) => x.id === body.target.productId);
    p.title = "Busy Mom's 15-Minute Yoga Plan";
    p.description = "A short, friendly plan with 15 minute yoga flows you can do while the kids nap.";
  } else sf.creator.tagline = "Quick yoga for moms who are short on time";
  return json(route, 200, { ok: true, storefront: sf, previous: null, meta: {} }, 1500);
});

// 1. Input, empty and the empty hint
await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.getByLabel("What do you do and who do you help?").waitFor();
await shot(page, "01-input-empty");
await page.getByRole("button", { name: "Build my store" }).click();
await shot(page, "02-input-empty-hint");

// 2. Too long hint
await page.getByLabel("What do you do and who do you help?").fill("I teach yoga. ".repeat(46));
await page.getByRole("button", { name: "Build my store" }).click();
await shot(page, "03-input-too-long");

// 3. Filled
await fillInput(page);
await shot(page, "04-input-filled", true);

// 4. Generating, then the slow hint
mode = "slow-ready";
await page.getByRole("button", { name: "Build my store" }).click();
await sleep(1200);
await shot(page, "05-generating");
await sleep(10500);
await shot(page, "06-generating-slow");
await page.getByText("What I offer").waitFor({ timeout: 20000 });

// 5. Editor
await shot(page, "07-editor-top");
await shot(page, "08-editor-full", true);

// 6. Tap to edit
await page.getByRole("button", { name: "Edit tagline" }).click();
await shot(page, "09-edit-in-place");
await page.keyboard.press("End");
await page.keyboard.type(", in 15 minutes");
await page.getByText("What I offer").click();

// 7. Bottom sheet, and Cheaper at the floor (the starter is at ₹99)
const starter = fx.storefront.products[0];
await page.getByRole("button", { name: `New version of ${starter.title}` }).click();
await shot(page, "10-regen-sheet");
await page.getByRole("dialog").getByRole("button", { name: "Cheaper" }).click();
await shot(page, "11-cheaper-at-lowest");

// 8. Regenerate, then the Undo toast
await page.getByRole("dialog").getByRole("button", { name: "Try another" }).click();
await sleep(300);
await shot(page, "12-regen-busy");
await page.getByText("Your product is updated.").waitFor();
await shot(page, "13-undo-toast");

// 9. Creator edits a price far above the guide
const core = fx.storefront.products[1];
await page.getByRole("button", { name: new RegExp(`Price ₹${core.price_inr}`) }).click();
await page.getByLabel("Price in rupees").fill("2999");
await page.getByLabel("Price in rupees").press("Enter");
await page.getByText(/Heads up/).scrollIntoViewIfNeeded();
await shot(page, "14-price-warning");

// 10. Redo all asks first, because there are edits
await page.getByRole("button", { name: "Redo all" }).click();
await shot(page, "15-redo-all-confirm");
await page.getByRole("button", { name: "Keep what I have" }).click();

// 11. Autosave: reload keeps the editor and the edits
await page.reload();
await page.getByText("What I offer").waitFor();
await shot(page, "16-after-refresh");

// 12. Error states (from the input screen, words kept)
await page.getByRole("button", { name: "← Edit my words" }).click();
for (const [m, name] of [["timeout", "18-error-slow"], ["busy", "19-error-busy"], ["daily", "20-error-daily-cap"], ["broken", "21-error-broken"]] as const) {
  mode = m;
  await page.getByRole("button", { name: "Build my store" }).click();
  await page.getByRole("button", { name: "Try again" }).waitFor();
  await shot(page, name);
  await page.getByRole("button", { name: "Edit my words" }).click();
}
await ctx.setOffline(true);
await page.getByRole("button", { name: "Build my store" }).click();
await page.getByRole("button", { name: "Try again" }).waitFor();
await shot(page, "17-error-offline");
await ctx.setOffline(false);
await page.getByRole("button", { name: "Edit my words" }).click();

// 13. Clarify question, from the REAL API: under 4 words is answered by code, no model call
await page.unroute("**/api/generate*");
await page.getByRole("button", { name: "Start over with a blank page" }).click();
await page.getByRole("button", { name: "Yes, clear everything" }).click();
await page.getByLabel("What do you do and who do you help?").fill("fitness");
await page.getByRole("button", { name: "Build my store" }).click();
await page.getByText("One quick question").waitFor();
await shot(page, "22-clarify");

await browser.close();
