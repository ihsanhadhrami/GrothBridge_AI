import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reconcile } from '../worker/cron';
import { resetCompanyKeyCache } from '../worker/chip';
import worker from '../worker/index';
import {
  alerts,
  callsTo,
  makeCtx,
  makeEnv,
  makeWorld,
  notes,
  ORDER_ID,
  orderRow,
  purchase,
  PURCHASE_ID,
  status,
  type World,
} from './fakes';

/** The 15-minute reconciliation (worker/cron.ts) against the fake world. */

let world: World;
const MIN = 60 * 1000;
const ago = (ms: number) => new Date(Date.now() - ms);

beforeEach(async () => {
  world = await makeWorld();
  resetCompanyKeyCache();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Pending orders', () => {
  it('missed webhook recovered: paid in CHIP, Pending in Notion → Paid and sent to Make', async () => {
    world.purchases.set(PURCHASE_ID, purchase());
    world.orders.push(orderRow({ created: ago(20 * MIN) }));

    const report = await reconcile(makeEnv());
    expect(report.recovered).toHaveLength(1);
    expect(status(world.orders[0]!)).toBe('Paid');
    const sent = JSON.parse(callsTo(world, 'make')[0]!.init.body as string);
    expect(sent).toMatchObject({ event: 'paid', order_id: ORDER_ID, amount: 8900, chip_purchase_id: PURCHASE_ID });
    expect(alerts(world)[0]).toMatch(/Recovered a missed payment/);
  });

  it('leaves orders younger than 15 minutes alone', async () => {
    world.purchases.set(PURCHASE_ID, purchase());
    world.orders.push(orderRow({ created: ago(5 * MIN) }));
    const report = await reconcile(makeEnv());
    expect(report.checked).toBe(0);
    expect(callsTo(world, 'chip')).toHaveLength(0);
  });

  it('unpaid and younger than 24 hours: left Pending, no alert', async () => {
    world.purchases.set(PURCHASE_ID, purchase({ status: 'viewed', payment: null }));
    world.orders.push(orderRow({ created: ago(3 * 60 * MIN) }));
    await reconcile(makeEnv());
    expect(status(world.orders[0]!)).toBe('Pending');
    expect(alerts(world)).toEqual([]);
  });

  it('unpaid after 24 hours: Expired (no alert, it is routine)', async () => {
    world.purchases.set(PURCHASE_ID, purchase({ status: 'viewed', payment: null }));
    world.orders.push(orderRow({ created: ago(25 * 60 * MIN) }));
    const report = await reconcile(makeEnv());
    expect(report.expired).toEqual([ORDER_ID]);
    expect(status(world.orders[0]!)).toBe('Expired');
    expect(notes(world.orders[0]!)).toMatch(/unpaid 24 hours/);
    expect(alerts(world)).toEqual([]);
  });

  it('mid-payment after 24 hours: not expired', async () => {
    world.purchases.set(PURCHASE_ID, purchase({ status: 'pending_execute', payment: null }));
    world.orders.push(orderRow({ created: ago(25 * 60 * MIN) }));
    await reconcile(makeEnv());
    expect(status(world.orders[0]!)).toBe('Pending');
  });

  it('paid but the wrong amount: Failed, owner alerted, nothing sent', async () => {
    world.purchases.set(PURCHASE_ID, purchase({ total: 100 }));
    world.orders.push(orderRow());
    await reconcile(makeEnv());
    expect(status(world.orders[0]!)).toBe('Failed');
    expect(callsTo(world, 'make')).toHaveLength(0);
    expect(alerts(world)[0]).toMatch(/FAILED[\s\S]*total 100 sen/);
  });

  it('CHIP does not know the purchase (test vs live key): alert; Expired once 24 hours old', async () => {
    world.orders.push(orderRow({ created: ago(30 * MIN) }));
    await reconcile(makeEnv());
    expect(status(world.orders[0]!)).toBe('Pending');
    expect(alerts(world)[0]).toMatch(/CHIP doesn't know purchase/);

    world.orders[0]!.created_time = ago(25 * 60 * MIN).toISOString();
    await reconcile(makeEnv());
    expect(status(world.orders[0]!)).toBe('Expired');
  });

  it('Make down: the order stays Paid, the owner is alerted, and the next run re-sends it', async () => {
    world.purchases.set(PURCHASE_ID, purchase({ payment: { amount: 8900, currency: 'MYR', paid_on: Math.floor(ago(16 * MIN).getTime() / 1000) } }));
    world.orders.push(orderRow());
    world.override.make = () => new Response('down', { status: 500 });
    const first = await reconcile(makeEnv());
    expect(status(world.orders[0]!)).toBe('Paid');
    expect(first.problems[0]).toMatch(/Make: webhook answered 500/);

    world.override = {}; // Make is back
    const second = await reconcile(makeEnv());
    expect(second.resent).toEqual([ORDER_ID]);
    expect(callsTo(world, 'make')).toHaveLength(2);
  });
});

describe('Paid orders (sent to Make, not yet Delivered)', () => {
  it('re-sent while under 24 hours; Make answers, the row stays for Make to update', async () => {
    world.purchases.set(PURCHASE_ID, purchase());
    world.orders.push(orderRow({ status: 'Paid', paidAt: ago(20 * MIN).toISOString() }));
    const report = await reconcile(makeEnv());
    expect(report.resent).toEqual([ORDER_ID]);
    expect(callsTo(world, 'make')).toHaveLength(1);
    expect(alerts(world)[0]).toMatch(/sent to Make again/);
  });

  it('still Paid 24 hours after payment: Failed, alert, not re-sent', async () => {
    world.purchases.set(PURCHASE_ID, purchase());
    world.orders.push(orderRow({ status: 'Paid', paidAt: ago(25 * 60 * MIN).toISOString() }));
    await reconcile(makeEnv());
    expect(status(world.orders[0]!)).toBe('Failed');
    expect(callsTo(world, 'make')).toHaveLength(0);
    expect(alerts(world)[0]).toMatch(/not delivered after 24 hours/);
  });

  it('Delivered rows are never touched', async () => {
    world.purchases.set(PURCHASE_ID, purchase());
    world.orders.push(orderRow({ status: 'Delivered', created: ago(60 * MIN), paidAt: ago(60 * MIN).toISOString() }));
    const report = await reconcile(makeEnv());
    expect(report.checked).toBe(0);
    expect(callsTo(world, 'make')).toHaveLength(0);
  });
});

describe('limits and failures', () => {
  it('stays under the subrequest budget; the rest waits for the next run', async () => {
    for (let i = 0; i < 30; i++) {
      const id = `8f9c2a4e-1b2c-4d5e-8f90-${String(i).padStart(12, '0')}`;
      const orderId = `GB-20261125120000-${'ABCDEFGHJK'[i % 10]}${'ABCDEFGHJK'[Math.floor(i / 10)]}ZZ`;
      const p = purchase({ id, reference: orderId });
      p.purchase!.metadata = { order_id: orderId, product: 'autopost-threads', package: 'starter' };
      world.purchases.set(id, p);
      world.orders.push(orderRow({ purchaseId: id, orderId, created: ago((60 + i) * MIN) }));
    }
    const report = await reconcile(makeEnv());
    expect(report.deferred).toBe(true);
    expect(world.calls.length).toBeLessThanOrEqual(45);
    expect(report.recovered.length).toBeGreaterThan(10);
  });

  it('Notion down: one alert, no crash', async () => {
    world.override.notion = () => new Response('busy', { status: 503 });
    const report = await reconcile(makeEnv());
    expect(report.problems).toHaveLength(2);
    expect(alerts(world)).toHaveLength(1);
  });

  it('not configured before launch: logged, no Telegram alert', async () => {
    const report = await reconcile(makeEnv({ CHIP_SECRET_KEY: undefined }));
    expect(report.problems[0]).toMatch(/CHIP_SECRET_KEY/);
    expect(alerts(world)).toEqual([]);
    expect(console.warn).toHaveBeenCalled();
  });

  it('the scheduled handler runs it', async () => {
    world.purchases.set(PURCHASE_ID, purchase());
    world.orders.push(orderRow());
    const ctx = makeCtx();
    await worker.scheduled!({ scheduledTime: Date.now(), cron: '*/15 * * * *', noRetry() {} } as ScheduledController, makeEnv(), ctx as unknown as ExecutionContext);
    await ctx.settle();
    expect(status(world.orders[0]!)).toBe('Paid');
  });
});
