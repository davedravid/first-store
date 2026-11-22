# First Store: product spec

## Overview

**Why.** SuperProfile has 2M+ creators, mostly India's long tail. Many sign up, land on an empty store and stall. They do not know what to sell, how to price it or how to write the page. An empty store earns nothing for the creator and nothing for SuperProfile.

**The request.** Build a standalone, mobile-first web app where a creator describes themselves in a few words and real LLM calls turn that into a ready-to-publish storefront: a bio, 2-4 product ideas with a format, an India-appropriate price in rupees and a description. The creator can edit any field, regenerate the whole page or one block and publish a public page they can share.

**The impact I am going for.** Turn "I have an audience" into "I have a store I am proud to share" in a few minutes. If that works inside SuperProfile onboarding, more new creators publish a store with at least one product in their first session, which is the step before any sale.

**The principle behind every screen.** The creator is stuck on a blank page, so I never hand them another one. Taps beat typing. Clarify, do not reject. Never show a broken page, to the creator or to their follower.

## Who it is for

**The creator.** An Indian micro-creator with 5K-100K followers in fitness, finance, cooking, design, exam prep, astrology or fashion. Phone-first, not technical, comfortable in English, Hindi or Hinglish, with a price-sensitive audience and no experience pricing a product. The "expert without an audience" (say, an HR professional who wants to sell interview prep) uses the same flow through the description box.

**The follower.** The person who opens the shared link. They decide in seconds whether the page looks real and whether they want something on it.

## Use cases

- As a creator, I want to describe what I do in a sentence or two and get a full store, so I do not have to face a blank page.
- As a creator who is not sure how to describe myself, I want one simple question with answers I can tap, so I am not told my input is "invalid".
- As a creator, I want product ideas I could make in a weekend to two weeks, at prices my followers will actually pay, so I can launch without guessing.
- As a creator, I want to know why a price was suggested, so I can trust it or change it with confidence.
- As a creator, I want to tap any text to change it and get a new version of one block without losing the rest, so the page feels like mine.
- As a creator, I want my draft saved if I refresh or go back, so I never lose work.
- As a creator, I want to publish without making an account and get a link I can put in my bio and WhatsApp.
- As a creator, I want to see who wants which product before I make it, so I build the thing people will pay for first.
- As a follower, I want a clean page that shows what is on offer and what it costs, so I can decide quickly.
- As a follower, I want to say "I want this" and be told when it launches, without being spammed.

## Decisions and why

1. **Input is one screen: a description box first.** The required box asks "What do you do and who do you help?", with starter-sentence chips (one in Hinglish) that the creator finishes in their own words. Name, @handle and a pasted Instagram bio are optional and folded away, plus audience-size chips (just starting / under 5K / 5-25K / 25-100K+) and an English/Hinglish toggle. *Why:* the description is the one thing that tells me what to build; everything else is a nice-to-have that should not slow anyone down.
2. **No Instagram scraping.** The handle is a display label only and is never used to guess a niche. A pasted bio is treated as creator input. *Why:* scraping is fragile, against Instagram's rules and wrong for a private account. The creator's own words are better input anyway.
3. **Structured output with a clear split.** The model writes the creator block (display name, niche, niche type, safety topic, tagline, bio, language) and 2-4 products (format, tier, title, description, three "what's inside" points, a suggested price and the effort to create). Code adds the display name, the final price, the "why this price" line and the disclaimer. `format` is a fixed list (priority DM, template pack, checklist, notes, prompt pack, ebook/guide, roadmap, workshop, 1:1 call, short course, call package, mentorship). *Why:* code needs a fixed format to look up the price band and "community" is simply not on the list. See [AI_DESIGN.md](AI_DESIGN.md).
4. **Never invent a person's name.** If the creator gives no name, the page shows their @handle, else a neutral label from the niche ("Home Baking with Kadai"). Code flags any name in the bio or display name that is not in the input or a whole word of the handle. *Why:* a store that calls you by the wrong name is worse than no name.
5. **"Why this price" is written by code**, from the final price, the band, the audience bucket and the tier below. For example: "Our price guide puts ebooks and guides from creators with 5-25K followers at ₹199-₹499. We picked ₹399 so it's a step up from your ₹99 starter." It says "our price guide" because the bands are my heuristics, not market data. *Why:* when the model wrote this line it was generic and could disagree with the actual price.
6. **Disclaimers are written by code** and shown on the public page: finance "Educational content only. Not investment advice.", health and fitness "Not medical advice.", astrology "For guidance only; no guaranteed outcomes." The topic comes from the model's safety topic plus a keyword safety net on the creator's own words and the server adds the disclaimer again at every publish. *Why:* a disclaimer is a rule, not copy, so it should never depend on the model or on an edit.
7. **A product ladder.** Starter (priority DM, template, checklist, notes), Core (workshop, ebook, short course), Premium (always a package such as 3 calls, or a mentorship; never a single call). Formats are distinct and code enforces Premium > Core > Starter on price. *Why:* a ladder gives followers an easy first buy and gives the creator somewhere to grow, which a list of three similar products does not.
8. **The model writes, code enforces.** Code sets and snaps the price from the band table, enforces tier order, writes the price rationale and the disclaimer and rejects hype words, rule or compliance language ("regulatory", "registered", "not a substitute for professional advice"), outcome promises ("crack UPSC", "get selected"), invented numbers and names, personalised trading advice on finance pages, a title and description that disagree on duration, an effort tag in a title and extras the creator never mentioned ("with photos", "WhatsApp support"). Failed checks get one retry with the errors fed back, then the backup model, then a friendly screen. *Why:* in my first eval the model priced 19 of 19 stores outside the bands. Rules belong in code.
9. **Vague input gets one question.** The model returns either a store or one follow-up question with 3 tappable suggestions. Inputs under 4 words (after removing the handle), a handle on its own or emoji on their own get the question from code, with no model call, echoing what they typed. *Why:* "fitness" is not a mistake, it is a creator who needs one nudge.
10. **Slow AI gets an honest wait.** Every model call has a timeout. While waiting, the screen shows the shape of the store and says what is happening, with no fake progress bar. After 10 seconds it says the main AI is slow and the backup is being asked, because that is what is actually happening.
11. **Tap-to-edit, not chat.** The editor is a live preview using the same storefront component as the public page, with one accent colour per store picked from the niche. Any text is tappable. Each block has "New version" with chips: Try another / Shorter / More casual / More premium / Cheaper. If Cheaper or More premium cannot move the price further, the sheet says so with no model call ("This is already the lowest price we'd suggest for an ebook"). Redo-all asks first if there are edits. Every regenerate has a one-tap Undo. Regenerating one block sends the rest of the page as context. The creator can type any price: code checks it against the band and shows a gentle note, never an error and the rationale then says "You set ₹X". "Why this price" is only visible to the creator. *Why:* a creator knows what they want to change when they see it; a chat box makes them describe it.
12. **Publish with no login.** A public page at /s/&lt;slug&gt;, a private edit link /e/&lt;slug&gt;#k=&lt;token&gt;, copy link, WhatsApp share and a generated share image. The token sits after the # so it never reaches a server log and only its hash is stored. Publishing again with the token updates the same page. At publish, the creator's own edits are checked against the same rules and any issues are shown as a gentle list with "Publish anyway". The draft autosaves in the browser. *Why:* an account wall at the moment of pride is where people drop off.
13. **"I want this" instead of a Buy button.** The public product button collects a name plus a WhatsApp number (10-digit Indian mobile) or an email, with a one-line consent note: used only to say when it launches. Each person counts once per product. The creator sees counts ("1 person wants your Starter guide") and the list, only through their edit link. *Why:* there are no payments in this prototype and a dead Buy button breaks trust. Demand before the product exists is also the most useful thing a new creator can learn.
14. **The north-star click.** After publishing, the creator sees a prominent "Make this a real store on SuperProfile" button and every click is tracked.
15. **Language.** English and Hinglish only, as a natural Roman-script mix. Devanagari is out of scope.
16. **Logging.** Funnel events (generate, needs_more_info, edit, regenerate, publish, share_click, page_view, want_this_submit, superprofile_click) are counted per day and per store. Every model call logs tokens, latency and which provider and model served it and whether it was a fallback.
17. **Guardrails.** A per-IP limit of 10 stores an hour and a global daily cap of 50 stores (regenerates get 3x both, since one costs about a third of a store), enforced in Upstash Redis. Inputs under 4 words never count. There is a maximum input length and a limit on "I want this" sign-ups. Over a limit, the creator sees "Lots of people are building stores right now", never an error. *Why:* there are no paid keys, so there is no spend to cap. The real risk is running out of free quota.
18. **Free-tier providers.** Groq is the main model (`openai/gpt-oss-120b` with a strict JSON schema) and Google Gemini Flash-Lite is the backup. Groq is first because in testing on 19 Nov 2026 it answered in under a second with valid JSON, while both Gemini Flash models returned 503 "high demand" or timed out and Gemini Flash-Lite answered but took about 10 seconds. The provider and models are set by env vars, never hardcoded. The backup takes over on a timeout, a 429 or output that still fails after the retry. If one provider's key is empty, the app runs on the other alone. On the Gemini free tier Google may use inputs to improve its products, so the input screen does not ask for sensitive personal data.

## Rules for generated copy

- Simple, warm and specific. First-person bio. No hype words ("ultimate", "game-changing", "unlock", "secret").
- Never invent follower counts, testimonials, credentials, results, names or numbers the creator did not give. Leave it out rather than make it up.
- Do not promise specifics the creator did not mention (content counts, photos, WhatsApp support, certificates). Title and description must agree, for example on duration.
- No rule or compliance language in the copy ("regulatory", "registered", "not a substitute for professional advice"). Disclaimers are added by code. A credential the creator states about themself may be repeated.
- Taglines and titles never promise an outcome ("crack UPSC", "get selected"). The effort tag (weekend, one week) never appears in a title.
- Hinglish is a natural Roman-script mix of Hindi and English, the way a creator actually speaks.
- Safe claims. Finance is education only: no stock tips, investment advice or personal trading advice (no reviewing the buyer's trades or setup, no next moves, entry/exit points or signals). Fitness and health: no medical claims. Astrology and exam prep: no guaranteed outcomes.
- Every product must be something one person can make in about a weekend to two weeks.

## Pricing

These are starting heuristics, sense-checked against Topmate's public data. Topmate skews to career and expert niches, so I treat it as a ceiling for lifestyle creators.

| Format | Band (₹) |
|---|---|
| Priority DM / written answer / "ask me anything" | 49-199 |
| Templates, checklists, notes, prompt packs | 99-499 |
| Ebook / guide / roadmap | 199-999 (capped at 499 for lifestyle niches under 25K) |
| Live workshop / webinar (one session) | 99-499 (999 only at 25K+ or with stated credentials) |
| 1:1 call (30 min) | 299-999 (Starter or Core only, never Premium) |
| Short recorded course | 499-2,999 (capped at 1,499 for lifestyle niches under 25K) |
| Premium package (e.g. 3 calls) / mentorship | 1,499-4,999 (7,999-9,999 only with stated credentials and 25K+) |

- Audience: "just starting" and under 5K use the lower half of the band; 25-100K+ uses the upper half. Career and exam niches move to the upper half one audience step earlier.
- Prices only land on these points: 49, 99, 149, 199, 249, 299, 399, 499, 599, 699, 799, 999, 1499, 1999, 2499, 2999, 3999, 4999, 7999, 9999.
- Community memberships are not generated.
- Each product has a one-line "why this price", written by code (decision 5).

## What I did not build and why

- **Payments and checkout.** That is what SuperProfile already does well. This prototype ends at the handoff button.
- **Accounts.** The private edit link is enough for a prototype and removes a sign-up wall.
- **Product files, delivery, or the AI writing the actual ebook or course.** A different, much bigger product. First prove that creators want the store.
- **Image generation, themes and custom domains.** One clean theme with a niche accent is enough to feel finished.
- **Devanagari Hindi.** Roman-script Hinglish covers how most of these creators write captions.
- **Instagram scraping.** See decision 2.
- **Community memberships, a "let buyers choose the price" toggle and a fee calculator.** Each adds a decision the stuck creator does not need yet.
- **A SuperProfile integration.** Out of reach for a take-home; the tracked button stands in for it.

## Success metrics

**In this prototype (measurable now).** The north star is the share of published stores whose creator clicks "Make this a real store on SuperProfile". Secondary: "I want this" taps per published store. Supporting: generate to publish conversion, time to publish, edit rate, regenerate rate, failure rate and cost per published store.

**Inside SuperProfile onboarding (the real bet).** The share of new sign-ups who publish a store with at least one product in their first session. I am assuming a baseline of about 15% and aiming for about 25% in 90 days, tested with a 50% holdout. Guardrail: the 7-day first-sale rate must not drop.

**The riskiest assumption.** That the stall is about ideas, not KYC, the paid plan or not having the product made yet. The week-one test: split the empty-store group by KYC status and plan and see whether the stall rate differs.
