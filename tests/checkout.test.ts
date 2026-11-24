import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleCheckout, MESSAGES } from '../worker/checkout';
import type { WorkerEnv } from '../worker/env';
import worker from '../worker/index';

/**
 * The checkout handler end to end, with CHIP, Notion and Telegram replaced
 * by a fake `fetch`. No real keys; every value here is made up.
 */

const CHECKOUT_URL = 'https://gate.chip-in.asia/p/11111111-2222-3333-4444-555555555555/';

type Route = (url: string, init: RequestInit) => Response | Promise<Response>;
let calls: { url: string; init: RequestInit; body: any }[];
let routes: { chip: Route; notion: Route; telegram: Route };

function fakeFetch(input: string | URL | Request, init: RequestInit = {}) {
  const url = String(input instanceof Request ? input.url : input);
  const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
  calls.push({ url, init, body });
  if (url.startsWith('https://gate.chip-in.asia/')) return Promise.resolve(routes.chip(url, init));
  if (url.startsWith('https://api.notion.com/')) return Promise.resolve(routes.notion(url, init));
  if (url.startsWith('https://api.telegram.org/')) return Promise.resolve(routes.telegram(url, init));
  return Promise.reject(new Error(`unexpected fetch ${url}`));
}

const chipOk: Route = (_u, init) => {
  const sent = JSON.parse(init.body as string);
  const total = sent.purchase.products.reduce((s: number, p: { price: number }) => s + p.price, 0);
  return Response.json({ id: 'chip-purchase-1', checkout_url: CHECKOUT_URL, is_test: true, status: 'created', purchase: { total } }, { status: 201 });
};
const notionOk: Route = () => Response.json({ object: 'page', id: 'notion-page-1' });
const telegramOk: Route = () => Response.json({ ok: true });

function makeEnv(overrides: Partial<WorkerEnv> = {}, allow = true): WorkerEnv {
  return {
    ASSETS: { fetch: async () => new Response('asset') } as unknown as Fetcher,
    CHECKOUT_RATE_LIMIT: { limit: vi.fn(async () => ({ success: allow })) },
    CHIP_SECRET_KEY: 'test-secret',
    CHIP_BRAND_ID: 'brand-123',
    NOTION_TOKEN: 'notion-token',
    NOTION_ORDERS_DB: 'orders-db',
    TELEGRAM_BOT_TOKEN: 'bot-token',
    TELEGRAM_ADMIN_CHAT_ID: '42',
    ...overrides,
  };
}

function makeCtx() {
  const pending: Promise<unknown>[] = [];
  return { waitUntil: (p: Promise<unknown>) => void pending.push(p), settle: () => Promise.all(pending) };
}

const form = {
  product: 'autopost-threads',
  package: 'starter',
  name: '  Siti Aminah ',
  email: 'Siti@Example.com',
  phone: '012-345 6789',
  consent: true,
};

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request('https://growthbridge.my/api/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.9', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const chipCalls = () => calls.filter((c) => c.url.startsWith('https://gate.chip-in.asia/'));
const notionCalls = () => calls.filter((c) => c.url.startsWith('https://api.notion.com/'));
const telegramCalls = () => calls.filter((c) => c.url.startsWith('https://api.telegram.org/'));

beforeEach(() => {
  calls = [];
  routes = { chip: chipOk, notion: notionOk, telegram: telegramOk };
  vi.stubGlobal('fetch', vi.fn(fakeFetch));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('POST /api/checkout: success', () => {
  it('creates the CHIP purchase from the products file and returns checkout_url', async () => {
    const env = makeEnv();
    const ctx = makeCtx();
    const res = await handleCheckout(post(form), env, ctx);
    await ctx.settle();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ checkout_url: CHECKOUT_URL });

    const [chip] = chipCalls();
    expect(chip!.url).toBe('https://gate.chip-in.asia/api/v1/purchases/');
    expect((chip!.init.headers as Record<string, string>).authorization).toBe('Bearer test-secret');
    const sent = chip!.body;
    expect(sent.brand_id).toBe('brand-123');
    expect(sent.reference).toMatch(/^GB-\d{14}-[2-9A-HJ-NP-Z]{4}$/);
    expect(sent.client).toEqual({ email: 'siti@example.com', full_name: 'Siti Aminah', phone: '+60 123456789' });
    expect(sent.purchase.currency).toBe('MYR');
    expect(sent.purchase.products).toEqual([
      { name: 'Autopost Threads dengan AI (Starter)', price: 8900, quantity: '1', category: 'autopost-threads/starter' },
    ]);
    expect(sent.purchase.metadata).toEqual({ order_id: sent.reference, product: 'autopost-threads', package: 'starter' });
    expect(sent.success_redirect).toBe('https://growthbridge.my/terima-kasih');
    expect(sent.failure_redirect).toBe('https://growthbridge.my/produk/autopost-threads?pakej=starter#beli');
    expect(sent.cancel_redirect).toBe(sent.failure_redirect);
    expect(sent.success_callback).toBe('https://growthbridge.my/api/webhooks/chip');
    expect(sent.send_receipt).toBe(false);
  });

  it('writes the Pending row to Notion with every buyer detail', async () => {
    const ctx = makeCtx();
    await handleCheckout(post({ ...form, package: 'masterclass' }), makeEnv(), ctx);
    await ctx.settle();

    const [notion] = notionCalls();
    expect(notion!.url).toBe('https://api.notion.com/v1/pages');
    expect((notion!.init.headers as Record<string, string>)['notion-version']).toBe('2022-06-28');
    const { parent, properties: p } = notion!.body;
    expect(parent).toEqual({ database_id: 'orders-db' });
    expect(p['Order ID'].title[0].text.content).toBe(chipCalls()[0]!.body.reference);
    expect(p.Name.rich_text[0].text.content).toBe('Siti Aminah');
    expect(p.Email).toEqual({ email: 'siti@example.com' });
    expect(p.Phone).toEqual({ phone_number: '+60123456789' });
    expect(p.Product).toEqual({ select: { name: 'autopost-threads' } });
    expect(p.Package).toEqual({ select: { name: 'masterclass' } });
    expect(p['Amount (RM)']).toEqual({ number: 259 });
    expect(p.Status).toEqual({ select: { name: 'Pending' } });
    expect(p['CHIP purchase ID'].rich_text[0].text.content).toBe('chip-purchase-1');
    expect(p.Notes.rich_text[0].text.content).toMatch(/test mode/);
    expect(telegramCalls()).toHaveLength(0);
  });

  it('ignores a price sent by the browser', async () => {
    const ctx = makeCtx();
    const res = await handleCheckout(post({ ...form, price: 100, priceSen: 100, amount: 1 }), makeEnv(), ctx);
    await ctx.settle();
    expect(res.status).toBe(200);
    expect(chipCalls()[0]!.body.purchase.products[0].price).toBe(8900);
    expect(notionCalls()[0]!.body.properties['Amount (RM)']).toEqual({ number: 89 });
  });

  it('answers a plain form post (no JavaScript) with a 303 to CHIP', async () => {
    const body = new URLSearchParams({ product: 'autopost-threads', package: 'starter', name: 'Siti Aminah', email: 'siti@example.com', phone: '0123456789', consent: 'on' });
    const ctx = makeCtx();
    const res = await handleCheckout(post(body.toString(), { 'content-type': 'application/x-www-form-urlencoded' }), makeEnv(), ctx);
    await ctx.settle();
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe(CHECKOUT_URL);
  });
});

describe('POST /api/checkout: refusals', () => {
  it('returns Malay field errors and never calls CHIP', async () => {
    const res = await handleCheckout(post({ ...form, email: 'nope', consent: false }), makeEnv(), makeCtx());
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string; errors: Record<string, string> };
    expect(data.error).toBe(MESSAGES.invalid);
    expect(Object.keys(data.errors).sort()).toEqual(['consent', 'email']);
    expect(chipCalls()).toHaveLength(0);
  });

  it.each([
    ['autopost-threads', 'siap-pasang'],
    ['autopost-threads', 'gold'],
    ['no-such-product', 'starter'],
  ])('refuses %s / %s', async (product, pkg) => {
    const res = await handleCheckout(post({ ...form, product, package: pkg }), makeEnv(), makeCtx());
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe(MESSAGES.unknownPackage);
    expect(chipCalls()).toHaveLength(0);
  });

  it('rate-limits per IP: 429 before anything else', async () => {
    const env = makeEnv({}, false);
    const res = await handleCheckout(post(form), env, makeCtx());
    expect(res.status).toBe(429);
    expect(env.CHECKOUT_RATE_LIMIT.limit).toHaveBeenCalledWith({ key: 'checkout:203.0.113.9' });
    expect(calls).toHaveLength(0);
  });

  it('refuses other content types, bad JSON and large bodies', async () => {
    expect((await handleCheckout(post('x', { 'content-type': 'text/plain' }), makeEnv(), makeCtx())).status).toBe(415);
    expect((await handleCheckout(post('{bad'), makeEnv(), makeCtx())).status).toBe(400);
    expect((await handleCheckout(post('[1,2]'), makeEnv(), makeCtx())).status).toBe(400);
    expect((await handleCheckout(post({ ...form, name: 'x'.repeat(9000) }), makeEnv(), makeCtx())).status).toBe(413);
    expect(chipCalls()).toHaveLength(0);
  });

  it('answers 503 and alerts when the CHIP keys are not set', async () => {
    const ctx = makeCtx();
    const res = await handleCheckout(post(form), makeEnv({ CHIP_SECRET_KEY: undefined }), ctx);
    await ctx.settle();
    expect(res.status).toBe(503);
    expect(chipCalls()).toHaveLength(0);
    expect(telegramCalls()[0]!.body.text).toMatch(/CHIP_SECRET_KEY/);
  });
});

describe('POST /api/checkout: failures outside', () => {
  it('CHIP error: 502 for the buyer, Telegram alert for the owner, no Notion row', async () => {
    routes.chip = () => Response.json({ __all__: { message: 'Invalid brand', code: 'invalid' } }, { status: 400 });
    const ctx = makeCtx();
    const res = await handleCheckout(post(form), makeEnv(), ctx);
    await ctx.settle();
    expect(res.status).toBe(502);
    expect(((await res.json()) as { error: string }).error).toBe(MESSAGES.chipFailed);
    expect(notionCalls()).toHaveLength(0);
    const alert = telegramCalls()[0]!.body;
    expect(alert.chat_id).toBe('42');
    expect(alert.text).toMatch(/CHIP purchase was not created/);
    expect(alert.text).toMatch(/Invalid brand/);
    expect(alert.text).toMatch(/siti@example.com/);
  });

  it('CHIP timeout: 502 and an alert that says so', async () => {
    routes.chip = () => {
      throw new DOMException('timed out', 'TimeoutError');
    };
    const ctx = makeCtx();
    const res = await handleCheckout(post(form), makeEnv(), ctx);
    await ctx.settle();
    expect(res.status).toBe(502);
    expect(telegramCalls()[0]!.body.text).toMatch(/no answer within/);
  });

  it('CHIP answers with a checkout_url on another host: refused', async () => {
    routes.chip = () => Response.json({ id: 'x', checkout_url: 'https://evil.example/p/x/' }, { status: 201 });
    const res = await handleCheckout(post(form), makeEnv(), makeCtx());
    expect(res.status).toBe(502);
  });

  it('CHIP total differs from our price: refused', async () => {
    routes.chip = () => Response.json({ id: 'x', checkout_url: CHECKOUT_URL, purchase: { total: 100 } }, { status: 201 });
    const ctx = makeCtx();
    const res = await handleCheckout(post(form), makeEnv(), ctx);
    await ctx.settle();
    expect(res.status).toBe(502);
    expect(telegramCalls()[0]!.body.text).toMatch(/total 100/);
  });

  it('Notion down: checkout still goes ahead, and the owner gets every detail', async () => {
    routes.notion = () => Response.json({ message: 'Could not find database' }, { status: 404 });
    const ctx = makeCtx();
    const res = await handleCheckout(post(form), makeEnv(), ctx);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { checkout_url: string }).checkout_url).toBe(CHECKOUT_URL);
    await ctx.settle();
    const text: string = telegramCalls()[0]!.body.text;
    expect(text).toMatch(/NOT written/);
    expect(text).toMatch(/chip-purchase-1/);
    expect(text).toMatch(/GB-\d{14}-/);
    expect(text).toMatch(/Siti Aminah, siti@example.com, \+60123456789/);
    expect(text).toMatch(/RM89/);
  });

  it('Notion not configured: checkout still goes ahead, with an alert', async () => {
    const ctx = makeCtx();
    const res = await handleCheckout(post(form), makeEnv({ NOTION_TOKEN: undefined }), ctx);
    await ctx.settle();
    expect(res.status).toBe(200);
    expect(notionCalls()).toHaveLength(0);
    expect(telegramCalls()[0]!.body.text).toMatch(/NOTION_TOKEN/);
  });

  it('Telegram down too: the alert lands in the Worker log instead', async () => {
    routes.notion = () => new Response('busy', { status: 503 });
    routes.telegram = () => new Response('nope', { status: 500 });
    const ctx = makeCtx();
    const res = await handleCheckout(post(form), makeEnv(), ctx);
    await ctx.settle();
    expect(res.status).toBe(200);
    expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/Telegram answered 500/), expect.stringMatching(/NOT written/));
  });
});

describe('Worker routing', () => {
  const run = (req: Request, env = makeEnv()) => worker.fetch!(req as never, env, makeCtx() as unknown as ExecutionContext);

  it('routes POST /api/checkout and adds the security headers', async () => {
    const res = await run(post(form));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-security-policy')).toContain("form-action 'self' mailto: https://gate.chip-in.asia;");
    expect(res.headers.get('x-frame-options')).toBe('DENY');
  });

  it('405 for GET /api/checkout, 501 for Phase 3 endpoints, 404 for unknown', async () => {
    const get = await run(new Request('https://growthbridge.my/api/checkout'));
    expect(get.status).toBe(405);
    expect(get.headers.get('allow')).toBe('POST');
    expect((await run(new Request('https://growthbridge.my/api/enquiry', { method: 'POST' }))).status).toBe(501);
    expect((await run(new Request('https://growthbridge.my/api/webhooks/chip', { method: 'POST' }))).status).toBe(501);
    expect((await run(new Request('https://growthbridge.my/api/nope'))).status).toBe(404);
  });

  it('still 301s www to the apex', async () => {
    const res = await run(new Request('https://www.growthbridge.my/produk/autopost-threads?pakej=starter'));
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://growthbridge.my/produk/autopost-threads?pakej=starter');
  });
});
