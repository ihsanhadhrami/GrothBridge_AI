import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetCompanyKeyCache } from '../worker/chip';
import { hmacSha256Hex } from '../worker/crypto';
import { handleChipWebhook } from '../worker/webhook';
import {
  alerts,
  callsTo,
  makeCtx,
  makeEnv,
  makeWorld,
  MAKE_SECRET,
  notes,
  ORDER_ID,
  orderRow,
  PAID_ON,
  purchase,
  PURCHASE_ID,
  status,
  type World,
} from './fakes';

/** POST /api/webhooks/chip against the fake world (tests/fakes.ts). */

let world: World;

beforeEach(async () => {
  world = await makeWorld();
  resetCompanyKeyCache();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function signed(body: unknown, key?: CryptoKey, signatureOverride?: string): Promise<Request> {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  return new Request('https://growthbridge.my/api/webhooks/chip', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-signature': signatureOverride ?? (await world.sign(raw, key)) },
    body: raw,
  });
}

/** A success_callback body: the purchase snapshot plus event_type. */
const paidEvent = (over = {}) => ({ ...purchase(over), event_type: 'purchase.paid' });

async function run(req: Request, env = makeEnv()) {
  const ctx = makeCtx();
  const res = await handleChipWebhook(req, env, ctx);
  await ctx.settle();
  return res;
}

describe('signature', () => {
  it('valid success_callback signature (company key from GET /public_key/): paid order goes to Make', async () => {
    world.purchases.set(PURCHASE_ID, purchase());
    world.orders.push(orderRow());

    const res = await run(await signed(paidEvent()));
    expect(res.status).toBe(200);

    const [make] = callsTo(world, 'make');
    expect(make).toBeDefined();
    const raw = make!.init.body as string;
    expect(JSON.parse(raw)).toEqual({
      event: 'paid',
      order_id: ORDER_ID,
      chip_purchase_id: PURCHASE_ID,
      amount: 8900,
      email: 'siti@example.com',
      name: 'Siti Aminah',
      phone: '+60123456789',
      product: 'autopost-threads',
      package: 'starter',
      paid_at: new Date(PAID_ON * 1000).toISOString(),
      is_test: true,
    });
    // Make checks this: HMAC-SHA256 over the exact body, hex.
    expect((make!.init.headers as Record<string, string>)['x-gb-signature']).toBe(await hmacSha256Hex(MAKE_SECRET, raw));

    expect(status(world.orders[0]!)).toBe('Paid');
    expect(world.orders[0]!.properties['Paid at'].date.start).toBe(new Date(PAID_ON * 1000).toISOString());
    expect(alerts(world)).toEqual([]);
  });

  it('valid portal-webhook signature (CHIP_PUBLIC_KEY) is accepted too', async () => {
    world.purchases.set(PURCHASE_ID, purchase());
    world.orders.push(orderRow());
    const res = await run(await signed(paidEvent(), world.webhookKey.privateKey), makeEnv({ CHIP_PUBLIC_KEY: world.webhookPem }));
    expect(res.status).toBe(200);
    expect(callsTo(world, 'make')).toHaveLength(1);
  });

  it('CHIP_PUBLIC_KEY pasted as JSON (quotes and \\n escapes) still works', async () => {
    world.purchases.set(PURCHASE_ID, purchase());
    world.orders.push(orderRow());
    const res = await run(await signed(paidEvent(), world.webhookKey.privateKey), makeEnv({ CHIP_PUBLIC_KEY: JSON.stringify(world.webhookPem) }));
    expect(res.status).toBe(200);
  });

  it('bad signature: 400, alert, nothing fetched or forwarded', async () => {
    world.purchases.set(PURCHASE_ID, purchase());
    world.orders.push(orderRow());
    const res = await run(await signed(paidEvent(), world.webhookKey.privateKey)); // signed with a key we don't trust
    expect(res.status).toBe(400);
    expect(callsTo(world, 'make')).toHaveLength(0);
    expect(callsTo(world, 'chip').filter((c) => c.url.includes('/purchases/'))).toHaveLength(0);
    expect(status(world.orders[0]!)).toBe('Pending');
    expect(alerts(world)[0]).toMatch(/REJECTED \(400\): X-Signature does not match/);
  });

  it('body changed after signing: 400', async () => {
    const good = JSON.stringify(paidEvent());
    const sig = await world.sign(good);
    const tampered = good.replace('"total":8900', '"total":100');
    const res = await run(await signed(tampered, undefined, sig));
    expect(res.status).toBe(400);
  });

  it('missing or garbage X-Signature: 400', async () => {
    const req = new Request('https://growthbridge.my/api/webhooks/chip', { method: 'POST', body: JSON.stringify(paidEvent()) });
    expect((await run(req)).status).toBe(400);
    expect((await run(await signed(paidEvent(), undefined, 'not base64!!'))).status).toBe(400);
  });

  it('rejected-call alerts are rate-limited (anyone can post here)', async () => {
    const env = makeEnv({ ALERT_RATE_LIMIT: { limit: vi.fn(async () => ({ success: false })) } });
    const res = await run(await signed(paidEvent(), undefined, 'AAAA'), env);
    expect(res.status).toBe(400);
    expect(alerts(world)).toEqual([]);
    expect(console.error).toHaveBeenCalledWith('[alert, rate-limited]', expect.stringMatching(/REJECTED/));
  });

  it('CHIP public key unavailable: 500 so CHIP retries, and an alert', async () => {
    world.override.chip = (url) => (url.endsWith('/public_key/') ? new Response('down', { status: 503 }) : undefined);
    const res = await run(await signed(paidEvent()));
    expect(res.status).toBe(500);
    expect(alerts(world)[0]).toMatch(/could not load a key/);
  });
});

describe('purchase.paid', () => {
  it('re-fetches the purchase: a forged "paid" body for an unpaid purchase does nothing', async () => {
    world.purchases.set(PURCHASE_ID, purchase({ status: 'created', payment: null }));
    world.orders.push(orderRow());
    const res = await run(await signed(paidEvent())); // body says paid
    expect(res.status).toBe(200);
    expect(callsTo(world, 'make')).toHaveLength(0);
    expect(status(world.orders[0]!)).toBe('Pending');
  });

  it('wrong amount: nothing sent to Make, row marked Failed, owner alerted', async () => {
    world.purchases.set(PURCHASE_ID, purchase({ total: 100 }));
    world.orders.push(orderRow());
    const res = await run(await signed(paidEvent({ total: 100 })));
    expect(res.status).toBe(200); // a retry can't fix it
    expect(callsTo(world, 'make')).toHaveLength(0);
    expect(status(world.orders[0]!)).toBe('Failed');
    expect(notes(world.orders[0]!)).toMatch(/total 100 sen ≠ 8900 sen/);
    expect(alerts(world)[0]).toMatch(/REJECTED.*total 100 sen/);
  });

  it('payment amount differs from the price: rejected', async () => {
    world.purchases.set(PURCHASE_ID, purchase({ payment: { amount: 100, currency: 'MYR', paid_on: PAID_ON } }));
    world.orders.push(orderRow());
    await run(await signed(paidEvent()));
    expect(callsTo(world, 'make')).toHaveLength(0);
    expect(alerts(world)[0]).toMatch(/payment amount 100/);
  });

  it('another brand, or a package we do not sell: rejected', async () => {
    world.purchases.set(PURCHASE_ID, purchase({ brand_id: 'someone-else' }));
    world.orders.push(orderRow());
    await run(await signed(paidEvent()));
    expect(alerts(world)[0]).toMatch(/brand_id someone-else is not ours/);

    world.calls.length = 0;
    const siap = purchase();
    siap.purchase!.metadata = { order_id: ORDER_ID, product: 'autopost-threads', package: 'siap-pasang' };
    world.purchases.set(PURCHASE_ID, siap);
    world.orders[0]!.properties.Status = { select: { name: 'Pending' } };
    await run(await signed(paidEvent()));
    expect(callsTo(world, 'make')).toHaveLength(0);
    expect(alerts(world)[0]).toMatch(/siap-pasang" is not sold/);
  });

  it('Make down: 500 so CHIP retries; the row is Paid so the cron retries too', async () => {
    world.purchases.set(PURCHASE_ID, purchase());
    world.orders.push(orderRow());
    world.override.make = () => new Response('Scenario is off', { status: 410 });
    const res = await run(await signed(paidEvent()));
    expect(res.status).toBe(500);
    expect(status(world.orders[0]!)).toBe('Paid');
    expect(alerts(world)[0]).toMatch(/NOT passed on to Make[\s\S]*Make: webhook answered 410/);
  });

  it('Make times out: 500', async () => {
    world.purchases.set(PURCHASE_ID, purchase());
    world.orders.push(orderRow());
    world.override.make = () => {
      const err = new Error('The operation was aborted due to timeout');
      err.name = 'TimeoutError';
      throw err;
    };
    const res = await run(await signed(paidEvent()));
    expect(res.status).toBe(500);
    expect(alerts(world)[0]).toMatch(/no answer within 15000 ms/);
  });

  it('Make answers 200 only after the Notion row says Paid', async () => {
    world.purchases.set(PURCHASE_ID, purchase());
    world.orders.push(orderRow());
    let statusWhenMakeCalled = '';
    world.override.make = () => {
      statusWhenMakeCalled = status(world.orders[0]!);
      return undefined;
    };
    await run(await signed(paidEvent()));
    expect(statusWhenMakeCalled).toBe('Paid');
  });

  it('Notion down: 500 so CHIP retries, nothing sent to Make', async () => {
    world.purchases.set(PURCHASE_ID, purchase());
    world.override.notion = () => new Response('busy', { status: 503 });
    const res = await run(await signed(paidEvent()));
    expect(res.status).toBe(500);
    expect(callsTo(world, 'make')).toHaveLength(0);
  });

  it('same notification twice after delivery: one Make call', async () => {
    world.purchases.set(PURCHASE_ID, purchase());
    world.orders.push(orderRow());
    expect((await run(await signed(paidEvent()))).status).toBe(200);
    world.orders[0]!.properties.Status = { select: { name: 'Delivered' } }; // what Make does
    expect((await run(await signed(paidEvent()))).status).toBe(200);
    expect(callsTo(world, 'make')).toHaveLength(1);
  });

  it('Notion row missing (checkout write failed): rebuilt from the purchase as Paid, then sent', async () => {
    world.purchases.set(PURCHASE_ID, purchase());
    const res = await run(await signed(paidEvent()));
    expect(res.status).toBe(200);
    expect(world.orders).toHaveLength(1);
    const p = world.orders[0]!.properties;
    expect(p['Order ID'].title[0].plain_text).toBe(ORDER_ID);
    expect(p.Email).toEqual({ email: 'siti@example.com' });
    expect(p.Phone).toEqual({ phone_number: '+60123456789' });
    expect(p.Package).toEqual({ select: { name: 'starter' } });
    expect(p['Amount (RM)']).toEqual({ number: 89 });
    expect(p.Status).toEqual({ select: { name: 'Paid' } });
    expect(notes(world.orders[0]!)).toMatch(/test mode[\s\S]*rebuilt from the CHIP purchase/);
    expect(callsTo(world, 'make')).toHaveLength(1);
    expect(alerts(world)[0]).toMatch(/row was missing/);
  });

  it('Make or CHIP not configured: 500 + alert', async () => {
    world.purchases.set(PURCHASE_ID, purchase());
    world.orders.push(orderRow());
    const res = await run(await signed(paidEvent()), makeEnv({ MAKE_WEBHOOK_URL: undefined }));
    expect(res.status).toBe(500);
    expect(alerts(world)[0]).toMatch(/MAKE_WEBHOOK_URL not set/);
  });

  it('other events are acknowledged and ignored', async () => {
    const res = await run(await signed({ ...purchase({ status: 'created' }), event_type: 'purchase.created' }));
    expect(res.status).toBe(200);
    expect(callsTo(world, 'make')).toHaveLength(0);
    expect(callsTo(world, 'notion')).toHaveLength(0);
  });
});

describe('payment.refunded', () => {
  const refundEvent = {
    id: '11111111-2222-4333-8444-555555555555',
    type: 'payment',
    event_type: 'payment.refunded',
    related_to: { type: 'purchase', id: PURCHASE_ID },
    payment: { amount: 8900, currency: 'MYR', payment_type: 'refund' },
    is_test: true,
  };

  it('verified refund goes to Make with event "refunded"; the Worker leaves the row to Make', async () => {
    world.purchases.set(PURCHASE_ID, purchase({ status: 'refunded' }));
    world.orders.push(orderRow({ status: 'Delivered' }));
    const res = await run(await signed(refundEvent, world.webhookKey.privateKey), makeEnv({ CHIP_PUBLIC_KEY: world.webhookPem }));
    expect(res.status).toBe(200);
    const sent = JSON.parse(callsTo(world, 'make')[0]!.init.body as string);
    expect(sent).toMatchObject({ event: 'refunded', order_id: ORDER_ID, amount: 8900, refunded_amount: 8900 });
    expect(status(world.orders[0]!)).toBe('Delivered');
    expect(alerts(world)[0]).toMatch(/Refund \(RM89(\.00)?\) sent to Make/);
  });

  it('purchase not refunded in CHIP: nothing sent', async () => {
    world.purchases.set(PURCHASE_ID, purchase());
    world.orders.push(orderRow({ status: 'Delivered' }));
    await run(await signed(refundEvent, world.webhookKey.privateKey), makeEnv({ CHIP_PUBLIC_KEY: world.webhookPem }));
    expect(callsTo(world, 'make')).toHaveLength(0);
  });

  it('already Refunded: nothing sent', async () => {
    world.purchases.set(PURCHASE_ID, purchase({ status: 'refunded' }));
    world.orders.push(orderRow({ status: 'Refunded' }));
    await run(await signed(refundEvent, world.webhookKey.privateKey), makeEnv({ CHIP_PUBLIC_KEY: world.webhookPem }));
    expect(callsTo(world, 'make')).toHaveLength(0);
  });
});
