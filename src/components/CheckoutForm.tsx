import { useState, type FormEvent } from 'react';
import { checkoutPackages, type Product } from '../data/products';
import { site } from '../data/site';
import { formatRM } from '../lib/money';
import { validateCheckout, type FieldErrors } from '../lib/validate';
import { Consent, Field, networkErrorMessage, postJson } from './Field';

interface Props {
  product: Product;
  selected: string;
  onSelect: (id: string) => void;
}

/**
 * Collects buyer details and asks the Worker for a CHIP checkout URL.
 * The browser sends only the product slug and package id; the Worker
 * reads the price from src/data/products.ts.
 */
export function CheckoutForm({ product, selected, onSelect }: Props) {
  const packages = checkoutPackages(product);
  const pkg = packages.find((p) => p.id === selected) ?? packages[0]!;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<'idle' | 'sending'>('idle');
  const [formError, setFormError] = useState('');

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = { product: product.slug, package: pkg.id, name, email, phone, consent };
    const found = validateCheckout(input);
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length > 0) {
      const first = Object.keys(found)[0];
      document.getElementById(first === 'consent' ? 'consent' : first!)?.focus();
      return;
    }
    setStatus('sending');
    try {
      const { ok, data } = await postJson('/api/checkout', input);
      const url = data?.checkout_url;
      if (ok && typeof url === 'string' && url.startsWith('https://')) {
        window.location.assign(url);
        return; // keep the button disabled while the browser leaves
      }
      if (data?.errors && typeof data.errors === 'object') setErrors(data.errors as FieldErrors);
      setFormError(
        typeof data?.error === 'string'
          ? data.error
          : `Maaf, pembayaran belum dapat dimulakan. Cuba lagi sebentar, atau emel ${site.email}.`,
      );
    } catch (err) {
      setFormError(networkErrorMessage(err, site.email));
    }
    setStatus('idle');
  }

  return (
    <section id="beli" className="checkout" aria-labelledby="beli-title">
      <div className="frame checkout-grid">
        <form className="checkout-form" onSubmit={onSubmit} noValidate action="/api/checkout" method="post">
          <h2 id="beli-title" className="t-2">
            Beli {pkg.name}
          </h2>

          <input type="hidden" name="product" value={product.slug} />
          <fieldset className="choice">
            <legend>Pakej</legend>
            <div className="package-choice">
              {packages.map((p) => (
                <label key={p.id} className="package-option">
                  <input
                    type="radio"
                    name="package"
                    value={p.id}
                    checked={pkg.id === p.id}
                    onChange={() => onSelect(p.id)}
                  />
                  <span className="package-option-name">{p.name}</span>
                  <span className="package-option-price">{formatRM(p.priceSen)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <Field
            id="name"
            label="Nama penuh"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            required
            maxLength={100}
          />
          <Field
            id="email"
            label="Emel"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            hint="Akses produk dan invois dihantar ke emel ini sahaja."
            required
          />
          <Field
            id="phone"
            label="Nombor telefon"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            error={errors.phone}
            hint="Telefon bimbit Malaysia, contoh 012-345 6789."
            required
          />
          <Consent checked={consent} onChange={setConsent} error={errors.consent}>
            Saya setuju dengan <a href="/terma">Terma & Syarat</a> dan{' '}
            <a href="/privasi">Notis Privasi</a>, dan telah membaca{' '}
            <a href="/bayaran-balik">Polisi Bayaran Balik</a>.
          </Consent>

          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}

          <button className="btn btn-block" type="submit" disabled={status === 'sending'}>
            {status === 'sending' ? 'Membuka halaman bayaran…' : `Bayar ${formatRM(pkg.priceSen)}`}
          </button>
          <p className="form-note">
            Anda akan dibawa ke halaman bayaran CHIP (FPX atau kad). Kami tidak melihat atau
            menyimpan butiran kad atau akaun bank anda.
          </p>
        </form>

        <aside className="order-summary" aria-label="Ringkasan pesanan">
          <p className="order-name">{pkg.name}</p>
          <p className="order-price">{formatRM(pkg.priceSen)}</p>
          <p className="order-for">{pkg.audience}</p>
          <ul className="ticks">
            {pkg.includes.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="order-after">
            Selepas bayaran berjaya, emel dengan akses dan invois dihantar secara automatik.
          </p>
        </aside>
      </div>
    </section>
  );
}
