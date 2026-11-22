/**
 * Live QA at 390 px. Uses at most 3 real generations (gibberish, simulate=slow via Gemini, one normal store).
 * Run: node --import tsx tests/ui/qa.mts <baseUrl>   -> docs/qa/results.json + screenshots
 */
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const BASE = process.argv[2] ?? "https://first-store-nine.vercel.app";
const OUT = "docs/qa";
mkdirSync(OUT, { recursive: true });
const fx = JSON.parse(readFileSync("tests/ui/fixture.json", "utf8"));
const results: { check: string; expected: string; got: string; pass: boolean; ms?: number }[] = [];
const rec = (check: string, expected: string, got: string, pass: boolean, ms?: number) => {
  results.push({ check, expected, got, pass, ms });
  console.log(pass ? "PASS" : "FAIL", "|", check, "|", got, ms ? `| ${ms} ms` : "");
};
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const dialogs: string[] = [];
page.on("dialog", (d) => {
  dialogs.push(d.message());
  void d.dismiss();
});
const box = () => page.getByLabel("What do you do and who do you help?");
async function fresh(q = "") {
  await page.goto(`${BASE}/${q}`);
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}/${q}`);
  await box().waitFor();
}
async function build(text: string) {
  await box().fill(text);
  const t = Date.now();
  await page.getByRole("button", { name: "Build my store" }).click();
  return t;
}
const outcome = async () => {
  const r = await Promise.race([
    page.getByText("What I offer").first().waitFor({ timeout: 70000 }).then(() => "store"),
    page.getByText("One quick question").waitFor({ timeout: 70000 }).then(() => "question"),
    page.getByRole("button", { name: "Try again" }).waitFor({ timeout: 70000 }).then(() => "error screen"),
  ]);
  return r;
};

// 1. One word: answered by code, no model call
await fresh();
let t = await build("fitness");
let o = await outcome();
rec("One-word input (\"fitness\")", "clarify question, no AI call", `${o}: ${await page.locator("h1").innerText()}`, o === "question", Date.now() - t);
await page.screenshot({ path: `${OUT}/one-word.png` });

// 2. Gibberish (real call 1)
await fresh();
t = await build("asdkj qwpoe zmxnc lkjhg poiuy");
o = await outcome();
rec("Gibberish (5 nonsense words)", "clarify question with 3 suggestions", `${o}${o === "question" ? `: ${await page.locator("h1").innerText()}` : ""}`, o === "question", Date.now() - t);
await page.screenshot({ path: `${OUT}/gibberish.png` });

// 3. simulate=fail: every provider fails (no real call)
await fresh("?simulate=fail");
t = await build("I teach Excel shortcuts to accountants who work long hours");
o = await outcome();
rec("?simulate=fail", "friendly error screen with Try again, input kept", o === "error screen" ? `error screen: ${await page.locator("h1").innerText()}` : o, o === "error screen", Date.now() - t);
await page.screenshot({ path: `${OUT}/simulate-fail.png` });
await page.getByRole("button", { name: "Edit my words" }).click();
const kept = await box().inputValue();
rec("Input kept after an error", "same words in the box", kept.slice(0, 40) + "...", kept.startsWith("I teach Excel"));

// 4. simulate=slow: Groq hangs 10 s, Gemini takes over (real call 2, on Gemini)
await fresh("?simulate=slow");
t = await build("I teach Excel shortcuts to accountants who work long hours");
await page.waitForTimeout(11500);
const hint = await page.getByRole("status").first().innerText().catch(() => "");
await page.screenshot({ path: `${OUT}/simulate-slow-hint.png` });
o = await outcome();
rec("?simulate=slow (Groq hangs, Gemini takes over)", "honest 'taking longer' hint, then a store", `${o}; hint after 11 s: "${hint.split("\n").pop()}"`, o === "store" && /longer than usual/i.test(hint), Date.now() - t);
await page.screenshot({ path: `${OUT}/simulate-slow-store.png` });

// 5. A normal store (real call 3)
await fresh();
t = await build("Main working women ko 20 minute ki home workouts sikhati hoon, bina equipment ke");
o = await outcome();
rec("Normal Hinglish input", "a store in the editor", o, o === "store", Date.now() - t);
await page.screenshot({ path: `${OUT}/normal-store.png` });

// 6. Publish + script injection in creator fields (no model call)
const evil = structuredClone(fx.storefront);
evil.creator.display_name = `<script>alert("xss")</script>Priya`;
evil.creator.bio = `I teach yoga. <img src=x onerror="alert('xss')"> <b>bold?</b> More text about yoga for new moms who are busy.`;
await page.goto(BASE);
await page.evaluate((d) => localStorage.setItem("first-store:draft:v1", JSON.stringify(d)), { v: 1, screen: "editor", input: fx.input, handleRaw: "", storefront: evil, edited: false, prices: {}, clarify: null, published: null });
await page.reload();
await page.getByRole("button", { name: "Publish my store" }).click();
await page.getByText("Your store is live.").waitFor({ timeout: 20000 });
const pub = await page.evaluate(() => JSON.parse(localStorage.getItem("first-store:draft:v1")!).published);
rec("Publish", "live screen with link", `published /s/${pub.slug}`, Boolean(pub.slug));
const f = await ctx.newPage();
f.on("dialog", (d) => {
  dialogs.push(d.message());
  void d.dismiss();
});
await f.goto(`${BASE}/s/${pub.slug}`);
await f.getByText("What I offer").waitFor();
await f.waitForTimeout(1500);
const nameShown = await f.locator("article p").first().innerText();
const imgs = await f.locator("article img").count();
rec("Script injection in name and bio", "shown as plain text, nothing runs", `dialogs fired: ${dialogs.length}; <img> tags in page: ${imgs}; name shown as text: ${nameShown.includes("<script>")}`, dialogs.length === 0 && imgs === 0 && nameShown.includes("<script>"));
await f.screenshot({ path: `${OUT}/injection-public.png` });

// 7. "I want this" with a bad number, then a good one
await f.getByRole("button", { name: "I want this" }).first().click();
await f.getByLabel("Your name").fill("QA");
await f.getByLabel("WhatsApp number or email").fill("12345");
await f.getByRole("button", { name: "Notify me" }).click();
const bad = await f.getByText("does not look like").isVisible({ timeout: 8000 }).catch(() => false);
rec("\"I want this\" with a bad number (12345)", "friendly inline error, nothing saved", bad ? "inline error shown" : "no error", bad);
await f.screenshot({ path: `${OUT}/want-bad-number.png` });

// 8. Bad slugs and a bad edit link
for (const path of ["/s/nobody-zz99", "/s/BAD!!slug", "/s/a"]) {
  const r = await f.goto(`${BASE}${path}`);
  rec(`Bad slug ${path}`, "404 with a friendly page", `${r?.status()} ${(await f.getByText("This store is not here").count()) ? "friendly page" : "other"}`, r?.status() === 404);
}
await f.goto(`${BASE}/e/${pub.slug}#k=${"x".repeat(24)}`);
const badEdit = await f.getByText("This edit link does not work").isVisible({ timeout: 15000 }).catch(() => false);
rec("Edit link with a wrong token", "friendly 'link does not work', no data", badEdit ? "friendly message" : "other", badEdit);

// 9. API hardening
const api = await ctx.request.post(`${BASE}/api/store`, { data: { slug: pub.slug, token: "y".repeat(24) } });
rec("Store API with a wrong token", "404, no store data", `${api.status()}`, api.status() === 404);
const big = await ctx.request.post(`${BASE}/api/generate`, { data: { description: "a".repeat(5000), audience: "under_5k", language: "en" } });
rec("Generate API with 5,000 characters", "400 TOO_LONG, no AI call", `${big.status()} ${(await big.json()).error?.code}`, big.status() === 400);

writeFileSync(`${OUT}/results.json`, JSON.stringify({ base: BASE, at: new Date().toISOString(), slug: pub.slug, results }, null, 2));
writeFileSync(`${OUT}/.last-slug`, pub.slug);
await browser.close();
