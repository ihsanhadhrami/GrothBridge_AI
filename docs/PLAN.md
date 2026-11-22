# growthbridge.my build plan (Option A)

Owner: Ihsan Hadhrami · Growth Bridge · Nov 2026
Save this file in the repo as `docs/PLAN.md`.

## Summary and stack decisions

The store is a React site on Cloudflare Workers with one small Worker API for checkout and payment notifications. Make handles delivery, and Notion is the admin panel. There's no database to run and no admin login to build, and adding a product means adding content, not rebuilding.

| Part | Tool | Job |
| --- | --- | --- |
| Website | React + Vite, built with Claude Code | Home, product pages, checkout form, legal pages |
| Hosting | Cloudflare Workers with static assets, on growthbridge.my | Serves the pages, plus the small API |
| Worker API (3 endpoints) | Cloudflare Worker | Creates CHIP payments, verifies CHIP's signed notifications, receives Siap Pasang enquiries. Secrets stay here, never in the browser |
| Payments and refunds | CHIP Collect | FPX RM1.00 per paid transaction; refunds from the CHIP portal |
| Delivery | Make | Shares the files and video, creates the Telegram invite, makes the invoice, sends the email |
| Admin | Notion | Orders and Enquiries databases. Checkboxes trigger resend, runbook release and revoke |
| Code | Claude Code + GitHub | You own every file; every change is versioned |

**Why a small Worker API, and not payment links alone:** creating a CHIP payment needs the secret key, and checking CHIP's signature needs code. A browser can do neither safely. The Worker runs that code next to the pages, in the same project.

**The one catch with React: link previews and SEO.** A plain React app sends the same empty HTML for every page, so a product link posted on Threads shows a generic preview. **Prerender each route to its own HTML file at build time** (Phase 1 does this). Each product page then has its own title, description and preview image.

**Rejected for now:** Emergent, buyer accounts, a custom admin page, coupons.

## How it works

The Worker is the only place that talks to CHIP with the secret key. It hands Make only payments it has already verified, and Make does everything the buyer receives.

### Pages

| Path | Content |
| --- | --- |
| `/` | Growth Bridge home: Ihsan Hadhrami, @ihsaaann__, and a card for each product |
| `/produk/autopost-threads` | The problem, a demo, the packages, FAQ, checkout form (name, email, phone, consent) |
| `/terima-kasih` | "Bayaran sedang diproses. Semak emel anda dalam 5 minit." |
| `/siap-pasang` | Enquiry form |
| `/terma`, `/privasi`, `/bayaran-balik`, `/hubungi` | Terms, privacy notice (PDPA), refund policy, contact with SSM number |

Products and packages live in one file (`src/data/products.ts`): name, slug, packages, prices in sen, and what each delivers. A new product = a new entry in that file + one Make delivery template.

### Worker API

| Endpoint | Does |
| --- | --- |
| `POST /api/checkout` | Validates the form, reads the price from the products file (never from the browser), creates the CHIP purchase, writes a `Pending` row to Notion, returns CHIP's checkout URL |
| `POST /api/webhooks/chip` | Verifies CHIP's signature over the raw body, re-fetches the purchase from CHIP, then forwards only verified `paid` or `refunded` events to Make's webhook, signed with a shared secret |
| `POST /api/enquiry` | Saves a Siap Pasang enquiry to Notion and sends a Telegram alert |

Plus a **scheduled job (Cron Trigger) every 15 minutes:** it checks Notion orders still Pending after 15 minutes against CHIP, forwards any that were paid but whose notification was missed, and marks unpaid orders older than 24 hours as Expired.

### Notion (admin panel)

**Orders** database: Order ID, Name, Email, Phone, Product, Package, Amount (RM), Status (Pending, Paid, Delivered, Failed, Refunded, Expired), CHIP purchase ID, Invoice no., Paid at, Telegram invite, plus 3 checkboxes: **Resend access**, **Release runbook**, **Revoke access**. A second database, **Enquiries**, holds Siap Pasang leads.

## Before you build

- [ ] **growthbridge.my** registered (2-year minimum, auto-renew on), with its DNS on Cloudflare
- [ ] **CHIP merchant account:** apply with the SSM registration (GROWTH BRIDGE ENTERPRISE, 202603162028). Build with test keys while approval runs; approval checks the live site, so the legal pages go up first
- [ ] **Cloudflare account** with Workers enabled, and `wrangler` logged in on the computer
- [ ] **GitHub repo** `growthbridge-store` (private)
- [ ] **Notion:** the Orders and Enquiries databases above, plus a Notion integration (API token) shared with both
- [ ] **Google Drive (Growth Bridge account):** a folder `Produk/Autopost Threads` holding the manual PDF, runbook PDF + MD and the video, all **Restricted**, with downloading off for viewers
- [ ] **Google Docs invoice template** with placeholders ({{invoice_no}}, {{name}}, {{email}}, {{package}}, {{amount}}, {{date}})
- [ ] **Telegram bot** (@BotFather), an admin of the support group with permission to invite users
- [ ] **Booking link** for Masterclass (Cal.com or Calendly)
- [ ] **Legal text in Malay:** terms, refund policy, privacy notice (PDPA), contact
- [ ] **Email sender:** the Growth Bridge Gmail through Make to start. Move to hello@growthbridge.my once the domain's email is set up

## Execution: phases 0–6

Run phases 0 to 4 in Claude Code inside the `growthbridge-store` repo, one phase per session, and commit after each. Phase 5 (Make) is built in Claude chat with the Make and Notion connectors.

### Phase 0 · Project rules

`CLAUDE.md` in the repo root holds the project rules. It is already written; just copy it in.

### Phase 1 · Site, pages and prerendering

```text
Read CLAUDE.md. Scaffold the site for Cloudflare Workers static assets
(React + Vite + the Cloudflare Vite plugin).
1. src/data/products.ts with product "autopost-threads": packages
   starter (8900, manual PDF + video + 14-day Telegram support) and
   masterclass (25900, Starter + 2-hour live 1:1 + Claude runbook after
   the session); Siap Pasang as an enquiry-only package (no price).
2. Pages: "/" home (intro to Ihsan Hadhrami, @ihsaaann__, product
   cards), "/produk/:slug" generated from the products file, with a
   checkout form per package (name, email, phone, required consent to
   /terma and /privasi), "/terima-kasih", "/siap-pasang" form, and the
   4 legal pages using the text I paste.
3. Prerender every route to its own HTML file at build time, each
   with its own <title>, meta description, canonical URL and Open
   Graph tags (image 1200x630), so Threads link previews work.
4. Footer: GROWTH BRIDGE ENTERPRISE (202603162028 (NS0324359-K)),
   contact email, links to the legal pages.
5. Mobile-first, Lighthouse 90+ on performance and accessibility.
Forms post to /api/* but don't build the API yet. Show me the build
output and a local preview.
```

### Phase 2 · Checkout API (CHIP test mode)

```text
Read CLAUDE.md. Add the Worker API in worker/:
POST /api/checkout
- Validate name, email, phone, consent, product slug and package.
- Read the price from src/data/products.ts.
- Create an order id (e.g. GB-<timestamp>-<random>).
- Create a CHIP purchase (https://gate.chip-in.asia/api/v1/purchases/,
  Bearer CHIP_SECRET_KEY, brand_id CHIP_BRAND_ID) with the buyer's
  email, the product line, reference = order id,
  success_redirect = /terima-kasih, failure_redirect = the product page,
  success_callback = /api/webhooks/chip.
- Write a Notion Orders row: status Pending, all buyer details,
  CHIP purchase id. If Notion fails, still return checkout and alert
  me on Telegram.
- Return { checkout_url } and redirect the browser there.
Rate-limit to 10 requests per minute per IP with the Workers rate
limiting binding. Write unit tests for validation and price lookup.
```

### Phase 3 · Payment notification + enquiries

```text
Read CLAUDE.md. Add:
POST /api/webhooks/chip
1. Read the raw body BEFORE parsing. Base64-decode the X-Signature header
   and verify it against the raw body with CHIP_PUBLIC_KEY (RSA PKCS#1
   v1.5, SHA-256) using Web Crypto. The key for success_callback comes
   from CHIP's GET /public_key/; a portal webhook uses its own
   Webhook.public_key. See
   https://docs.chip-in.asia/chip-collect/overview/webhook-signatures.
   On failure: return 400, alert me on Telegram, stop.
2. For purchase.paid and payment.refunded only: GET the purchase from
   CHIP and confirm the status and that the amount matches the products
   file.
3. POST to MAKE_WEBHOOK_URL: {event, order_id, chip_purchase_id,
   amount, email, name, phone, product, package, paid_at}, with header
   X-GB-Signature = HMAC-SHA256(body, MAKE_SHARED_SECRET).
4. Return 200 only after Make answers 200; otherwise return 500 so
   CHIP retries.
POST /api/enquiry: validate, write to Notion Enquiries, alert me on
Telegram, rate-limit.
Cron Trigger every 15 minutes (reconciliation): query Notion Orders
with status Pending older than 15 minutes; for each, GET the purchase
from CHIP; if paid, forward it to Make exactly like step 3; if older
than 24 hours and unpaid, set status Expired. Alert me on any error.
Tests: valid signature, bad signature, wrong amount, Make down,
missed webhook recovered by the cron.
```

### Phase 4 · Deploy

```text
Read CLAUDE.md. Set all secrets with wrangler secret put (I'll paste
them when prompted, never into files). Deploy with wrangler, attach the
custom domain growthbridge.my and www, redirect www to the apex. Add
security headers (HSTS, CSP allowing only our own scripts and CHIP's
checkout domain, X-Frame-Options DENY, Referrer-Policy). Confirm
https://growthbridge.my serves every prerendered page.
```

### Phase 5 · Make + Notion delivery

Built in Claude chat with the Make and Notion connectors, as described in the next section. Use one scenario per job, and test each one before switching it on.

### Phase 6 · Test, then go live

Run the testing checklist in CHIP test mode. Then switch the Worker secrets to live CHIP keys, set the live webhook in the CHIP portal, make one real RM89 purchase, and refund it.

## Make scenarios

There are five scenarios. Only Delivery runs automatically, triggered instantly by the Worker. The admin jobs are set to **On demand**, so they use no operations while idle. Timed checks would cost operations on every run, even when nothing happens, so the missed-payment check runs in the Worker's free scheduled job instead.

| Scenario | Trigger | Steps |
| --- | --- | --- |
| **1. Delivery** | Custom webhook from the Worker (instant) | Check X-GB-Signature (HMAC-SHA256 with the shared secret) → find the Notion order; **stop if already Delivered** → next invoice number from a Make data store counter (sequential processing ON) → share the manual + video in Drive with the buyer's email as Viewer, notification off → Telegram `createChatInviteLink` (member_limit 1, expires in 7 days) → invoice from the Google Docs template, exported to PDF → Gmail: access links, Telegram invite, support hours, invoice attached (Masterclass adds the booking link) → Notion: Delivered + invoice no. + invite. Error route: Notion Failed + Telegram alert |
| **2. Resend access** | On demand (tick **Resend access** in Notion, then Run once) | New Telegram invite → resend the email → untick |
| **3. Release runbook** | On demand (tick **Release runbook**) | Share the runbook PDF + MD with the buyer in Drive → email → untick, log the date |
| **4. Refund / revoke** | Worker webhook (`payment.refunded`) or tick **Revoke access** | Remove the buyer's Drive access → revoke their Telegram invite → Notion Refunded |
| **5. Enquiry alert** | Handled in the Worker | No Make needed |

**Operations per order:** roughly 10 to 12 for Delivery. Check the Make plan's monthly limit against expected orders before launch.

**Keep the existing autopost scenario separate.** These are new scenarios in their own Make folder. Don't edit the live Threads scenario to share modules or connections with them.

## Rules and testing

**Rules that don't bend**

1. Only a notification the Worker has verified reaches Make. It checks CHIP's base64-encoded RSA signature over the raw body, using PKCS#1 v1.5 and SHA-256 (https://docs.chip-in.asia/chip-collect/overview/webhook-signatures), then re-fetches the purchase.
2. Make also checks that every request carries the Worker's HMAC signature, so nobody can call the Make webhook directly.
3. Delivery runs once per order. A repeated notification sees status Delivered and stops.
4. Prices come from the products file, never from the browser.
5. Secrets live in Worker secrets and Make connections. Never in GitHub, never in chat.
6. Every failure sends a Telegram alert before a buyer notices.

**Testing checklist (CHIP test mode)**

- [ ] A successful test payment: email within 2 minutes, with Drive access, a Telegram invite and the invoice PDF
- [ ] A failed or cancelled payment: the order stays Pending and nothing is delivered
- [ ] A notification with a bad signature: rejected, alert sent
- [ ] The same notification sent twice: one delivery, one invoice number
- [ ] Make webhook URL temporarily wrong: the Worker cron recovers the order within 15 minutes
- [ ] A price edited in the browser: CHIP still charges the real price
- [ ] Calling the Make webhook directly without the signature: rejected
- [ ] The Drive files open only for the buyer's email; downloading is off
- [ ] The Telegram invite works once only
- [ ] Masterclass: booking link received; the runbook arrives only after Release runbook
- [ ] Refund in the CHIP portal: Drive access removed, Notion shows Refunded
- [ ] A product link pasted in Threads shows that product's own preview
- [ ] All pages work on a phone, and all 4 legal pages are live
- [ ] One real purchase on live keys, checked end to end, then refunded

## Costs, limits, and when to move to Option B

**Running costs**

| Item | Cost | Note |
| --- | --- | --- |
| CHIP Collect | RM1.00 per FPX payment; 1.0% debit card, 2.0% credit card | No setup or monthly fee |
| growthbridge.my domain | About US$150–230 upfront | .ai domains require a 2-year minimum registration |
| Cloudflare Workers + static assets | RM0 at this scale | The free tier covers a small store |
| Make | Current plan | About 10–12 operations per order. Admin scenarios are On demand |
| Notion, Google Drive, Gmail, Telegram | RM0 | Already in use |

Example: a RM89 Starter sale paid by FPX keeps RM88.

**Known limits (accepted for Option A)**

- No buyer login. If a buyer loses the email, run Resend.
- Drive access is tied to the buyer's email address. A forwarded link does not open for other accounts, but the buyer can still screen-record.
- Admin work is manual: tick a box in Notion, then run the scenario.
- Telegram support lasts 14 days. Track that date in Notion.
- Order history lives in Notion and CHIP, not on the site.

**Move to Option B (buyer portal + admin page) when any of these is true**

1. More than 30 orders a month, or Resend and refunds take more than 1 hour a week.
2. More than 5 products, or courses with lessons that need tracking.
3. Buyers ask for a login, or Drive links are being shared.
4. Subscriptions are added, such as the RM300/month care plan billed automatically.
