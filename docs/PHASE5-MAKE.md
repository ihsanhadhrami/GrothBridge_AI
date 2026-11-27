# Phase 5 build spec: Make + Notion delivery

Written 2026-11-27 from the Worker code as deployed (version `536cc2e4`). Use it to build Phase 5 in Claude chat with the Make and Notion connectors (docs/PLAN.md, "Phase 5"). Nothing in this repo changes Make or Notion.

Build one scenario at a time, test it with the scenario off or on a test order, and switch it on only when the owner says so.

## 0. Before building anything

1. **Clear the queue on the `growthbridge-orders` webhook** (folder `growthbridge.my`). It holds test events: ZF8Y `paid` (re-sent every 15 minutes), ZF8Y `refunded`, and Y64K `paid`. If the queue is not cleared before Delivery goes on, those test orders get delivered to growthbridge.biz@gmail.com.
2. **In Notion, set ZF8Y (`GB-20261127164618-ZF8Y`) to Refunded by hand.** It was refunded in CHIP. Until that is done, every cron run alerts "Paid in Notion, but CHIP now says refunded". Y64K has been, or will be, set to Failed by the cron; leave it.
3. **Leave the existing autopost (Threads) scenario alone.** No shared modules, no shared connections, no edits.
4. **Check the Notion Orders property names** against this spec. The Worker writes these: `Order ID` (title), `Name`, `Email`, `Phone`, `Product` (select, slug), `Package` (select, id), `Amount (RM)` (number), `Status` (select), `CHIP purchase ID`, `Paid at` (date), `Notes`. From PLAN.md, Make also needs `Invoice no.`, `Telegram invite`, and the checkboxes `Resend access`, `Release runbook` and `Revoke access`. Don't change the database. If a name differs, use the real one.
5. **Secrets.** The owner types every secret into Make: connections, the shared secret, the Telegram admin chat id. They are never pasted into chat.

## 1. What the Worker sends

One custom webhook (`MAKE_WEBHOOK_URL`) receives two kinds of event. The Worker sends one only after it has verified it with CHIP: the RSA signature, a fresh fetch of the purchase, our brand, the order id, and the amount = the price in `src/data/products.ts`.

```
POST <MAKE_WEBHOOK_URL>
content-type: application/json
x-gb-signature: <lowercase hex HMAC-SHA256(raw body, MAKE_SHARED_SECRET)>

{
  "event": "paid" | "refunded",
  "order_id": "GB-20261127164618-ZF8Y",
  "chip_purchase_id": "…",
  "amount": 8900,               // sen. Use this; never hard-code a price in Make
  "email": "buyer@example.com",  // lower-cased
  "name": "…",
  "phone": "+60123456789",       // E.164
  "product": "autopost-threads", // slug
  "package": "starter" | "masterclass",
  "paid_at": "2026-11-27T08:51:00.000Z", // ISO, UTC
  "is_test": true,
  "refunded_amount": 8900        // refunded only, sen; can be less than amount
}
```

How the Worker behaves, and what Make must allow for:

- **The Worker treats only HTTP 200 as success.** For anything else (or no answer within 15 s) it answers CHIP 500 and alerts, and CHIP retries.
- **The same `paid` event arrives more than once.** CHIP retries, and the Worker's cron re-sends every row that is still `Paid` 15 minutes after payment, every 15 minutes for 24 hours (then sets it Failed). **Delivery must check the Notion status and run once.**
- **The Worker sets the row to `Paid` before it calls Make.** Make only updates rows; it never creates them.
- The Worker doesn't send a `paid` event for a row that is already Delivered, Failed or Refunded. It doesn't send `refunded` for a row that is already Refunded.
- For `refunded`, the Worker doesn't touch the row. Make sets Refunded.
- If the scenario is off, Make still answers 200 and queues the event. The Worker can't tell the difference; the cron's re-sends add more items to the queue.

## 2. Make setup

All of this goes in the `growthbridge.my` folder, with new connections used only by these scenarios.

- **Connections (made by the owner):**
  - Google Drive, Google Docs and Gmail on the Growth Bridge Google account
  - Notion, shared with Orders only
  - Telegram Bot, with the bot that is admin of the support group
- **Webhook `growthbridge-orders` options:** turn on **Get request headers** and **JSON pass-through**. The HMAC needs the raw body exactly as sent; a parsed and re-serialised body won't match. If the hook can't be changed, make a new one. Its URL then changes, and the owner runs `npx wrangler secret put MAKE_WEBHOOK_URL` and updates `.dev.vars`.
- **Shared secret:** a team custom variable `GB_SHARED_SECRET`, if the Make plan has custom variables. Otherwise it goes in the formula of the check module, where anyone with access to the scenario can see it. The value is `MAKE_SHARED_SECRET` from `.dev.vars`, entered by the owner.
- **Data store `gb-invoice-counter`:** key = text, field `last` (number). Two records: `live` (`last` = 0) and `test` (`last` = 0), so test orders don't use up real invoice numbers.
- **Telegram values (entered by the owner):**
  - `GB_SUPPORT_CHAT_ID`: the support group, a negative number starting with -100
  - `GB_ADMIN_CHAT_ID`: the owner's private chat; the same value as the Worker's `TELEGRAM_ADMIN_CHAT_ID`
- **Drive (owner, ready):** `Produk/Autopost Threads`. Recommended: two subfolders, so one share covers each bundle and later file updates.
  - `Starter`: the manual PDF and the video
  - `Runbook`: the runbook PDF and MD
  - All Restricted, with downloading off for viewers.
  - Add an `Invois` folder for the invoice PDFs. They are kept 7 years (privacy notice).

### Checking the signature in Make

With JSON pass-through on, the raw body is the webhook's `value`. The check is:

```
sha256({{1.value}}; "hex"; {{var.team.GB_SHARED_SECRET}})
  = get(map({{1.headers}}; "value"; "name"; "x-gb-signature"); 1)
```

Make's `sha256(text; encoding; key)` gives an HMAC when a key is given. Check the formula with this test vector before using the real secret:

- secret `not-the-real-secret`
- body `{"event":"paid","order_id":"GB-20261127164618-TEST"}`
- expected `64cb9c50156d01bd8900a5c3f284468cb202b0a36579b169b03f426d5d2c774d`

## 3. Scenario 1: Orders webhook (Delivery + Refund)

Trigger: webhook `growthbridge-orders`, instant. **Sequential processing ON**, so the invoice counter and the duplicate check can't race. **"Allow storing of incomplete executions" OFF.** With sequential processing on, one stored incomplete execution stops every later order.

1. **Webhook trigger.**
2. **Router, signature check.**
   - **Bad signature** (filter: the check above is false):
     - Webhook response 401.
     - Telegram to `GB_ADMIN_CHAT_ID`: "Make: request to the orders webhook with a bad signature. Nothing done." No body content.
     - Stop.
   - **Good signature:** continue.
3. **Webhook response 200.** Put it this early so the Worker gets its answer within its 15 s. While a delivery runs (about 30 s), a second order waits in line. If that wait goes past 15 s, the Worker answers CHIP 500 and CHIP retries. That's harmless, because step 5 stops duplicates.
4. **Parse JSON** on `value`.
5. **Notion: search Orders** where `Order ID` = `order_id`. Exactly one row, or Telegram alert and stop.
6. **Router on `event`.**

### Route A: `paid` (Delivery)

Filters, checked before any work (filters cost no operations). If any fails, stop.

- Status = **Paid**. This is the run-once rule. Delivered, Refunded, Failed and Expired all stop.
- The row's `CHIP purchase ID` = `chip_purchase_id`.
- The row's `Amount (RM)` × 100 = `amount`.

Steps:

1. **Invoice number.**
   - If the row already has `Invoice no.` (a retry after a part-failed run), reuse it.
   - Otherwise:
     1. Get the data store record (key = `if(is_test; "test"; "live")`).
     2. next = `last` + 1. Update the record.
     3. Write `Invoice no.` to the Notion row **straight away**, so a retry never takes a second number.
   - Format: see Open decision 1. Test numbers carry a `TEST-` prefix.
2. **Drive: share** the `Starter` folder with `email` as Viewer, **notification email off**.
   - Sharing again is harmless.
   - A non-Google email fails here: see Open decision 2.
3. **Telegram invite.**
   - If the row already has `Telegram invite`, reuse it.
   - Otherwise, Telegram "Make an API call" `createChatInviteLink`, then write the link to `Telegram invite` straight away:
     - `chat_id` = `GB_SUPPORT_CHAT_ID`
     - `member_limit` = 1
     - `expire_date` = `formatDate(addDays(now; 7); "X")`
     - `name` = `order_id`
4. **Invoice PDF.**
   1. Google Docs "Create a document from a template" with these values:
      - `{{invoice_no}}`
      - `{{name}}`
      - `{{email}}`
      - `{{package}}`: the display name, see the table below
      - `{{amount}}`: `"RM" + formatNumber(amount / 100; 2; "."; ",")`
      - `{{date}}`: `paid_at` in Malaysia time, D Month YYYY, with Malay month names (Januari, Februari, Mac, April, Mei, Jun, Julai, Ogos, September, Oktober, November, Disember)
   2. Drive "Download a file" as PDF. Save it as `Invois/<invoice_no>.pdf`.
5. **Gmail** to `email`, with the invoice PDF attached (copy in section 7).
   - Subject: `Akses Autopost Threads: <Package> (<order_id>)`
   - Test orders put `[UJIAN] ` in front.
   - Masterclass adds the booking link (Open decision 3).
6. **Notion update:**
   - Status **Delivered**.
   - `Invoice no.` and `Telegram invite` (already set).
   - Add a line to Notes: "Make: delivered <date/time>".

Package display names:

| `package` | Display name |
| --- | --- |
| `starter` | Starter |
| `masterclass` | Masterclass |

These names live in `src/data/products.ts`; see Open decision 4 for avoiding this second copy.

**Error handler** on steps 1–6 (use Ignore, not Break):

- Notion: Status **Failed**, and a Notes line "Make: delivery failed at <module>: <error>".
- Telegram to `GB_ADMIN_CHAT_ID`, with the order id, the step and the error.

Once a row is Failed, the Worker stops re-sending it. To retry:

- Within 24 h of payment: fix the cause, then set the Status back to Paid. The cron re-sends it within 15 minutes, and steps 1 and 3 reuse what was already made.
- After 24 h: tick **Resend access** (Scenario 2).

### Route B: `refunded`

- **Full refund** (`refunded_amount` = `amount`):
  1. Drive: list the permissions on `Starter` and on `Runbook`, and delete the ones for `email`.
  2. Telegram `revokeChatInviteLink` with the stored `Telegram invite`.
  3. Notion: Status **Refunded**, untick `Revoke access`, Notes "Make: refunded RMx, access removed <date>".
  4. Telegram to the owner. A buyer who has already joined the group must be removed by hand: see Open decision 5.
- **Partial refund** (`refunded_amount` < `amount`), for example a Masterclass session cancelled 48 h ahead (RM170):
  - **Don't remove access.** The Refund Policy says the Starter materials stay with the buyer.
  - Leave the Status as it is. Add a Notes line "Make: partial refund RMx <date>". Telegram to the owner.
- Status already Refunded: stop.
- Error handler: Telegram to the owner, with the order id and the error. Don't change the Status.

## 4. Scenario 2: Resend access (on demand)

Trigger: Run once. Search Orders where `Resend access` is ticked.

For each row:

1. Make a new Telegram invite: the same call as in Route A, step 3. Write it to `Telegram invite`.
2. Share the `Starter` folder again. Masterclass: share `Runbook` too, if it was released (Notes say so).
3. Send the same email again, with the invoice PDF found in `Invois/<Invoice no.>.pdf`. If the row has no invoice yet (it failed before step 1), run Route A's invoice steps first.
4. Untick `Resend access`. If the Status was Failed or Paid, set it to Delivered. Add a Notes line "Make: resent <date>".

## 5. Scenario 3: Release runbook (on demand)

Trigger: Run once. Search Orders where `Release runbook` is ticked, Package = masterclass, and Status = Delivered.

For each row:

1. Share the `Runbook` folder with `email` (Viewer, notification off).
2. Send the runbook email (section 7).
3. Untick `Release runbook`. Add a Notes line "Make: runbook released <date>". There is no date property for this; see PLAN.md, "log the date".

## 6. Scenario 4: Revoke access (on demand)

Trigger: Run once. Search Orders where `Revoke access` is ticked. Use it for a refund made in the CHIP portal whose webhook was missed, or for any revoke by hand (PROGRESS.md: "refund in CHIP, then tick Revoke access straight away").

For each row, the steps are those of Route B, full refund: remove the Drive permissions, revoke the invite, then untick. Set Status **Refunded** only if CHIP shows it refunded; otherwise keep the Status and add a Notes line.

## 7. Email copy (Bahasa Melayu, for the owner to approve)

These are drafts for the owner to edit. Every fact in them comes from the live site: support hours, 14 days, 60 days, the 7-day invite.

**Delivery (Starter):**

> Salam {{name}},
>
> Terima kasih kerana membeli Autopost Threads dengan AI (Starter). Nombor pesanan anda: {{order_id}}.
>
> **Akses bahan.** Manual PDF dan video tutorial dikongsi dengan emel ini di Google Drive: {{starter_folder_link}}. Buka dengan akaun Google untuk emel {{email}}. Akses diberi kepada emel ini sahaja.
>
> **Group sokongan Telegram.** Sertai melalui pautan ini: {{telegram_invite}}. Pautan ini untuk anda sahaja, boleh digunakan sekali, dan tamat dalam 7 hari. Sokongan tersedia selama 14 hari dari tarikh pembelian, 9:00 pagi hingga 12:00 tengah hari.
>
> **Invois** dilampirkan ({{invoice_no}}).
>
> Ada masalah? Balas emel ini atau emel growthbridge.biz@gmail.com dengan nombor pesanan anda.
>
> Ihsan Hadhrami
> GROWTH BRIDGE ENTERPRISE (202603162028 (NS0324359-K))

**Masterclass** adds, after the Telegram paragraph:

> **Sesi live 1:1 (2 jam).** Tempah slot anda di sini: {{booking_link}}. Sesi perlu ditempah dan dihadiri dalam tempoh 60 hari dari tarikh pembelian. Anda boleh tukar slot sekali dengan notis sekurang-kurangnya 48 jam. Runbook Claude akan dihantar selepas sesi selesai.

**Runbook (Scenario 3):**

> Salam {{name}},
>
> Terima kasih kerana hadir sesi Masterclass. Runbook Claude (PDF dan MD) kini dikongsi dengan emel ini di Google Drive: {{runbook_folder_link}}. Runbook ini untuk kegunaan peribadi anda.
>
> Nombor pesanan: {{order_id}}.
>
> Ihsan Hadhrami
> GROWTH BRIDGE ENTERPRISE (202603162028 (NS0324359-K))

## 8. Test plan (CHIP test mode)

Make each test order with `POST https://growthbridge.my/api/checkout`, buyer email growthbridge.biz@gmail.com. The owner pays it with the test card. The launch switches stay off.

| # | Test | Pass when |
| --- | --- | --- |
| 1 | The test vector from section 2 | The Make formula gives the expected hex |
| 2 | A direct POST to the webhook, without a signature or with a wrong one | 401, owner alerted, nothing in Notion changes |
| 3 | Starter paid | Email within 2 minutes: Drive link, Telegram invite, invoice PDF `TEST-…`. Notion row Delivered, with Invoice no. and invite |
| 4 | The same event again (wait for the cron's re-send, or replay it in Make) | Stops at "Status = Paid"; no second email, counter unchanged |
| 5 | The Drive files | Open only for the buyer's Google account; no download for a viewer |
| 6 | The Telegram invite | Works once; a second account can't use it |
| 7 | Masterclass paid | Email has the booking link; no runbook. Tick Release runbook, Run once → the runbook email and Drive access |
| 8 | Resend access on test 3's row | A new invite, the same invoice number, the box unticked |
| 9 | Full refund of test 3 in the CHIP portal | Drive access gone, invite revoked, Notion Refunded, owner alerted |
| 10 | Partial refund of test 7 (RM170) | Access kept; Notes line and alert; Status unchanged |
| 11 | A failure: temporarily share a missing folder id | Notion Failed + alert. After the fix, setting Status back to Paid → delivered within 15 minutes, with the same invoice number |
| 12 | A failed or cancelled payment | Row stays Pending (Expired after 24 h); nothing delivered |

Afterwards: set the `test` counter back to 0 if wanted, delete the test emails and invoices if wanted, and clear the webhook queue.

## 9. Switch-on order

1. Scenario 1 on, with only Route A built. Run tests 1–6 and 11.
2. Add Route B. Run tests 9–10.
3. Build Scenarios 2–4. Run tests 7–8.
4. Only then go to Phase 6: live keys, the live refund webhook, `LEGAL_LAST_UPDATED`.

Operations: roughly 12–15 per delivery. Check the Make plan's monthly limit against expected orders.

## 10. Open decisions for the owner

1. **Invoice number format.** Suggested: `GB-INV-0001`, continuous and never reset, and `TEST-GB-INV-0001` for test orders. A yearly reset (`GB-INV-2026-0001`) also works.
2. **Buyers with an email that is not a Google account.** Drive can't share with one while the notification is off, and even with it on, the buyer can't open the files without a Google account for that email. Options:
   - (a) Make catches the error and sends the buyer an email asking for a Gmail address.
   - (b) Add a line under the checkout email field: "Guna emel akaun Google (Gmail) anda untuk akses Drive". This is a small change in this repo.
   - (c) Both.
   Recommended: (c).
3. **The Masterclass booking link** (Cal.com or Calendly) isn't ready. Masterclass delivery can't be tested or go live without it.
4. **Package names in Make.** Today Make maps `starter` → "Starter" itself. Optional: the Worker adds `product_name` and `package_name` (from `src/data/products.ts`) to the event, so the names live in one place. A small Worker change with tests, on a branch.
5. **Removing a refunded buyer from the Telegram group.** Revoking the invite doesn't remove someone who has already joined, and the bot doesn't learn their user id from a member-limited link. Suggested: the owner removes them by hand, prompted by the refund alert. The support period is 14 days anyway.
