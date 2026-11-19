PROJECT: "First Store" - AI Storefront Generator. Take-home for SuperProfile (Cosmofeed), PM (AI-native, 0 to 1) role. Standalone web app, mobile-first. Deadline Sun 22 Nov 2026 5 PM IST (confirmed).

GOAL: A creator gives a short self-description (optionally an @handle and their pasted Instagram bio). The app uses real LLM calls to generate a ready-to-publish storefront: creator bio, 2-4 product ideas (format + India-appropriate INR price + description), then lets the creator edit any field, regenerate the whole page or one block, and publish a public shareable mobile-friendly page.

WHY IT MATTERS: SuperProfile has 2M+ creators, mostly India's long tail. Many sign up, land on an empty store and stall. They don't know what to sell, how to price it, or how to write the page. We reduce "I have an audience" to "I have a store I'm proud to share" to a few minutes.

PRIMARY USER: Indian micro-creator, 5K-100K followers (fitness, finance, cooking, design, exam prep, astrology, fashion). Phone-first, non-technical, comfortable in English/Hindi/Hinglish, price-sensitive audience, never priced a product. The "expert without an audience" uses the same flow via the description box. SECOND USER: the creator's follower, who opens the shared page.

DESIGN PRINCIPLE: The creator is stuck on a blank page, so never hand them another one. Taps beat typing. Clarify, don't reject. Never show a broken page, to the creator OR their follower.

DECISIONS
1. Input: one screen. Text box (required), optional @handle (display label only), optional "Paste your Instagram bio" box, audience size chips (just starting / under 5K / 5-25K / 25-100K+), language toggle (English / Hinglish).
2. Instagram: NO scraping. The handle is never used to guess a niche. The pasted bio is treated as creator input.
3. Output (structured JSON, schema-constrained): creator {display_name, niche, niche_type(career_exam|expert|lifestyle), tagline, bio, language}; products[2..4] each {id, format, tier(starter|core|premium), title, description, whats_inside[3], price_inr, price_rationale, effort_to_create(weekend|one_week|two_weeks)}.
4. Product ladder: Starter (Priority DM, template, checklist, notes), Core (workshop, ebook, short course), Premium (always a package such as 3 calls, or a mentorship; never a single call). Distinct formats. Code enforces price order Premium > Core > Starter.
5. THE MODEL WRITES, CODE ENFORCES. Model proposes format, tier and copy. Code: sets/snaps price from the band table, enforces tier order, rejects hype words, flags any number in the output not present in the creator's input, checks lengths and product count. Failed checks -> one retry with errors fed back -> friendly fallback.
6. Gate: the model returns either {status:"ready", storefront} or {status:"needs_more_info", question, suggestions[3]}. One-word or gibberish input leads to ONE follow-up question with 3 tappable suggestions. A handle-only input with no description also goes to the needs_more_info clarify question, never an error (the handle is never read, so there is nothing to generate from yet).
6b. Slow LLM: every model call has a timeout. While waiting, show an honest loading state (say what is happening, no fake progress). On timeout, one retry, then the friendly fallback.
7. Editor = tap-to-edit live preview. Per-block regenerate sheet with chips: Try another / Shorter / More casual / More premium / Cheaper. Regenerate-all asks to confirm if edits exist. Every regenerate has one-tap Undo. Regenerating one block sends the rest of the page as context.
8. Publish: no login. /s/<slug> public page + private edit link (secret token) + copy link + WhatsApp share + OG tags. Draft autosaves.
9. Public product button = "I want this". Follower leaves name + WhatsApp number or email (one-line consent note, used only to tell them when it launches). Count shown to the creator on their edit link ("7 people want your Starter guide"). Interest data visible only to the creator via the edit token.
10. Creator's post-publish screen has a prominent "Make this a real store on SuperProfile" button (tracked). This is the north-star click.
11. Language: English and Hinglish only (natural Roman-script mix). Devanagari is out of scope.
12. Logging: funnel events (generate, needs_more_info, edit, regenerate, publish, share_click, page_view, want_this_submit, superprofile_click), tokens, latency and which provider + model served each generation (and whether it was a fallback).
13. Guardrails: per-IP rate limit, global daily cap (kept low, because free-tier quotas are small), max input length, rate limit on "I want this" submissions. No paid API keys, so there is no spend to cap; the risk is running out of free quota.
14. LLM providers, free tiers only: Groq (primary, openai/gpt-oss-120b with strict json_schema) and Google Gemini (fallback). Groq is primary because in testing on 19 Nov 2026 it answered in under 1 second with schema-valid JSON, while both Gemini Flash models returned 503 "high demand" or timed out; Gemini Flash-Lite answered but took about 10 seconds, so the Gemini fallback uses gemini-3.5-flash-lite for both full generation and regenerate. No Anthropic or other paid providers. The provider is switchable by env vars (LLM_PRIMARY, LLM_FALLBACK) and models are set by env vars (MODEL_GENERATE, MODEL_REGEN, GROQ_MODEL), never hardcoded. Both use JSON-schema structured output and the same Zod validation. The fallback takes over on timeout, 429 (quota or rate limit) or failed validation after the retry. If one provider's key is empty, the app runs on the other alone and goes straight to the friendly fallback screen when it fails. Note for the decision doc: on the Gemini free tier, Google may use inputs to improve its products, so the input screen must not invite sensitive personal data.

QUALITY RULES FOR GENERATED COPY
- Simple, warm, specific. First-person bio. No hype words ("ultimate", "game-changing", "unlock", "secret").
- NEVER invent follower counts, testimonials, credentials, results or numbers the creator didn't give. Omit rather than fabricate.
- Hinglish = natural Roman-script Hindi-English mix, how a creator would actually speak.
- Safe claims: finance = education only, no stock tips or investment advice; fitness/health = no medical claims; astrology and exam prep = no guaranteed outcomes.
- Product ideas must be makeable by one person in about a weekend to two weeks.

PRICING (starting heuristics, sense-checked against Topmate public data; Topmate skews to career/expert niches so treat it as a ceiling for lifestyle creators)
Format -> default band in INR
- Priority DM / written answer / "ask me anything": 49-199
- Templates, checklists, notes, prompt packs: 99-499
- Ebook / guide / roadmap: 199-999 (cap 499 for lifestyle niches under 25K)
- Live workshop / webinar (single session): 99-499 (999 only at 25K+ or stated credentials)
- 1:1 call (30 min): 299-999 (Starter or Core only, never Premium)
- Short recorded course: 499-2,999 (cap 1,499 for lifestyle niches under 25K)
- Premium package (e.g. 3 calls) / mentorship: 1,499-4,999 (7,999-9,999 only with stated credentials AND 25K+)
Not generated in v1: community membership.
Audience: "just starting" / under 5K -> lower half of band; 25-100K+ -> upper half. career_exam niches can use the upper half one audience step earlier.
Price points only: 49, 99, 149, 199, 249, 299, 399, 499, 599, 699, 799, 999, 1499, 1999, 2499, 2999, 3999, 4999, 7999, 9999.
Each product has a one-line "why this price" for the creator.

NOT BUILDING: payments/checkout, accounts, product file upload or delivery, AI writing the actual ebook/course, image generation, themes, custom domains, Devanagari Hindi, any Instagram scraping, community memberships, "let buyers choose price" toggle, fee calculator, SuperProfile integration.

SUCCESS METRICS
Prototype (measurable now): north star = share of published stores whose creator clicks "Make this a real store on SuperProfile"; secondary = "I want this" taps per published store; supporting = generate->publish conversion, time to publish, edit rate, regenerate rate, failure rate, cost per published store.
Inside SuperProfile onboarding (the real bet): % of new signups publishing a store with 1+ product in first session, baseline ASSUMED ~15%, target ~25% in 90 days, 50% holdout; guardrail = 7-day first-sale rate must not drop.
RISKIEST ASSUMPTION: the stall is about ideas, not KYC, the paid plan, or not having the product made. Week-1 test: split the empty-store cohort by KYC status and plan.

EVALUATION WEIGHTS: Problem thinking and judgment 30%, Execution 25%, UX/UI 20%, Communication 15%, AI usage 10%. A smaller product I can defend beats a bigger one I can't.

AUDIENCE FOR THE DECISION DOC: Vijai Kanth Panthail, Head of Product and Design. Expect "why this and not that?"
