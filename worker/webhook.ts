import { formatRM } from '../src/lib/money';
import { getCompanyPublicKey, getPurchase, type ChipPurchase } from './chip';
import { importChipPublicKey, verifyRsaSignature } from './crypto';
import type { Ctx, WorkerEnv } from './env';
import { errorText, json } from './http';
import { purchaseLine, settlePaid, settleRefunded, type Outcome } from './orders';
import { sendAlert } from './telegram';

/**
 * POST /api/webhooks/chip: CHIP's success_callback (set on every purchase
 * by the checkout) and any webhook set up in the CHIP portal.
 *
 * 1. Verify X-Signature over the raw body, before parsing anything. Keys:
 *    the company key from CHIP's GET /public_key/ (success_callback), and
 *    CHIP_PUBLIC_KEY, the portal webhook's own key (payment.refunded).
 *    Bad signature: 400 + Telegram alert, stop.
 * 2. Only purchase.paid and payment.refunded do anything; other events get 200.
 *    The purchase is fetched again from CHIP: the body only says which one.
 * 3. orders.ts checks it against the products file, updates Notion, and
 *    sends it to Make, signed with MAKE_SHARED_SECRET.
 * 4. 200 only once Make has answered 200. Any failure on our side is a 500,
 *    so CHIP sends it again (up to 8 tries over 36 hours), and the cron
 *    (worker/cron.ts) retries every 15 minutes as well.
 */

const MAX_BODY_BYTES = 64 * 1024;

export async function handleChipWebhook(request: Request, env: WorkerEnv, ctx: Ctx): Promise<Response> {
  const alert = (text: string) => ctx.waitUntil(sendAlert(env, text));

  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_BODY_BYTES) return rejectSignature(env, ctx, request, 413, `body of ${declared} bytes is too large`);
  const raw = new Uint8Array(await request.arrayBuffer());
  if (raw.length > MAX_BODY_BYTES) return rejectSignature(env, ctx, request, 413, `body of ${raw.length} bytes is too large`);

  // 1. Signature, over the bytes exactly as received.
  const signature = request.headers.get('x-signature');
  if (!signature) return rejectSignature(env, ctx, request, 400, 'no X-Signature header');

  const keys: CryptoKey[] = [];
  const keyProblems: string[] = [];
  if (env.CHIP_PUBLIC_KEY) {
    try {
      keys.push(await importChipPublicKey(env.CHIP_PUBLIC_KEY));
    } catch (err) {
      keyProblems.push(`CHIP_PUBLIC_KEY can't be used: ${errorText(err)}`);
    }
  }
  let companyKeyMissing = false;
  if (env.CHIP_SECRET_KEY) {
    try {
      keys.push(await importChipPublicKey(await getCompanyPublicKey(env.CHIP_SECRET_KEY)));
    } catch (err) {
      companyKeyMissing = true;
      keyProblems.push(`CHIP's company public key (GET /public_key/) is unavailable: ${errorText(err)}`);
    }
  }

  let valid = false;
  for (const key of keys) {
    if (await verifyRsaSignature(key, raw, signature)) {
      valid = true;
      break;
    }
  }
  if (!valid) {
    if (keys.length === 0 || companyKeyMissing) {
      // Our fault, not the sender's: we couldn't load a key to check with. 500 so CHIP tries again.
      alert(['CHIP webhook NOT processed: the Worker could not load a key to verify it. CHIP will retry.', ...keyProblems].join('\n'));
      return json({ error: 'signature check unavailable' }, 500);
    }
    return rejectSignature(env, ctx, request, 400, 'X-Signature does not match the body', keyProblems);
  }

  // 2. The event. The body is trusted now, but only to say which purchase.
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(raw));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not a JSON object');
    body = parsed as Record<string, unknown>;
  } catch (err) {
    alert(`CHIP webhook: signed, but the body isn't JSON (${errorText(err)}). Ignored.`);
    return json({ error: 'bad body' }, 400);
  }

  const eventType = typeof body.event_type === 'string' ? body.event_type : '';
  let purchaseId: string;
  let refundedAmount: number | undefined;
  if (eventType === 'purchase.paid') {
    purchaseId = typeof body.id === 'string' ? body.id : '';
  } else if (eventType === 'payment.refunded') {
    // The body is the refund Payment; related_to points at the Purchase.
    const related = body.related_to as { type?: unknown; id?: unknown } | null | undefined;
    purchaseId = related?.type === 'purchase' && typeof related.id === 'string' ? related.id : '';
    const amount = (body.payment as { amount?: unknown } | null | undefined)?.amount;
    if (typeof amount === 'number') refundedAmount = amount;
  } else {
    console.log(`[webhook] CHIP event "${eventType}" for ${String(body.id)}: not used, answered 200.`);
    return json({ ok: true, ignored: eventType }, 200);
  }
  if (!purchaseId) {
    alert(`CHIP webhook ${eventType}: signed, but it names no purchase. Ignored.\nBody id: ${String(body.id)}`);
    return json({ error: 'no purchase id' }, 400);
  }

  if (!env.CHIP_SECRET_KEY) {
    alert(`CHIP webhook ${eventType} for purchase ${purchaseId} NOT processed: CHIP_SECRET_KEY is not set. CHIP will retry.`);
    return json({ error: 'not configured' }, 500);
  }

  let purchase: ChipPurchase;
  try {
    purchase = await getPurchase(env.CHIP_SECRET_KEY, purchaseId);
  } catch (err) {
    alert(`CHIP webhook ${eventType} for purchase ${purchaseId} NOT processed: could not fetch it from CHIP. CHIP will retry.\n${errorText(err)}`);
    return json({ error: 'chip unavailable' }, 500);
  }

  // 3–4.
  let outcome: Outcome;
  try {
    outcome = eventType === 'purchase.paid' ? await settlePaid(env, purchase) : await settleRefunded(env, purchase, refundedAmount);
  } catch (err) {
    alert(
      [
        `Payment ${eventType === 'purchase.paid' ? 'received' : 'refunded'} but NOT passed on to Make. CHIP will retry, and so will the 15-minute check.`,
        purchaseLine(purchase),
        `Error: ${errorText(err)}`,
      ].join('\n'),
    );
    return json({ error: 'not delivered yet' }, 500);
  }

  switch (outcome.kind) {
    case 'forwarded':
      if (outcome.notes.length) alert([`${eventType}: sent to Make, with a note.`, purchaseLine(purchase), ...outcome.notes].join('\n'));
      if (eventType === 'payment.refunded') {
        const refunded = refundedAmount !== undefined ? formatRM(refundedAmount) : 'amount unknown';
        alert(`Refund (${refunded}) sent to Make to remove access.\n${purchaseLine(purchase)}`);
      }
      return json({ ok: true }, 200);
    case 'already':
      console.log(`[webhook] ${eventType} for ${outcome.orderId}: row is already ${outcome.status}; nothing sent.`);
      return json({ ok: true, already: outcome.status }, 200);
    case 'not-applicable':
      console.log(`[webhook] ${eventType} for ${outcome.orderId}: CHIP status is now ${outcome.chipStatus}; nothing sent.`);
      return json({ ok: true, status: outcome.chipStatus }, 200);
    case 'rejected':
      // Not something a retry fixes: 200, so CHIP stops, and the owner gets the details.
      alert(
        [
          `CHIP ${eventType} REJECTED, nothing sent to Make: ${outcome.reason}.`,
          purchaseLine(purchase),
          'Check this payment in the CHIP portal; refund it if it is real.',
        ].join('\n'),
      );
      return json({ ok: false, rejected: true }, 200);
  }
}

/**
 * A request we can't trust. 400 (or 413), and an alert, but at most a few a
 * minute: anyone can post to this URL, and that mustn't flood the owner's
 * Telegram. Past the limit the details still go to the Worker log.
 */
async function rejectSignature(
  env: WorkerEnv,
  ctx: Ctx,
  request: Request,
  status: number,
  reason: string,
  extra: string[] = [],
): Promise<Response> {
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  const text = [`CHIP webhook REJECTED (${status}): ${reason}. Nothing was processed.`, `From IP: ${ip}`, ...extra].join('\n');
  const { success } = await env.ALERT_RATE_LIMIT.limit({ key: 'webhook-rejected' });
  if (success) ctx.waitUntil(sendAlert(env, text));
  else console.error('[alert, rate-limited]', text);
  return json({ error: 'invalid signature' }, status);
}
