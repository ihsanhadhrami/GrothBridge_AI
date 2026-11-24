import { describe, expect, it } from 'vitest';
import { getCheckoutPackage, products } from '../src/data/products';

describe('getCheckoutPackage (the price the Worker charges)', () => {
  it('returns the prices in sen from the products file', () => {
    expect(getCheckoutPackage('autopost-threads', 'starter')?.priceSen).toBe(8900);
    expect(getCheckoutPackage('autopost-threads', 'masterclass')?.priceSen).toBe(25900);
  });

  it('carries the product, for names and slugs', () => {
    const pkg = getCheckoutPackage('autopost-threads', 'starter');
    expect(pkg?.product.slug).toBe('autopost-threads');
    expect(pkg?.name).toBe('Starter');
  });

  it('never sells the enquiry-only package', () => {
    expect(getCheckoutPackage('autopost-threads', 'siap-pasang')).toBeUndefined();
  });

  it('returns nothing for unknown products or packages', () => {
    expect(getCheckoutPackage('nope', 'starter')).toBeUndefined();
    expect(getCheckoutPackage('autopost-threads', 'gold')).toBeUndefined();
    expect(getCheckoutPackage('autopost-threads', '')).toBeUndefined();
    expect(getCheckoutPackage('', '')).toBeUndefined();
  });

  it('is not fooled by object keys', () => {
    expect(getCheckoutPackage('autopost-threads', '__proto__')).toBeUndefined();
    expect(getCheckoutPackage('constructor', 'starter')).toBeUndefined();
  });
});

describe('products file', () => {
  it('has positive whole-sen prices and unique ids', () => {
    const slugs = products.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const product of products) {
      const ids = product.packages.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const pkg of product.packages) {
        if (pkg.kind === 'checkout') {
          expect(Number.isInteger(pkg.priceSen)).toBe(true);
          expect(pkg.priceSen).toBeGreaterThan(0);
        } else {
          expect(pkg).not.toHaveProperty('priceSen');
        }
      }
    }
  });
});
