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

/** The parts of a CHIP Purchase the webhook and the cron read. */
export interface ChipPurchase {
  id: string;
  status: string;
  is_test?: boolean;
  brand_id?: string;
  reference?: string;
  created_on?: number;
  client?: { email?: string; full_name?: string; phone?: string };
  purchase?: {
    currency?: string;
    total?: number;
    metadata?: Record<string, unknown> | null;
    products?: { name?: string; price?: number; category?: string }[];
  };
  /** null while unpaid. paid_on is Unix seconds. */
  payment?: { amount?: number; currency?: string; paid_on?: number | null } | null;
}

/** GET /purchases/{id}/. Throws UpstreamError (status 404 if CHIP doesn't know the id). */
export async function getPurchase(secretKey: string, purchaseId: string): Promise<ChipPurchase> {
  if (!/^[0-9a-f-]{36}$/i.test(purchaseId)) throw new UpstreamError('CHIP', `"${purchaseId}" is not a CHIP purchase id`);
  const res = await fetchWithTimeout(
    'CHIP',
    `${CHIP_API}/purchases/${purchaseId}/`,
    { headers: { authorization: `Bearer ${secretKey}`, accept: 'application/json' } },
    TIMEOUT_MS,
  );
  if (!res.ok) {
    throw new UpstreamError('CHIP', `get purchase ${purchaseId} answered ${res.status}: ${await bodySnippet(res, 200)}`, res.status);
  }
  const data = (await res.json().catch(() => null)) as ChipPurchase | null;
  if (!data || data.id !== purchaseId || typeof data.status !== 'string') {
    throw new UpstreamError('CHIP', `get purchase ${purchaseId} answered without the purchase`);
  }
  return data;
}

/**
 * The company public key that verifies success_callback signatures
 * (GET /public_key/, a JSON-encoded PEM string). Webhooks set up in the CHIP
 * portal use their own key instead, which is CHIP_PUBLIC_KEY. Cached for the
 * life of the isolate, per secret key.
 */
let companyKeyCache: { secretKey: string; pem: Promise<string> } | null = null;

export function getCompanyPublicKey(secretKey: string): Promise<string> {
  if (companyKeyCache?.secretKey === secretKey) return companyKeyCache.pem;
  const pem = fetchCompanyPublicKey(secretKey);
  companyKeyCache = { secretKey, pem };
  pem.catch(() => {
    if (companyKeyCache?.pem === pem) companyKeyCache = null; // retry next time
  });
  return pem;
}

async function fetchCompanyPublicKey(secretKey: string): Promise<string> {
  const res = await fetchWithTimeout(
    'CHIP',
    `${CHIP_API}/public_key/`,
    { headers: { authorization: `Bearer ${secretKey}`, accept: 'application/json' } },
    TIMEOUT_MS,
  );
  if (!res.ok) throw new UpstreamError('CHIP', `get public key answered ${res.status}: ${await bodySnippet(res, 200)}`, res.status);
  const pem = (await res.json().catch(() => null)) as unknown;
  if (typeof pem !== 'string' || !pem.includes('BEGIN PUBLIC KEY')) {
    throw new UpstreamError('CHIP', 'get public key answered without a PEM string');
  }
  return pem;
}

/** For tests: forget the cached company key. */
export function resetCompanyKeyCache(): void {
  companyKeyCache = null;
}
