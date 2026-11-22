/**
 * Builds evals/results.generated.md (the raw tables and stores) from the saved runs. No model calls.
 * evals/results.md is the edited write-up built from it, so this script never overwrites it.
 * Run: node --import tsx evals/report.mts
 *
 * v1 and v2 numbers are frozen as published: v1 comes from runs/v1-rescored.json (v1 pages checked with the v2 rules),
 * v2 from runs/v2.json. v2.1 (a 13-case re-run) comes from runs/v2.1.json with the v2.1 rules.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { FORMAT_LABEL, type CreatorInput, type Storefront } from "../src/lib/ai/schema";
import { SCORED, type CaseResult } from "./run.mjs";

type Case = { id: string; label: string; expect: string; repeat_to?: number; must_not_contain?: string[]; input: CreatorInput };
const cases: Case[] = JSON.parse(readFileSync("evals/cases.json", "utf8"));
const v1raw: Record<string, CaseResult> = JSON.parse(readFileSync("evals/runs/v1.json", "utf8"));
const v21: Record<string, CaseResult> = existsSync("evals/runs/v2.1.json") ? JSON.parse(readFileSync("evals/runs/v2.1.json", "utf8")) : {};
const v2: Record<string, CaseResult> = JSON.parse(readFileSync("evals/runs/v2.json", "utf8"));

// ---- v1 re-scored with the v2 rules, frozen on 20 Nov 2026 by freeze-v1.mts (later rule changes never move it) ----
const v1: Record<string, CaseResult> = JSON.parse(readFileSync("evals/runs/v1-rescored.json", "utf8"));

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

function caseTable(runs: Record<string, CaseResult>, showModelPrice: boolean, only: string[] = ids): string {
  const head = `| Case | Expected | Got | ${SCORED.map((k) => CHECK_NAMES[k]).join(" | ")} |${showModelPrice ? " Model's own price in band |" : ""} Retry | Time | Tokens | Pass |`;
  const sep = `|${"---|".repeat(SCORED.length + (showModelPrice ? 8 : 7))}`;
  const rows = only.map((id) => {
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
  const called = ids.map((id) => runs[id]).filter((r) => r && r.calls > 0);
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
    `> **What the creator typed:** ${c.input.description}${c.input.handle ? `  \n> **Handle:** ${c.input.handle}` : ""}${c.input.instagram_bio ? `  \n> **Instagram bio:** ${c.input.instagram_bio}` : ""}  \n> **Audience:** ${c.input.audience.replace(/_/g, " ")} · **Language:** ${c.input.language}`,
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
  if (s.disclaimer) lines.push(`<sub>Disclaimer on the page: ${s.disclaimer}</sub>`, "");
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

// ---- v2.1: 13-case re-run (the 3 v2 fails + the 10 rated stores) ----
const v21Ids = ids.filter((id) => v21[id]);
const p21 = v21Ids.filter((id) => v21[id].passAll).length;
const v21Fails = v21Ids.filter((id) => !v21[id].passAll);
const s21 = stats(Object.fromEntries(v21Ids.map((id) => [id, v21[id]])) as Record<string, CaseResult>);
const RATE21 = RATE.filter((id) => v21[id]?.outcome === "ready");

const md = `# First Store: AI eval results

**v1: ${p1}/25 pass all checks, v2: ${p2}/25.**${v21Ids.length ? ` **v2.1 (re-run of ${v21Ids.length} cases: the 3 v2 fails + the 10 rated stores): ${p21}/${v21Ids.length}.**` : ""}

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

**Scoring note:** the number rule got stricter between the runs: content counts like "50+ tricks" now count as invented. So the saved v1 pages were re-checked with the same rules as v2. ${v1OriginalPass === p1 ? `This did not change v1's result (${p1}/25 either way), only which checks each page failed.` : `With the rules as they stood during the v1 run, v1 scored ${v1OriginalPass}/25.`}

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

${
  v21Ids.length
    ? `## v2.1: after the store review (20 Nov 2026)

**${p21}/${v21Ids.length} pass all checks.** Re-run of ${v21Ids.length} cases only, to save free-tier quota: the 3 cases that failed in v2 plus the 10 stores rated by hand. The v1 and v2 numbers above are unchanged.

What changed from v2 (issues 1-5 came from the hand review of the 10 stores):
1. **Invented names** (stores named Rahul, Anu, Meera). New optional "name" input. The page shows the typed name, else the @handle, else a neutral niche label ("Home Baking with Kadai"). The prompt never invents a name, and code flags a name in the bio or display name that the creator did not give.
2. **"Why this price" is written by code**, from the final price, the band, the audience and the cheaper tier. Example: *"Our price guide puts ebooks and guides from creators with 5-25K followers at ₹199-₹499. We picked ₹499 so it's a step up from your ₹149 starter."* The model no longer writes it.
3. **Finance is education only.** Code flags personalised trading advice: a phrase list ("next move", "entry/exit", "buy/sell signals"...) plus patterns for rewordings ("review of your current approach", "tailored suggestions", "the day's key options setup", "your recent trades"). Finance, health and astrology pages get a fixed, code-written disclaimer.
4. **No rule or compliance language in the copy** ("regulatory", "SEBI registered", "no financial advice"...).
5. **Consistency:** a duration in a product title must match its description ("3-Month" vs "three weeks"). The prompt also says not to promise extras the creator never mentioned (photos, WhatsApp support).
6. **Inputs under 4 words** get the clarifying question in code, with no model call, and the question repeats what they typed ("You said \\"fitness\\". Who do you help, and with what?").

**Honest note on how v2.1 got here:** the first v2.1 run scored 13/13, but reading the pages found problems the checks missed: a display name of "Options Trading with @handle" (a placeholder copied from my own prompt), a bio saying "No financial advice", and a stock-trading store still offering "review of your current approach" and a "daily heads-up on market setups". Re-checking that run with tightened rules gave 11/13. After fixing the prompt and the rules, the 13 cases were re-run (the two finance cases once more after the last finance patterns). The table below is that final run.

| | v2.1 |
|---|---|
| Pass all checks | **${p21}/${v21Ids.length}** |
| Median time per case | ${(s21.medianMs / 1000).toFixed(1)} s |
| Average tokens per case | ${s21.avgTokens} |
| Cases that needed the retry | ${s21.retries}/${s21.calls} |

Still failing in v2.1 (${v21Fails.length}):
${v21Fails.map((id) => `- **${cases.find((c) => c.id === id)!.label}:** ${v21[id].issues[0]?.replace(/^\[\w+\] /, "") ?? v21[id].errorCode}`).join("\n") || "- none"}

Word lists and patterns only catch phrasings someone has thought of. The finance rule caught two rewordings only after a human read the pages. That is the strongest argument for keeping a human check on finance and health pages before launch at scale.

${caseTable(v21, true, v21Ids)}

`
    : ""
}## v2, case by case

${caseTable(v2, true)}

## v1, case by case (re-scored with the v2 rules)

${caseTable(v1, false)}

## Rate these yourself: 10 stores from v2

Exactly what a creator would see after code checks (final prices, ₹).

${RATE.map((id, i) => renderStore(cases.find((c) => c.id === id)!, v2[id], i + 1)).join("\n")}
${
  RATE21.length
    ? `
## The same stores in v2.1 (rate again)

After the review fixes: real names only, code-written "why this price", disclaimers, no rule language.

${RATE21.map((id, i) => renderStore(cases.find((c) => c.id === id)!, v21[id], i + 1)).join("\n")}`
    : ""
}`;

writeFileSync("evals/results.generated.md", md);
console.log(`results.generated.md written. v1 ${p1}/25 (original rules ${v1OriginalPass}/25), v2 ${p2}/25, v2.1 ${p21}/${v21Ids.length}. Stores to rate: ${RATE.length} + ${RATE21.length}`);
