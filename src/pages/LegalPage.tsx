import type { LegalDoc } from '../content/legal';
import { LEGAL_LAST_UPDATED } from '../data/site';
import { PageHead } from '../components/PageHead';

export function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <>
      <PageHead id="legal-title" title={doc.title}>
        <p className="t-3">{doc.lead}</p>
        {LEGAL_LAST_UPDATED && <p className="legal-updated">Kemas kini terakhir: {LEGAL_LAST_UPDATED}</p>}
      </PageHead>
      <section className="legal" aria-label={`Kandungan ${doc.title}`}>
        <div className="frame legal-grid">
          <nav aria-label="Kandungan halaman" className="legal-toc">
            <h2 className="legal-toc-title">Dalam halaman ini</h2>
            <ol>
              {doc.sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}>{s.title}</a>
                </li>
              ))}
            </ol>
          </nav>
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
    </>
  );
}
