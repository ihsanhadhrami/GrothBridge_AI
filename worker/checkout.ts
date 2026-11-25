import { getCheckoutPackage, getProduct } from '../src/data/products';
import { site } from '../src/data/site';
import { formatRM } from '../src/lib/money';
import { intlPhone, validateCheckout, type CheckoutInput, type FieldErrors } from '../src/lib/validate';
import { buildPurchase, createPurchase, type CreatedPurchase } from './chip';
import type { Ctx, WorkerEnv } from './env';
import { createOrderRow, type PendingOrder } from './notion';
import { newOrderId } from './order-id';
import { BODY_MESSAGES, checked, errorText, htmlPage, json, readBody, str } from './http';
import { sendAlert } from './telegram';

/**
 * POST /api/checkout
 *
 * 1. Rate limit: 10 per minute per IP (CHECKOUT_RATE_LIMIT binding).
 * 2. Validate the form with the same rules as the browser, and look up the
 *    package in src/data/products.ts. The price comes only from there;
 *    anything else in the body (a "price", "amount", …) is ignored.
 * 3. Create the CHIP purchase. If that fails, the buyer gets a Malay error
 *    and the owner a Telegram alert.
 * 4. Write the Pending row to Notion in the background (ctx.waitUntil), so
 *    the buyer isn't kept waiting on Notion. If it fails, checkout still
 *    goes ahead and the owner gets a Telegram alert with every detail
 *    needed to add the row by hand (Phase 3's webhook also rebuilds it).
 * 5. Answer { checkout_url } (fetch from the site), or 303 to it for a
 *    plain form post (no JavaScript).
 */

const MAX_BODY_BYTES = 8 * 1024;

export const MESSAGES = {
  invalid: 'Sila semak maklumat yang ditanda.',
  unknownPackage: 'Pakej ini tidak dijumpai. Muat semula halaman dan cuba lagi.',
  rateLimited: 'Terlalu banyak cubaan. Tunggu seminit, kemudian cuba lagi.',
  ...BODY_MESSAGES,
  notOpen: `Pembayaran belum dibuka. Sila emel ${site.email} untuk membeli.`,
  chipFailed: `Maaf, halaman bayaran tidak dapat dibuka sekarang. Cuba lagi sebentar, atau emel ${site.email}.`,
} as const;

interface ErrorBody {
  error: string;
  errors?: FieldErrors;
}

export async function handleCheckout(request: Request, env: WorkerEnv, ctx: Ctx): Promise<Response> {
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  const { success } = await env.CHECKOUT_RATE_LIMIT.limit({ key: `checkout:${ip}` });

  const parsed = await readBody(request, MAX_BODY_BYTES);
  const asForm = parsed.form;
  if (!success) return reply(asForm, 429, { error: MESSAGES.rateLimited });
  if ('status' in parsed) return reply(asForm, parsed.status, { error: parsed.error });

  const input = toCheckoutInput(parsed.fields);
  const back = getProduct(input.product) ? `/produk/${input.product}#beli` : '/';
  const errors = validateCheckout(input);
  if (Object.keys(errors).length > 0) return reply(asForm, 400, { error: MESSAGES.invalid, errors }, back);

  const pkg = getCheckoutPackage(input.product, input.package);
  if (!pkg) return reply(asForm, 400, { error: MESSAGES.unknownPackage }, back);

  if (!env.CHIP_SECRET_KEY || !env.CHIP_BRAND_ID) {
    ctx.waitUntil(sendAlert(env, 'Checkout refused: CHIP_SECRET_KEY or CHIP_BRAND_ID is not set on the Worker.'));
    return reply(asForm, 503, { error: MESSAGES.notOpen }, back);
  }

  const orderId = newOrderId();
  const phone = intlPhone(input.phone);
  const buyer = { name: input.name.trim(), email: input.email.trim().toLowerCase() };
  const summary = [
    `Order: ${orderId}`,
    `Package: ${pkg.product.slug} / ${pkg.id} (${formatRM(pkg.priceSen)})`,
    `Buyer: ${buyer.name}, ${buyer.email}, ${phone.e164}`,
  ];

  let purchase: CreatedPurchase;
  try {
    purchase = await createPurchase(
      env.CHIP_SECRET_KEY,
      buildPurchase({
        brandId: env.CHIP_BRAND_ID,
        orderId,
        product: pkg.product,
        pkg,
        buyer: { ...buyer, phone: phone.chip },
      }),
    );
  } catch (err) {
    ctx.waitUntil(sendAlert(env, ['Checkout failed: the CHIP purchase was not created.', ...summary, `Error: ${errorText(err)}`].join('\n')));
    return reply(asForm, 502, { error: MESSAGES.chipFailed }, back);
  }

  const order: PendingOrder = {
    orderId,
    ...buyer,
    phone: phone.e164,
    productSlug: pkg.product.slug,
    packageId: pkg.id,
    amountSen: pkg.priceSen,
    chipPurchaseId: purchase.id,
    isTest: purchase.isTest,
  };
  ctx.waitUntil(writeOrderRow(env, order, [...summary, `CHIP purchase: ${purchase.id}${purchase.isTest ? ' (test)' : ''}`]));

  if (asForm) return new Response(null, { status: 303, headers: { location: purchase.checkoutUrl, 'cache-control': 'no-store' } });
  return json({ checkout_url: purchase.checkoutUrl }, 200);
}

async function writeOrderRow(env: WorkerEnv, order: PendingOrder, summary: string[]): Promise<void> {
  try {
    if (!env.NOTION_TOKEN || !env.NOTION_ORDERS_DB) throw new Error('NOTION_TOKEN or NOTION_ORDERS_DB is not set on the Worker');
    await createOrderRow(env.NOTION_TOKEN, env.NOTION_ORDERS_DB, order);
  } catch (err) {
    await sendAlert(
      env,
      [
        'Notion: the Pending order row was NOT written. Checkout went ahead; add the row by hand.',
        ...summary,
        `Error: ${errorText(err)}`,
      ].join('\n'),
    );
  }
}

/** Only the fields we know, as strings. A checkbox posts "on". */
export function toCheckoutInput(fields: Record<string, unknown>): CheckoutInput {
  return {
    product: str(fields.product),
    package: str(fields.package),
    name: str(fields.name),
    email: str(fields.email),
    phone: str(fields.phone),
    consent: checked(fields.consent),
  };
}

/** JSON for the site's fetch; a small Malay page for a plain form post. */
function reply(asForm: boolean, status: number, body: ErrorBody, back = '/'): Response {
  if (!asForm) return json(body, status);
  const items = Object.values(body.errors ?? {}).filter((e): e is string => typeof e === 'string');
  return htmlPage(status, 'Pembayaran belum dimulakan', body.error, items, back, 'Kembali ke borang');
}
