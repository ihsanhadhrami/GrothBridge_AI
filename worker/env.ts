/**
 * Secrets, set with `wrangler secret put <NAME>` in production and in
 * .dev.vars locally (gitignored). They are never in wrangler.jsonc or the
 * repo. Optional here because a Worker without them must still serve the
 * site; each handler checks the ones it needs and fails loudly.
 *
 * CHIP_PUBLIC_KEY is the public key of the webhook set up in the CHIP portal
 * (needed for payment.refunded). success_callback is checked with CHIP's
 * company key, which the Worker fetches itself (GET /public_key/), so the
 * paid path works without CHIP_PUBLIC_KEY.
 */
export interface Secrets {
  CHIP_SECRET_KEY?: string;
  CHIP_BRAND_ID?: string;
  CHIP_PUBLIC_KEY?: string;
  NOTION_TOKEN?: string;
  NOTION_ORDERS_DB?: string;
  NOTION_ENQUIRIES_DB?: string;
  MAKE_WEBHOOK_URL?: string;
  MAKE_SHARED_SECRET?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_ADMIN_CHAT_ID?: string;
}

/** Bindings from wrangler.jsonc (generated `Env`) plus the secrets. */
export type WorkerEnv = Env & Secrets;

/** The part of ExecutionContext the handlers use (easy to fake in tests). */
export interface Ctx {
  waitUntil(promise: Promise<unknown>): void;
}
