import type { CheckoutPackage, Product } from '../src/data/products';
import { site } from '../src/data/site';
import { bodySnippet, fetchWithTimeout, UpstreamError } from './upstream';

/**
 * CHIP Collect (https://docs.chip-in.asia). Test or live mode is decided by
 * the secret key alone: same endpoint, and the purchase comes back with
 * is_test true for a test key.
 */
export const CHIP_API = 'https://gate.chip-in.asia/api/v1';
/** checkout_url lives here; the CSP form-action allows it (worker/index.ts). */
export const CHIP_CHECKOUT_ORIGIN = 'https://gate.chip-in.asia';

const TIMEOUT_MS = 10000;

export interface Buyer {
  name: string;
  email: string;
  /** "+60 123456789", CHIP's format. */
  phone: string;
}

export interface PurchaseBody {
  brand_id: string;
  reference: string;
  client: { email: string; full_name: string; phone: string };
  purchase: {
    currency: 'MYR';
    products: { name: string; price: number; quantity: string; category: string }[];
    metadata: { order_id: string; product: string; package: string };
  };
  success_redirect: string;
  failure_redirect: string;
  cancel_redirect: string;
  success_callback: string;
  send_receipt: boolean;
  platform: 'web';
  creator_agent: string;
}

/**
 * The purchase for one order. The price comes only from the products file
 * (via `pkg`). Everything Phase 3's webhook needs to rebuild a missing Notion
 * row is on the purchase: buyer name, email and phone, reference = order id,
 * and the product and package (metadata, plus category on the line).
 */
export function buildPurchase(args: {
  brandId: string;
  orderId: string;
  product: Product;
  pkg: CheckoutPackage;
  buyer: Buyer;
}): PurchaseBody {
  const { brandId, orderId, product, pkg, buyer } = args;
  const productPage = `${site.url}/produk/${product.slug}?pakej=${encodeURIComponent(pkg.id)}#beli`;
  return {
    brand_id: brandId,
    reference: orderId,
    client: { email: buyer.email, full_name: buyer.name, phone: buyer.phone },
    purchase: {
      currency: 'MYR',
      products: [
        {
          name: `${product.name} (${pkg.name})`,
          price: pkg.priceSen,
          quantity: '1', // CHIP documents quantity as a decimal string.
          category: `${product.slug}/${pkg.id}`,
        },
      ],
      metadata: { order_id: orderId, product: product.slug, package: pkg.id },
    },
    success_redirect: `${site.url}/terima-kasih`,
    failure_redirect: productPage,
    cancel_redirect: productPage,
    success_callback: `${site.url}/api/webhooks/chip`,
    send_receipt: false, // Make sends the invoice (Phase 5).
    platform: 'web',
    creator_agent: 'growthbridge.my',
  };
}

export interface CreatedPurchase {
  id: string;
  checkoutUrl: string;
  isTest: boolean;
}

/** POST /purchases/. Throws UpstreamError on any failure or unexpected answer. */
export async function createPurchase(secretKey: string, body: PurchaseBody): Promise<CreatedPurchase> {
  const res = await fetchWithTimeout(
    'CHIP',
    `${CHIP_API}/purchases/`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${secretKey}`, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
    },
    TIMEOUT_MS,
  );
  if (!res.ok) {
    throw new UpstreamError('CHIP', `create purchase answered ${res.status}: ${await bodySnippet(res)}`, res.status);
  }
  const data = (await res.json().catch(() => null)) as {
    id?: unknown;
    checkout_url?: unknown;
    is_test?: unknown;
    purchase?: { total?: unknown };
  } | null;
  if (
    !data ||
    typeof data.id !== 'string' ||
    typeof data.checkout_url !== 'string' ||
    !data.checkout_url.startsWith(`${CHIP_CHECKOUT_ORIGIN}/`)
  ) {
    throw new UpstreamError('CHIP', 'create purchase answered without a usable id and checkout_url');
  }
  // CHIP computes the total itself; it must equal our price.
  const expected = body.purchase.products.reduce((sum, p) => sum + p.price, 0);
  if (data.purchase?.total !== undefined && data.purchase.total !== expected) {
    throw new UpstreamError('CHIP', `purchase ${data.id} total ${String(data.purchase.total)} ≠ expected ${expected} sen`);
  }
  return { id: data.id, checkoutUrl: data.checkout_url, isTest: data.is_test === true };
}
