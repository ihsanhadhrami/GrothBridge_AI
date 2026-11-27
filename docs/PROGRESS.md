# Progress and handoff

Last updated: 2026-11-27 (Phase 4 deployed; Phase 3 live-tested).

## Status

- **Phase 0: done.**
- **Phase 1 (site, pages, prerendering): done. Approved by the owner on 2026-11-24.**
  - Live on https://growthbridge.my in pre-launch mode for CHIP merchant review (`PAYMENTS_ENABLED = false`).
  - Pages: 5 policy pages, including Polisi Penghantaran.
- **Phase 4 (deploy): the domains and headers went live early (2026-11-23) for the CHIP review; finished 2026-11-27** (secrets, Phase 2+3 deployed, CSP with CHIP's checkout domain). See "Phase 4: deploy and live test".
- **Phase 2 (checkout API): done. Approved by the owner on 2026-11-25** after an end-to-end CHIP test-mode run. See "Phase 2: what was built" below. Committed on branch `phase-2-checkout`, not merged or deployed.
- **Phase 3 (webhook, enquiries, cron): built and unit-tested, committed on branch `phase-3-webhook` (1b285b2, 2026-11-25). Merged to main and deployed 2026-11-27; the paid path passed a live CHIP test-mode run (see Phase 4).** See "Phase 3: what was built" below. The end-to-end run with real CHIP/Notion/Telegram is still to do (see "Phase 3: still to test").
- **Phase 4 (deploy): done 2026-11-27, awaiting owner review.** See "Phase 4: deploy and live test" below. main fast-forwarded to `phase-3-webhook` (not pushed); live version `536cc2e4`.
- **Next: Phase 5 (Make + Notion delivery), once the owner approves Phase 4.**
- (Phase 4 plan as agreed 2026-11-27, kept for reference:)
  1. The owner runs `npx wrangler secret put` for the CHIP **test** key, CHIP_BRAND_ID, NOTION_TOKEN, NOTION_ORDERS_DB, NOTION_ENQUIRIES_DB, TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_CHAT_ID. CHIP_PUBLIC_KEY waits for the refund webhook in the CHIP portal.
  2. Merge `phase-3-webhook` to main and deploy (`npm run build && npx wrangler deploy`). Only once the owner says so.
  3. Run one CHIP test-mode purchase, which the owner pays. Check the signed callback, the Notion row and the alerts. The cron should also recover the Phase 2 test order GB-20261125181720-Y64K (paid in CHIP, still Pending in Notion).
  - **The test uses Make (owner, 2026-11-27).**
    - The owner creates just the Make custom webhook, in a scenario left off, and sets MAKE_WEBHOOK_URL and MAKE_SHARED_SECRET.
    - Make queues what arrives while the scenario is off. Clear that queue or run it in Phase 5.
  - **Status flow approved by the owner (2026-11-27):** the Worker sets Paid before calling Make; Paid rows are re-sent every 15 minutes; Failed after 24 hours.
  - **Secrets (2026-11-27):** 8 are on the production Worker: the CHIP test key, CHIP_BRAND_ID, NOTION_TOKEN, NOTION_ORDERS_DB, NOTION_ENQUIRIES_DB, the 2 Telegram secrets, and MAKE_SHARED_SECRET.
    - Each was piped from `.dev.vars` into `wrangler secret put`; no value was shown.
    - MAKE_SHARED_SECRET was newly generated and is also in `.dev.vars`; the owner pastes it into Make in Phase 5.
    - **MAKE_WEBHOOK_URL is set (owner, 2026-11-27).** It points to a new Make custom webhook `growthbridge-orders` in folder `growthbridge.my`, in a saved scenario left OFF. Its value is also in `.dev.vars`. 9 secrets in total; only CHIP_PUBLIC_KEY (refunds) is still missing.
    - The Notion integration can now open both Orders and Enquiries (checked 2026-11-27).
    - **Ready for Phase 4:** merge `phase-3-webhook` to main, deploy (owner says go), then run the live test payment.
- (Original Phase 2 handoff notes, kept for reference:)
  - The Worker now runs first for every request (`run_worker_first: true`): it 301s www, serves `/api/*` (currently a 501 stub), and passes everything else to the static assets. Build the API inside that same `fetch`.
  - Keep one Worker only; the owner's rule.
  - Turn `PAYMENTS_ENABLED` on only once checkout works in test mode; the checkout form in `src/components/CheckoutForm.tsx` is already wired to `POST /api/checkout`.
  - Put the buyer's name, email and phone, reference = order ID, and the product and package on the CHIP purchase (see "Decisions" below). Build the CHIP redirect and callback URLs from `site.url`.
  - The SSM address is deliberately not on the site (owner's choice, 2026-11-24), even though CHIP asked for it.

## Phase 4: deploy and live test (2026-11-27)

- **Deployed** with the owner's go: main fast-forwarded to `phase-3-webhook` (9834a83), `npm run build && npx wrangler deploy`. This shipped Phase 2 and Phase 3 together; the site had been on the 2026-11-23 pre-launch Worker. Nothing pushed to GitHub.
  - Version 135c90f7, then 536cc2e4 (one log line added, below). Cron `*/15 * * * *` registered. Rollout across the edge took about a minute; during it some requests still got the old 501 stub.
  - 9 secrets on the Worker (`wrangler secret list`); only CHIP_PUBLIC_KEY (refunds) is missing.
  - Both launch switches are still false: the Beli buttons and the enquiry form still show the pre-launch mailto. But `POST /api/checkout` is live with the CHIP **test** key, so anyone who posts to it gets a test-mode checkout (no real money; a Pending row in Notion).
- **Verified live:**
  - All 9 routes 200, each with its own title and canonical on growthbridge.my. sitemap, robots, og image and video 200; unknown paths 404.
  - www → 301 apex (path and query kept); http → 301 https.
  - Headers: HSTS, CSP (own scripts only; form-action `'self' mailto: https://gate.chip-in.asia`), X-Frame-Options DENY, Referrer-Policy, nosniff, Permissions-Policy.
  - API: GET on the 3 endpoints → 405; unknown `/api/*` → 404; empty checkout and enquiry → 400 with the Malay field errors; webhook without a signature → 400; with a bad signature → 400 (+ Telegram alert).
- **One 500 on the first bad-signature test:** "signature check unavailable", i.e. the Worker could not fetch or import CHIP's company key (`GET /public_key/`) at that moment. It did not happen again. The production key itself works (a live checkout created a CHIP purchase in 1.6 s), and the next bad-signature test got 400. Cause unknown, most likely a one-off failure on CHIP's side or during the rollout. `worker/webhook.ts` now also logs the key error (`[webhook] no usable CHIP key: …`, no buyer data), so if it recurs, the reason is in Workers Logs, not only in Telegram. A real callback in that state gets 500 and CHIP retries, so nothing is lost.
- **Live test payment (Phase 3 end to end):**
  - `POST https://growthbridge.my/api/checkout` (Starter; buyer "Ujian Phase 4", growthbridge.biz@gmail.com, placeholder phone) → CHIP test purchase, order `GB-20261127164618-ZF8Y`. The owner paid it with the test card.
  - CHIP's signed success_callback reached `/api/webhooks/chip` once (08:51 UTC) and was not retried, so the Worker answered 200, which it does only after Make answers 200. The Notion row is **Paid**, Paid at 08:51 UTC. The event is waiting in the Make webhook queue (scenario off).
  - The cron recovered the Phase 2 order `GB-20261125181720-Y64K` (Pending → Paid, sent to Make).
- **What the cron will do next (expected, not bugs):**
  - Y64K was paid on 2026-11-25, more than 24 h ago, so the next run sets it **Failed** with an alert.
  - ZF8Y is re-sent to Make every 15 minutes (alert once), and becomes **Failed** 24 h after payment unless Make marks it Delivered. Each re-send adds an item to the Make queue: **clear the queue before switching on the Delivery scenario in Phase 5**, or the test orders get delivered to growthbridge.biz@gmail.com.
  - The unpaid live purchase GB-20261125175451-XKT9 has no Notion row, so the cron never sees it.
- **Not tested yet:** refunds (need the CHIP portal webhook and CHIP_PUBLIC_KEY), the enquiry API against the real Notion (`ENQUIRY_API_ENABLED` is false), and Make's side (Phase 5).

## Phase 3: what was built (2026-11-25)

- `POST /api/webhooks/chip` (`worker/webhook.ts`):
  1. Reads the raw bytes first and checks `X-Signature` (RSA PKCS#1 v1.5, SHA-256, Web Crypto, `worker/crypto.ts`) before parsing.
     - Two keys are tried. success_callback is signed with CHIP's company key, which the Worker fetches from `GET /public_key/` with `CHIP_SECRET_KEY` and caches per isolate. A webhook made in the CHIP portal (needed for `payment.refunded`) has its own key: that is `CHIP_PUBLIC_KEY`.
     - Bad or missing signature: 400 and a Telegram alert. Alerts are capped at 3 a minute (`ALERT_RATE_LIMIT`), because anyone can post to this URL.
     - Key unavailable (CHIP down, secret missing): 500, so CHIP retries.
  2. Only `purchase.paid` and `payment.refunded` do anything; other events get 200. The purchase is fetched again from CHIP (for a refund, via the Payment's `related_to.id`).
  3. Checks in `worker/orders.ts` (shared with the cron): our brand, our order-id format, metadata = reference, a package from `src/data/products.ts`, MYR, and total = the package price. For a paid purchase, `payment.amount` must match too.
     - A failed check: nothing goes to Make, the row is set to Failed with a note, and the owner is alerted. The answer is 200 (a retry can't fix it).
  4. Paid: the row becomes **Paid** + Paid at (CHIP's `paid_on`) **before** Make is called, then the event goes to `MAKE_WEBHOOK_URL`. If the row is missing (the checkout's Notion write failed), it is rebuilt from the CHIP purchase, with a note and an alert.
     - Rows already Delivered, Failed or Refunded: nothing is sent (a repeated notification).
  5. Refund: the event goes to Make; the Worker leaves the row to Make's Refund scenario.
  6. 200 only after Make answers 200. Make down, Notion down, or a secret missing → 500 + alert, and CHIP retries (up to 8 times over 36 h).
- To Make: JSON `{event: "paid"|"refunded", order_id, chip_purchase_id, amount (sen), email, name, phone (E.164), product, package, paid_at (ISO UTC), is_test, refunded_amount (refunds only)}`. Header `X-GB-Signature` = lowercase hex HMAC-SHA256(raw body, `MAKE_SHARED_SECRET`). Make has to check that header first (Phase 5). Timeout 15 s.
- `POST /api/enquiry` (`worker/enquiry.ts`):
  - 5 per minute per IP (`ENQUIRY_RATE_LIMIT`).
  - Same validation as the browser; it now also checks the scope fields (accounts 1–99, the two radio groups), shared in `src/lib/validate.ts`.
  - Notion Enquiries row: Name, Email, Phone, Business, Message (the scope answers + the message), Status New. Then a Telegram alert with everything.
  - If Notion fails, the alert carries the whole enquiry, and the visitor still gets "sent". Only if Notion and Telegram both fail does the visitor get a 502 with the email address.
  - A no-JS form post gets a small Malay page.
  - `ENQUIRY_API_ENABLED` is still false: the live form keeps opening the email app until the owner switches it on.
- Cron, every 15 minutes (`worker/cron.ts`, `triggers.crons` in `wrangler.jsonc`):
  - **Paid** with Paid at > 15 min ago (Make hasn't marked it Delivered): re-sent to Make. The owner is alerted the first time. Still Paid 24 h after payment: **Failed** + note + alert.
  - **Pending** > 15 min: ask CHIP. Paid → exactly the webhook's path (Paid + Make) and a "recovered" alert. Unpaid after 24 h → **Expired** (logged, no alert). Not expired while CHIP says the payment is in progress. CHIP doesn't know the purchase (test vs live key) → alert; Expired after 24 h.
  - One Telegram message per run, and only when something needs the owner.
  - At most 45 outside calls per run (the free plan allows 50); the rest wait for the next run.
  - Secrets missing: logged only while `PAYMENTS_ENABLED` is false, a Telegram alert once it's true.
- Order status flow (matches the Store Admin page in Notion): Pending (checkout) → Paid (Worker, verified) → Delivered or Failed (Make) → Refunded (Make). Expired (Worker cron).
- Other changes:
  - `sendAlert` now reports whether Telegram took the message.
  - Body parsing and the no-JS page moved to `worker/http.ts`.
  - The Notion helpers can split long text into several 2,000-character pieces.
  - `worker-configuration.d.ts` regenerated without the secrets (`wrangler types --env-file <empty file>`). A plain `wrangler types` now reads `.dev.vars` and makes the secrets required, which breaks the build.
- Tests: 95 in total (`npm test`). New files: `tests/fakes.ts` (fake CHIP, an in-memory Notion, Telegram and Make; RSA keys generated per run), `webhook.test.ts`, `cron.test.ts` and `enquiry.test.ts`. They cover:
  - a valid signature with either key, a bad signature, a body changed after signing, a missing signature, the alert rate limit, and the key being unavailable
  - a forged "paid" body for an unpaid purchase, a wrong total, a wrong payment amount, another brand, the enquiry-only package
  - Make down or timing out, Notion down, Paid set before Make, the same notification twice, a missing row rebuilt, a refund
  - a missed webhook recovered by the cron, expiry, in-progress payments, Make down and then back, Paid stuck for 24 h, the subrequest budget, and the scheduled handler
  - enquiry save, errors, Notion down, both down, rate limit, and the no-JS post
- Checked in `vite preview` (the Workers runtime): pages 200; GET on the new endpoints → 405; enquiry field errors → 400 in Malay; the no-JS error page renders. The real CHIP test-mode `GET /public_key/` answers a JSON PEM string (3072-bit RSA), and `worker/crypto.ts` imports it.

## Phase 3: still to test (needs the owner)

- **Real signed CHIP callback.** Only the deployed Worker can receive one. It needs `wrangler secret put` for CHIP (test key), Notion, Telegram, Make and `NOTION_ENQUIRIES_DB`, then a deploy and one test-mode purchase.
- **Local run against the real Notion and CHIP test mode.** Needs `MAKE_WEBHOOK_URL` and `MAKE_SHARED_SECRET` in `.dev.vars` (a local catcher works until Make is built in Phase 5), and `NOTION_ENQUIRIES_DB`. It would mark the Phase 2 test order (GB-20261125181720-Y64K, paid in CHIP) as Paid.
- **Refunds** need a webhook in the CHIP portal (event `payment.refunded`, URL `https://growthbridge.my/api/webhooks/chip`). Its public key goes in `CHIP_PUBLIC_KEY`.

## Phase 2: what was built (2026-11-25)

- `POST /api/checkout` in `worker/checkout.ts`, routed from `worker/index.ts`:
  1. Rate limit: 10 per minute per IP (`CHECKOUT_RATE_LIMIT` binding in `wrangler.jsonc`). Answers 429 with a Malay message.
  2. Validation: `src/lib/validate.ts` (same rules as the browser). The price comes from `getCheckoutPackage()` in `src/data/products.ts`. Any price in the body is ignored, and Siap Pasang is refused.
  3. Order ID `GB-<YYYYMMDDHHMMSS Malaysia time>-<4 chars>` (`worker/order-id.ts`).
  4. CHIP purchase (`worker/chip.ts`):
     - Buyer: `full_name`, `email` (lower-cased) and `phone` ("+60 123456789").
     - `reference` = order ID. `purchase.metadata` = {order_id, product, package}; the line's `category` = "product/package".
     - Redirects: success → `/terima-kasih`; failure and cancel → `/produk/<slug>?pakej=<id>#beli`. Callback → `/api/webhooks/chip`. All URLs are built from `site.url`. `send_receipt: false`.
     - The answer is checked: `checkout_url` must be on gate.chip-in.asia, and CHIP's total must equal our price.
  5. Notion Pending row (`worker/notion.ts`, API version 2022-06-28, `parent.database_id`). It sets every Orders property the Worker owns, and Notes = "CHIP test mode" when `is_test`.
     - It runs in `ctx.waitUntil` after the answer, so the buyer never waits on Notion.
     - If it fails, Telegram gets every detail needed to add the row by hand.
  6. The answer is `{ checkout_url }`. A plain form post (no JavaScript) gets a 303 to CHIP, or a small Malay error page.
- Errors:
  - Every outside call goes through `fetchWithTimeout` (`worker/upstream.ts`): CHIP 10 s, Notion 6 s, Telegram 5 s.
  - CHIP failure → 502 plus a Malay message for the buyer, and a Telegram alert.
  - CHIP keys missing → 503 "Pembayaran belum dibuka" plus an alert. The live site is in this state today: no secrets set.
  - Telegram failing or not configured → the alert goes to the Worker log (`console.error`, observability on).
  - Any unexpected exception in `/api/*` → 500 plus an alert.
- Routing:
  - GET `/api/checkout` → 405.
  - `/api/enquiry` and `/api/webhooks/chip` → 501 until Phase 3.
  - Any other `/api/*` → 404.
- CSP: `form-action` now allows `https://gate.chip-in.asia`, because browsers apply form-action to the 303 after a form post. `connect-src` stays `'self'`.
- Secrets: typed in `worker/env.ts` (optional, checked per handler). Names are listed in `.dev.vars.example` (tracked, no values).
- Tests: `npm test` (vitest; `vitest.config.ts`, `tests/`). 49 tests:
  - validation and phone formats
  - price lookup and the products file
  - order IDs
  - the handler end to end with a fake fetch: success, a price sent by the browser, a form post, field errors, enquiry and unknown packages, rate limit, bad bodies, missing keys, CHIP error, timeout, wrong host and wrong total, Notion down or unset, Telegram down
  - routing, and the www redirect
- Checked in `vite preview` (the Workers runtime) without secrets:
  - a valid checkout → 503 with the Malay message, and the alert is logged
  - field errors → 400 with Malay messages
  - Siap Pasang → 400
  - the no-JS error page renders
  - GET → 405; `/api/enquiry` → 501
  - the 11th request in a minute → 429
  - the pages still return 200
- **CHIP test-mode run (2026-11-25), via `vite preview` with `.dev.vars`:**
  - `POST /api/checkout` → `checkout_url` in about 0.35 s. CHIP has the purchase with `is_test` true, reference `GB-20261125181720-Y64K` and total 8900.
  - Notion got the Pending row with every field, and Notes "CHIP test mode (not a real payment)."
  - The owner paid with test card 4444 3333 2222 1111. CHIP shows status `paid`, 8900 MYR, visa, and status history created → viewed → pending_execute → paid. The Notion row stays Pending until the Phase 3 webhook.
  - Telegram alerts come from @Growthbridgeadminbot to the owner's private chat; a test message was delivered.
  - CHIP's `success_callback` went to the live `/api/webhooks/chip`, which answers 501 until Phase 3. Expected, and harmless in test mode.
  - Side effect: two unpaid live purchases, made by mistake with the old live key (see the gotcha under "How to run"). The owner cancels them in the CHIP portal; that key has been rotated.
- **Launch switches split (owner, 2026-11-25)**, in `src/config.ts`. Both are still false.
  - `PAYMENTS_ENABLED` controls checkout only. Turn it on once the Worker has the CHIP secrets (`wrangler secret put`).
  - `ENQUIRY_API_ENABLED` controls the Siap Pasang form (mailto until Phase 3 builds `POST /api/enquiry`).
  - Checked by a build with only checkout on: the product page shows the real checkout form, and Siap Pasang still opens the email app.
- **Phase 2 approved by the owner on 2026-11-25.**

## Phase 1: what was built

- Vite 8 + React 19 + `@cloudflare/vite-plugin`, with a Worker stub in `worker/index.ts`. It answers `/api/*` with 501 and a Malay message until Phase 2. (Since 2026-11-23 it also runs first for every request; see Status.)
- `wrangler.jsonc`: `html_handling: auto-trailing-slash`, 404 page. (`run_worker_first` was `["/api/*"]` in Phase 1; since 2026-11-23 it is `true`.)
- `src/data/products.ts`: the single source of products and prices (in sen), page copy, FAQ, step stills and the demo video. Siap Pasang is `kind: 'enquiry'` with a text `priceLabel` ("Dari RM1,500") and no sen price, so it can never be charged.
- `src/lib/validate.ts`: shared form validation for the browser and, from Phase 2, the Worker. `src/lib/money.ts`: `formatRM`.
- Prerendering: `vite.prerender.config.ts` builds `src/entry-server.tsx`. `scripts/prerender.mjs` renders every route with `renderToString` into `dist/client/<route>.html`, plus `404.html`, `sitemap.xml` and `robots.txt`. It also lists any `[placeholder]` left in the copy. The client hydrates with `hydrateRoot`.
- Brand: the mark is measured from `brand/growthbridge-logo.png`: 6 bars, heights 0.44 / 0.549 / 0.541 / 0.757 / 1 / 0.925, bar:gap 54:40. It's drawn as SVG in `src/components/Mark.tsx`, flat green (the logo's fade is dropped; no gradients). The wordmark is in Montserrat 600, only for the name; everything else is Inter.
- Design direction "One motif" (design-taste-frontend skill, seed 55736505): the logo's bars run the hero, the steps, the pricing tiles, the schedule chart, page heads and the footer. The live element is the schedule picker.
- Teaser video: `public/media/teaser-720.mp4` (1.2 MB; source in `media-src/`, gitignored). Plus a poster frame and 3 real stills (Notion queue, Make modules, Threads post).

## Phase 1: checks run (2026-11-22, against `vite preview` = the real Worker runtime)

- curl: all 8 routes return 200 with their own `<title>`, canonical URL, OG/Twitter tags and `<h1>`. Unknown paths return 404. `/terma/` → 307 `/terma`. `POST /api/checkout` → 501 (reaches the Worker).
- Design inspector at 1440/768/390: **0 FAIL on all 9 pages**. Legal, contact, thank-you and 404 run with `--allow few-pictures,no-footage`; no honest picture exists for a legal page. The remaining warnings are "little motion" on one-screen pages and small margin/edge notes on the product page.
- Lighthouse (mobile, simulated): `/` 94/100/100/100, `/produk/autopost-threads` 91/100/100/100, `/bayaran-balik` 91/100/100/100 (Performance / Accessibility / Best Practices / SEO). CLS 0.
- Browser smoke test, 12/12 passing:
  - package pick, `?pakej=` preselect
  - empty and bad-phone validation
  - valid checkout and enquiry submits reach `/api/*` and show the Malay error
  - schedule picker arithmetic
  - video autoplays muted and the pause button works
  - reduced motion: nothing hidden, no autoplay
  - no page errors
- Notes for Phase 4 CSP: the site loads no third-party scripts, fonts or images; everything is self-hosted. Inline `style` attributes: none (the bars are SVG).

## Phase 1 review changes (2026-11-22)

- Schedule chart redesigned with motion (motion-design skill, installed at `~/.claude/skills/motion-design`):
  - Posts wait as outlined slots; a "today" marker walks the week and fills each one as it's posted.
  - Primary motion: slots rise in a wave on scroll-in. Secondary: each post fills bottom-up and lifts 8px. Marker: the day label turns green.
  - One signature curve `cubic-bezier(0.2, 0.7, 0.2, 1)` for entrances, `cubic-bezier(0.4, 0, 1, 1)` for exits. A sweep lasts ~3 s and runs only on scroll-in and after a change, so no pause control is needed.
  - Server HTML and reduced motion show the finished week with no movement.
- Times under the chart now read "Contoh masa: …", with the note "Masa di atas hanya contoh. Anda pilih masa sendiri."
- No address anywhere (owner: the SSM number is enough).
- FAQ: tool plans answer (owner's wording); Masterclass "one to one session" (replaces "satu lawan satu").
- Legal: Masterclass 60 days; retention "7 tahun dari akhir tahun berkaitan"; enquiries deleted after 12 months; support is "14 hari dari tarikh pembelian" everywhere (manual's wording).
- "Kemas kini terakhir" is now `LEGAL_LAST_UPDATED` in `src/data/site.ts`, null until Phase 6. While it's null, the legal pages show no date and the build prints a reminder.
- Checks after the changes:
  - Smoke test 12/12.
  - Chart motion test 9/9 (queue, sweep order, progressive fill, change, day off, reduced motion, no errors).
  - Inspector 0 FAIL on product, contact and privacy. Lint 0 FAIL.
  - Lighthouse on the product page: 84–92 performance over 3 runs (local noise; the chart is below the fold and adds ~1 kB of JS), 100/100/100 for the rest, CLS 0.

### Second round (2026-11-22)

- The logo bars on the home hero and every page head are now live (`<Bars live />` in `src/components/Mark.tsx`):
  - Rise: left to right, 90 ms apart, settling after a 3.5% overshoot. Done in CSS, so it plays before JS loads.
  - Glint: one lighter-green pass across the bars once they've landed.
  - Pointer: with a mouse, the bars under the pointer grow toward it (up to 7%, falling off over about 1.5 bars).
  - Click or tap: a growth pulse runs across all six.
  - Nothing loops; reduced motion shows still bars. The footer and product-card bars stay still.
- The refund section "Janji baiki atau pulang" is now "Proses troubleshooting atau refund" (anchor `#troubleshooting-atau-refund`), with matching wording in the lead, the meta description and "Cara memohon".
- Checks:
  - Bars motion test 8/8. Smoke 12/12. Chart motion 9/9.
  - Inspector 0 FAIL on home, refund and Siap Pasang. Lint 0 FAIL.
  - Lighthouse on home: the new build and the previous commit both score 94/88/88 across 3 runs on this machine, so the variance is local noise. A11y/BP/SEO 100, CLS 0.

### Third round (2026-11-22)

- **Superseded:** the Notion and Threads stills are now the owner's own phone screenshots: `public/media/step-notion.jpg` (522×1080) and `step-threads.jpg` (530×1080), served as-is, never re-compressed.
  - Product step tiles: they fill the tile width and show from the top (`object-fit: cover; object-position: top`); the Make still stays whole.
  - Home "Tentang saya": the heading and the two phones sit on the left (cols 1–6), the text on the right (8–13). On phones they stack one per row, max 340 px wide.
- (Earlier, now replaced) Notion and Threads stills re-cut from `media-src/teaser_1080x1920.mp4` (0.8 s and 7.3 s):
  - The crop `720x552+180+308` drops the phone status bar and the phone outline.
  - Then light denoise (`hqdn3d=3:2:0:0`), 2× Lanczos upscale, `unsharp=7:7:1.1`, saved as WebP q90 at 1440×1104.
  - The source caps the detail: the phone is ~740 px wide in the video. For truly sharp stills, use original phone screenshots.
- Teaser video re-encoded without the phone status bar:
  - While the phone is on screen (0–13.97 s, then a hard cut), a 6-px strip of the phone's own background (y 303) is stretched over the status bar area (670×66 at 215,237) on every frame.
  - The patch matches both the Notion and the Threads background, and the transition between them.
  - Encoded as before (720×1280, CRF 27, faststart); poster re-cut at 0.5 s. A frame scan finds 0 frames with the red time pill.
  - The original stays untouched in `media-src/`. Re-encode command:
    `ffmpeg -i media-src/teaser_1080x1920.mp4 -an -filter_complex "[0:v]split[base][src];[src]crop=670:6:215:303,scale=670:66:flags=bilinear[patch];[base][patch]overlay=215:237:enable='lt(t,13.985)',scale=720:1280:flags=lanczos" -c:v libx264 -profile:v high -preset slow -crf 27 -pix_fmt yuv420p -movflags +faststart public/media/teaser-720.mp4`
- Step tiles now show screenshots whole (`object-fit: contain`, bottom-aligned), so no words get cropped.
- Sales headlines open on a green slab like selected text (`src/components/Highlight.tsx`, `.hl`), wiping in once on load:
  - home "Sistem AI dan automasi"
  - product `hero.titleMark` "Post setiap hari,"
  - Siap Pasang "Siap Pasang:"
  Legal, contact and 404 headlines stay plain.
- Checks: smoke 12/12, chart 9/9, bars 8/8; inspector 0 FAIL on home, product and Siap Pasang; lint 0 FAIL.

## Teaser voice-over (2026-11-23)

- The owner's ElevenLabs voice-over (37.1 s; source kept unshipped as `media-src/teaser-voiceover.mp3`) is retimed onto the teaser. `public/media/teaser-720.mp4` is now 41 s with AAC mono audio, about 1.6 MB.
- Method (`media-src/teaser-voiceover-plan.py`):
  - The voice is cut at its natural pauses into 12 phrases, matched by Whisper transcript to the 10 caption scenes.
  - Each phrase starts 0.1 s after its scene appears, at least 0.2 s after the previous one. No tempo or pitch change.
  - Two long inner pauses are shortened: after "Anda", and inside "Se…tiap".
  - The end card is held 1 s longer so the last line ("…DM … di Threads") isn't cut. The audio is levelled with loudnorm to about −16 LUFS.
  - The status-bar cover is unchanged.
- Player (`TeaserVideo`): still autoplays muted (browser rule). A new "Hidupkan suara" button (bottom-left, `aria-pressed`) unmutes and restarts from 0 so the voice plays in sync; pressing it again mutes. If the browser refuses sound, it falls back to muted.
- Re-encode command (from the repo root, with the graph from the plan script):
  `ffmpeg -i media-src/teaser_1080x1920.mp4 -i media-src/teaser-voiceover.mp3 -filter_complex "<status-bar patch>,tpad=stop_mode=clone:stop_duration=1,scale=720:1280 ; <voice graph>" -c:v libx264 -crf 27 -c:a aac -b:a 96k -ac 1 -movflags +faststart -t 41 public/media/teaser-720.mp4`

## Pre-launch live on growthbridge.my for CHIP review (2026-11-23)

**Deployed:** https://growthbridge.my (Worker `growthbridge`, version 9f90b241). The zone is Active (SSL Full strict, Always Use HTTPS on).

- **Domain:** growthbridge.ai → growthbridge.my everywhere (commit e7bc0e8). All absolute URLs come from `site.url`.
- **One Worker, both hostnames:** `wrangler.jsonc` has custom domains `growthbridge.my` and `www.growthbridge.my`, and wrangler created the DNS records. It replaced the old apex A record 103.7.9.22, with the owner's OK.
  - `run_worker_first: true`, so `worker/index.ts` sees every request. It sends www → 301 to the apex (path and query kept), answers `/api/*` with 501 (not built), and passes everything else to the static assets.
  - The Worker sets the security headers on every response: HSTS, CSP (own scripts only + `mailto:` form-action), X-Frame-Options DENY, Referrer-Policy strict-origin-when-cross-origin, nosniff, Permissions-Policy. `public/_headers` was removed, so there's one source.
- **Pre-launch mode:** `PAYMENTS_ENABLED = false` (`src/config.ts`).
  - "Beli" becomes "Pembayaran dibuka tidak lama lagi" + "Tanya melalui emel" (subject "Pertanyaan: <product> <package>", names from products.ts).
  - The Siap Pasang form opens the visitor's email app. The client bundle has no `/api/` call.
- **OG images:** `public/og/og-home.png` (home, legal pages, Siap Pasang, contact, thanks) and `public/og/og-autopost-threads.png` (product), both owner-supplied and printed with growthbridge.my. The old .ai images were deleted on 2026-11-25 (owner: .ai isn't used at all).
- **Legal date:** `LEGAL_LAST_UPDATED = '23 November 2026'` (owner: set to today for pre-launch). Update it whenever legal text changes, and at Phase 6.
- **Footer:** "© 2026 GROWTH BRIDGE ENTERPRISE (202603162028 (NS0324359-K)) · growthbridge.biz@gmail.com", plus the Polisi links (Terma, Privasi, Bayaran Balik, Hubungi).
- **Verified live (pinned to Cloudflare's address while public DNS caches expired):**
  - All 8 routes return 200 over HTTPS, each with its own title, canonical and og:image on growthbridge.my.
  - www → 301 apex, and http → 301 https.
  - The og images, sitemap.xml and robots.txt return 200; unknown paths return 404. The built output has 0 matches for growthbridge.ai.
  - Lighthouse mobile, `/` and the product page: Perf 98, A11y 100, BP 93, SEO 92. The BP and SEO points are lost only to zone features below.
- **Zone features the owner may want to change (dashboard, not repo):**
  - Cloudflare Web Analytics auto-injects `static.cloudflareinsights.com/beacon.min.js`, which the CSP blocks (console error).
  - Managed robots.txt prepends `Content-Signal:` lines that Lighthouse flags as unknown.
- **Deploy command:** `npm run build && npx wrangler deploy`
- **docs/PLAN.md:** the .ai pricing and 2-year minimum were replaced with the .my facts on 2026-11-25 (bought from Exabytes; no price stated, see the invoice).

## Decisions made with the owner

- (2026-11-21) Missing Notion row: in Phase 3 the webhook creates the row if it's missing, built from the CHIP purchase itself. So **Phase 2 must put on the CHIP purchase: buyer name, email and phone, reference = order ID, and the product and package.** The Worker is the only thing that ever creates order rows; Make only updates them. Accepted gap: Notion fails at checkout AND the webhook is missed → the cron can't see the order (the checkout Telegram alert still fires).
- (2026-11-21) Refunds: a missed `payment.refunded` isn't auto-recovered. Rule: refund in CHIP, then tick Revoke access straight away.
- (2026-11-21) Prerendering: a small build step, no framework. `renderToString` + `hydrateRoot`; routes come from the products file.
- (2026-11-21) Contact email growthbridge.biz@gmail.com. Refund policy: no refund after access is sent, plus a fix-or-refund section, named "Proses troubleshooting atau refund" by the owner (2026-11-22).
- (2026-11-22) No job title in the bio. Telegram support hours: 9:00 pagi hingga 12:00 tengah hari.
- (2026-11-22) No registered address on the site. Retention 7 years from the end of the relevant year (LHDN). Enquiry deletion 12 months (owner's choice). Legal date set at Phase 6.

## Deviations from the content draft (owner to confirm in review)

- The "Label kecil" eyebrows are dropped on the site (the design rules ban eyebrows); they stay on the OG images.
- The product hero is split: h1 "Post setiap hari, ikut jadual anda." with "Ikut suara brand anda. Tanpa upah sesiapa." under it.
- The demo video is in the product hero, the home product card and the Siap Pasang page, not in a separate Demo section.
- The Siap Pasang page title "Siap Pasang: saya bina untuk anda." and its copy were written from facts already in the draft.
- The schedule picker's times are labelled as examples on the page; 7:30 and 8:47 malam come from the video.

## Waiting for the owner (remind every phase)

- `LEGAL_LAST_UPDATED` in `src/data/site.ts`: fill in at Phase 6, on the day live CHIP keys go on after the test purchase. The build prints a reminder while it's null.
- Optional: a video version that ends on growthbridge.my instead of "DM @ihsaaann__".

## How to run

```bash
npm install
npm run build                   # tsc, client + Worker build, SSR build, prerender
npm test                        # unit tests (vitest)
npx vite preview --port 4173    # serves dist/ in the Worker runtime
```

Gotcha: `vite preview` reads secrets from `dist/growthbridge/.dev.vars`, a copy made by `npm run build`. **After editing `.dev.vars`, rebuild, then restart the preview**; restarting alone keeps the old keys. (2026-11-25: this made two unpaid live CHIP purchases after the switch to the test key.)

Gotcha: after every rebuild, **restart `vite preview`**. It keeps the old asset manifest, so the new hashed CSS returns 404 and pages look unstyled. On Windows, stopping the shell doesn't stop its node child; kill the process listening on 4173.

Design checks (skill at `~/.claude/skills/design-taste-frontend`):

```bash
node ~/.claude/skills/design-taste-frontend/scripts/lint.mjs src
node ~/.claude/skills/design-taste-frontend/scripts/inspect.mjs http://localhost:4173/<path> --out .taste-skill/inspect-<name>
```
