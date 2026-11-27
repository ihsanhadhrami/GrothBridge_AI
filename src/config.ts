/**
 * Two launch switches, flipped independently.
 *
 * PAYMENTS_ENABLED: checkout on the product page. While false (pre-launch,
 * CHIP merchant review), every "Beli" button reads "Pembayaran dibuka tidak
 * lama lagi" with a "Tanya melalui emel" mailto beside it, and the browser
 * never calls /api/checkout. POST /api/checkout is built and tested in CHIP
 * test mode (Phase 2); turn this on once the Worker has the CHIP secrets.
 */
export const PAYMENTS_ENABLED: boolean = false;

/**
 * ENQUIRY_API_ENABLED: the Siap Pasang form. While false, the form opens the
 * visitor's email app with the details filled in, and the browser never calls
 * /api/enquiry. POST /api/enquiry is built (Phase 3); turn this on once the
 * Worker has NOTION_ENQUIRIES_DB, NOTION_TOKEN and the Telegram secrets.
 */
export const ENQUIRY_API_ENABLED: boolean = false;
