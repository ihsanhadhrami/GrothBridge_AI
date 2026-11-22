# CLAUDE.md — growthbridge.my

The full build plan is in docs/PLAN.md. Follow it.
Work ONE phase at a time. Stop after each phase, show me the result,
and wait for my review before starting the next phase.

Project: growthbridge.my, the online store of GROWTH BRIDGE ENTERPRISE
(202603162028 (NS0324359-K)), Malaysia. Sells digital products and
classes; the first is "Autopost Threads".

Stack: React + Vite + TypeScript, prerendered to static HTML per route,
served by Cloudflare Workers static assets, plus a small Worker API in
worker/ (TypeScript). Deploy with wrangler.

Rules:
- Customer-facing text in Bahasa Melayu; code and comments in English.
- Products, packages and prices live only in src/data/products.ts.
  The Worker imports the same file. Never trust a price from the browser.
- Money in sen as integers (RM89.00 = 8900).
- Secrets only via `wrangler secret put`, never committed, never typed
  into chat or files:
  CHIP_SECRET_KEY, CHIP_BRAND_ID, CHIP_PUBLIC_KEY, NOTION_TOKEN,
  NOTION_ORDERS_DB, NOTION_ENQUIRIES_DB, MAKE_WEBHOOK_URL,
  MAKE_SHARED_SECRET, TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID.
- Local dev secrets go in .dev.vars, which must be in .gitignore.
- No user accounts, no database other than Notion, no admin page.
- Every external call has a timeout and an error path; no silent failures.
- Brand: navy #041B29, green #10C987, Inter. No fake testimonials,
  no countdown timers, no invented numbers.
- Do not touch any Make, Notion or Zernio setup from this repo.
