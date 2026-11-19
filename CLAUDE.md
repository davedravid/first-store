# First Store: working rules

@AGENTS.md

1. Read docs/PRODUCT_SPEC.md before doing anything. It is the source of truth for scope, schema, pricing and copy rules.
2. Mobile-first. Design every screen at 390px wide first, then check it scales up. Tap targets at least 44px.
3. Never put secrets in code, commits, logs or chat. Keys live only in .env.local (local) and Vercel env vars (live). .env.example lists names with no values.
4. Every LLM output is validated with Zod and the code checks in the spec (price bands, tier order, hype words, invented numbers, lengths, product count) before anyone sees it. Failed checks: one retry with the errors fed back, then a friendly fallback.
5. Every failure shows a friendly screen with a next step. Never a stack trace, blank page or raw error, for the creator or the follower.
6. Keep scope to the spec. If a request or idea is out of scope (see NOT BUILDING), say so plainly instead of building it.
7. Explain in plain language. The owner is a product manager, not a developer. One plain sentence for every command run. Ask before anything destructive.
8. At the end of each session, append an entry to AI_USAGE.md: date, what was asked, what was built, what was changed or rejected, and what the AI got wrong.
9. LLMs are free tiers only: Gemini primary, Groq fallback (spec decision 14). Provider order comes from LLM_PRIMARY / LLM_FALLBACK and models from MODEL_GENERATE, MODEL_REGEN and GROQ_MODEL. Do not hardcode provider or model names. Fall back on timeout, 429 or failed validation. Log which provider and model served each request. The app must work with Gemini alone when GROQ_API_KEY is empty. Keep DAILY_CAP low.

## The brief

docs/assignment.pdf is the original brief from SuperProfile. It stays on the laptop only and is git-ignored. Never commit it. The spec wins on product decisions, but these brief items must be covered:
- A handle-only entry must never dead-end. The handle is not read (no scraping), so a handle with no description goes to the clarify step, not an error.
- Edge cases to handle and demo: empty input, gibberish, one-word description, handle-only, slow LLM (timeout + clear loading state), failed LLM (friendly fallback).
- Places where the spec departs from the brief need a "why" in the decision doc: no Instagram reading, no Hindi in Devanagari, no community format, no themes.
- Deliverables: live URL, public repo with README, 2-3 page decision doc (with flow diagram and one rejected alternative for the main screen), 5-10 min Loom showing at least one edge case.
- The live app must stay up for 2 weeks after submission, and every link must open without an access request.

## Stack

Next.js (App Router) + TypeScript + Tailwind, Zod, Google Gemini API + Groq API (free tiers), Upstash Redis (+ @upstash/ratelimit), deployed on Vercel.
Started from the official create-next-app template. No UI kit yet. Anything taken from a template or kit gets listed in README.md under "What I used".
