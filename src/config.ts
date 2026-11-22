/**
 * Pre-launch switch (CHIP merchant review). While false, the site takes no
 * payments: every "Beli" button reads "Pembayaran dibuka tidak lama lagi"
 * with a "Tanya melalui emel" mailto beside it, the Siap Pasang form opens
 * an email instead of posting, and nothing in the browser calls /api/*.
 * Turn on once checkout (Phase 2) is built and tested.
 */
export const PAYMENTS_ENABLED: boolean = false;
