/**
 * Publishing end to end (no LLM calls; writes to Upstash): publish, follower sign-up, interest count,
 * edit link on a second device, update + cache refresh, bad edit link, share image, 404.
 * Run: node --import tsx tests/ui/publish.mts <baseUrl> <outDir>
 */
import { chromium, type BrowserContext } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3100";
const OUT = process.argv[3] ?? "docs/screenshots/publish";
mkdirSync(OUT, { recursive: true });
const fx = JSON.parse(readFileSync("tests/ui/fixture.json", "utf8"));
const draft = { v: 1, screen: "editor", input: fx.input, handleRaw: "", storefront: fx.storefront, edited: false, prices: {}, clarify: null, published: null };
const sizes = [[390, 844, "390"], [1280, 800, "1280"]] as const;
const browser = await chromium.launch();
const ctxFor = (w: number, h: number) => browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 800 ? 2 : 1, isMobile: w < 800, hasTouch: w < 800 });
const log = (...a: unknown[]) => console.log(...a);

// 1. Creator publishes
const creator: BrowserContext = await ctxFor(390, 844);
const page = await creator.newPage();
await page.goto(BASE);
await page.evaluate((d) => localStorage.setItem("first-store:draft:v1", JSON.stringify(d)), draft);
await page.reload();
await page.getByRole("button", { name: "Publish my store" }).click();
await page.getByText("Your store is live.").waitFor({ timeout: 20000 });
const pub = await page.evaluate(() => JSON.parse(localStorage.getItem("first-store:draft:v1")!).published);
log("published slug:", pub.slug, "| token length:", pub.token.length);
await page.screenshot({ path: `${OUT}/live-screen-390.png`, fullPage: true });

// 2. A follower opens the public page and signs up
for (const [w, h, tag] of sizes) {
  const c = await ctxFor(w, h);
  const f = await c.newPage();
  const res = await f.goto(`${BASE}/s/${pub.slug}`);
  log(`public page ${tag}:`, res?.status(), "| has editor bits:", await f.getByText("Why this price").count(), await f.getByRole("button", { name: /New version/ }).count());
  await f.screenshot({ path: `${OUT}/public-${tag}.png` });
  if (tag === "390") {
    await f.screenshot({ path: `${OUT}/public-390-full.png`, fullPage: true });
    await f.getByRole("button", { name: "I want this" }).first().click();
    await f.getByLabel("Your name").fill("Meena");
    await f.getByLabel("WhatsApp number or email").fill("12345");
    await f.getByRole("button", { name: "Notify me" }).click();
    await f.getByText("does not look like").waitFor();
    await f.screenshot({ path: `${OUT}/want-bad-contact-390.png` });
    await f.getByLabel("WhatsApp number or email").fill("98765 43210");
    await f.getByRole("button", { name: "Notify me" }).click();
    await f.getByText("You are on the list").waitFor();
    await f.screenshot({ path: `${OUT}/want-done-390.png` });
    const og = await f.locator('meta[property="og:image"]').getAttribute("content");
    log("og:title:", await f.locator('meta[property="og:title"]').getAttribute("content"));
    const img = await c.request.get(og!.replace(/^https?:\/\/[^/]+/, BASE));
    log("share image:", img.status(), img.headers()["content-type"]);
    writeFileSync(`${OUT}/share-image.png`, await img.body());
  }
  await c.close();
}

// 3. The creator sees the interest
await page.getByRole("button", { name: "Refresh" }).click();
await page.getByText("1 person wants").waitFor({ timeout: 10000 });
log("creator sees:", (await page.getByText("1 person wants").first().innerText()).replace(/\s+/g, " "));
await page.screenshot({ path: `${OUT}/live-screen-interest-390.png`, fullPage: true });

// 4. The edit link on a second device (desktop), then an update
const other = await ctxFor(1280, 800);
const p2 = await other.newPage();
await p2.goto(`${BASE}/e/${pub.slug}#k=${pub.token}`);
await p2.getByText("Who wants what").waitFor({ timeout: 15000 });
await p2.screenshot({ path: `${OUT}/edit-link-1280.png` });
await p2.getByRole("button", { name: "Keep editing my store" }).click();
await p2.getByText("1 person wants this").waitFor();
await p2.screenshot({ path: `${OUT}/editor-published-1280.png` });
await p2.getByRole("button", { name: "Edit tagline" }).click();
await p2.keyboard.press("Control+A");
await p2.keyboard.type("Yoga for new moms, 15 minutes a day");
await p2.getByRole("heading", { name: "Your store draft" }).click();
await p2.getByRole("button", { name: "Update my live page" }).click();
await p2.getByText("Your live page is updated.").waitFor({ timeout: 15000 });
const fresh = await (await other.newPage()).goto(`${BASE}/s/${pub.slug}`);
log("public page shows the update:", (await fresh!.text()).includes("Yoga for new moms, 15 minutes a day"));

// 5. A bad edit link and a missing store
const p3 = await other.newPage();
await p3.goto(`${BASE}/e/${pub.slug}#k=${"x".repeat(24)}`);
await p3.getByText("This edit link does not work").waitFor({ timeout: 15000 });
await p3.screenshot({ path: `${OUT}/edit-link-bad-1280.png` });
const nf = await p3.goto(`${BASE}/s/nobody-zz99`);
log("missing store:", nf?.status(), (await p3.getByText("This store is not here").count()) > 0);
await p3.screenshot({ path: `${OUT}/not-found-1280.png` });

writeFileSync(`${OUT}/.last-slug`, pub.slug);
await browser.close();
