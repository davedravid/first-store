/**
 * Builds evals/results.md from evals/runs/v1.json and v2.json. No model calls.
 * Run: node --import tsx evals/report.mts
 *
 * v1 pages are re-checked with the FINAL validator rules (report mode), so v1 and v2 are judged by the same rules.
 * Cases that errored in a run stay errors; re-checking cannot invent a page that was never produced.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { FORMAT_LABEL, type CreatorInput, type Storefront } from "../src/lib/ai/schema";
import { validateStorefront } from "../src/lib/ai/validators";
import { SCORED, type CaseResult } from "./run.mjs";

type Case = { id: string; label: string; expect: string; repeat_to?: number; must_not_contain?: string[]; input: CreatorInput };
const cases: Case[] = JSON.parse(readFileSync("evals/cases.json", "utf8"));
const v1raw: Record<string, CaseResult> = JSON.parse(readFileSync("evals/runs/v1.json", "utf8"));
const v2: Record<string, CaseResult> = JSON.parse(readFileSync("evals/runs/v2.json", "utf8"));

// ---- re-check v1 pages with the final rules ----
const v1: Record<string, CaseResult> = {};
for (const c of cases) {
  const r = structuredClone(v1raw[c.id]);
  if (r?.outcome === "ready" && r.storefront) {
    const v = validateStorefront(c.input, r.storefront, "report");
    r.checks = Object.fromEntries(SCORED.map((k) => [k, v.finalChecks[k]]));
    r.issues = v.errors.map((i) => `[${i.category}] ${i.message}`);
    r.passAll = r.statusOk && r.caseSpecificOk && Object.values(r.checks).every(Boolean);
  }
  v1[c.id] = r;
}

const ids = cases.map((c) => c.id);
const passCount = (runs: Record<string, CaseResult>) => ids.filter((id) => runs[id]?.passAll).length;
const v1OriginalPass = ids.filter((id) => v1raw[id]?.passAll).length;
const tick = (b: boolean | undefined) => (b === undefined ? "–" : b ? "✓" : "✗");
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

const CHECK_NAMES: Record<string, string> = {
  invented_facts: "No invented facts",
  hype_words: "No hype words",
  price_in_band: "Price in band",
  tier_order: "Tier order",
  distinct_formats: "Distinct formats",
  safe_claims: "Safe claims",
};

function outcomeText(r: CaseResult): string {
  if (r.outcome === "error") return r.errorCode === "TOO_LONG" ? "too long (blocked before AI)" : `error: ${r.errorCode}`;
  if (r.outcome === "needs_more_info") return "asked a question";
  return "store";
}

function expectText(e: string) {
  return { ready: "store", needs_more_info: "question", too_long: "blocked", either: "store or question" }[e] ?? e;
}

function caseTable(runs: Record<string, CaseResult>, showModelPrice: boolean): string {
  const head = `| Case | Expected | Got | ${SCORED.map((k) => CHECK_NAMES[k]).join(" | ")} |${showModelPrice ? " Model's own price in band |" : ""} Retry | Time | Tokens | Pass |`;
  const sep = `|${"---|".repeat(SCORED.length + (showModelPrice ? 8 : 7))}`;
  const rows = ids.map((id) => {
    const r = runs[id];
    const c = cases.find((x) => x.id === id)!;
    const checks = SCORED.map((k) => tick(r.checks?.[k]));
    return `| ${c.label} | ${expectText(c.expect)} | ${outcomeText(r)} | ${checks.join(" | ")} |${showModelPrice ? ` ${tick(r.modelPriceInBand)} |` : ""} ${r.retried ? "yes" : ""} | ${(r.latencyMs / 1000).toFixed(1)} s | ${r.inputTokens + r.outputTokens} | **${r.passAll ? "PASS" : "FAIL"}** |`;
  });
  return [head, sep, ...rows].join("\n");
}

function checkSummary(runs: Record<string, CaseResult>) {
  const pages = ids.filter((id) => runs[id]?.checks);
  return Object.fromEntries(SCORED.map((k) => [k, `${pages.filter((id) => runs[id].checks![k]).length}/${pages.length}`]));
}

function stats(runs: Record<string, CaseResult>) {
  const called = ids.map((id) => runs[id]).filter((r) => r.calls > 0);
  return {
    medianMs: median(called.map((r) => r.latencyMs)),
    avgMs: avg(called.map((r) => r.latencyMs)),
    maxMs: Math.max(...called.map((r) => r.latencyMs)),
    avgTokens: avg(called.map((r) => r.inputTokens + r.outputTokens)),
    totalTokens: called.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0),
    retries: called.filter((r) => r.retried).length,
    calls: called.length,
  };
}

function rupees(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

function renderStore(c: Case, r: CaseResult, n: number): string {
  const s = r.storefront as Storefront;
  const lines = [
    `### ${n}. ${c.label}`,
    "",
    `> **What the creator typed:** ${c.input.description}${c.input.instagram_bio ? `  \n> **Instagram bio:** ${c.input.instagram_bio}` : ""}  \n> **Audience:** ${c.input.audience.replace(/_/g, " ")} · **Language:** ${c.input.language}`,
    "",
    `**${s.creator.display_name}** · ${s.creator.niche}`,
    `*${s.creator.tagline}*`,
    "",
    s.creator.bio,
    "",
  ];
  for (const p of s.products) {
    lines.push(`**${p.title}** · ${rupees(p.price_inr)} · ${FORMAT_LABEL[p.format]} · ${p.tier}`);
    lines.push(`${p.description}`);
    for (const w of p.whats_inside) lines.push(`- ${w}`);
    lines.push(`*Why this price:* ${p.price_rationale}`, "");
  }
  if (r.fixes.length) lines.push(`<sub>Code fixed: ${r.fixes.join("; ")}</sub>`, "");
  lines.push("**Would an Indian micro-creator ship this?**  ☐ Yes  ☐ No  ·  Note: ____________________", "", "---", "");
  return lines.join("\n");
}

// ---- pick 10 v2 stores to rate: one per niche plus the hardest safety cases ----
const RATE = [
  "R01-fitness-moms",
  "R02-fitness-hinglish-bio",
  "R03-finance-salaried",
  "R06-cooking-baking-hinglish",
  "R07-design-canva",
  "R09-exam-upsc",
  "R11-astrology-tarot",
  "R13-fashion-saree",
  "R15-expert-no-audience",
  "U05-stock-tips",
].filter((id) => v2[id]?.outcome === "ready");

const s1 = stats(v1);
const s2 = stats(v2);
const c1 = checkSummary(v1);
const c2 = checkSummary(v2);
const p1 = passCount(v1);
const p2 = passCount(v2);
const v2Fails = ids.filter((id) => !v2[id].passAll);

const md = `# First Store: AI eval results

**v1: ${p1}/25 pass all checks, v2: ${p2}/25.**

Real runs on Groq \`openai/gpt-oss-120b\` (free tier), 19 Nov 2026. 25 inputs: 15 realistic creators and 10 ugly ones. Raw data: \`evals/runs/v1.json\` and \`v2.json\`.

| | v1 | v2 |
|---|---|---|
| Prompt | first version (\`evals/prompts_v1/\`) | improved (\`prompts/\`) |
| Code rules | report only (find problems, fix nothing) | enforced (code fixes prices and tier order, one retry with the errors fed back) |
| Pass all checks | **${p1}/25** | **${p2}/25** |
| Median time per case | ${(s1.medianMs / 1000).toFixed(1)} s | ${(s2.medianMs / 1000).toFixed(1)} s |
| Slowest case | ${(s1.maxMs / 1000).toFixed(1)} s | ${(s2.maxMs / 1000).toFixed(1)} s |
| Average tokens per case | ${s1.avgTokens} | ${s2.avgTokens} |
| Cases that needed the retry | n/a | ${s2.retries}/${s2.calls} |
| Total tokens for the run | ${s1.totalTokens.toLocaleString("en-IN")} | ${s2.totalTokens.toLocaleString("en-IN")} |

**How a case passes:** the right kind of answer (a store, one clarifying question, or "too long" blocked before any AI call), plus all six checks below on the final page. For the prompt-injection case, the page also must not echo the injected words. The evals run on Groq only, so a case that still breaks a rule after the retry counts as a fail. On the live site Gemini would try it next.

**Scoring note:** the number rule got stricter between the runs: content counts like "50+ tricks" now count as invented. So the saved v1 pages were re-checked with the same final rules as v2. ${v1OriginalPass === p1 ? `This did not change v1's result (${p1}/25 either way), only which checks each page failed.` : `With the rules as they stood during the v1 run, v1 scored ${v1OriginalPass}/25.`}

## Checks passed, per check (out of pages produced)

| Check | v1 | v2 |
|---|---|---|
${SCORED.map((k) => `| ${CHECK_NAMES[k]} | ${c1[k]} | ${c2[k]} |`).join("\n")}

"Price in band" in v2 is the final price after code. The model's own prices in v2 were in band on ${ids.filter((id) => v2[id].modelPriceInBand).length}/${ids.filter((id) => v2[id].checks).length} pages, so most of the price win comes from code, not the model.

## What failed in v1 and what changed for v2

1. **Prices too high (the biggest problem).** The model priced almost every core product above its band, for example an ebook at ₹1,499 when the band was ₹199-499. *Change:* code now sets the final price (clamp to band, snap to a price point, fix tier order), and the v2 prompt lists the bands so the model's first guess is closer.
2. **Invented content counts.** "50+ maths tricks", "20 yoga sequences", "30+ interview questions": promises the creator never made. *Change:* the prompt bans content counts above 12 and the "+" sign, code flags them, and the model gets one retry with the exact phrase quoted back.
3. **Unsafe requests went through.** The stock-tips creator got products called "stock tips" and "multibagger picks". *Change:* the prompt says to build a safe, educational version, and lists words never to use, not even in a denial.
4. **The clarifying question came back without its 3 tap-able suggestions** (one word, gibberish), so there was nothing to show. *Change:* the prompt says always exactly 3, and code treats a missing list as a retry instead of a crash.
5. **The cure-diabetes creator got a question instead of a store.** *Change:* the prompt says an unsafe request is not a reason to ask; build the safe version.
6. One hype word ("Ultimate ...") and one provider error with no tokens used (the UI/UX case in v1), counted as fails.

## Still failing in v2 (${v2Fails.length})

${v2Fails.map((id) => `- **${cases.find((c) => c.id === id)!.label}:** ${v2[id].outcome === "ready" ? "built a store where a clarifying question was expected" : v2[id].issues[0]?.replace(/^\[\w+\] /, "") ?? v2[id].errorCode}`).join("\n")}

## v2, case by case

${caseTable(v2, true)}

## v1, case by case (re-scored with the final rules)

${caseTable(v1, false)}

## Rate these yourself: 10 stores from v2

Exactly what a creator would see after code checks (final prices, ₹).

${RATE.map((id, i) => renderStore(cases.find((c) => c.id === id)!, v2[id], i + 1)).join("\n")}
`;

writeFileSync("evals/results.md", md);
console.log(`results.md written. v1 ${p1}/25 (original rules ${v1OriginalPass}/25), v2 ${p2}/25. Stores to rate: ${RATE.length}`);
