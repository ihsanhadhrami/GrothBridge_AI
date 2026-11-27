/**
 * Small HTTP helpers shared by the site's form endpoints (/api/checkout,
 * /api/enquiry): JSON answers, reading a JSON or plain form-post body, and a
 * tiny Malay HTML page for browsers that post the form without JavaScript.
 */

export const BODY_MESSAGES = {
  badRequest: 'Permintaan tidak dapat dibaca. Muat semula halaman dan cuba lagi.',
  tooLarge: 'Permintaan terlalu besar.',
} as const;

export function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export type ParsedBody =
  | { form: boolean; fields: Record<string, unknown> }
  | { form: boolean; status: number; error: string };

/** JSON or application/x-www-form-urlencoded, at most `maxBytes`. */
export async function readBody(request: Request, maxBytes: number): Promise<ParsedBody> {
  const type = (request.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
  const form = type === 'application/x-www-form-urlencoded';
  if (type !== 'application/json' && !form) return { form, status: 415, error: BODY_MESSAGES.badRequest };

  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > maxBytes) return { form, status: 413, error: BODY_MESSAGES.tooLarge };
  const text = await request.text().catch(() => null);
  if (text === null) return { form, status: 400, error: BODY_MESSAGES.badRequest };
  if (new TextEncoder().encode(text).length > maxBytes) return { form, status: 413, error: BODY_MESSAGES.tooLarge };

  if (form) return { form, fields: Object.fromEntries(new URLSearchParams(text)) };
  try {
    const data: unknown = JSON.parse(text);
    if (data && typeof data === 'object' && !Array.isArray(data)) return { form, fields: data as Record<string, unknown> };
  } catch {
    // fall through
  }
  return { form, status: 400, error: BODY_MESSAGES.badRequest };
}

/** A string field, or '' for anything else. */
export const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** A checkbox posts "on"; fetch from the site sends true. */
export const checked = (v: unknown): boolean => v === true || v === 'on' || v === 'true';

/** The no-JavaScript answer: a heading, a message, optional list, and a link back. */
export function htmlPage(
  status: number,
  title: string,
  message: string,
  items: string[] = [],
  back = '/',
  backLabel = 'Kembali',
): Response {
  const list = items.length ? `<ul>${items.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>` : '';
  const html =
    `<!doctype html><html lang="ms"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<meta name="robots" content="noindex"><title>${escapeHtml(title)} | GrowthBridge</title></head><body>` +
    `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>${list}` +
    `<p><a href="${escapeHtml(back)}">${escapeHtml(backLabel)}</a></p></body></html>`;
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
