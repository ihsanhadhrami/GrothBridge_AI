import { site } from '../src/data/site';
import { handleCheckout, json } from './checkout';
import { CHIP_CHECKOUT_ORIGIN } from './chip';
import type { WorkerEnv } from './env';
import { sendAlert } from './telegram';

/**
 * Worker entry. It runs first for every request (run_worker_first: true in
 * wrangler.jsonc) because one Worker serves both custom domains:
 *   - www.growthbridge.my → 301 to the apex, same path and query.
 *   - POST /api/checkout  → worker/checkout.ts (CHIP purchase + Notion row).
 *   - /api/enquiry, /api/webhooks/chip → Phase 3; 501 until then.
 *   - everything else     → the prerendered static files (env.ASSETS).
 * Every response leaves with the security headers below, so they are set in
 * one place. http → https is the zone's "Always Use HTTPS" setting.
 */

const APEX = new URL(site.url).hostname;

/**
 * CSP: own scripts, styles, fonts, images and video only. form-action also
 * allows mailto: (pre-launch enquiry form) and CHIP's checkout, because a
 * plain form post to /api/checkout is answered with a 303 to CHIP and
 * browsers apply form-action to that redirect.
 */
const SECURITY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; " +
    `media-src 'self'; connect-src 'self'; form-action 'self' mailto: ${CHIP_CHECKOUT_ORIGIN}; frame-ancestors 'none'; ` +
    "base-uri 'self'; object-src 'none'; upgrade-insecure-requests",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
};

function secure(response: Response): Response {
  const out = new Response(response.body, response); // copy: some responses have immutable headers
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) out.headers.set(name, value);
  return out;
}

const NOT_BUILT = new Set(['/api/enquiry', '/api/webhooks/chip']);

async function api(request: Request, env: WorkerEnv, ctx: ExecutionContext, path: string): Promise<Response> {
  if (path === '/api/checkout') {
    if (request.method !== 'POST') {
      const res = json({ error: 'Kaedah tidak dibenarkan.' }, 405);
      res.headers.set('allow', 'POST');
      return res;
    }
    return handleCheckout(request, env, ctx);
  }
  if (NOT_BUILT.has(path)) return json({ error: 'Perkhidmatan ini belum dibuka. Sila cuba lagi kemudian.' }, 501);
  return json({ error: 'Tidak dijumpai.' }, 404);
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);

    if (url.hostname === `www.${APEX}`) {
      url.protocol = 'https:';
      url.hostname = APEX;
      url.port = '';
      return secure(Response.redirect(url.toString(), 301));
    }

    if (url.pathname.startsWith('/api/')) {
      try {
        return secure(await api(request, env, ctx, url.pathname));
      } catch (err) {
        // A bug, not an outside service (those are caught in the handlers).
        const reason = err instanceof Error ? (err.stack ?? err.message) : String(err);
        ctx.waitUntil(sendAlert(env, `Worker error on ${request.method} ${url.pathname}:\n${reason}`));
        return secure(json({ error: `Maaf, berlaku ralat. Cuba lagi sebentar, atau emel ${site.email}.` }, 500));
      }
    }

    return secure(await env.ASSETS.fetch(request));
  },
} satisfies ExportedHandler<WorkerEnv>;
