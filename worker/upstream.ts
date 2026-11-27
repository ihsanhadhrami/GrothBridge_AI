/**
 * Every call to an outside service goes through here: it always has a
 * timeout, and every failure becomes an UpstreamError that names the
 * service, so the caller can alert with a useful message.
 */

export class UpstreamError extends Error {
  constructor(
    readonly service: string,
    message: string,
    readonly status?: number,
  ) {
    super(`${service}: ${message}`);
    this.name = 'UpstreamError';
  }
}

export async function fetchWithTimeout(
  service: string,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    if (name === 'TimeoutError' || name === 'AbortError') {
      throw new UpstreamError(service, `no answer within ${timeoutMs} ms`);
    }
    throw new UpstreamError(service, `request failed (${err instanceof Error ? err.message : String(err)})`);
  }
}

/** Reads a response body as text, cut short for alerts and logs. */
export async function bodySnippet(res: Response, max = 500): Promise<string> {
  const text = await res.text().catch(() => '');
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
