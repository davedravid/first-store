/** Re-checks the saved pages of a run with the CURRENT rules (no model calls). Usage: recheck.mts <run-file> */
import { readFileSync } from "node:fs";
import type { CreatorInput } from "../src/lib/ai/schema";
import { validateStorefront } from "../src/lib/ai/validators";
import type { CaseResult } from "./run.mjs";

const cases: { id: string; input: CreatorInput }[] = JSON.parse(readFileSync("evals/cases.json", "utf8"));
const run: Record<string, CaseResult> = JSON.parse(readFileSync(process.argv[2], "utf8"));
let pass = 0;
for (const [id, r] of Object.entries(run)) {
  if (!r.storefront) { if (r.passAll) pass++; continue; }
  const v = validateStorefront(cases.find((c) => c.id === id)!.input, r.storefront, "report", { setName: false });
  if (v.errors.length === 0) pass++;
  else console.log(id, v.errors.map((e) => `[${e.category}] ${e.message}`).join(" | ").slice(0, 300));
}
console.log(`re-checked with current rules: ${pass}/${Object.keys(run).length}`);
