# QA report

I ran a last round of checks on the live site on the morning of 22 Nov 2026, on a 390px phone screen, before handing this in. I wanted to see the edges a real creator or a curious reviewer would hit first: vague input, a broken AI, a slow AI, bad links, bad phone numbers and someone trying to inject a script into their own page.

I kept it to three real AI generations so the free quota stays available for reviewers. Everything else either never reaches the model (code answers it) or uses the `?simulate=` switches.

**Result: 15/15 pass.**

| Check | What should happen | What happened | Time | Result |
|---|---|---|---|---|
| One-word input ("fitness") | Clarify question, no AI call | Question: You said "fitness". Who do you help, and with what? | 0.9 s | Pass |
| Gibberish (5 nonsense words) | Clarify question with 3 suggestions | Question: What kind of content or products do you create for your audience? | 1.9 s | Pass |
| `?simulate=fail` | Friendly error screen with Try again | "Something went wrong on our side" | 0.4 s | Pass |
| Input kept after an error | Same words back in the box | Words kept | | Pass |
| `?simulate=slow` (Groq hangs, Gemini takes over) | Honest "taking longer" hint, then a store | Hint at 11 s: "Taking longer than usual. Our main AI is slow, so we are asking our backup." Then a store from Gemini | 12.6 s | Pass |
| Normal Hinglish input | A store in the editor | Store | 2.9 s | Pass |
| Publish | Live screen with a link | Published | | Pass |
| Script injection in the name and bio (`<script>`, `<img onerror>`) | Shown as plain text, nothing runs | 0 dialogs fired, 0 image tags created, the tags shown as text | | Pass |
| "I want this" with a bad number (12345) | Friendly inline error, nothing saved | Inline error shown | | Pass* |
| Bad slug `/s/nobody-zz99` | 404 with a friendly page | 404, friendly page | | Pass |
| Bad slug `/s/BAD!!slug` | 404 with a friendly page | 404, friendly page | | Pass |
| Bad slug `/s/a` | 404 with a friendly page | 404, friendly page | | Pass |
| Edit link with a wrong token | Friendly "link does not work", no data | Friendly message | | Pass* |
| Store API with a wrong token | 404, no store data | 404 | | Pass |
| Generate API with 5,000 characters | 400 TOO_LONG, no AI call | 400 TOO_LONG | | Pass |

\* These two failed on the first run because my test script checked the screen before the server had answered. The screenshot showed "Sending...". I fixed the script to wait and re-ran both: they pass. The app was not changed.

**Secrets scan.** I searched the code and the full git history for Groq and Gemini key patterns, Upstash tokens, `.env.local`, the eval token ledger and the assignment PDF. Nothing was found. The repo is public on GitHub.

**One thing I noticed.** The store slug is built from the display name, so the injection test produced a slug like `scriptalertxssscriptpriy-69e7`. It is harmless (only letters, numbers and dashes survive), just ugly.

The test script is `tests/ui/qa.mts`, the raw results are in `docs/qa/results.json` and the screenshots are in `docs/qa/`. All test stores were deleted afterwards.

## The automated checks behind this

- 51 unit tests (`npm test`): price bands, every copy rule, names, disclaimers, finance advice, slugs, contact numbers, accent colour contrast and the publish warnings.
- `tests/ui/screens.mts`: every screen and error state at 390px, with the AI mocked.
- `tests/ui/publish.mts`: publish, follower sign-up, the count reaching the creator, the edit link on a second device, an update showing on the public page straight away, the share image and the 404.
