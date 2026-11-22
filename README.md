# First Store

First Store turns a creator's one-line description into a store they can share: a bio, three products with prices and a public page with an "I want this" button.

**Live store:** https://first-store-nine.vercel.app · **Recording:** [watch the walkthrough](https://drive.google.com/file/d/1X4_KXiUGAYW_b4mlLybI8P2ByFM9dQyh/view?usp=sharing)

## How it works

1. The creator answers "What do you do and who do you help?" in a sentence or two, in English or Hinglish.
2. If the input is too vague ("fitness"), they get one question with three answers they can tap.
3. In a few seconds they see their store: a bio, a tagline and 2-4 products, each with a price and a short "why this price".
4. They tap any text to change it, ask for a new version of any block, set their own price and undo any change.
5. They publish with no login and get a public link, a WhatsApp share button and a private edit link.
6. Followers tap "I want this" on a product, and the creator sees who wants what.

## Run it locally

You need Node.js 20.9 or newer and free API keys from Groq (console.groq.com) and Gemini (aistudio.google.com). Publishing also needs a free Upstash Redis database (upstash.com).

```bash
npm install
cp .env.example .env.local   # add your keys
npm run dev                  # open http://localhost:3000
npm test                     # unit tests
```

More detail: [product spec](docs/PRODUCT_SPEC.md), [AI design](docs/AI_DESIGN.md), [eval results](evals/results.md), [QA report](docs/QA_REPORT.md) and [how I used AI](AI_USAGE.md).
