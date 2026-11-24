import { describe, expect, it } from 'vitest';
import { intlPhone, validateCheckout, validatePhone, type CheckoutInput } from '../src/lib/validate';
import { toCheckoutInput } from '../worker/checkout';

const good: CheckoutInput = {
  product: 'autopost-threads',
  package: 'starter',
  name: 'Siti Aminah',
  email: 'siti@example.com',
  phone: '012-345 6789',
  consent: true,
};

describe('validateCheckout', () => {
  it('accepts a complete form', () => {
    expect(validateCheckout(good)).toEqual({});
  });

  it('flags each missing field in Malay', () => {
    const errors = validateCheckout({ ...good, name: ' ', email: '', phone: '', consent: false });
    expect(Object.keys(errors).sort()).toEqual(['consent', 'email', 'name', 'phone']);
    expect(errors.name).toBe('Sila isi nama penuh anda.');
    expect(errors.consent).toMatch(/^Sila setuju/);
  });

  it('rejects a bad email and an over-long name', () => {
    expect(validateCheckout({ ...good, email: 'siti@example' }).email).toBe('Emel ini tidak sah. Semak semula.');
    expect(validateCheckout({ ...good, name: 'a'.repeat(101) }).name).toBe('Nama terlalu panjang.');
  });
});

describe('validatePhone', () => {
  it.each(['0123456789', '012-345 6789', '011-2345 6789', '+60123456789', '60123456789', '(012) 345-6789'])(
    'accepts Malaysian mobile %s',
    (n) => expect(validatePhone(n)).toBeUndefined(),
  );
  it.each(['03-2345 6789', '12345', '+6512345678', '0123', 'abc'])('rejects %s', (n) =>
    expect(validatePhone(n)).toBeDefined(),
  );
});

describe('intlPhone', () => {
  it.each([
    ['012-345 6789', '+60123456789', '+60 123456789'],
    ['+60 11-2345 6789', '+601123456789', '+60 1123456789'],
    ['60123456789', '+60123456789', '+60 123456789'],
  ])('%s → %s / %s', (raw, e164, chip) => {
    expect(intlPhone(raw)).toEqual({ e164, chip });
  });
});

describe('toCheckoutInput (Worker side)', () => {
  it('keeps only known fields, as strings, and reads a checkbox "on"', () => {
    const input = toCheckoutInput({
      product: 'autopost-threads',
      package: 'starter',
      name: 'Siti',
      email: 'siti@example.com',
      phone: 123, // not a string → empty
      consent: 'on',
      price: 1, // ignored
    });
    expect(input).toEqual({
      product: 'autopost-threads',
      package: 'starter',
      name: 'Siti',
      email: 'siti@example.com',
      phone: '',
      consent: true,
    });
    expect(input).not.toHaveProperty('price');
  });

  it('treats any other consent value as no', () => {
    for (const consent of [false, 'false', 'yes', 1, null, undefined]) {
      expect(toCheckoutInput({ consent }).consent).toBe(false);
    }
  });
});
