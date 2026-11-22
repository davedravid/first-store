/** Re-runs the two QA checks whose first run did not wait for the server. Merges into docs/qa/results.json. No AI calls. */
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

const BASE = process.argv[2] ?? "https://first-store-nine.vercel.app";
const fx = JSON.parse(readFileSync("tests/ui/fixture.json", "utf8"));
const file = JSON.parse(readFileSync("docs/qa/results.json", "utf8"));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.goto(BASE);
await page.evaluate((d) => localStorage.setItem("first-store:draft:v1", JSON.stringify(d)), { v: 1, screen: "editor", input: fx.input, handleRaw: "", storefront: fx.storefront, edited: false, prices: {}, clarify: null, published: null });
await page.reload();
await page.getByRole("button", { name: "Publish my store" }).click();
await page.getByText("Your store is live.").waitFor({ timeout: 20000 });
const pub = await page.evaluate(() => JSON.parse(localStorage.getItem("first-store:draft:v1")!).published);

const f = await ctx.newPage();
await f.goto(`${BASE}/s/${pub.slug}`);
await f.getByRole("button", { name: "I want this" }).first().click();
await f.getByLabel("Your name").fill("QA");
await f.getByLabel("WhatsApp number or email").fill("12345");
await f.getByRole("button", { name: "Notify me" }).click();
const bad = await f.getByText("does not look like").waitFor({ timeout: 15000 }).then(() => true, () => false);
await f.screenshot({ path: "docs/qa/want-bad-number.png" });

await f.goto(`${BASE}/e/${pub.slug}#k=${"x".repeat(24)}`);
const badEdit = await f.getByText("This edit link does not work").waitFor({ timeout: 15000 }).then(() => true, () => false);
await f.screenshot({ path: "docs/qa/bad-edit-link.png" });

for (const r of file.results) {
  if (r.check.startsWith('"I want this" with a bad number')) Object.assign(r, { got: bad ? "inline error shown" : "no error", pass: bad, note: "re-checked: first run did not wait for the server" });
  if (r.check.startsWith("Edit link with a wrong token")) Object.assign(r, { got: badEdit ? "friendly message" : "other", pass: badEdit, note: "re-checked: first run did not wait for the server" });
}
writeFileSync("docs/qa/results.json", JSON.stringify(file, null, 2));
console.log("bad number:", bad, "| bad edit link:", badEdit, "| slug:", pub.slug);
writeFileSync("docs/qa/.last-slug", pub.slug);
await browser.close();
