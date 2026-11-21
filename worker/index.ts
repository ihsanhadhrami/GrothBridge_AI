/**
 * Worker entry. Only /api/* reaches it (see run_worker_first in
 * wrangler.jsonc); every page is served straight from static assets.
 *
 * Phase 1: the API is not built yet. Every /api/* call answers 501 with a
 * Malay message the forms show to the visitor.
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return json({ error: 'Perkhidmatan ini belum dibuka. Sila cuba lagi kemudian.' }, 501);
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
