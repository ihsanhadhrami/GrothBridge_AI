import type { InputHTMLAttributes, ReactNode } from 'react';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string;
  hint?: string;
}

export function Field({ id, label, error, hint, ...input }: FieldProps) {
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ');
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...input}
      />
      {hint && (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function Consent({
  checked,
  onChange,
  error,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="field field-check">
      <input
        id="consent"
        name="consent"
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'consent-error' : undefined}
      />
      <label htmlFor="consent">{children}</label>
      {error && (
        <p id="consent-error" className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

/** POST JSON with a timeout. Returns parsed JSON (or null) and the status. */
export async function postJson(
  url: string,
  body: unknown,
  timeoutMs = 15000,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> | null }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { ok: res.ok, status: res.status, data };
}

export function networkErrorMessage(err: unknown, email: string): string {
  if (err instanceof DOMException && err.name === 'TimeoutError') {
    return `Sambungan mengambil masa terlalu lama. Cuba lagi, atau emel ${email}.`;
  }
  return `Sambungan terputus. Semak internet anda dan cuba lagi, atau emel ${email}.`;
}
