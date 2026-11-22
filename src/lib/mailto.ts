import { site } from '../data/site';

/** mailto: link to the business email, subject "Pertanyaan: <product> <package>". */
export function enquiryMailto(productName: string, packageName: string, body?: string): string {
  const params = [`subject=${encodeURIComponent(`Pertanyaan: ${productName} ${packageName}`)}`];
  if (body) params.push(`body=${encodeURIComponent(body)}`);
  return `mailto:${site.email}?${params.join('&')}`;
}
