import { useState, type FormEvent } from 'react';
import { site } from '../data/site';
import { products } from '../data/products';
import { validateEnquiry, type FieldErrors } from '../lib/validate';
import { Consent, Field, networkErrorMessage, postJson } from './Field';
import { ENQUIRY_API_ENABLED } from '../config';
import { enquiryMailto } from '../lib/mailto';

// Names for the email subject come from the products file, like everywhere else.
const product = products[0]!;
const PRODUCT = product.name;
const PACKAGE = product.packages.find((p) => p.kind === 'enquiry')?.name ?? 'Siap Pasang';

/**
 * Siap Pasang enquiry. Live: the Worker saves it to Notion and alerts the
 * owner. Pre-launch (ENQUIRY_API_ENABLED false): nothing is posted; the visitor's
 * email app opens with the details filled in, to send themselves.
 */
export function EnquiryForm() {
  const [v, setV] = useState({
    name: '',
    email: '',
    phone: '',
    business: '',
    threads: '',
    // Scope questions for the quote (optional): number of Threads accounts, picture/video posts, writing help.
    accounts: '',
    media: '',
    writing: '',
    message: '',
  });
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'mailed'>('idle');
  const [formError, setFormError] = useState('');

  const set = (k: keyof typeof v) => (e: { target: { value: string } }) =>
    setV((old) => ({ ...old, [k]: e.target.value }));

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = { ...v, consent };
    const found = validateEnquiry(input);
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length > 0) {
      document.getElementById(Object.keys(found)[0]!)?.focus();
      return;
    }
    if (!ENQUIRY_API_ENABLED) {
      const body = [
        `Nama: ${v.name.trim()}`,
        `Emel: ${v.email.trim()}`,
        `Telefon: ${v.phone.trim()}`,
        `Bisnes: ${v.business.trim() || '-'}`,
        `Threads: ${v.threads.trim() || '-'}`,
        `Bilangan akaun Threads: ${v.accounts.trim() || '-'}`,
        `Perlu post bergambar/video?: ${v.media || '-'}`,
        `Perlu bantuan menulis kandungan?: ${v.writing || '-'}`,
        '',
        'Apa yang saya mahu automasikan:',
        v.message.trim(),
      ].join('\n');
      window.location.href = enquiryMailto(PRODUCT, PACKAGE, body);
      setStatus('mailed');
      return;
    }
    setStatus('sending');
    try {
      const { ok, data } = await postJson('/api/enquiry', input);
      if (ok) {
        setStatus('sent');
        return;
      }
      if (data?.errors && typeof data.errors === 'object') setErrors(data.errors as FieldErrors);
      setFormError(
        typeof data?.error === 'string'
          ? data.error
          : `Maaf, pertanyaan anda belum dapat dihantar. Cuba lagi, atau emel ${site.email}.`,
      );
    } catch (err) {
      setFormError(networkErrorMessage(err, site.email));
    }
    setStatus('idle');
  }

  if (status === 'mailed') {
    return (
      <div className="form-done" role="status">
        <h2 className="t-3">Aplikasi emel anda sepatutnya terbuka sekarang.</h2>
        <p>Butiran anda sudah diisi. Tekan Hantar dalam aplikasi emel untuk menghantarnya kepada kami.</p>
        <p>
          Jika ia tidak terbuka, emel terus ke{' '}
          <a href={enquiryMailto(PRODUCT, PACKAGE)}>{site.email}</a>.
        </p>
        <p>
          <button type="button" className="btn btn-secondary" onClick={() => setStatus('idle')}>
            Kembali ke borang
          </button>
        </p>
      </div>
    );
  }

  if (status === 'sent') {
    return (
      <div className="form-done" role="status">
        <h2 className="t-3">Terima kasih, pertanyaan anda sudah sampai.</h2>
        <p>Saya akan membalas ke {v.email} dalam 1–2 hari bekerja.</p>
      </div>
    );
  }

  return (
    <form
      className="enquiry-form"
      onSubmit={onSubmit}
      noValidate
      // Without JS: pre-launch hands the fields to the email app, never to /api/*.
      action={ENQUIRY_API_ENABLED ? '/api/enquiry' : enquiryMailto(PRODUCT, PACKAGE)}
      method="post"
      encType={ENQUIRY_API_ENABLED ? undefined : 'text/plain'}
    >
      <Field id="name" label="Nama penuh" autoComplete="name" value={v.name} onChange={set('name')} error={errors.name} required maxLength={100} />
      <Field id="email" label="Emel" type="email" autoComplete="email" inputMode="email" value={v.email} onChange={set('email')} error={errors.email} required />
      <Field
        id="phone"
        label="Nombor telefon"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        value={v.phone}
        onChange={set('phone')}
        error={errors.phone}
        hint="Telefon bimbit Malaysia, contoh 012-345 6789."
        required
      />
      <Field id="business" label="Nama bisnes (pilihan)" autoComplete="organization" value={v.business} onChange={set('business')} error={errors.business} maxLength={120} />
      <Field id="threads" label="Akaun Threads (pilihan)" value={v.threads} onChange={set('threads')} error={errors.threads} placeholder="@namaakaun" maxLength={60} />
      <Field
        id="accounts"
        label="Bilangan akaun Threads"
        type="number"
        inputMode="numeric"
        min={1}
        max={99}
        step={1}
        value={v.accounts}
        onChange={set('accounts')}
        error={errors.accounts}
      />
      <Choice name="media" legend="Perlu post bergambar/video?" options={['Ya', 'Tidak', 'Belum pasti']} value={v.media} onChange={(x) => setV((o) => ({ ...o, media: x }))} />
      <Choice name="writing" legend="Perlu bantuan menulis kandungan?" options={['Ya', 'Tidak']} value={v.writing} onChange={(x) => setV((o) => ({ ...o, writing: x }))} />
      <div className="field">
        <label htmlFor="message">Apa yang anda mahu automasikan?</label>
        <textarea
          id="message"
          name="message"
          rows={5}
          value={v.message}
          onChange={set('message')}
          required
          maxLength={2000}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={errors.message ? 'message-error' : undefined}
        />
        {errors.message && (
          <p id="message-error" className="field-error">
            {errors.message}
          </p>
        )}
      </div>
      <Consent checked={consent} onChange={setConsent} error={errors.consent}>
        Saya setuju dengan <a href="/terma">Terma & Syarat</a> dan <a href="/privasi">Notis Privasi</a>.
      </Consent>
      {!ENQUIRY_API_ENABLED && (
        <p className="form-note">Butang ini membuka aplikasi emel anda dengan butiran di atas. Tiada apa dihantar sehingga anda tekan Hantar di sana.</p>
      )}
      {formError && (
        <p className="form-error" role="alert">
          {formError}
        </p>
      )}
      <button className="btn btn-block" type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Menghantar…' : ENQUIRY_API_ENABLED ? 'Hantar pertanyaan' : 'Hantar melalui emel'}
      </button>
    </form>
  );
}

/** A row of pill radios (same look as the schedule picker). Optional: nothing is selected at first. */
function Choice({
  name,
  legend,
  options,
  value,
  onChange,
}: {
  name: string;
  legend: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="choice field">
      <legend>{legend}</legend>
      <div className="choice-row">
        {options.map((o) => (
          <label key={o} className="choice-pill">
            <input type="radio" name={name} value={o} checked={value === o} onChange={() => onChange(o)} />
            <span>{o}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
