import { useEffect, useRef, useState } from 'react';

/**
 * The page's one live thing: pick how often to post and on which days, and
 * the week fills with bars (the GrowthBridge mark's own shape). Pure
 * arithmetic on the visitor's choices; no claims.
 *
 * Motion tells the product's micro-story (motion-design skill: setup →
 * action → resolution). Posts wait in the queue as outlined slots; a "today"
 * marker walks the week and each slot fills as Make posts it.
 *   - Primary: slots rise in a wave when the chart scrolls into view.
 *   - Secondary: each post fills bottom-up and lifts a little as it goes out.
 *   - Marker: the day label turns green as the sweep passes it.
 * One signature curve (the site's rise curve) for every entrance, an
 * accelerating curve for exits. A sweep lasts about 3 s, so no pause control
 * is needed; it only runs on scroll-in and after the visitor changes the
 * schedule. Server HTML and reduced motion show the finished week, still.
 */

const DAYS = [
  { short: 'Isn', long: 'Isnin' },
  { short: 'Sel', long: 'Selasa' },
  { short: 'Rab', long: 'Rabu' },
  { short: 'Kha', long: 'Khamis' },
  { short: 'Jum', long: 'Jumaat' },
  { short: 'Sab', long: 'Sabtu' },
  { short: 'Ahd', long: 'Ahad' },
];
const ROWS = 3;

// Example times only (the buyer sets their own). Two a day match the demo video.
const TIMES: Record<number, string[]> = {
  1: ['7:30 malam'],
  2: ['7:30 malam', '8:47 malam'],
  3: ['12:30 tengah hari', '7:30 malam', '8:47 malam'],
};

type Status = 'empty' | 'queued' | 'posted';

const EASE_SIGNATURE = 'cubic-bezier(0.2, 0.7, 0.2, 1)';
const RISE_MS = 560; // dramatic reveal, once
const RISE_DAY_STAGGER = 40; // wave across the week
const RISE_ROW_STAGGER = 60; // bottom to top inside a day
const ADD_MS = 320; // a slot joining after a change
const STEP_MS = 420; // marker time per day
const ROW_DELAY_MS = 90; // must match --row-delay in styles.css
const IDLE_BEFORE_SWEEP_MS = 650; // let the visitor finish clicking first

const isOn = (days: boolean[], perDay: number, d: number, r: number) => days[d]! && r < perDay;

function layout(days: boolean[], perDay: number, status: Status): Status[][] {
  return DAYS.map((_, d) => Array.from({ length: ROWS }, (_, r) => (isOn(days, perDay, d, r) ? status : 'empty')));
}

function rise(el: HTMLElement | null | undefined, delay: number, duration: number) {
  el?.animate([{ transform: 'scaleY(0.04)' }, { transform: 'scaleY(1)' }], {
    duration,
    delay,
    easing: EASE_SIGNATURE,
    fill: 'backwards',
  });
}

function lift(el: HTMLElement | null | undefined, delay: number) {
  el?.animate(
    [
      { transform: 'translateY(0)', easing: 'cubic-bezier(0.2, 0, 0, 1)' },
      { transform: 'translateY(-8px)', offset: 0.4, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
      { transform: 'translateY(0)' },
    ],
    { duration: 460, delay },
  );
}

export function ScheduleDemo() {
  const [perDay, setPerDay] = useState(2);
  const [days, setDays] = useState<boolean[]>(() => DAYS.map(() => true));
  const [slots, setSlots] = useState<Status[][]>(() => layout(DAYS.map(() => true), 2, 'posted'));
  const [nowDay, setNowDay] = useState<number | null>(null);
  const [waiting, setWaiting] = useState(false);

  const weekRef = useRef<HTMLDivElement>(null);
  const slotEls = useRef<(HTMLSpanElement | null)[][]>(DAYS.map(() => []));
  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  const motionOk = useRef(false);
  const timers = useRef<number[]>([]);
  const firstRun = useRef(true);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  // Walk the marker over the days that have queued posts and post them.
  const sweep = () => {
    clearTimers();
    const queuedDays = slotsRef.current.flatMap((col, d) => (col.includes('queued') ? [d] : []));
    if (queuedDays.length === 0) {
      setNowDay(null);
      return;
    }
    const first = queuedDays[0]!;
    const last = queuedDays[queuedDays.length - 1]!;
    for (let d = first; d <= last; d++) {
      later(() => {
        setNowDay(d);
        slotsRef.current[d]!.forEach((s, r) => {
          if (s === 'queued') lift(slotEls.current[d]![r], r * ROW_DELAY_MS);
        });
        setSlots((prev) => prev.map((col, i) => (i === d ? col.map((s) => (s === 'queued' ? 'posted' : s)) : col)));
      }, (d - first) * STEP_MS);
    }
    later(() => setNowDay(null), (last - first) * STEP_MS + 700);
  };

  // Intro: on the client, with motion allowed, queue the week and play it
  // when the chart scrolls into view.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const week = weekRef.current;
    if (!week || !('IntersectionObserver' in window) || typeof week.animate !== 'function') return;
    motionOk.current = true;
    setSlots((cur) => cur.map((col) => col.map((s) => (s === 'posted' ? 'queued' : s))));
    setWaiting(true);

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        io.disconnect();
        setWaiting(false);
        slotEls.current.forEach((col, d) =>
          col.forEach((el, r) => rise(el, d * RISE_DAY_STAGGER + r * RISE_ROW_STAGGER, RISE_MS)),
        );
        const waveEnd = RISE_MS + (DAYS.length - 1) * RISE_DAY_STAGGER + (ROWS - 1) * RISE_ROW_STAGGER;
        later(sweep, waveEnd + 120);
      },
      { threshold: 0.45 },
    );
    io.observe(week);
    return () => {
      io.disconnect();
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The visitor changed the schedule: new slots join the queue, removed ones
  // empty out, and the marker posts the new ones once they stop clicking.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const animate = motionOk.current;
    const prev = slotsRef.current;
    const next = prev.map((col, d) =>
      col.map((s, r): Status => (isOn(days, perDay, d, r) ? (s === 'empty' ? (animate ? 'queued' : 'posted') : s) : 'empty')),
    );
    if (animate) {
      let n = 0;
      next.forEach((col, d) =>
        col.forEach((s, r) => {
          if (prev[d]![r] === 'empty' && s !== 'empty') rise(slotEls.current[d]![r], n++ * 30, ADD_MS);
        }),
      );
    }
    setSlots(next);
    if (animate && !waiting) {
      clearTimers();
      setNowDay(null);
      later(sweep, IDLE_BEFORE_SWEEP_MS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perDay, days]);

  const activeDays = days.filter(Boolean).length;
  const perWeek = perDay * activeDays;
  const toggleDay = (i: number) => setDays((d) => d.map((on, j) => (j === i ? !on : on)));

  return (
    <section className="schedule" aria-labelledby="jadual-title">
      <div className="frame schedule-grid">
        <div className="schedule-controls">
          <h2 id="jadual-title" className="t-2">
            Tetapkan jadual anda
          </h2>
          <p className="schedule-intro">
            Anda pilih berapa kali sehari dan hari apa. Make ambil post Ready ikut masa itu.
          </p>

          <fieldset className="choice">
            <legend>Post sehari</legend>
            <div className="choice-row">
              {[1, 2, 3].map((n) => (
                <label key={n} className="choice-pill">
                  <input
                    type="radio"
                    name="per-day"
                    value={n}
                    checked={perDay === n}
                    onChange={() => setPerDay(n)}
                  />
                  <span>{n} kali</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="choice">
            <legend>Hari</legend>
            <div className="choice-row">
              {DAYS.map((d, i) => (
                <button
                  key={d.short}
                  type="button"
                  className="day-toggle"
                  aria-pressed={days[i]}
                  aria-label={d.long}
                  onClick={() => toggleDay(i)}
                >
                  {d.short}
                </button>
              ))}
            </div>
          </fieldset>

          <p className="schedule-sum" aria-live="polite">
            <strong key={perWeek} className="schedule-count">
              {perWeek} post seminggu.
            </strong>{' '}
            {perWeek === 0
              ? 'Pilih sekurang-kurangnya satu hari.'
              : `Contoh masa: ${TIMES[perDay]!.join(', ')}.`}
          </p>
          <p className="schedule-note">
            Masa di atas hanya contoh. Anda pilih masa sendiri. Akaun saya post dua kali sehari, setiap hari.
          </p>
        </div>

        <div ref={weekRef} className={`week${waiting ? ' is-waiting' : ''}`} aria-hidden="true">
          {DAYS.map((d, i) => (
            <div
              key={d.short}
              className={`week-day${days[i] ? '' : ' is-off'}${nowDay === i ? ' is-now' : ''}`}
            >
              <div className="week-stack">
                {slots[i]!.map((s, r) => (
                  <span
                    key={r}
                    ref={(el) => {
                      slotEls.current[i]![r] = el;
                    }}
                    className={`slot is-${s}`}
                  />
                ))}
              </div>
              <span className="week-label">{d.short}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
