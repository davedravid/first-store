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

**What it got wrong:**
- Its first model pick for generation (gemini-3.8-flash) was the newest model on paper, but was unavailable on the free tier during testing.
