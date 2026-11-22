# Progress and handoff

Last updated: 2026-11-22.

## Status

- **Phase 0: done.**
- **Phase 1 (site, pages, prerendering): built and checked. Waiting for the owner's review.** Phase 2 doesn't start until the owner approves.

## Phase 1: what was built

- Vite 8 + React 19 + `@cloudflare/vite-plugin`, with a Worker stub in `worker/index.ts`. It answers `/api/*` with 501 and a Malay message until Phase 2.
- `wrangler.jsonc`: `run_worker_first: ["/api/*"]`, `html_handling: auto-trailing-slash`, 404 page.
- `src/data/products.ts`: the single source of products and prices (in sen), page copy, FAQ, step stills and the demo video. Siap Pasang is `kind: 'enquiry'` with `displayPriceSen` only, so it can never be charged.
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

## Decisions made with the owner

- (2026-11-21) Missing Notion row: in Phase 3 the webhook creates the row if it's missing, built from the CHIP purchase itself. So **Phase 2 must put on the CHIP purchase: buyer name, email and phone, reference = order ID, and the product and package.** The Worker is the only thing that ever creates order rows; Make only updates them. Accepted gap: Notion fails at checkout AND the webhook is missed → the cron can't see the order (the checkout Telegram alert still fires).
- (2026-11-21) Refunds: a missed `payment.refunded` isn't auto-recovered. Rule: refund in CHIP, then tick Revoke access straight away.
- (2026-11-21) Prerendering: a small build step, no framework. `renderToString` + `hydrateRoot`; routes come from the products file.
- (2026-11-21) Contact email growthbridge.biz@gmail.com. Refund policy: no refund after access is sent, plus "Janji baiki atau pulang" (wording drafted, **owner to review**).
- (2026-11-22) No job title in the bio. Telegram support hours: 9:00 pagi hingga 12:00 tengah hari.

## Deviations from the content draft (owner to confirm in review)

- The "Label kecil" eyebrows are dropped on the site (the design rules ban eyebrows); they stay on the OG images.
- The product hero is split: h1 "Post setiap hari, ikut jadual anda." with "Ikut suara brand anda. Tanpa upah sesiapa." under it.
- The demo video is in the product hero, the home product card and the Siap Pasang page, not in a separate Demo section.
- The Siap Pasang page title "Siap Pasang: saya bina untuk anda." and its copy were written from facts already in the draft.
- The schedule picker's 3-a-day time (12:30 tengah hari) is an example; 7:30 and 8:47 malam are real (from the video).

## Waiting for the owner (remind every phase; block deploy on the legal ones)

`npm run build` prints the remaining placeholders:
- `[Semak dan nyatakan pelan yang manual cadangkan.]`: FAQ, `src/data/products.ts`
- `[tarikh go-live]`: `src/data/site.ts`
- `[60 hari]`: Terma §7, `src/content/legal.tsx`
- `[sahkan: 7 tahun]`, `[12 bulan]`: Privasi §6, `src/content/legal.tsx`
- `[Alamat berdaftar SSM]`: `src/data/site.ts`
- Review the "Janji baiki atau pulang" wording in `src/content/legal.tsx`
- Optional: a video version that ends on growthbridge.ai instead of "DM @ihsaaann__"

## How to run

```bash
npm install
npm run build                   # tsc, client + Worker build, SSR build, prerender
npx vite preview --port 4173    # serves dist/ in the Worker runtime
```

Gotcha: after every rebuild, **restart `vite preview`**. It keeps the old asset manifest, so the new hashed CSS returns 404 and pages look unstyled. On Windows, stopping the shell doesn't stop its node child; kill the process listening on 4173.

Design checks (skill at `~/.claude/skills/design-taste-frontend`):

```bash
node ~/.claude/skills/design-taste-frontend/scripts/lint.mjs src
node ~/.claude/skills/design-taste-frontend/scripts/inspect.mjs http://localhost:4173/<path> --out .taste-skill/inspect-<name>
```
