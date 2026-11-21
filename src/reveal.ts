/**
 * Section entrances. Only elements still below the fold are hidden, and only
 * once this script runs, so content never depends on JS to appear and the
 * first screen never flashes. Skipped entirely under reduced motion.
 */
export function startReveal(): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;

  const targets = Array.from(
    document.querySelectorAll<HTMLElement>('main section h2, main section [data-reveal], main .tile, main .faq-item, main .statement'),
  );
  const below = targets.filter((el) => el.getBoundingClientRect().top > window.innerHeight * 0.95);

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        el.classList.add('reveal-in');
        el.classList.remove('reveal-wait');
        io.unobserve(el);
      }
    },
    { rootMargin: '0px 0px -8% 0px' },
  );

  below.forEach((el) => {
    // Stagger siblings that enter together.
    const index = el.parentElement ? Array.from(el.parentElement.children).indexOf(el) : 0;
    el.style.setProperty('--reveal-delay', `${Math.min(index, 5) * 70}ms`);
    el.classList.add('reveal-wait');
    io.observe(el);
  });
}
