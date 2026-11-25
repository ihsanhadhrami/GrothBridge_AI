import { PAYMENTS_ENABLED } from '../src/config';
import { getPurchase } from './chip';
import type { WorkerEnv } from './env';
import { errorText } from './http';
import { appendNote, queryOrders, statusProp, updateOrder, type OrderRow } from './notion';
import { PAID_STATES, purchaseLine, settlePaid } from './orders';
import { sendAlert } from './telegram';
import { UpstreamError } from './upstream';

/**
 * Cron Trigger, every 15 minutes (wrangler.jsonc): catches what a missed or
 * failed CHIP notification would otherwise lose.
 *
 *   Pending > 15 min  → ask CHIP. Paid: handled exactly like the webhook
 *                       (orders.ts: Paid + Make). Unpaid after 24 h: Expired.
 *   Paid    > 15 min  → Make hasn't marked it Delivered: send it to Make again
 *                       (Make stops if it's already Delivered). Still Paid
 *                       24 h after payment: Failed, and the owner is alerted.
 *
 * One Telegram message per run, only when something needs the owner (an
 * error, a recovered payment, a Failed order); routine expiries are only
 * logged. Each run makes at most MAX_SUBREQUESTS outside calls (the Workers
 * free plan allows 50); rows left over wait for the next run.
 */

const MINUTE = 60 * 1000;
export const STALE_AFTER_MS = 15 * MINUTE;
export const GIVE_UP_AFTER_MS = 24 * 60 * MINUTE;
const MAX_SUBREQUESTS = 45;

/** CHIP statuses where the buyer may still be mid-payment: never expire these. */
const IN_PROGRESS = new Set(['pending_execute', 'pending_charge', 'pending_capture', 'pending_release', 'preauthorized', 'hold']);

export interface ReconcileReport {
  checked: number;
  recovered: string[];
  resent: string[];
  /** Re-sent for the first time (paid 15–30 minutes ago): worth telling the owner once. */
  resentFirst: string[];
  expired: string[];
  failed: string[];
  problems: string[];
  deferred: boolean;
}

export async function reconcile(env: WorkerEnv, now: Date = new Date()): Promise<ReconcileReport> {
  const report: ReconcileReport = { checked: 0, recovered: [], resent: [], resentFirst: [], expired: [], failed: [], problems: [], deferred: false };

  const missing = (['NOTION_TOKEN', 'NOTION_ORDERS_DB', 'CHIP_SECRET_KEY'] as const).filter((n) => !env[n]);
  if (missing.length) {
    const text = `Payment check (cron) skipped: ${missing.join(', ')} not set on the Worker.`;
    // Before launch that's expected; once payments are on, it's an emergency.
    if (PAYMENTS_ENABLED) await sendAlert(env, text);
    else console.warn(`[cron] ${text}`);
    report.problems.push(text);
    return report;
  }

  let budget = MAX_SUBREQUESTS - 1; // keep one for the alert
  const token = env.NOTION_TOKEN!;
  const db = env.NOTION_ORDERS_DB!;
  const before = new Date(now.getTime() - STALE_AFTER_MS).toISOString();
  const age = (iso: string | null) => (iso ? now.getTime() - Date.parse(iso) : 0);

  // Paid first: those are buyers who paid and are waiting for their access.
  const queries: { status: 'Paid' | 'Pending'; filter: Record<string, unknown> }[] = [
    {
      status: 'Paid',
      filter: { and: [{ property: 'Status', select: { equals: 'Paid' } }, { property: 'Paid at', date: { before } }] },
    },
    {
      status: 'Pending',
      filter: { and: [{ property: 'Status', select: { equals: 'Pending' } }, { timestamp: 'created_time', created_time: { before } }] },
    },
  ];

  for (const q of queries) {
    if (budget < 1) {
      report.deferred = true;
      break;
    }
    let rows: OrderRow[];
    try {
      budget -= 1;
      const result = await queryOrders(token, db, q.filter, 50);
      rows = result.rows;
      if (result.hasMore) report.deferred = true;
    } catch (err) {
      report.problems.push(`Could not read ${q.status} orders from Notion: ${errorText(err)}`);
      continue;
    }

    for (const row of rows) {
      // Worst case per row: CHIP + Notion update + Make.
      if (budget < 3) {
        report.deferred = true;
        break;
      }
      report.checked += 1;
      try {
        budget -= await (q.status === 'Paid' ? checkPaidRow(env, row, age, report) : checkPendingRow(env, row, age, report));
      } catch (err) {
        budget -= 3;
        report.problems.push(`${row.orderId || row.pageId}: ${errorText(err)}`);
      }
    }
  }

  console.log(
    `[cron] checked ${report.checked}: ${report.recovered.length} recovered, ${report.resent.length} re-sent, ` +
      `${report.expired.length} expired, ${report.failed.length} failed, ${report.problems.length} problems` +
      (report.deferred ? '; more left for the next run' : ''),
  );
  const lines = [
    ...report.recovered.map((l) => `Recovered a missed payment (sent to Make): ${l}`),
    ...report.resentFirst.map((l) => `Not Delivered 15 minutes after payment; sent to Make again (retried every 15 minutes for 24 hours): ${l}`),
    ...report.failed.map((l) => `Marked FAILED, deliver by hand: ${l}`),
    ...report.problems.map((l) => `Problem: ${l}`),
  ];
  if (lines.length) await sendAlert(env, ['Payment check (every 15 minutes):', ...lines].join('\n'));
  return report;
}

/** Returns how many outside calls it made. */
async function checkPendingRow(
  env: WorkerEnv,
  row: OrderRow,
  age: (iso: string | null) => number,
  report: ReconcileReport,
): Promise<number> {
  const token = env.NOTION_TOKEN!;
  const old = age(row.createdTime) > GIVE_UP_AFTER_MS;
  const expire = async (why: string) => {
    await updateOrder(token, row.pageId, { ...statusProp('Expired'), ...appendNote(row.notes, `Worker: Expired, ${why}.`) });
    report.expired.push(row.orderId);
  };

  if (!row.chipPurchaseId) {
    report.problems.push(`${row.orderId}: Pending, but the row has no CHIP purchase ID${old ? '; marked Expired' : ''}.`);
    if (old) await expire('no CHIP purchase ID on the row');
    return old ? 1 : 0;
  }

  let purchase;
  try {
    purchase = await getPurchase(env.CHIP_SECRET_KEY!, row.chipPurchaseId);
  } catch (err) {
    if (err instanceof UpstreamError && err.status === 404) {
      // E.g. a purchase made with the other key (test vs live).
      report.problems.push(
        `${row.orderId}: CHIP doesn't know purchase ${row.chipPurchaseId} with the current key (test vs live?)${old ? '; marked Expired' : ''}.`,
      );
      if (old) await expire(`CHIP does not know purchase ${row.chipPurchaseId} with the current key`);
      return old ? 2 : 1;
    }
    throw err;
  }

  if (PAID_STATES.has(purchase.status)) {
    const outcome = await settlePaid(env, purchase, row);
    if (outcome.kind === 'forwarded') report.recovered.push(purchaseLine(purchase));
    else if (outcome.kind === 'rejected') report.failed.push(`${purchaseLine(purchase)}: ${outcome.reason}`);
    return 3;
  }
  if (purchase.status === 'refunded') {
    report.problems.push(`${row.orderId}: Pending in Notion but refunded in CHIP. Check it by hand.`);
    return 1;
  }
  if (old && !IN_PROGRESS.has(purchase.status)) {
    await expire(`unpaid 24 hours after checkout (CHIP status ${purchase.status})`);
    return 2;
  }
  return 1;
}

async function checkPaidRow(
  env: WorkerEnv,
  row: OrderRow,
  age: (iso: string | null) => number,
  report: ReconcileReport,
): Promise<number> {
  if (age(row.paidAt) > GIVE_UP_AFTER_MS) {
    await updateOrder(env.NOTION_TOKEN!, row.pageId, {
      ...statusProp('Failed'),
      ...appendNote(row.notes, 'Worker: still not Delivered 24 hours after payment; Make never finished. Deliver by hand, then tick Resend access.'),
    });
    report.failed.push(`${row.orderId}: paid but not delivered after 24 hours (Make never marked it Delivered).`);
    return 1;
  }
  if (!row.chipPurchaseId) {
    report.problems.push(`${row.orderId}: Paid, but the row has no CHIP purchase ID; can't re-send it.`);
    return 0;
  }
  const purchase = await getPurchase(env.CHIP_SECRET_KEY!, row.chipPurchaseId);
  const outcome = await settlePaid(env, purchase, row);
  if (outcome.kind === 'forwarded') {
    report.resent.push(row.orderId);
    if (age(row.paidAt) < 2 * STALE_AFTER_MS) report.resentFirst.push(purchaseLine(purchase));
  }
  else if (outcome.kind === 'rejected') report.failed.push(`${purchaseLine(purchase)}: ${outcome.reason}`);
  else if (outcome.kind === 'not-applicable') {
    report.problems.push(`${row.orderId}: Paid in Notion, but CHIP now says ${outcome.chipStatus}. Check it by hand.`);
  }
  return 2;
}
