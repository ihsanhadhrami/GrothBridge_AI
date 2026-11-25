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

export type OrderStatus = 'Pending' | 'Paid' | 'Delivered' | 'Failed' | 'Refunded' | 'Expired';

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

/**
 * Rich text. Notion caps one text object at 2,000 characters, so longer text
 * is split into several (up to 100, i.e. 200,000 characters).
 */
export function text(content: string): { type: 'text'; text: { content: string } }[] {
  const parts: { type: 'text'; text: { content: string } }[] = [];
  for (let i = 0; i < content.length && parts.length < 100; i += 2000) {
    parts.push({ type: 'text', text: { content: content.slice(i, i + 2000) } });
  }
  return parts;
}

/** The row the checkout writes (status Pending). */
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
export async function createOrderRow(
  token: string,
  databaseId: string,
  order: PendingOrder,
  /** Extra or replacement properties (the webhook creates a missing row as Paid). */
  overrides: Record<string, unknown> = {},
): Promise<string> {
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
      body: JSON.stringify({ parent: { database_id: databaseId }, properties: { ...orderRowProperties(order), ...overrides } }),
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

// ---------------------------------------------------------------------------
// Reading and updating order rows (webhook and cron).

/** One Orders row, as the Worker reads it. */
export interface OrderRow {
  pageId: string;
  orderId: string;
  status: string;
  chipPurchaseId: string;
  /** ISO time the row was created (Notion's created_time). */
  createdTime: string;
  /** ISO start of "Paid at", or null. */
  paidAt: string | null;
  notes: string;
}

function headers(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}`, 'notion-version': NOTION_VERSION, 'content-type': 'application/json' };
}

interface NotionPage {
  id: string;
  created_time: string;
  properties: Record<string, any>;
}

const plain = (rt: unknown): string =>
  Array.isArray(rt)
    ? rt.map((t: { plain_text?: string; text?: { content?: string } }) => t.plain_text ?? t.text?.content ?? '').join('')
    : '';

export function toOrderRow(page: NotionPage): OrderRow {
  const p = page.properties ?? {};
  return {
    pageId: page.id,
    orderId: plain(p['Order ID']?.title),
    status: p.Status?.select?.name ?? '',
    chipPurchaseId: plain(p['CHIP purchase ID']?.rich_text).trim(),
    createdTime: page.created_time,
    paidAt: p['Paid at']?.date?.start ?? null,
    notes: plain(p.Notes?.rich_text),
  };
}

export interface OrderQuery {
  rows: OrderRow[];
  hasMore: boolean;
}

/** POST /databases/{id}/query: one page of results, oldest first. */
export async function queryOrders(
  token: string,
  databaseId: string,
  filter: Record<string, unknown>,
  pageSize = 50,
): Promise<OrderQuery> {
  const res = await fetchWithTimeout(
    'Notion',
    `${NOTION_API}/databases/${databaseId}/query`,
    {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ filter, sorts: [{ timestamp: 'created_time', direction: 'ascending' }], page_size: pageSize }),
    },
    TIMEOUT_MS,
  );
  if (!res.ok) throw new UpstreamError('Notion', `query orders answered ${res.status}: ${await bodySnippet(res)}`, res.status);
  const data = (await res.json().catch(() => null)) as { results?: NotionPage[]; has_more?: boolean } | null;
  if (!data || !Array.isArray(data.results)) throw new UpstreamError('Notion', 'query orders answered without results');
  return { rows: data.results.map(toOrderRow), hasMore: data.has_more === true };
}

/** The row for an order id, or null if there is none. Throws if there are two. */
export async function findOrder(token: string, databaseId: string, orderId: string): Promise<OrderRow | null> {
  const { rows } = await queryOrders(token, databaseId, { property: 'Order ID', title: { equals: orderId } }, 5);
  const exact = rows.filter((r) => r.orderId === orderId);
  if (exact.length > 1) throw new UpstreamError('Notion', `${exact.length} Orders rows have Order ID ${orderId}; expected one`);
  return exact[0] ?? null;
}

/** PATCH /pages/{id} with the given properties. */
export async function updateOrder(token: string, pageId: string, properties: Record<string, unknown>): Promise<void> {
  const res = await fetchWithTimeout(
    'Notion',
    `${NOTION_API}/pages/${pageId}`,
    { method: 'PATCH', headers: headers(token), body: JSON.stringify({ properties }) },
    TIMEOUT_MS,
  );
  if (!res.ok) throw new UpstreamError('Notion', `update order ${pageId} answered ${res.status}: ${await bodySnippet(res)}`, res.status);
}

export const statusProp = (status: OrderStatus) => ({ Status: { select: { name: status } } });

/** Notes with one more line; the owner's own notes are kept. */
export function appendNote(existing: string, line: string): Record<string, unknown> {
  const notes = existing.trim() ? `${existing.trim()}\n${line}` : line;
  return { Notes: { rich_text: text(notes) } };
}

// ---------------------------------------------------------------------------
// Enquiries (Siap Pasang leads).

export interface EnquiryRow {
  name: string;
  email: string;
  /** E.164. */
  phone: string;
  business: string;
  /** The scope answers and the visitor's message, as one text. */
  message: string;
}

export function enquiryRowProperties(e: EnquiryRow): Record<string, unknown> {
  return {
    Name: { title: text(e.name) },
    Email: { email: e.email },
    Phone: { phone_number: e.phone },
    Business: { rich_text: e.business ? text(e.business) : [] },
    Message: { rich_text: text(e.message) },
    Status: { select: { name: 'New' } },
  };
}

/** Creates the Enquiries row (status New). Returns the page id; throws UpstreamError. */
export async function createEnquiryRow(token: string, databaseId: string, e: EnquiryRow): Promise<string> {
  const res = await fetchWithTimeout(
    'Notion',
    `${NOTION_API}/pages`,
    {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ parent: { database_id: databaseId }, properties: enquiryRowProperties(e) }),
    },
    TIMEOUT_MS,
  );
  if (!res.ok) throw new UpstreamError('Notion', `create enquiry row answered ${res.status}: ${await bodySnippet(res)}`, res.status);
  const data = (await res.json().catch(() => null)) as { id?: unknown } | null;
  if (!data || typeof data.id !== 'string') throw new UpstreamError('Notion', 'create enquiry row answered without a page id');
  return data.id;
}
