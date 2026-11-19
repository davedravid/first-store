Build a store page for this creator.

<creator_input>
{{creator_input}}
</creator_input>

Audience size (picked by the creator from chips): {{audience}}
Language for all copy: {{language}}

## First decide: enough to go on?
- Ask ONLY when you cannot tell what the creator does: one word, gibberish or only a handle. Then return status "needs_more_info" with:
  - question: ONE short, friendly question that helps them say what they do (under 140 characters).
  - suggestions: ALWAYS exactly 3 short example answers they could tap, each a full sentence in their voice, related to whatever they did type. Never null, never fewer than 3.
  - storefront: null
- If you can tell what they do, even roughly, return status "ready" with the storefront, and question and suggestions set to null. An unsafe request (guarantees, stock tips, cures) is NOT a reason to ask; build the safe version.

## The storefront
creator:
- display_name: the creator's name if given, else a short friendly name from their handle or niche.
- niche: a short phrase for what they do.
- niche_type: career_exam (exam prep, jobs, interviews, careers), expert (finance, law, design, coaching, a professional skill) or lifestyle (fitness, cooking, fashion, beauty, astrology, travel, parenting and similar).
- tagline: one short line (under 90 characters).
- bio: first person, 2 to 4 sentences (120 to 450 characters).
- language: "{{language}}".

products: 2 to 4 product ideas the creator could make alone in a weekend to two weeks. Use a ladder:
- starter: a small, cheap first buy. Formats: priority_dm, template_pack, checklist, notes, prompt_pack, call_1on1.
- core: the main product. Formats: workshop, ebook_guide, roadmap, short_course, call_1on1, template_pack.
- premium (optional, at most one): always a package such as call_package (for example 3 calls) or mentorship. Never a single call.
- Every product must use a different format. Include one starter. No community or membership products.

Each product:
- id: "p1", "p2" and so on.
- title: short and specific (under 60 characters). Plain words, no hype.
- description: 1 to 2 sentences on who it is for and what they get (under 240 characters).
- whats_inside: exactly 3 short bullets.
- price_inr: a fair price in rupees for a price-sensitive Indian audience. Use only these price points: 49, 99, 149, 199, 249, 299, 399, 499, 599, 699, 799, 999, 1499, 1999, 2499, 2999, 3999, 4999. Stay inside the band for the format:
  - priority_dm: 49-199
  - template_pack, checklist, notes, prompt_pack: 99-499
  - ebook_guide, roadmap: 199-999 (lifestyle niches under 25K followers: at most 499)
  - workshop: 99-499 (up to 999 only at 25K+ followers)
  - call_1on1: 299-999
  - short_course: 499-2999 (lifestyle niches under 25K followers: at most 1499)
  - call_package, mentorship: 1499-4999
  - Just starting or under 5K followers: use the lower half of the band. 25K+ followers: the upper half.
  - Each higher tier must cost more than every lower tier.
- price_rationale: one line telling the creator why this price makes sense, in words only. Never put a rupee amount or any number in it (for example "a low first price so followers can try you out"), because the final price may be adjusted.
- effort_to_create: weekend, one_week or two_weeks.
