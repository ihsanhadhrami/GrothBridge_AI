/**
 * Signatures, all with Web Crypto (no libraries).
 *
 * CHIP signs every callback and webhook: X-Signature is the base64 of an
 * RSA PKCS#1 v1.5 signature over the SHA-256 of the raw request body
 * (https://docs.chip-in.asia/chip-collect/overview/webhook-signatures).
 * The Worker signs what it sends to Make: X-GB-Signature is the lowercase
 * hex HMAC-SHA256 of the body with MAKE_SHARED_SECRET.
 */

const RSA = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' } as const;

/**
 * A PEM "BEGIN PUBLIC KEY" (SPKI) key. Also accepts the key as CHIP's
 * GET /public_key/ returns it (a JSON string, with quotes and "\n" escapes),
 * in case it was pasted that way into a secret. Throws on anything else.
 */
export async function importChipPublicKey(pem: string): Promise<CryptoKey> {
  let s = pem.trim();
  if (s.startsWith('"')) {
    try {
      s = JSON.parse(s) as string;
    } catch {
      // not JSON; use as is
    }
  }
  s = s.replaceAll('\\n', '\n');
  if (s.includes('BEGIN RSA PUBLIC KEY')) {
    throw new Error('public key is PKCS#1 ("BEGIN RSA PUBLIC KEY"); expected "BEGIN PUBLIC KEY"');
  }
  const match = /-----BEGIN PUBLIC KEY-----([\s\S]+?)-----END PUBLIC KEY-----/.exec(s);
  if (!match) throw new Error('public key is not a PEM "BEGIN PUBLIC KEY" block');
  const der = base64ToBytes(match[1]!.replace(/\s+/g, ''));
  if (!der) throw new Error('public key PEM body is not valid base64');
  return crypto.subtle.importKey('spki', der, RSA, false, ['verify']);
}

/** True only for a well-formed signature that matches the body. Never throws. */
export async function verifyRsaSignature(key: CryptoKey, rawBody: Uint8Array, signatureB64: string): Promise<boolean> {
  const signature = base64ToBytes(signatureB64.trim());
  if (!signature || signature.length === 0) return false;
  try {
    return await crypto.subtle.verify(RSA, key, signature, rawBody);
  } catch {
    return false;
  }
}

export async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(body)));
  return Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('');
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64) || b64.length % 4 === 1) return null;
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}
