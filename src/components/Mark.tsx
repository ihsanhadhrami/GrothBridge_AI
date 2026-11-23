import { useEffect, useRef } from 'react';

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
const WIDTH = BAR_HEIGHTS.length * (BAR_W + BAR_GAP) - BAR_GAP;

const EASE_SIGNATURE = 'cubic-bezier(0.2, 0.7, 0.2, 1)';

export function Mark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox={`0 0 ${WIDTH} ${BAR_H}`} aria-hidden="true" focusable="false">
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
 *
 * `live` (home hero, page heads, footer) adds motion, following the motion-design
 * skill. Growth is the emotion, vertical is the path.
 *   - Primary (CSS, so it plays before JS loads): bars rise left to right
 *     and settle with a 3.5% overshoot.
 *   - Secondary (CSS): one glint runs across the bars once they've landed.
 *   - Interaction (JS): with a mouse, the bars under the pointer grow toward
 *     it; a click or tap sends a growth pulse across all six.
 * Bars that load below the screen hold their rise until scrolled into view.
 * Nothing loops on its own, so no pause control is needed. Reduced motion:
 * still bars, no interaction.
 */
export function Bars({ className, live = false }: { className?: string; live?: boolean }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = ref.current;
    if (!live || !svg || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const groups = Array.from(svg.querySelectorAll<SVGGElement>('.bar'));

    // Bars that start below the screen (the footer) wait, low, and rise when
    // they scroll into view, so the entrance is actually seen.
    let entrance: IntersectionObserver | undefined;
    if (svg.getBoundingClientRect().top > window.innerHeight) {
      svg.classList.add('is-waiting');
      entrance = new IntersectionObserver(
        ([entry]) => {
          if (!entry?.isIntersecting) return;
          svg.classList.remove('is-waiting'); // re-applies the CSS animation, from the start
          entrance?.disconnect();
        },
        { threshold: 0.35 },
      );
      entrance.observe(svg);
    }

    const centres = BAR_HEIGHTS.map((_, i) => (i * (BAR_W + BAR_GAP) + BAR_W / 2) / WIDTH);
    let frame = 0;
    let pointerX = 0;

    const follow = () => {
      frame = 0;
      const box = svg.getBoundingClientRect();
      const x = (pointerX - box.left) / box.width;
      groups.forEach((g, i) => {
        const d = (x - centres[i]!) / 0.15;
        const k = Math.exp(-d * d); // 1 under the pointer, fading over ~1.5 bars
        g.style.transform = `scaleY(${(1 + 0.07 * k).toFixed(4)})`;
        g.classList.toggle('is-near', k > 0.55);
      });
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      pointerX = e.clientX;
      if (!frame) frame = requestAnimationFrame(follow);
    };
    const onLeave = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      groups.forEach((g) => {
        g.style.transform = '';
        g.classList.remove('is-near');
      });
    };
    const onPress = () => {
      groups.forEach((g, i) =>
        g.querySelector('rect')?.animate(
          [
            { transform: 'scaleY(1)', easing: EASE_SIGNATURE },
            { transform: 'scaleY(1.08)', offset: 0.35, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
            { transform: 'scaleY(1)' },
          ],
          { duration: 560, delay: i * 70 },
        ),
      );
    };

    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerleave', onLeave);
    svg.addEventListener('pointerdown', onPress);
    return () => {
      entrance?.disconnect();
      cancelAnimationFrame(frame);
      svg.removeEventListener('pointermove', onMove);
      svg.removeEventListener('pointerleave', onLeave);
      svg.removeEventListener('pointerdown', onPress);
    };
  }, [live]);

  return (
    <svg
      ref={ref}
      className={`bars${live ? ' live' : ''} ${className ?? ''}`}
      viewBox={`0 0 ${WIDTH} ${BAR_H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {BAR_HEIGHTS.map((r, i) => {
        const rect = <rect x={i * (BAR_W + BAR_GAP)} y={BAR_H - r * BAR_H} width={BAR_W} height={r * BAR_H} />;
        return live ? (
          <g key={i} className="bar">
            {rect}
          </g>
        ) : (
          <rect key={i} x={i * (BAR_W + BAR_GAP)} y={BAR_H - r * BAR_H} width={BAR_W} height={r * BAR_H} />
        );
      })}
    </svg>
  );
}
