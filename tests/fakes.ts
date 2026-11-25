import { vi } from 'vitest';
import type { ChipPurchase } from '../worker/chip';
import type { WorkerEnv } from '../worker/env';

/**
 * A fake outside world for the Worker: CHIP, an in-memory Notion (Orders and
 * Enquiries), Telegram and Make, behind a stubbed global fetch. No real keys;
 * every value is made up. RSA keys are generated per test run.
 */

export const PURCHASE_ID = '8f9c2a4e-1b2c-4d5e-8f90-123456789abc';
export const ORDER_ID = 'GB-20261125120000-ABCD';
export const MAKE_URL = 'https://hook.eu2.make.com/test-hook';
export const MAKE_SECRET = 'make-shared-secret';
export const PAID_ON = 1795600000; // Unix seconds

type Route = (url: string, init: RequestInit) => Response | undefined | Promise<Response | undefined>;

export interface FakeRow {
  id: string;
  created_time: string;
  properties: Record<string, any>;
}

export interface World {
  calls: { url: string; init: RequestInit; body: any }[];
  purchases: Map<string, ChipPurchase>;
  orders: FakeRow[];
  enquiries: FakeRow[];
  /** Override a service's answer; return undefined to fall through to the fake. */
  override: Partial<Record<'chip' | 'notion' | 'telegram' | 'make', Route>>;
  companyPem: string;
  sign(body: string, key?: CryptoKey): Promise<string>;
  companyKey: CryptoKeyPair;
  webhookKey: CryptoKeyPair;
  webhookPem: string;
}

const RSA = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' } as const;

async function keyPair(): Promise<{ pair: CryptoKeyPair; pem: string }> {
  const pair = (await crypto.subtle.generateKey(
    { ...RSA, modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  const spki = new Uint8Array((await crypto.subtle.exportKey('spki', pair.publicKey)) as ArrayBuffer);
  const b64 = btoa(String.fromCharCode(...spki));
  const pem = `-----BEGIN PUBLIC KEY-----\n${b64.match(/.{1,64}/g)!.join('\n')}\n-----END PUBLIC KEY-----\n`;
  return { pair, pem };
}

let keys: { company: { pair: CryptoKeyPair; pem: string }; webhook: { pair: CryptoKeyPair; pem: string } } | null = null;

export async function makeWorld(): Promise<World> {
  keys ??= { company: await keyPair(), webhook: await keyPair() };
  const world: World = {
    calls: [],
    purchases: new Map(),
    orders: [],
    enquiries: [],
    override: {},
    companyPem: keys.company.pem,
    companyKey: keys.company.pair,
    webhookKey: keys.webhook.pair,
    webhookPem: keys.webhook.pem,
    async sign(body, key = keys!.company.pair.privateKey) {
      const sig = new Uint8Array(await crypto.subtle.sign(RSA, key, new TextEncoder().encode(body)));
      return btoa(String.fromCharCode(...sig));
    },
  };

  const fakeFetch = async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input instanceof Request ? input.url : input);
    let body: any;
    try {
      body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    } catch {
      body = init.body;
    }
    world.calls.push({ url, init, body });
    const service = url.startsWith('https://gate.chip-in.asia/')
      ? 'chip'
      : url.startsWith('https://api.notion.com/')
        ? 'notion'
        : url.startsWith('https://api.telegram.org/')
          ? 'telegram'
          : url.startsWith(MAKE_URL)
            ? 'make'
            : null;
    if (!service) throw new Error(`unexpected fetch ${url}`);
    const custom = world.override[service];
    if (custom) {
      const res = await custom(url, init);
      if (res) return res;
    }
    if (service === 'chip') return chip(world, url, init);
    if (service === 'notion') return notion(world, url, init, body);
    if (service === 'telegram') return Response.json({ ok: true });
    return new Response('Accepted', { status: 200 });
  };
  vi.stubGlobal('fetch', vi.fn(fakeFetch));
  return world;
}

function chip(world: World, url: string, init: RequestInit): Response {
  const path = url.replace('https://gate.chip-in.asia/api/v1', '');
  if (path === '/public_key/') return Response.json(world.companyPem);
  const m = /^\/purchases\/([^/]+)\/$/.exec(path);
  if (m && (init.method ?? 'GET') === 'GET') {
    const p = world.purchases.get(m[1]!);
    return p ? Response.json(p) : Response.json({ __all__: [{ code: 'not_found' }] }, { status: 404 });
  }
  return new Response('unexpected CHIP call', { status: 500 });
}

let pageSeq = 0;

function notion(world: World, url: string, init: RequestInit, body: any): Response {
  const path = url.replace('https://api.notion.com/v1', '');
  const q = /^\/databases\/([^/]+)\/query$/.exec(path);
  if (q) {
    const rows = q[1] === 'orders-db' ? world.orders : world.enquiries;
    const results = rows.filter((r) => matches(r, body.filter)).sort((a, b) => a.created_time.localeCompare(b.created_time));
    const size = body.page_size ?? 100;
    return Response.json({ object: 'list', results: results.slice(0, size), has_more: results.length > size, next_cursor: null });
  }
  if (path === '/pages' && init.method === 'POST') {
    const row: FakeRow = { id: `page-${++pageSeq}`, created_time: new Date().toISOString(), properties: readable(body.properties) };
    (body.parent.database_id === 'orders-db' ? world.orders : world.enquiries).push(row);
    return Response.json({ object: 'page', id: row.id });
  }
  const pg = /^\/pages\/([^/]+)$/.exec(path);
  if (pg && init.method === 'PATCH') {
    const row = [...world.orders, ...world.enquiries].find((r) => r.id === pg[1]);
    if (!row) return Response.json({ message: 'not found' }, { status: 404 });
    Object.assign(row.properties, readable(body.properties));
    return Response.json({ object: 'page', id: row.id });
  }
  return new Response('unexpected Notion call', { status: 500 });
}

/** Notion echoes plain_text on reads; add it so the Worker's reader sees what Notion would send. */
function readable(props: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(props)) {
    const conv = (rt: any[]) => rt.map((t) => ({ ...t, plain_text: t.text.content }));
    if (v?.title) out[k] = { title: conv(v.title) };
    else if (v?.rich_text) out[k] = { rich_text: conv(v.rich_text) };
    else out[k] = v;
  }
  return out;
}

function matches(row: FakeRow, f: any): boolean {
  if (!f) return true;
  if (f.and) return f.and.every((x: any) => matches(row, x));
  if (f.timestamp === 'created_time') return row.created_time < f.created_time.before;
  const p = row.properties[f.property];
  if (f.title) return (p?.title ?? []).map((t: any) => t.plain_text).join('') === f.title.equals;
  if (f.select) return p?.select?.name === f.select.equals;
  if (f.date) return !!p?.date?.start && Date.parse(p.date.start) < Date.parse(f.date.before);
  throw new Error(`fake Notion can't filter ${JSON.stringify(f)}`);
}

/** A Notion Orders row as the checkout writes it. */
export function orderRow(over: { status?: string; created?: Date; paidAt?: string; purchaseId?: string; orderId?: string } = {}): FakeRow {
  const text = (s: string) => [{ type: 'text', text: { content: s }, plain_text: s }];
  return {
    id: `page-${++pageSeq}`,
    created_time: (over.created ?? new Date(Date.now() - 20 * 60 * 1000)).toISOString(),
    properties: {
      'Order ID': { title: text(over.orderId ?? ORDER_ID) },
      Name: { rich_text: text('Siti Aminah') },
      Email: { email: 'siti@example.com' },
      Status: { select: { name: over.status ?? 'Pending' } },
      'CHIP purchase ID': { rich_text: over.purchaseId === '' ? [] : text(over.purchaseId ?? PURCHASE_ID) },
      'Paid at': { date: over.paidAt ? { start: over.paidAt } : null },
      Notes: { rich_text: [] },
    },
  };
}

export const status = (row: FakeRow) => row.properties.Status?.select?.name;
export const notes = (row: FakeRow) => (row.properties.Notes?.rich_text ?? []).map((t: any) => t.plain_text).join('');

/** A CHIP purchase as GET /purchases/{id}/ returns it, paid by default. */
export function purchase(over: Partial<ChipPurchase> & { total?: number } = {}): ChipPurchase {
  const { total = 8900, ...rest } = over;
  return {
    id: PURCHASE_ID,
    status: 'paid',
    is_test: true,
    brand_id: 'brand-123',
    reference: ORDER_ID,
    created_on: PAID_ON - 120,
    client: { email: 'siti@example.com', full_name: 'Siti Aminah', phone: '+60 123456789' },
    purchase: {
      currency: 'MYR',
      total,
      metadata: { order_id: ORDER_ID, product: 'autopost-threads', package: 'starter' },
      products: [{ name: 'Autopost Threads dengan AI (Starter)', price: total, category: 'autopost-threads/starter' }],
    },
    payment: { amount: total, currency: 'MYR', paid_on: PAID_ON },
    ...rest,
  };
}

export function makeEnv(overrides: Partial<WorkerEnv> = {}): WorkerEnv {
  return {
    ASSETS: { fetch: async () => new Response('asset') } as unknown as Fetcher,
    CHECKOUT_RATE_LIMIT: { limit: vi.fn(async () => ({ success: true })) },
    ENQUIRY_RATE_LIMIT: { limit: vi.fn(async () => ({ success: true })) },
    ALERT_RATE_LIMIT: { limit: vi.fn(async () => ({ success: true })) },
    CHIP_SECRET_KEY: 'test-secret',
    CHIP_BRAND_ID: 'brand-123',
    NOTION_TOKEN: 'notion-token',
    NOTION_ORDERS_DB: 'orders-db',
    NOTION_ENQUIRIES_DB: 'enquiries-db',
    MAKE_WEBHOOK_URL: MAKE_URL,
    MAKE_SHARED_SECRET: MAKE_SECRET,
    TELEGRAM_BOT_TOKEN: 'bot-token',
    TELEGRAM_ADMIN_CHAT_ID: '42',
    ...overrides,
  };
}

export function makeCtx() {
  const pending: Promise<unknown>[] = [];
  return { waitUntil: (p: Promise<unknown>) => void pending.push(p), settle: () => Promise.all(pending) };
}

export const callsTo = (world: World, service: 'chip' | 'notion' | 'telegram' | 'make') =>
  world.calls.filter((c) =>
    service === 'chip'
      ? c.url.startsWith('https://gate.chip-in.asia/')
      : service === 'notion'
        ? c.url.startsWith('https://api.notion.com/')
        : service === 'telegram'
          ? c.url.startsWith('https://api.telegram.org/')
          : c.url.startsWith(MAKE_URL),
  );

export const alerts = (world: World): string[] => callsTo(world, 'telegram').map((c) => c.body.text as string);
