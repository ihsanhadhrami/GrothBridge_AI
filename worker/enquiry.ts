import { site } from '../src/data/site';
import { enquiryDetailLines, intlPhone, validateEnquiry, type EnquiryInput } from '../src/lib/validate';
import type { Ctx, WorkerEnv } from './env';
import { BODY_MESSAGES, checked, errorText, htmlPage, json, readBody, str } from './http';
import { createEnquiryRow } from './notion';
import { sendAlert } from './telegram';

/**
 * POST /api/enquiry: a Siap Pasang lead.
 *
 * 1. Rate limit: 5 per minute per IP (ENQUIRY_RATE_LIMIT).
 * 2. Validate with the same rules as the browser (src/lib/validate.ts).
 * 3. Save it to Notion Enquiries (status New) and alert the owner on Telegram.
 *    The visitor is told it arrived if at least one of the two has it: if
 *    Notion fails, the Telegram alert carries the whole enquiry. Only when
 *    both fail does the visitor get an error, with the email address to use.
 */

const MAX_BODY_BYTES = 16 * 1024;

export const ENQUIRY_MESSAGES = {
  ...BODY_MESSAGES,
  invalid: 'Sila semak maklumat yang ditanda.',
  rateLimited: 'Terlalu banyak cubaan. Tunggu seminit, kemudian cuba lagi.',
  failed: `Maaf, pertanyaan anda belum dapat dihantar. Cuba lagi sebentar, atau emel ${site.email}.`,
  sent: 'Terima kasih, pertanyaan anda sudah sampai. Saya akan membalas melalui emel dalam 1–2 hari bekerja.',
} as const;

export function toEnquiryInput(fields: Record<string, unknown>): EnquiryInput {
  return {
    name: str(fields.name),
    email: str(fields.email),
    phone: str(fields.phone),
    business: str(fields.business),
    threads: str(fields.threads),
    accounts: str(fields.accounts),
    media: str(fields.media),
    writing: str(fields.writing),
    message: str(fields.message),
    consent: checked(fields.consent),
  };
}

export async function handleEnquiry(request: Request, env: WorkerEnv, ctx: Ctx): Promise<Response> {
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  const { success } = await env.ENQUIRY_RATE_LIMIT.limit({ key: `enquiry:${ip}` });

  const parsed = await readBody(request, MAX_BODY_BYTES);
  const asForm = parsed.form;
  if (!success) return reply(asForm, 429, ENQUIRY_MESSAGES.rateLimited);
  if ('status' in parsed) return reply(asForm, parsed.status, parsed.error);

  const input = toEnquiryInput(parsed.fields);
  const errors = validateEnquiry(input);
  if (Object.keys(errors).length > 0) {
    if (!asForm) return json({ error: ENQUIRY_MESSAGES.invalid, errors }, 400);
    return reply(true, 400, ENQUIRY_MESSAGES.invalid, Object.values(errors).filter((e): e is string => typeof e === 'string'));
  }

  const row = {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: intlPhone(input.phone).e164,
    business: input.business.trim(),
    // Business has its own column, so its line (the first) is left out here.
    message: [...enquiryDetailLines(input).slice(1), '', input.message.trim()].join('\n'),
  };
  const details = [`Nama: ${row.name}`, `Emel: ${row.email}`, `Telefon: ${row.phone}`, ...enquiryDetailLines(input), '', input.message.trim()];

  let saved = false;
  let notionError = '';
  try {
    if (!env.NOTION_TOKEN || !env.NOTION_ENQUIRIES_DB) throw new Error('NOTION_TOKEN or NOTION_ENQUIRIES_DB is not set on the Worker');
    await createEnquiryRow(env.NOTION_TOKEN, env.NOTION_ENQUIRIES_DB, row);
    saved = true;
  } catch (err) {
    notionError = errorText(err);
  }

  const heading = saved
    ? 'New Siap Pasang enquiry (saved in Notion Enquiries). Reply within 24 hours.'
    : `New Siap Pasang enquiry. NOT saved in Notion (${notionError}); this message is the only copy. Add it to Enquiries by hand.`;
  if (saved) {
    // Notion has it; the alert is a heads-up, so don't make the visitor wait for Telegram.
    ctx.waitUntil(sendAlert(env, [heading, '', ...details].join('\n')));
  } else {
    const alerted = await sendAlert(env, [heading, '', ...details].join('\n'));
    if (!alerted) {
      console.error('[enquiry] Lost: neither Notion nor Telegram took it.', notionError);
      return reply(asForm, 502, ENQUIRY_MESSAGES.failed);
    }
  }

  if (asForm) return htmlPage(200, 'Pertanyaan diterima', ENQUIRY_MESSAGES.sent, [], '/', 'Kembali ke laman utama');
  return json({ ok: true }, 200);
}

/** JSON for the site's fetch; a small Malay page for a plain form post. */
function reply(asForm: boolean, status: number, error: string, items: string[] = []): Response {
  if (!asForm) return json({ error }, status);
  return htmlPage(status, 'Pertanyaan belum dihantar', error, items, '/siap-pasang', 'Kembali ke borang');
}
