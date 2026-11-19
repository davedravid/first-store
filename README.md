# First Store

AI storefront generator for Indian micro-creators. A creator describes what they do and gets a ready-to-share store page with a bio and 2-4 priced product ideas. Take-home for SuperProfile.

Spec: [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md). AI usage log: [AI_USAGE.md](AI_USAGE.md).

## Run locally

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the values.
3. `npm run dev` and open http://localhost:3000

## What I used

- Official `create-next-app` template (Next.js App Router, TypeScript, Tailwind, ESLint).
- Libraries: zod, @upstash/redis, @upstash/ratelimit.
- LLMs: Google Gemini API (primary) and Groq (fallback), both on free tiers.
- No UI kit or component library so far.
- Built with help from Claude Code. See AI_USAGE.md.
