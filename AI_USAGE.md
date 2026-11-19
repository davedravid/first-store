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
