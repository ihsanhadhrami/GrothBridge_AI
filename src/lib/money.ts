/**
 * Formats sen as Malaysian ringgit: 8900 -> "RM89", 150000 -> "RM1,500",
 * 8950 -> "RM89.50". Written by hand (not Intl) so server and browser
 * output match exactly during hydration.
 */
export function formatRM(sen: number): string {
  if (!Number.isInteger(sen) || sen < 0) throw new Error(`Invalid amount in sen: ${sen}`);
  const ringgit = Math.floor(sen / 100);
  const cents = sen % 100;
  const grouped = String(ringgit).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return cents === 0 ? `RM${grouped}` : `RM${grouped}.${String(cents).padStart(2, '0')}`;
}
