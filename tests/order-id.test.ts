import { describe, expect, it } from 'vitest';
import { newOrderId } from '../worker/order-id';

describe('newOrderId', () => {
  it('uses Malaysia time and 4 unambiguous characters', () => {
    // 2026-11-25 06:30:12 UTC = 14:30:12 in Malaysia.
    const id = newOrderId(new Date(Date.UTC(2026, 10, 25, 6, 30, 12)), () => new Uint8Array([0, 1, 31, 32]));
    expect(id).toBe('GB-20261125143012-23Z2');
  });

  it('rolls the date over at midnight Malaysia time', () => {
    const id = newOrderId(new Date(Date.UTC(2026, 11, 31, 16, 0, 0)));
    expect(id.startsWith('GB-20270101000000-')).toBe(true);
  });

  it('looks like GB-<14 digits>-<4 chars> and differs between calls', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newOrderId()));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(/^GB-\d{14}-[2-9A-HJ-NP-Z]{4}$/);
  });
});
