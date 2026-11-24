import { bodySnippet, fetchWithTimeout, UpstreamError } from './upstream';

/**
 * Notion Orders database (property names and types as set up in Notion;
 * this code only writes rows, it never changes the database).
 * The Worker is the only thing that creates order rows; Make only updates them.
 */
const NOTION_API = 'https://api.notion.com/v1';
// The API version with `parent: { database_id }`; it works for a database
// with one data source, which Orders is.
const NOTION_VERSION = '2022-06-28';
const TIMEOUT_MS = 6000;

export interface PendingOrder {
  orderId: string;
  name: string;
  email: string;
  /** E.164, "+60123456789". */
  phone: string;
  productSlug: string;
  packageId: string;
  amountSen: number;
  chipPurchaseId: string;
  isTest: boolean;
}

const text = (content: string) => [{ type: 'text', text: { content: content.slice(0, 2000) } }];

export function orderRowProperties(order: PendingOrder): Record<string, unknown> {
  return {
    'Order ID': { title: text(order.orderId) },
    Name: { rich_text: text(order.name) },
    Email: { email: order.email },
    Phone: { phone_number: order.phone },
    Product: { select: { name: order.productSlug } },
    Package: { select: { name: order.packageId } },
    'Amount (RM)': { number: order.amountSen / 100 },
    Status: { select: { name: 'Pending' } },
    'CHIP purchase ID': { rich_text: text(order.chipPurchaseId) },
    Notes: { rich_text: order.isTest ? text('CHIP test mode (not a real payment).') : [] },
  };
}

/** Creates the Pending row. Returns the Notion page id; throws UpstreamError. */
export async function createOrderRow(token: string, databaseId: string, order: PendingOrder): Promise<string> {
  const res = await fetchWithTimeout(
    'Notion',
    `${NOTION_API}/pages`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'notion-version': NOTION_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ parent: { database_id: databaseId }, properties: orderRowProperties(order) }),
    },
    TIMEOUT_MS,
  );
  if (!res.ok) {
    throw new UpstreamError('Notion', `create order row answered ${res.status}: ${await bodySnippet(res)}`, res.status);
  }
  const data = (await res.json().catch(() => null)) as { id?: unknown } | null;
  if (!data || typeof data.id !== 'string') throw new UpstreamError('Notion', 'create order row answered without a page id');
  return data.id;
}
