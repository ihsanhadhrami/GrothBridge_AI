/**
 * Form validation shared by the browser (for quick feedback) and the
 * Worker (the check that counts). Messages are customer-facing Malay.
 */

export type FieldErrors = Partial<Record<string, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Malaysian mobile: 01X-XXXXXXX(X), with or without +60 / 60.
const MY_MOBILE_RE = /^(?:\+?60|0)1\d{8,9}$/;

export function normalisePhone(raw: string): string {
  return raw.replace(/[\s\-().]/g, '');
}

export function validateName(v: string): string | undefined {
  const s = v.trim();
  if (s.length < 2) return 'Sila isi nama penuh anda.';
  if (s.length > 100) return 'Nama terlalu panjang.';
  return undefined;
}

export function validateEmail(v: string): string | undefined {
  const s = v.trim();
  if (!s) return 'Sila isi emel anda.';
  if (s.length > 254 || !EMAIL_RE.test(s)) return 'Emel ini tidak sah. Semak semula.';
  return undefined;
}

export function validatePhone(v: string): string | undefined {
  const s = normalisePhone(v);
  if (!s) return 'Sila isi nombor telefon anda.';
  if (!MY_MOBILE_RE.test(s)) return 'Gunakan nombor telefon bimbit Malaysia, contoh 012-345 6789.';
  return undefined;
}

export function validateConsent(v: boolean): string | undefined {
  return v ? undefined : 'Sila setuju dengan Terma dan Notis Privasi untuk teruskan.';
}

export interface CheckoutInput {
  product: string;
  package: string;
  name: string;
  email: string;
  phone: string;
  consent: boolean;
}

export function validateCheckout(input: CheckoutInput): FieldErrors {
  const errors: FieldErrors = {
    name: validateName(input.name),
    email: validateEmail(input.email),
    phone: validatePhone(input.phone),
    consent: validateConsent(input.consent),
  };
  return prune(errors);
}

export interface EnquiryInput {
  name: string;
  email: string;
  phone: string;
  business: string;
  threads: string;
  message: string;
  consent: boolean;
}

export function validateEnquiry(input: EnquiryInput): FieldErrors {
  const message = input.message.trim();
  const errors: FieldErrors = {
    name: validateName(input.name),
    email: validateEmail(input.email),
    phone: validatePhone(input.phone),
    business: input.business.length > 120 ? 'Nama bisnes terlalu panjang.' : undefined,
    threads: input.threads.length > 60 ? 'Nama akaun Threads terlalu panjang.' : undefined,
    message:
      message.length < 10
        ? 'Ceritakan sedikit apa yang anda mahu automasikan.'
        : message.length > 2000
          ? 'Mesej terlalu panjang (had 2,000 aksara).'
          : undefined,
    consent: validateConsent(input.consent),
  };
  return prune(errors);
}

function prune(errors: FieldErrors): FieldErrors {
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v !== undefined));
}
