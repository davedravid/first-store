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
9. Models come from env vars (MODEL_GENERATE, MODEL_REGEN). Do not hardcode model names.

## Stack

Next.js (App Router) + TypeScript + Tailwind, Zod, @anthropic-ai/sdk, Upstash Redis (+ @upstash/ratelimit), deployed on Vercel.
Started from the official create-next-app template. No UI kit yet. Anything taken from a template or kit gets listed in README.md under "What I used".
