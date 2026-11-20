/**
 * One-off, run on 20 Nov 2026 BEFORE the v2.1 rule changes:
 * saves the v1 re-score (v1 pages checked with the v2 rules) to evals/runs/v1-rescored.json,
 * so later rule changes never move the published v1 and v2 numbers.
 */
import { readFileSync, writeFileSync } from "node:fs";
import type { CreatorInput } from "../src/lib/ai/schema";
import { validateStorefront } from "../src/lib/ai/validators";
import { SCORED, type CaseResult } from "./run.mjs";

const cases: { id: string; input: CreatorInput }[] = JSON.parse(readFileSync("evals/cases.json", "utf8"));
const v1raw: Record<string, CaseResult> = JSON.parse(readFileSync("evals/runs/v1.json", "utf8"));
const out: Record<string, CaseResult> = {};
for (const c of cases) {
  const r = structuredClone(v1raw[c.id]);
  if (r?.outcome === "ready" && r.storefront) {
    const v = validateStorefront(c.input, r.storefront, "report");
    r.checks = Object.fromEntries(SCORED.map((k) => [k, v.finalChecks[k]]));
    r.issues = v.errors.map((i) => `[${i.category}] ${i.message}`);
    r.passAll = r.statusOk && r.caseSpecificOk && Object.values(r.checks).every(Boolean);
  }
  out[c.id] = r;
}
writeFileSync("evals/runs/v1-rescored.json", JSON.stringify(out, null, 1));
console.log("v1 re-scored pass:", Object.values(out).filter((r) => r.passAll).length, "/", cases.length);
