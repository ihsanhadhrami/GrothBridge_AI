import { site } from '../src/data/site';

/**
 * Worker entry. It runs first for every request (run_worker_first: true in
 * wrangler.jsonc) because one Worker serves both custom domains:
 *   - www.growthbridge.my → 301 to the apex, same path and query.
 *   - /api/*              → not built yet (pre-launch): 501 with a Malay
 *                           message. Nothing in the site calls it while
 *                           PAYMENTS_ENABLED is false.
 *   - everything else     → the prerendered static files (env.ASSETS).
 * Every response leaves with the security headers below, so they are set in
 * one place. http → https is the zone's "Always Use HTTPS" setting.
 */

const APEX = new URL(site.url).hostname;

/** CSP: own scripts, styles, fonts, images and video only. mailto: for the pre-launch enquiry form. */
const SECURITY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; " +
    "media-src 'self'; connect-src 'self'; form-action 'self' mailto:; frame-ancestors 'none'; " +
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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.hostname === `www.${APEX}`) {
      url.protocol = 'https:';
      url.hostname = APEX;
      url.port = '';
      return secure(Response.redirect(url.toString(), 301));
    }

    if (url.pathname.startsWith('/api/')) {
      return secure(json({ error: 'Perkhidmatan ini belum dibuka. Sila cuba lagi kemudian.' }, 501));
    }

    return secure(await env.ASSETS.fetch(request));
  },
} satisfies ExportedHandler<Env>;
