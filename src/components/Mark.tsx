/**
 * The GrowthBridge mark: five rising bars. The same geometry runs the whole
 * site (hero band, step tiles, pricing tiles, footer), so it lives here once.
 */
export const BAR_HEIGHTS = [0.38, 0.52, 0.66, 0.82, 1] as const;

export function Mark({ className }: { className?: string }) {
  const w = 6;
  const gap = 3;
  const h = 24;
  return (
    <svg
      className={className}
      viewBox={`0 0 ${BAR_HEIGHTS.length * (w + gap) - gap} ${h}`}
      aria-hidden="true"
      focusable="false"
    >
      {BAR_HEIGHTS.map((r, i) => (
        <rect key={i} x={i * (w + gap)} y={h - r * h} width={w} height={r * h} fill="currentColor" />
      ))}
    </svg>
  );
}

/** The mark as a row of flat blocks that fill their container (CSS sizes them). */
export function Bars({ className }: { className?: string }) {
  return (
    <div className={`bars ${className ?? ''}`} aria-hidden="true">
      {BAR_HEIGHTS.map((r, i) => (
        <span key={i} style={{ height: `${r * 100}%` }} />
      ))}
    </div>
  );
}
