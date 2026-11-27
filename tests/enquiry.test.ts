import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ENQUIRY_MESSAGES, handleEnquiry } from '../worker/enquiry';
import { alerts, callsTo, makeCtx, makeEnv, makeWorld, type World } from './fakes';

/** POST /api/enquiry against the fake world. */

let world: World;

beforeEach(async () => {
  world = await makeWorld();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const form = {
  name: ' Ahmad Zaki ',
  email: 'Zaki@Example.com',
  phone: '019-876 5432',
  business: 'Kedai Kek Zaki',
  threads: '@kekzaki',
  accounts: '2',
  media: 'Ya',
  writing: 'Tidak',
  message: 'Saya mahu post resipi kek setiap hari secara automatik.',
  consent: true,
};

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request('https://growthbridge.my/api/enquiry', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.9', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function run(req: Request, env = makeEnv()) {
  const ctx = makeCtx();
  const res = await handleEnquiry(req, env, ctx);
  await ctx.settle();
  return res;
}

describe('POST /api/enquiry', () => {
  it('saves to Notion Enquiries (New) and alerts the owner', async () => {
    const res = await run(post(form));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const [row] = world.enquiries;
    const p = row!.properties;
    expect(callsTo(world, 'notion')[0]!.body.parent).toEqual({ database_id: 'enquiries-db' });
    expect(p.Name.title[0].plain_text).toBe('Ahmad Zaki');
    expect(p.Email).toEqual({ email: 'zaki@example.com' });
    expect(p.Phone).toEqual({ phone_number: '+60198765432' });
    expect(p.Business.rich_text[0].plain_text).toBe('Kedai Kek Zaki');
    expect(p.Status).toEqual({ select: { name: 'New' } });
    const message = p.Message.rich_text.map((t: { plain_text: string }) => t.plain_text).join('');
    expect(message).toBe(
      [
        'Threads: @kekzaki',
        'Bilangan akaun Threads: 2',
        'Perlu post bergambar/video?: Ya',
        'Perlu bantuan menulis kandungan?: Tidak',
        '',
        'Saya mahu post resipi kek setiap hari secara automatik.',
      ].join('\n'),
    );
    expect(alerts(world)[0]).toMatch(/New Siap Pasang enquiry \(saved in Notion[\s\S]*Ahmad Zaki[\s\S]*resipi kek/);
  });

  it('field errors come back in Malay, nothing saved', async () => {
    const res = await run(post({ ...form, email: 'nope', accounts: '0', message: 'hi', consent: false }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; errors: Record<string, string> };
    expect(body.error).toBe(ENQUIRY_MESSAGES.invalid);
    expect(Object.keys(body.errors).sort()).toEqual(['accounts', 'consent', 'email', 'message']);
    expect(world.enquiries).toHaveLength(0);
  });

  it('a made-up radio value is refused', async () => {
    const res = await run(post({ ...form, media: 'Mungkin' }));
    expect(res.status).toBe(400);
  });

  it('Notion down: still accepted, because the Telegram alert carries the whole enquiry', async () => {
    world.override.notion = () => new Response('busy', { status: 503 });
    const res = await run(post(form));
    expect(res.status).toBe(200);
    expect(alerts(world)[0]).toMatch(/NOT saved in Notion[\s\S]*only copy[\s\S]*zaki@example.com[\s\S]*resipi kek/);
  });

  it('Notion and Telegram both down: 502 with the email address to use', async () => {
    world.override.notion = () => new Response('busy', { status: 503 });
    world.override.telegram = () => new Response('nope', { status: 500 });
    const res = await run(post(form));
    expect(res.status).toBe(502);
    expect(((await res.json()) as { error: string }).error).toBe(ENQUIRY_MESSAGES.failed);
  });

  it('rate-limited: 429', async () => {
    const env = makeEnv({ ENQUIRY_RATE_LIMIT: { limit: vi.fn(async () => ({ success: false })) } });
    const res = await run(post(form), env);
    expect(res.status).toBe(429);
    expect(world.enquiries).toHaveLength(0);
    expect(env.ENQUIRY_RATE_LIMIT.limit).toHaveBeenCalledWith({ key: 'enquiry:203.0.113.9' });
  });

  it('plain form post (no JavaScript): a Malay thank-you page', async () => {
    const body = new URLSearchParams({ ...form, consent: 'on' }).toString();
    const res = await run(post(body, { 'content-type': 'application/x-www-form-urlencoded' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    expect(await res.text()).toMatch(/Pertanyaan diterima/);
  });

  it('bad bodies: 415 and 413', async () => {
    expect((await run(post('x', { 'content-type': 'text/plain' }))).status).toBe(415);
    expect((await run(post({ ...form, message: 'x'.repeat(20000) }))).status).toBe(413);
  });
});
