# Progress and handoff

Last updated: 2026-11-25.

## Status

- **Phase 0: done.**
- **Phase 1 (site, pages, prerendering): done. Approved by the owner on 2026-11-24.**
  - Live on https://growthbridge.my in pre-launch mode for CHIP merchant review (`PAYMENTS_ENABLED = false`).
  - Pages: 5 policy pages, including Polisi Penghantaran.
- **Phase 4 (deploy): mostly done early, for the CHIP review.**
  - Done: custom domains growthbridge.my and www (301 to the apex), and security headers set in `worker/index.ts`.
  - Still to do: `wrangler secret put` for the CHIP/Notion/Make/Telegram secrets, and CHIP's checkout domain in the CSP. Both wait on Phase 2/3.
- **Phase 2 (checkout API): built and unit-tested on 2026-11-25. Waiting for the owner's review and a real CHIP test-mode run.** See "Phase 2: what was built" below. Not committed or deployed yet.
- (Original Phase 2 handoff notes, kept for reference:)
  - The Worker now runs first for every request (`run_worker_first: true`): it 301s www, serves `/api/*` (currently a 501 stub), and passes everything else to the static assets. Build the API inside that same `fetch`.
  - Keep one Worker only; the owner's rule.
  - Turn `PAYMENTS_ENABLED` on only once checkout works in test mode; the checkout form in `src/components/CheckoutForm.tsx` is already wired to `POST /api/checkout`.
  - Put the buyer's name, email and phone, reference = order ID, and the product and package on the CHIP purchase (see "Decisions" below). Build the CHIP redirect and callback URLs from `site.url`.
  - The SSM address is deliberately not on the site (owner's choice, 2026-11-24), even though CHIP asked for it.

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
- **Still to do for Phase 2 sign-off:** one real CHIP test-mode purchase. The owner fills `.dev.vars` from `.dev.vars.example` with the CHIP **test** key. Then run `npm run build`, restart `vite preview`, and `POST /api/checkout`. Expect: a `checkout_url`, a Notion row with Pending + "CHIP test mode", and, after paying with test card 4444 3333 2222 1111 / CVC 123, a landing on `/terima-kasih`.
- `PAYMENTS_ENABLED` is still false. Flipping it also switches the Siap Pasang form to `POST /api/enquiry`, which is Phase 3. So either flip it after Phase 3, or split the flag first (the owner decides).

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
- **OG images:** `public/og/og-home.png` (home, legal pages, Siap Pasang, contact, thanks) and `public/og/og-autopost-threads.png` (product), both owner-supplied and printed with growthbridge.my. The old .ai images are kept, unshipped, in `brand/og-old-domain/`.
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
- **Stale in docs/PLAN.md:** lines 58 and 223 still describe .ai pricing and the 2-year minimum.

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

Gotcha: after every rebuild, **restart `vite preview`**. It keeps the old asset manifest, so the new hashed CSS returns 404 and pages look unstyled. On Windows, stopping the shell doesn't stop its node child; kill the process listening on 4173.

Design checks (skill at `~/.claude/skills/design-taste-frontend`):

```bash
node ~/.claude/skills/design-taste-frontend/scripts/lint.mjs src
node ~/.claude/skills/design-taste-frontend/scripts/inspect.mjs http://localhost:4173/<path> --out .taste-skill/inspect-<name>
```
