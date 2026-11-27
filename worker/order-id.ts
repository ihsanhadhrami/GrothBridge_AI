// No 0/O or 1/I, so an order id read out over the phone can't be misheard.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * "GB-20261125143012-7KQ2": GB, the time in Malaysia (UTC+8) to the second,
 * and 4 random characters (32^4 ≈ 1 million per second), so two buyers in
 * the same second still get different ids. Used as CHIP's reference and the
 * Notion title.
 */
export function newOrderId(now: Date = new Date(), random: (n: number) => Uint8Array = randomBytes): string {
  const myt = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const stamp = myt.toISOString().slice(0, 19).replace(/\D/g, ''); // YYYYMMDDHHMMSS
  const suffix = Array.from(random(4), (b) => ALPHABET[b % ALPHABET.length]).join('');
  return `GB-${stamp}-${suffix}`;
}

function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}
