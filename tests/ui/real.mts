/**
 * One REAL run (uses LLM quota): input -> store -> editor -> regenerate one product -> Undo.
 * Run: node --import tsx tests/ui/real.mts <baseUrl> <shotPrefix>
 */
import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? "http://localhost:3100";
const PREFIX = process.argv[3] ?? "real";
const OUT = "docs/screenshots";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.getByLabel("What do you do and who do you help?").fill("Main college students ko kadai mein bina oven ke cake aur cookies banana sikhati hoon. Simple recipes, hostel friendly.");
await page.getByLabel(/Instagram handle/).fill("instagram.com/bakewithanu");
await page.getByRole("button", { name: "Under 5K" }).click();
await page.getByRole("button", { name: "Hinglish" }).click();
const t0 = Date.now();
await page.getByRole("button", { name: "Build my store" }).click();
await page.getByText("What I offer").waitFor({ timeout: 70000 });
console.log("store built in", ((Date.now() - t0) / 1000).toFixed(1), "s");
await page.screenshot({ path: `${OUT}/${PREFIX}-editor.png`, fullPage: true });
console.log("name shown:", await page.getByRole("button", { name: "Edit name" }).innerText());

const regen = page.getByRole("button", { name: /^New version of / }).nth(1);
const label = await regen.getAttribute("aria-label");
await regen.click();
await page.getByRole("dialog").getByRole("button", { name: "Shorter" }).click();
const toast = page.getByText("Your product is updated.");
const failed = page.getByRole("dialog").getByRole("button", { name: "Try again" });
await Promise.race([toast.waitFor({ timeout: 70000 }), failed.waitFor({ timeout: 70000 })]);
if (await failed.isVisible()) console.log("regenerate: friendly error shown");
else {
  console.log("regenerate ok:", label, "->", await page.getByRole("button", { name: /^New version of / }).nth(1).getAttribute("aria-label"));
  await page.screenshot({ path: `${OUT}/${PREFIX}-regen-toast.png` });
  await page.getByRole("button", { name: "Undo" }).click();
  console.log("after undo:", await page.getByRole("button", { name: /^New version of / }).nth(1).getAttribute("aria-label"));
}
await browser.close();
