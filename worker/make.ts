import { hmacSha256Hex } from './crypto';
import { bodySnippet, fetchWithTimeout, UpstreamError } from './upstream';

/**
 * Make's Delivery (paid) and Refund (refunded) scenarios start from one
 * custom webhook, MAKE_WEBHOOK_URL. Only payments the Worker has verified
 * with CHIP are sent. Every request carries
 *   X-GB-Signature: lowercase hex HMAC-SHA256(raw body, MAKE_SHARED_SECRET)
 * and Make must check it before doing anything (docs/PLAN.md, rule 2).
 */

const TIMEOUT_MS = 15000;

export interface MakeEvent {
  event: 'paid' | 'refunded';
  order_id: string;
  chip_purchase_id: string;
  /** In sen: RM89.00 = 8900. */
  amount: number;
  email: string;
  name: string;
  /** E.164, "+60123456789". */
  phone: string;
  product: string;
  package: string;
  /** ISO 8601 (UTC), when CHIP accepted the payment. */
  paid_at: string;
  /** True for CHIP test-mode payments. */
  is_test: boolean;
  /** Refunds only: the amount refunded, in sen. */
  refunded_amount?: number;
}

/** Resolves only when Make answers 200; throws UpstreamError otherwise. */
export async function forwardToMake(url: string, secret: string, event: MakeEvent): Promise<void> {
  // https only; plain http just for a local test catcher.
  if (!/^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)[:/])/.test(url)) {
    throw new UpstreamError('Make', 'MAKE_WEBHOOK_URL must start with https://');
  }
  const body = JSON.stringify(event);
  const res = await fetchWithTimeout(
    'Make',
    url,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-gb-signature': await hmacSha256Hex(secret, body) },
      body,
    },
    TIMEOUT_MS,
  );
  if (res.status !== 200) {
    throw new UpstreamError('Make', `webhook answered ${res.status}: ${await bodySnippet(res, 200)}`, res.status);
  }
  await res.body?.cancel();
}
