import { getCheckoutPackage, type CheckoutPackage, type Product } from '../src/data/products';
import { formatRM } from '../src/lib/money';
import type { ChipPurchase } from './chip';
import type { WorkerEnv } from './env';
import { forwardToMake, type MakeEvent } from './make';
import {
  appendNote,
  createOrderRow,
  findOrder,
  statusProp,
  updateOrder,
  type OrderRow,
} from './notion';

/**
 * What a purchase that CHIP itself returned (GET /purchases/{id}/) means for
 * the order. Shared by the webhook and the cron, so a missed notification
 * recovered by the cron is handled exactly like the notification would have been.
 *
 * Order status (Notion), and who sets it:
 *   Pending   checkout (Worker)
 *   Paid      payment verified with CHIP, sent to Make (Worker, before Make runs)
 *   Delivered / Failed (delivery broke) / Refunded   Make
 *   Expired   unpaid after 24 hours (Worker cron)
 *   Failed    also set by the Worker when a payment fails its checks, or
 *             when Make hasn't delivered 24 hours after payment
 */

/** CHIP statuses that mean the money arrived. cleared/settled come after paid. */
export const PAID_STATES = new Set(['paid', 'cleared', 'settled']);

/** Rows in these states are finished: a repeated notification changes nothing. */
const DONE = new Set(['Delivered', 'Failed', 'Refunded']);

const ORDER_ID_RE = /^GB-\d{14}-[2-9A-HJ-NP-Z]{4}$/;

export interface VerifiedOrder {
  orderId: string;
  purchaseId: string;
  product: Product;
  pkg: CheckoutPackage;
  amountSen: number;
  name: string;
  email: string;
  /** E.164. */
  phone: string;
  /** ISO, or null if CHIP gave no payment time. */
  paidAt: string | null;
  isTest: boolean;
}

export type Checked = { ok: true; order: VerifiedOrder } | { ok: false; reason: string };

/**
 * Checks a purchase against our own records: our brand, our order id, a
 * package from src/data/products.ts, and a total equal to that package's
 * price in MYR. For a paid purchase, the payment amount must match too.
 */
export function checkPurchase(p: ChipPurchase, brandId: string | undefined): Checked {
  const fail = (reason: string): Checked => ({ ok: false, reason });
  if (brandId && p.brand_id !== undefined && p.brand_id !== brandId) return fail(`brand_id ${p.brand_id} is not ours`);

  const orderId = p.reference ?? '';
  if (!ORDER_ID_RE.test(orderId)) return fail(`reference "${orderId}" is not one of our order ids`);
  const meta = p.purchase?.metadata ?? {};
  if (meta.order_id !== undefined && meta.order_id !== orderId) {
    return fail(`metadata.order_id ${String(meta.order_id)} ≠ reference ${orderId}`);
  }

  // The checkout puts product and package in metadata, and "product/package" on the line.
  const [catProduct, catPackage] = (p.purchase?.products?.[0]?.category ?? '').split('/');
  const productSlug = typeof meta.product === 'string' ? meta.product : (catProduct ?? '');
  const packageId = typeof meta.package === 'string' ? meta.package : (catPackage ?? '');
  const pkg = getCheckoutPackage(productSlug, packageId);
  if (!pkg) return fail(`package "${productSlug}/${packageId}" is not sold in src/data/products.ts`);

  if (p.purchase?.currency !== 'MYR') return fail(`currency ${String(p.purchase?.currency)} is not MYR`);
  const total = p.purchase?.total;
  if (total !== pkg.priceSen) {
    return fail(`total ${String(total)} sen ≠ ${pkg.priceSen} sen, the price of ${pkg.product.slug}/${pkg.id} in src/data/products.ts`);
  }
  if (PAID_STATES.has(p.status) && p.payment?.amount !== undefined && p.payment.amount !== pkg.priceSen) {
    return fail(`payment amount ${p.payment.amount} sen ≠ ${pkg.priceSen} sen`);
  }

  const email = (p.client?.email ?? '').trim().toLowerCase();
  const name = (p.client?.full_name ?? '').trim();
  if (!email || !name) return fail('the purchase has no buyer name or email');

  const paidOn = p.payment?.paid_on;
  return {
    ok: true,
    order: {
      orderId,
      purchaseId: p.id,
      product: pkg.product,
      pkg,
      amountSen: pkg.priceSen,
      name,
      email,
      phone: (p.client?.phone ?? '').replace(/\s+/g, ''),
      paidAt: typeof paidOn === 'number' && paidOn > 0 ? new Date(paidOn * 1000).toISOString() : null,
      isTest: p.is_test === true,
    },
  };
}

export function makeEvent(event: MakeEvent['event'], o: VerifiedOrder, paidAt: string, refundedAmount?: number): MakeEvent {
  return {
    event,
    order_id: o.orderId,
    chip_purchase_id: o.purchaseId,
    amount: o.amountSen,
    email: o.email,
    name: o.name,
    phone: o.phone,
    product: o.product.slug,
    package: o.pkg.id,
    paid_at: paidAt,
    is_test: o.isTest,
    ...(refundedAmount !== undefined ? { refunded_amount: refundedAmount } : {}),
  };
}

export type Outcome =
  /** Sent to Make, which answered 200. */
  | { kind: 'forwarded'; orderId: string; rowCreated: boolean; notes: string[] }
  /** Already handled earlier; nothing sent. */
  | { kind: 'already'; orderId: string; status: string }
  /** Failed our checks; nothing sent. The caller alerts. */
  | { kind: 'rejected'; reason: string; orderId: string }
  /** CHIP says it isn't in the state this event needs (e.g. not paid). */
  | { kind: 'not-applicable'; orderId: string; chipStatus: string };

/** Throws if a secret the step needs is missing (caller answers 500 + alert). */
function need(env: WorkerEnv, names: (keyof WorkerEnv)[]): void {
  const missing = names.filter((n) => !env[n]);
  if (missing.length) throw new Error(`${missing.join(', ')} not set on the Worker`);
}

export function describeOrder(o: VerifiedOrder): string {
  return `${o.orderId} · ${o.product.slug}/${o.pkg.id} ${formatRM(o.amountSen)} · ${o.name}, ${o.email}${o.isTest ? ' · TEST' : ''}`;
}

/**
 * A paid purchase. `row` is the order's Notion row if the caller already has
 * it (the cron); otherwise it is looked up, and created from the purchase if
 * it's missing (the checkout's Notion write failed). Then: status Paid +
 * Paid at, and the event to Make. Throws on any Notion or Make failure, so
 * the webhook answers 500 and CHIP sends the notification again.
 */
export async function settlePaid(env: WorkerEnv, purchase: ChipPurchase, row?: OrderRow | null): Promise<Outcome> {
  const orderId = purchase.reference ?? '';
  if (!PAID_STATES.has(purchase.status)) return { kind: 'not-applicable', orderId, chipStatus: purchase.status };
  need(env, ['NOTION_TOKEN', 'NOTION_ORDERS_DB', 'MAKE_WEBHOOK_URL', 'MAKE_SHARED_SECRET']);
  const token = env.NOTION_TOKEN!;

  const checked = checkPurchase(purchase, env.CHIP_BRAND_ID);
  if (row === undefined) row = await findOrder(token, env.NOTION_ORDERS_DB!, orderId);

  if (!checked.ok) {
    // Keep it in front of the owner (daily check: "anything in Failed?").
    if (row && !DONE.has(row.status) && (!row.chipPurchaseId || row.chipPurchaseId === purchase.id)) {
      await updateOrder(token, row.pageId, {
        ...statusProp('Failed'),
        ...appendNote(row.notes, `Worker: CHIP says paid, but the payment failed our checks (${checked.reason}). Not delivered.`),
      });
    }
    return { kind: 'rejected', reason: checked.reason, orderId };
  }
  const o = checked.order;
  if (row && row.chipPurchaseId && row.chipPurchaseId !== o.purchaseId) {
    return { kind: 'rejected', orderId, reason: `the Notion row has CHIP purchase ${row.chipPurchaseId}, not ${o.purchaseId}` };
  }
  if (row && DONE.has(row.status)) return { kind: 'already', orderId, status: row.status };

  const notes: string[] = [];
  let paidAt = o.paidAt;
  if (!paidAt) {
    paidAt = new Date().toISOString();
    notes.push('CHIP gave no payment time; Paid at is when the Worker saw the payment.');
  }
  const paidProps = { ...statusProp('Paid'), 'Paid at': { date: { start: paidAt } } };

  let rowCreated = false;
  if (!row) {
    // The checkout's row is missing: rebuild it from the purchase.
    await createOrderRow(
      token,
      env.NOTION_ORDERS_DB!,
      {
        orderId: o.orderId,
        name: o.name,
        email: o.email,
        phone: o.phone,
        productSlug: o.product.slug,
        packageId: o.pkg.id,
        amountSen: o.amountSen,
        chipPurchaseId: o.purchaseId,
        isTest: o.isTest,
      },
      {
        ...paidProps,
        ...appendNote(
          o.isTest ? 'CHIP test mode (not a real payment).' : '',
          'Worker: this row was missing at payment, so it was rebuilt from the CHIP purchase.',
        ),
      },
    );
    rowCreated = true;
    notes.push('The Notion row was missing; it was rebuilt from the CHIP purchase.');
  } else if (row.status !== 'Paid') {
    await updateOrder(token, row.pageId, {
      ...paidProps,
      ...(row.chipPurchaseId ? {} : { 'CHIP purchase ID': { rich_text: [{ type: 'text', text: { content: o.purchaseId } }] } }),
    });
  }

  await forwardToMake(env.MAKE_WEBHOOK_URL!, env.MAKE_SHARED_SECRET!, makeEvent('paid', o, paidAt));
  return { kind: 'forwarded', orderId, rowCreated, notes };
}

/**
 * A refunded purchase (CHIP status "refunded", full or partial). The event
 * goes to Make, whose Refund scenario removes access and sets Refunded.
 * The Worker doesn't change the row itself.
 */
export async function settleRefunded(env: WorkerEnv, purchase: ChipPurchase, refundedAmount?: number): Promise<Outcome> {
  const orderId = purchase.reference ?? '';
  if (purchase.status !== 'refunded') return { kind: 'not-applicable', orderId, chipStatus: purchase.status };
  need(env, ['NOTION_TOKEN', 'NOTION_ORDERS_DB', 'MAKE_WEBHOOK_URL', 'MAKE_SHARED_SECRET']);

  const checked = checkPurchase(purchase, env.CHIP_BRAND_ID);
  if (!checked.ok) return { kind: 'rejected', reason: checked.reason, orderId };
  const o = checked.order;

  const row = await findOrder(env.NOTION_TOKEN!, env.NOTION_ORDERS_DB!, orderId);
  if (row?.status === 'Refunded') return { kind: 'already', orderId, status: row.status };

  const notes: string[] = [];
  if (!row) notes.push('There is no Notion row for this order; Make cannot mark it Refunded. Check by hand.');
  const paidAt = o.paidAt ?? row?.paidAt ?? '';
  await forwardToMake(env.MAKE_WEBHOOK_URL!, env.MAKE_SHARED_SECRET!, makeEvent('refunded', o, paidAt, refundedAmount));
  return { kind: 'forwarded', orderId, rowCreated: false, notes };
}

/** For alerts: a one-line summary of a purchase even when it failed checks. */
export function purchaseLine(p: ChipPurchase): string {
  const checked = checkPurchase(p, undefined);
  if (checked.ok) return describeOrder(checked.order);
  const total = typeof p.purchase?.total === 'number' ? formatRM(p.purchase.total) : '?';
  return `${p.reference ?? '(no reference)'} · CHIP ${p.id} · ${p.status} · ${total} · ${p.client?.email ?? '?'}${p.is_test ? ' · TEST' : ''}`;
}
