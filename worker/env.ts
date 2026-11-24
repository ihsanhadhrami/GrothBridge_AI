/**
 * Secrets, set with `wrangler secret put <NAME>` in production and in
 * .dev.vars locally (gitignored). They are never in wrangler.jsonc or the
 * repo. Optional here because a Worker without them must still serve the
 * site; each handler checks the ones it needs and fails loudly.
 *
 * Phase 3 adds use of CHIP_PUBLIC_KEY, NOTION_ENQUIRIES_DB, MAKE_WEBHOOK_URL
 * and MAKE_SHARED_SECRET.
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
