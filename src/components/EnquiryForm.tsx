import { useState, type FormEvent } from 'react';
import { site } from '../data/site';
import { validateEnquiry, type FieldErrors } from '../lib/validate';
import { Consent, Field, networkErrorMessage, postJson } from './Field';

/** Siap Pasang enquiry. The Worker saves it to Notion and alerts the owner. */
export function EnquiryForm() {
  const [v, setV] = useState({ name: '', email: '', phone: '', business: '', threads: '', message: '' });
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
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

  if (status === 'sent') {
    return (
      <div className="form-done" role="status">
        <h2 className="t-3">Terima kasih, pertanyaan anda sudah sampai.</h2>
        <p>Saya akan membalas ke {v.email} dalam 1–2 hari bekerja.</p>
      </div>
    );
  }

  return (
    <form className="enquiry-form" onSubmit={onSubmit} noValidate action="/api/enquiry" method="post">
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
      {formError && (
        <p className="form-error" role="alert">
          {formError}
        </p>
      )}
      <button className="btn btn-block" type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Menghantar…' : 'Hantar pertanyaan'}
      </button>
    </form>
  );
}
