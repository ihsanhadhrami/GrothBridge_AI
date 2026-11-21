import type { LegalDoc } from '../content/legal';
import { site } from '../data/site';

export function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <section className="legal" aria-labelledby="legal-title">
      <div className="frame legal-grid">
        <div className="legal-side">
          <h1 id="legal-title" className="t-2">
            {doc.title}
          </h1>
          <p className="legal-updated">Kemas kini terakhir: {site.lastUpdated}</p>
          <nav aria-label="Kandungan halaman" className="legal-toc">
            <ol>
              {doc.sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}>{s.title}</a>
                </li>
              ))}
            </ol>
          </nav>
        </div>
        <div className="legal-body">
          {doc.intro}
          {doc.sections.map((s) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`}>
              <h2 id={`${s.id}-h`} className="legal-h">
                {s.title}
              </h2>
              {s.body}
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
