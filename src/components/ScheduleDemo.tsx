import { useState } from 'react';

/**
 * The page's one live thing: pick how often to post and on which days, and
 * the week fills with bars (the GrowthBridge mark's own shape). Pure
 * arithmetic on the visitor's choices; no claims. Server-renders the owner's
 * real schedule (two posts a day, every day), so it reads fine without JS.
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

// Two a day are the owner's real times (from the demo video); the others are examples.
const TIMES: Record<number, string[]> = {
  1: ['7:30 malam'],
  2: ['7:30 malam', '8:47 malam'],
  3: ['12:30 tengah hari', '7:30 malam', '8:47 malam'],
};

export function ScheduleDemo() {
  const [perDay, setPerDay] = useState(2);
  const [days, setDays] = useState<boolean[]>(() => DAYS.map(() => true));

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
            <strong>{perWeek} post seminggu.</strong>{' '}
            {perWeek === 0
              ? 'Pilih sekurang-kurangnya satu hari.'
              : `Masa: ${TIMES[perDay]!.join(', ')}.`}
          </p>
          <p className="schedule-note">Akaun saya post dua kali sehari, setiap hari.</p>
        </div>

        <div className="week" aria-hidden="true">
          {DAYS.map((d, i) => (
            <div key={d.short} className={`week-day${days[i] ? '' : ' is-off'}`}>
              <div className="week-stack">
                {Array.from({ length: 3 }, (_, k) => (
                  <span key={k} className={days[i] && k < perDay ? 'is-on' : ''} />
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
