# Progress and handoff

Last updated: 2026-11-21. Paused by the owner in the middle of Phase 1.

## Where things stand

**Phase 0: done.** CLAUDE.md is in the repo root. The plan is in `docs/PLAN.md`.

**Phase 1 (site, pages, prerendering): mostly built, not yet reviewed by the owner.**

Done:
- Vite 8 + React 19 + `@cloudflare/vite-plugin`, with a Worker in `worker/index.ts`.
- `wrangler.jsonc`: `run_worker_first: ["/api/*"]`, `html_handling: auto-trailing-slash`, 404 page.
- `src/data/products.ts`: the single source of products and prices (in sen). It also holds the page copy, FAQ, step images and demo video. Siap Pasang is `kind: 'enquiry'` with `displayPriceSen` only, so it can never be charged.
- `src/lib/validate.ts`: shared form validation for the browser and, from Phase 2, the Worker. `src/lib/money.ts`: `formatRM`.
- Prerendering: `vite.prerender.config.ts` builds `src/entry-server.tsx`. `scripts/prerender.mjs` renders each route with `renderToString` into `dist/client/<route>.html`, plus `404.html`, `sitemap.xml` and `robots.txt`. It also lists any `[placeholder]` still in the copy. The client hydrates with `hydrateRoot`.
- Checked with curl against `vite preview` (the real Worker runtime): every route returns 200 with its own `<title>`, canonical URL, OG/Twitter tags and `<h1>`. Unknown paths return 404. `/terma/` → 307 `/terma`. `/api/*` reaches the Worker and returns 501 with a Malay message.
- Teaser video: the source is in `media-src/` (gitignored, 6.8 MB). The web version is `public/media/teaser-720.mp4` (1.2 MB), with a poster frame and 3 real stills cropped from it (Notion queue, Make modules, Threads post).
- Design direction from the design-taste-frontend skill: "One motif" (seed 55736505). The five rising bars of the GrowthBridge mark run the hero band, step tiles, pricing tiles, schedule chart and footer. The live element is the schedule picker (`ScheduleDemo`).
- Design inspector: the **product page passes (0 FAIL)** at 1440/768/390.

Still to do in Phase 1:
1. Design-inspector failures on other pages (last run):
   - `/` (home): the headline wraps to 3 lines at 1440 and 390 (cap its width differently). The Siap Pasang card reads as an "eyebrow" (line above the price). Only 2 pictures. Blank stretches at 768/390. Little motion.
   - `/terma`, `/privasi`, `/bayaran-balik`: no focal point (h1 too small), no pictures. Consider a larger h1 plus a motif band. The 4-picture floor is a design-skill heuristic and arguably doesn't suit legal pages; decide.
   - `/siap-pasang`: no focal point, no pictures, no motion (the reveal script only targets section children). The h1 "Siap Pasang" is a bare name.
2. Run Lighthouse (target 90+ performance and accessibility) on the prerendered pages.
3. Show the owner the build output and a local preview, then wait for review.
4. Commit at the end of the phase (the plan says commit after each phase). Pushing to GitHub needs the owner's go-ahead.

## Decisions made with the owner (2026-11-21)

- Missing Notion row at checkout: in Phase 3 the webhook creates the row if it's missing, built from the CHIP purchase itself. So Phase 2 must put on the CHIP purchase: buyer name, email and phone, reference = order ID, and the product and package. **The Worker is the only thing that ever creates order rows; Make only updates them.** Accepted remaining gap: if Notion fails at checkout and the webhook is also missed, the cron can't see the order (the checkout Telegram alert still fires).
- Refunds: a missed `payment.refunded` notification isn't recovered automatically. Rule: refund in CHIP, then tick Revoke access straight away.
- Prerendering: a small build step, no framework. `renderToString` per route plus `hydrateRoot`; the route list comes from the products file.
- `run_worker_first` for `/api/*`; check every route with curl.
- Contact email: growthbridge.biz@gmail.com.
- Refund policy: no refund after access is sent, plus a "Janji baiki atau pulang" (fix-or-refund) promise. Drafted in `src/content/legal.tsx`; **the owner must review the wording.**

## Deviations from the content draft (tell the owner)

- The "Label kecil" eyebrows (e.g. PRODUK & KELAS AI) are dropped on the site: the design rules ban eyebrows. They're still on the OG images.
- The product hero headline is split: h1 "Post setiap hari, ikut jadual anda." with "Ikut suara brand anda. Tanpa upah sesiapa." under it (h1 limited to 2 lines).
- The demo video is in the hero rather than a separate Demo section.
- Siap Pasang page and enquiry form copy were written from facts already in the draft. The owner should review it.
- The schedule picker's 3-a-day times (12:30 tengah hari) are examples. The 7:30 and 8:47 malam times are real (from the video).

## Waiting for the owner

Placeholders on the site (the build prints them): `[automation engineer]`, `[Semak dan nyatakan pelan yang manual cadangkan.]`, `[waktu sokongan]`, `[tarikh go-live]`, `[60 hari]`, `[sahkan: 7 tahun]`, `[12 bulan]`, `[Alamat berdaftar SSM]`. Most live in `src/data/site.ts`; the FAQ ones are in `src/data/products.ts` and the legal ones in `src/content/legal.tsx`.

Also wanted: the logo file (the site uses a drawn bar mark for now) and a photo of Ihsan for the home "Tentang saya" section (optional). The video ends with "DM @ihsaaann__"; a site version ending on "growthbridge.ai" may suit the store better.

## How to run

```bash
npm install
npm run build          # tsc, client + Worker build, SSR build, prerender
npx vite preview --port 4173   # serves dist/ in the Worker runtime
```

Gotcha: after every rebuild, **restart `vite preview`**. It keeps the old asset manifest, so the new hashed CSS returns 404 and pages look unstyled.

Design checks (skill at `~/.claude/skills/design-taste-frontend`):

```bash
node ~/.claude/skills/design-taste-frontend/scripts/lint.mjs src
node ~/.claude/skills/design-taste-frontend/scripts/inspect.mjs http://localhost:4173/<path> --out .taste-skill/inspect-<name>
```
