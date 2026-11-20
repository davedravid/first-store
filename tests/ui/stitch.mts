/** Puts each before/after pair side by side: docs/screenshots/compare/<screen>-<size>.png */
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

const b64 = (p: string) => `data:image/png;base64,${readFileSync(p).toString("base64")}`;
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const size of ["390", "1280"]) {
  for (const screen of ["input", "loading", "editor", "clarify", "error"]) {
    const w = size === "390" ? 390 : 1280;
    const img = (dir: string) => `<figure><figcaption>${dir === "before" ? "Before" : "After"}</figcaption><img src="${b64(`docs/screenshots/${dir}/${screen}-${size}.png`)}" style="width:${w === 390 ? 390 : 760}px"></figure>`;
    await page.setContent(`<body style="margin:0;padding:24px;background:#e7e5e4;font:600 22px system-ui;display:flex;gap:24px;align-items:flex-start;width:max-content">${img("before")}${img("after")}</body>
      <style>figure{margin:0}figcaption{margin-bottom:10px;color:#1c1917}img{display:block;border-radius:12px;box-shadow:0 6px 20px rgb(0 0 0/.15)}</style>`);
    await page.waitForLoadState("load");
    await page.locator("body").screenshot({ path: `docs/screenshots/compare/${screen}-${size}.png` });
  }
}
await browser.close();
console.log("stitched");
