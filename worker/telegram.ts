import type { Secrets } from './env';
import { bodySnippet, fetchWithTimeout } from './upstream';

const TIMEOUT_MS = 5000;
const MAX_LENGTH = 4000; // Telegram's limit is 4096 characters.

/**
 * Sends an alert to the owner's Telegram chat. Never throws: if Telegram
 * itself fails or isn't configured, the alert goes to the Worker log
 * (Workers Logs, observability is on) so nothing fails silently.
 * Resolves true only when Telegram accepted the message (the enquiry
 * handler needs to know whether the owner really got it).
 */
export async function sendAlert(env: Secrets, text: string): Promise<boolean> {
  const message = text.length > MAX_LENGTH ? `${text.slice(0, MAX_LENGTH)}…` : text;
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_ADMIN_CHAT_ID) {
    console.error('[alert] Telegram is not configured. Alert was:', message);
    return false;
  }
  try {
    const res = await fetchWithTimeout(
      'Telegram',
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // Plain text (no parse_mode), so names and error bodies need no escaping.
        body: JSON.stringify({ chat_id: env.TELEGRAM_ADMIN_CHAT_ID, text: message, disable_web_page_preview: true }),
      },
      TIMEOUT_MS,
    );
    if (!res.ok) {
      console.error(`[alert] Telegram answered ${res.status}: ${await bodySnippet(res, 200)}. Alert was:`, message);
      return false;
    }
    return true;
  } catch (err) {
    // The bot token is part of the URL; keep it out of the log in case an error message quotes the URL.
    const reason = (err instanceof Error ? err.message : String(err)).replaceAll(env.TELEGRAM_BOT_TOKEN, '***');
    console.error(`[alert] ${reason}. Alert was:`, message);
    return false;
  }
}
