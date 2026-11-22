/**
 * The GrowthBridge mark: six bars, measured from brand/growthbridge-logo.png
 * (bar 54 units wide, 40 apart; heights relative to the tallest). The same
 * geometry runs the whole site (hero, step tiles, pricing, footer), so it
 * lives here once. The logo's green-to-teal fade is drawn flat in brand green.
 */
export const BAR_HEIGHTS = [0.44, 0.549, 0.541, 0.757, 1, 0.925] as const;
const BAR_W = 54;
const BAR_GAP = 40;
const BAR_H = 268;

export function Mark({ className }: { className?: string }) {
  const width = BAR_HEIGHTS.length * (BAR_W + BAR_GAP) - BAR_GAP;
  return (
    <svg className={className} viewBox={`0 0 ${width} ${BAR_H}`} aria-hidden="true" focusable="false">
      {BAR_HEIGHTS.map((r, i) => (
        <rect key={i} x={i * (BAR_W + BAR_GAP)} y={BAR_H - r * BAR_H} width={BAR_W} height={r * BAR_H} fill="currentColor" />
      ))}
    </svg>
  );
}

/**
 * The mark stretched to fill any box (CSS sets width and height). Stretching
 * keeps the logo's proportions between bars: the gap stays 40/524 of the width
 * and each bar's height stays relative to the tallest.
 */
export function Bars({ className }: { className?: string }) {
  const width = BAR_HEIGHTS.length * (BAR_W + BAR_GAP) - BAR_GAP;
  return (
    <svg
      className={`bars ${className ?? ''}`}
      viewBox={`0 0 ${width} ${BAR_H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {BAR_HEIGHTS.map((r, i) => (
        <rect key={i} x={i * (BAR_W + BAR_GAP)} y={BAR_H - r * BAR_H} width={BAR_W} height={r * BAR_H} />
      ))}
    </svg>
  );
}
