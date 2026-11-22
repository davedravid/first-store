# The AI in First Store

## Basic idea: AI writes the content. Code checks and controls it.

- AI chooses the product types and tiers.
- Code sets the final prices using predefined price ranges. It also ensures Premium costs more than Core, and Core more than Starter.
- AI writes the bio, tagline, product titles, descriptions and bullet points.
- Code checks for exaggerated claims, unsafe words, unpromised extras and incorrect language.
- AI identifies the creator's niche and safety category.
- Code flags names or numbers the creator never provided.
- AI asks a question if the creator's input is unclear.
- Code sends inputs under 4 words directly to a clarification question without calling AI.
- Code also generates price explanations and finance, health and astrology disclaimers.

## How one store is generated

1. Code checks the input. Empty and very long inputs are stopped. Emoji-only, handle-only and inputs under 4 words get one clarifying question, with no AI call.
2. The creator's text is passed to AI as data, so hidden instructions inside it are ignored.
3. Groq generates the store in a fixed JSON format.
4. Code checks the output. If something is wrong, AI gets one chance to fix it.
5. If Groq fails, takes over 10 seconds or is rate-limited, Gemini is used.
6. If both fail, the creator sees a retry message. Their input is not lost.

## How I tested the AI

- I tested 25 inputs: 15 realistic creators from different niches and 10 difficult cases.
- Difficult cases included gibberish, one-word inputs, stock tips, medical claims, prompt injection and Hindi text.

| Version | What changed | Passed |
|---|---|---|
| v1 | First prompt, basic checks | 2/25 |
| v2 | Better prompt, code checks and one retry | 22/25 |
| v2.1 | Improvements after reviewing the stores | 12/13 |

- In v2, AI got the price within the correct range for 16 of 21 pages. Code corrected the remaining prices.
- My manual review caught issues the automated checks missed: invented names, generic price explanations, unsafe stock advice and incorrect wording in bios.
- Word-based checks cannot catch every possible issue. Finance and health pages should have human review before a wider launch.

## Speed and cost

- Typical generation time: around 2.5 seconds (median). Live site: 2.9 seconds.
- 5 out of 12 cases needed a second attempt.
- Around 3,300 tokens per store, or 6,200 when a retry is needed (about 4,500 on average).
- Current cost: ₹0 per store using free tiers.
- Daily limit of 50 stores and a per-device limit help control usage.
- p95 response time and Lighthouse scores are still pending from QA.

---

# How I used AI on this project

I built First Store with Claude Code doing most of the engineering. My job was the product: I wrote the context and the spec, decided what to build and what to leave out, set the rules the AI had to follow and reviewed everything it produced before it shipped. Its job was to turn that into working code, run the tests and tell me plainly what broke.

**How I worked with it.** For every big piece I asked for a plan in plain language first and approved or changed it before any code was written. I kept secrets out of its hands: I typed API keys into the env file myself and it only ever checked them as "present, N characters". I asked it to log every session below, including what it got wrong.

**What it was good at.** Speed and stamina. It wrote the engine, the validators, 51 unit tests, an eval harness and the Playwright scripts and it was good at finding its own bugs once a screenshot or a test showed them. It was also honest about numbers when I asked it to check them against the data.

**Where I had to step in.** Mostly where a check passed but the product was wrong:

- **Invented names.** After v2 scored 22/25, I read the stores and found creators called "Rahul", "Anu" and "Meera" who had never given a name. I made names a code rule.
- **Price explanations.** The model's "why this price" lines were generic and could disagree with the final price. I had code write them from the real price band.
- **Finance safety.** A "safe" stock-tips store still offered to review the buyer's own trading. I pushed for stricter rules and fixed disclaimers and I kept rule language like "no financial advice" out of the creator's copy.
- **Overstated results.** Its first v2.1 run said 13/13. When we read the pages again it was really 11/13 and the honest path is written up in the eval results.
- **The UI and colours.** The first UI looked like a form and the warm background clashed with the niche colours. I sent it back twice. It also once labelled a tier "Most popular", which is invented social proof; it caught that one itself.
- **The assignment PDF.** It committed the brief to the public repo on day one. I caught it and had it removed from the git history.

The dated log below is the full record, one entry per session, newest at the bottom.

---

# AI usage log

One entry per session with the AI coding assistant (Claude Code). Newest at the bottom.

## 2026-11-19: Project setup

**What I asked:** Set up the project: folder, git, .gitignore, stack, spec saved as docs/PRODUCT_SPEC.md, working rules in CLAUDE.md, this log, .env.example, a hello-world page, a public GitHub repo and a Vercel deploy.

**What it built:**
- Installed Node.js LTS (it was missing) and scaffolded the app with the official create-next-app template (Next.js App Router, TypeScript, Tailwind, ESLint).
- Added zod, @anthropic-ai/sdk, @upstash/redis and @upstash/ratelimit.
- Wrote the hello-world page, docs/PRODUCT_SPEC.md, CLAUDE.md, .env.example and this file.
- Pushed to a public GitHub repo and set up the Vercel deploy.

**What I changed or rejected:**
- Chose to keep the folder on the OneDrive Desktop instead of the suggested non-synced folder.

**What it got wrong:**
- The template .gitignore rule `.env*` also hid .env.example. Caught before the first commit and fixed with an exception line.
- Its search did not find the assignment PDF. I gave it the path in Downloads, and it moved the file to docs/assignment.pdf and added the brief's must-cover items to CLAUDE.md.
- It committed the assignment PDF to the public repo. I caught it. It removed the PDF from git and from history, git-ignored it and force-pushed.

**Spec changes I made:** handle-only input goes to the clarify question, slow LLM gets a timeout plus an honest loading state, deadline confirmed as Sun 22 Nov 2026, 5 PM IST.

## 2026-11-19: Switch to free-tier LLMs

**What I asked:** Drop Anthropic. Use Gemini (free tier) as primary and Groq (free tier) as fallback, switchable by env vars. Pick current models from the docs and fill the non-secret env values.

**What it built:**
- Uninstalled @anthropic-ai/sdk and removed ANTHROPIC_API_KEY.
- New env vars: GOOGLE_GENERATIVE_AI_API_KEY, GROQ_API_KEY, LLM_PRIMARY, LLM_FALLBACK, MODEL_GENERATE, MODEL_REGEN, GROQ_MODEL.
- Picked gemini-3.8-flash (generate), gemini-3.5-flash-lite (regenerate) and openai/gpt-oss-120b on Groq (strict json_schema), from the current Google AI Studio and Groq docs.
- Spec decision 14 and CLAUDE.md rule 9 cover providers, fallback triggers, provider logging and a low daily cap.

**What I changed or rejected:**
- Rejected the paid Anthropic setup from the first session in favour of free tiers.

**What it got wrong:**
- It started the project on a paid provider without asking about budget first.

## 2026-11-19: Key tests and Groq as primary

**What I asked:** Test my Gemini key, then my Groq key, and make Groq the main model if it works.

**What it built:**
- Test scripts (kept outside the repo) that report only key length and make one tiny call. Keys were never printed or read into the chat.
- Gemini: key works. gemini-3.5-flash-lite answered in about 10 s. gemini-3.8-flash and gemini-3.6-flash returned 503 "high demand" or timed out on every try.
- Groq: openai/gpt-oss-120b answered in 0.6-0.9 s with schema-valid JSON in strict mode, twice.
- Switched LLM_PRIMARY to groq and LLM_FALLBACK to gemini. Updated spec decision 14, CLAUDE.md and README.

**What I changed or rejected:**
- Made Groq primary instead of Gemini, based on the test results.
- Switched the Gemini fallback for full generation from gemini-3.8-flash to gemini-3.5-flash-lite, since Flash kept failing.

**What it got wrong:**
- Its first model pick for generation (gemini-3.8-flash) was the newest model on paper, but was unavailable on the free tier during testing.

## 2026-11-19: AI engine and evals (no UI)

**What I asked:** Build the generation engine only: Zod schemas, a validator layer for meaning ("the model writes, code enforces"), prompts as files, the Groq -> retry -> Gemini -> typed error flow, the clarify gate, per-block regenerate, token and latency logging, a ?simulate= flag, and a 25-case eval run twice (v1 prompt only with report-only rules, v2 improved prompt with code enforcement). My changes to the plan: the price rationale must contain no number, the Groq timeout drops to 10 s so the worst case fits 55 s, and the evals must stop with 30K Groq tokens left for the day.

**What it built:**
- src/lib/ai: schema.ts, validators.ts (all rules in one file), precheck.ts, prompts.ts, engine.ts, providers/groq.ts and gemini.ts, errors.ts, log.ts. API routes /api/generate and /api/regenerate (maxDuration 60).
- prompts/: system.md, generate.md, regenerate.md. The v1 copy is frozen in evals/prompts_v1/.
- evals/: 25 cases, a paced runner with a token ledger, a report builder and results.md with 10 stores for me to rate.
- docs/AI_DESIGN.md: the "model vs code" table, the flow, timeouts and free-tier capacity.
- 16 validator unit tests (npm test), all passing.

**Results (real runs, Groq gpt-oss-120b):** v1: 2/25 pass all checks. v2: 22/25.

**What I changed or rejected:** the three plan changes above.

**What it got wrong:**
- Its first number checker flagged "30 quick recipes" and then a Unicode hyphen in "30-minute"; it then loosened the rule too far before settling on a strict, consistent one (only time and session counts allowed). v1 was re-scored with the final rule so both runs are judged the same.
- The gate parser crashed when the model left out the suggestions, instead of asking for a retry.
- Failed calls logged the timeout limit as their latency instead of the real time.
- An eval import accidentally started a run, and a test server kept running after its task was stopped.
- Gemini Flash-Lite, the backup, returned 503 "overloaded" during the final API tests, so the backup path is proven to start but not to succeed tonight.

## 2026-11-20: Fixes from my review of 10 stores (v2.1)

**What I asked:** I reviewed the 10 v2 stores by hand and caught issues 1 to 5 myself: (1) invented names (Rahul, Anu, Meera), (2) the model writing "why this price", (3) finance products drifting into personalised trading advice, (4) compliance language in the copy ("without any regulatory claims"), (5) a title/description mismatch ("3-Month" vs "three weeks") and promised extras. I also asked for (6) inputs under 4 words to get the clarify question in code, (7) a Gemini retest with a second fallback only if still overloaded, and (8) a re-run of only the 3 failed cases plus the 10 rated stores, as v2.1, keeping v1 and v2 numbers unchanged.

**What it built:**
- Optional "name" input; display name = typed name > @handle > neutral niche label. Name check in the bio and display name.
- Code-written "why this price" from the final price, band, audience and the tier below; the model no longer writes it.
- Code-written disclaimers for finance, health and astrology pages (model tags the topic, a keyword safety net backs it up).
- Finance advice phrase list plus patterns; compliance words added to the banned list; duration consistency check; prompt rules against promised extras.
- Under-4-word inputs answered in code with a question that echoes what they typed.
- Gemini Flash-Lite retested: 3/3 small calls and 2/2 full stores, about 2 s each. No second fallback added; AI_DESIGN.md explains why a second Groq model would not help with Groq rate limits.
- v1 re-score frozen to a file so new rules cannot move the published v1/v2 numbers. 34 unit tests, all passing.
- Results: v1 2/25 and v2 22/25 unchanged; v2.1 12/13.

**What I changed or rejected:** the 8 points above. The rationale wording says "Our price guide puts..." instead of "usually sell for", because the bands are our heuristics, not market data.

**What it got wrong:**
- Its first v2.1 run scored 13/13, but reading the pages showed the checks had missed three things: a display name of "Options Trading with @handle" (caused by its own prompt wording), "No financial advice" in a bio, and a stock-trading store still offering "review of your current approach" and a "daily heads-up on market setups". The rules were tightened and the cases re-run; the honest path is written up in results.md.
- It first wrote the token and retry numbers in AI_DESIGN.md from memory and got them wrong (4 of 12 retries, 3.9K average); checked against the run data and corrected (5 of 12, 4.5K).
- Its keyword safety net at first would have put a finance disclaimer on a "budget outfits" fashion store; narrowed to strong signals before testing.

## 2026-11-20: Rule fixes, Upstash limits and the creator UI

**What I asked:** No more eval runs, to save quota. Four small rule fixes with unit tests only: more banned rule language ("substitute for professional", "registration"), no effort tag in titles and no outcome promises in taglines ("crack", "get selected"), Premium rationale that fits group calls, and "with photos" / "photo tutorials" in the extras check. Then the creator UI at 390 px: input, generating skeleton with an honest time hint, the clarify question, a tap-to-edit editor with per-block regenerate, Undo, price edits with a gentle warning, autosave, friendly error screens and a disabled Publish bar. Env vars on Vercel with DAILY_CAP 50, Playwright screenshots of every screen and error state, deploy and a live check. I also asked for an Upstash Redis database through the Upstash plugin.

**What it built:**
- The 4 rules in validators.ts, plus prompt lines. A credential the creator states ("registered dietitian") may be repeated; other rule words may not. 41 tests pass.
- Upstash: free database "firststore" in us-east-1 (next to Vercel's default region). Per-IP limit and a global daily cap of 50 stores, enforced in both API routes; inputs under 4 words are never counted. The secret token was copied by me into .env.local, never shown in chat.
- The UI: one screen flow at /, light theme, 16 px inputs and 44 px tap targets. "Cheaper" or "More premium" at the end of the band says so with no model call. A typed price keeps its own "You set ₹X" rationale and survives later regenerates.
- 22 Playwright screenshots in docs/screenshots (API mocked, no quota), plus one real local run: a Hinglish store built by Groq in 3.4 s, then regenerate and Undo.
- 14 env vars added to Vercel for Production, Preview and Development by a script that never printed a value.

**What I changed or rejected:** I asked for the Upstash values in a new .env; it used .env.local, which already had the empty slots and is what the app reads.

**What it got wrong:**
- The loading screen and the editor opened scrolled halfway down, which hid the "taking longer than usual" hint. Caught in the screenshots; every screen now starts at the top and the hint is pinned.
- The name and tagline were left-aligned under a centred avatar.
- Its scroll fix crashed the app: newer Chrome returns a promise from scrollTo, and React took that as the effect's cleanup. Caught on the next screenshot run.
- My two API key lines in .env.local have a stray space; it trimmed the values when sending them to Vercel instead of editing my lines.

## 2026-11-20: UI redesign before publishing

**What I asked:** After reviewing the first UI myself, I flagged that it looked like a form, not a product, and was a narrow column in empty space on desktop. I asked for one storefront component shared by the editor and the future public page, an accent colour by niche, a shorter input screen with example chips and folded optional fields, a desktop layout (form plus sample store; editor in a phone frame with a side panel), clearer editing cues, a "New version" label, a quiet "Redo all", a collapsible editor-only "Why this price", and a loading skeleton in the new shape. My tweaks: chips put an unfinished starter sentence in the box with the cursor at the end, plus one Hinglish chip; the accent comes from the model's niche and safety_topic first, keywords only as backup; fonts through next/font; the "I want this" button only shows a hint in the editor. Time box about 1.5 hours.

**What it built:**
- `Storefront` component with an edit mode (pencils, "New version", price hints) and a public mode (none of those).
- 8 accents picked by safety_topic, then the model's niche, then the creator's words; a test checks every accent passes WCAG AA, and that "budget outfits for college" stays fashion, not finance.
- Bricolage Grotesque for names, titles and prices via next/font (self-hosted, no call to Google from the phone); Geist for body text.
- Input screen with 6 starter chips (one Hinglish), the optional fields folded away and, on desktop, a sample store in a phone frame.
- Editor in a phone frame with a side panel on desktop; Publish is the only primary button.
- Before and after screenshots at 390 px and 1280 px, stitched side by side in docs/screenshots/compare.

**What I changed or rejected:** the 4 tweaks above.

**What it got wrong:**
- It labelled the Core tier "Most popular", which is invented social proof; caught and changed back to "Core" before any screenshot.
- The header band and hover outline read a colour variable that is resolved once for the whole page, so every store came out teal. Caught in the first screenshots.
- Starter chips first moved the cursor one frame after the tap, so the first word typed was lost ("hostel mein" became "mein"), and iPhones might not have opened the keyboard. Caught by the behaviour script; focus now happens inside the tap.
- The loading skeleton showed the default teal tint and the avatar sat behind the band; fixed on the next pass.

## 2026-11-20: Publishing

**What I asked:** Build publishing (spec decisions 8 to 10, 12 and 13).

**What it built:**
- Publish with no login: a public page at /s/<name>-<4 chars> and a private edit link /e/<slug>#k=<token>. The token sits after the #, so it never reaches a server log; only its SHA-256 is stored. Publishing again with the token updates the same page, and the page's cache is cleared at once.
- The disclaimer is re-derived on the server at publish, so it cannot be removed. The public page never gets the creator's input, the token hash or "why this price".
- "I want this" on the public page: name plus a 10-digit Indian mobile number or an email, a one-line consent note, de-duplicated per product, 5 per device per hour.
- A "Your store is live" screen: copy link, WhatsApp share, open page, who wants what (counts, then names and contacts behind a tap), the private edit link with a warning, and the tracked "Make this a real store on SuperProfile" button.
- A share image for WhatsApp and Instagram previews, generated from the store.
- Funnel events per day and per store: generate, needs_more_info, edit, regenerate, publish, share_click, page_view, want_this_submit, superprofile_click.
- An end-to-end Playwright test on the real database (publish, follower sign-up, count reaches the creator, edit link on a second device, update shows on the public page at once, bad link, share image, 404), then the test store is deleted.

**What I changed or rejected:** nothing yet.

**What it got wrong:**
- React's lint caught two effects that set state in a way that causes extra renders; rewritten.
- The contact box first opened an email keyboard on phones, which makes typing a WhatsApp number harder.
- The missing-store page returns HTTP 200 instead of 404, a side effect of streaming in this Next.js version. People see the right page; only search engines see the code. Left as is.

## 2026-11-22: Final polish, QA and docs

**What I asked:** On the last day, a visual polish (a white app shell with the niche colour only inside the store, a solid avatar, a plain gradient band, lighter tints and a card header that never wraps), a real 404 for missing stores, gentle warnings at publish for the creator's own edits, a reset-stats script, a live QA pass with at most 3 real generations, a secrets scan and the repo docs rewritten in my voice for the reviewer.

**What it built:**
- The polish, checked at 390px and 1280px in docs/screenshots/final.
- A proxy that checks the store exists before the page starts, so a missing store gets a real 404.
- Publish-time warnings for hype words, unsafe claims and prices outside the guide, with "Publish anyway".
- `npm run reset-stats` (a dry run unless given --yes).
- Live QA: 15/15 checks pass (docs/QA_REPORT.md). Secrets scan of the code and full history: clean.
- README, product spec, AI design, eval write-up and QA report rewritten for a reader.

**What I changed or rejected:** I flagged the colour clash and the overflowing card header after reviewing the redesign.

**What it got wrong:**
- Two QA checks failed on the first run because its test script checked the screen before the server had answered. It fixed the script and re-ran them; the app was fine.
- In the docs it first quoted a model phrase about pricing that it could not verify and wrote that no creator had typed the name "Rahul" when it came from a handle. Both were reworded before commit.
- It first wrote the README's example creator as "she"; changed to "they".
