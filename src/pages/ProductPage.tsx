import { useEffect, useState } from 'react';
import { checkoutPackages, fromPriceSen, type Package, type Product } from '../data/products';
import { formatRM } from '../lib/money';
import { Bars } from '../components/Mark';
import { TeaserVideo } from '../components/TeaserVideo';
import { ScheduleDemo } from '../components/ScheduleDemo';
import { CheckoutForm } from '../components/CheckoutForm';

export function ProductPage({ product }: { product: Product }) {
  const buyable = checkoutPackages(product);
  const [selected, setSelected] = useState(buyable[0]!.id);

  // ?pakej=masterclass preselects a package (read after hydration so the
  // server HTML and the first client render match).
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('pakej');
    if (wanted && checkoutPackages(product).some((p) => p.id === wanted)) setSelected(wanted);
  }, [product]);

  const choose = (id: string) => {
    setSelected(id);
    document.getElementById('beli')?.scrollIntoView({ block: 'start' });
    window.setTimeout(() => document.getElementById('name')?.focus({ preventScroll: true }), 300);
  };

  return (
    <>
      <section className="p-hero" aria-labelledby="p-title">
        <div className="frame p-hero-grid">
          <div className="p-hero-card">
            <Bars className="card-band" />
            <h1 id="p-title" className="t-1">
              {product.hero.title}
            </h1>
            <p className="p-hero-tagline t-3">{product.hero.tagline}</p>
            <p className="p-hero-lead">{product.hero.lead}</p>
            <div className="p-hero-actions">
              <a className="btn" href="#pakej">
                {product.hero.cta}
              </a>
              <p className="p-hero-prices">
                {buyable.map((p, i) => (
                  <span key={p.id}>
                    {i > 0 && ' · '}
                    {p.name} <strong>{formatRM(p.priceSen)}</strong>
                  </span>
                ))}
              </p>
            </div>
          </div>
          <div className="p-hero-stage">
            <TeaserVideo
              src={product.demo.videoSrc}
              poster={product.demo.posterSrc}
              label={product.demo.label}
            />
            <p className="stage-caption">{product.demo.caption}</p>
          </div>
        </div>
      </section>

      <section className="problem" aria-labelledby="masalah-title">
        <div className="frame problem-grid">
          <h2 id="masalah-title" className="t-2">
            {product.problem.title}
          </h2>
          <div className="problem-text">
            <p className="statement">{product.problem.body}</p>
            <p className="statement statement-turn">{product.problem.turn}</p>
          </div>
        </div>
      </section>

      <section className="steps" aria-labelledby="cara-title">
        <div className="frame">
          <div className="steps-grid">
            <h2 id="cara-title" className="t-2 steps-title">
              {product.steps.title}
            </h2>
            {product.steps.items.map((step, i) => (
              <div key={step.name} className={`step step-${i + 1}`} data-reveal>
                <div className="step-tile">
                  {step.image ? (
                    <img
                      src={step.image.src}
                      alt={step.image.alt}
                      width={step.image.width}
                      height={step.image.height}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <blockquote className="step-quote">{step.quote}</blockquote>
                  )}
                </div>
                <h3 className="step-name">{step.name}</h3>
                <p className="step-text">{step.text}</p>
              </div>
            ))}
          </div>
          <p className="steps-note">{product.steps.note}</p>
        </div>
      </section>

      <ScheduleDemo />

      <section id="pakej" className="pricing" aria-labelledby="pakej-title">
        <div className="frame">
          <div className="pricing-grid">
            <div className="pricing-head">
              <h2 id="pakej-title" className="t-2">
                {product.packagesTitle}
              </h2>
              <p>Dari {formatRM(fromPriceSen(product))}. Bayar sekali.</p>
            </div>
            {product.packages.map((p, i) => (
              <PackageTile key={p.id} pkg={p} index={i} onChoose={choose} />
            ))}
          </div>
          <p className="pricing-note">{product.packagesNote}</p>
        </div>
      </section>

      <CheckoutForm product={product} selected={selected} onSelect={setSelected} />

      <section className="faq" aria-labelledby="faq-title">
        <div className="frame faq-grid">
          <div className="faq-head">
            <h2 id="faq-title" className="t-2">
              {product.faqTitle}
            </h2>
            <p>
              Soalan lain? <a href="/hubungi">Hubungi kami</a>.
            </p>
          </div>
          <div className="faq-list">
            {product.faq.map((f, i) => (
              <details key={f.question} className="faq-item" open={i === 0} name="faq">
                <summary>{f.question}</summary>
                <p>
                  {f.topic === 'Bayaran balik' ? (
                    <>
                      Sila baca <a href="/bayaran-balik">Polisi Bayaran Balik</a> sebelum membeli.
                    </>
                  ) : (
                    f.answer
                  )}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function PackageTile({ pkg, index, onChoose }: { pkg: Package; index: number; onChoose: (id: string) => void }) {
  const price = pkg.kind === 'checkout' ? formatRM(pkg.priceSen) : formatRM(pkg.displayPriceSen);
  return (
    <article className={`tile tile-${index + 1}`} aria-labelledby={`tile-${pkg.id}`}>
      <div className="tile-body">
        <h3 id={`tile-${pkg.id}`} className="tile-name">
          {pkg.name}
        </h3>
        <p className="tile-price">{price}</p>
        <p className="tile-for">{pkg.audience}</p>
        <ul className="ticks">
          {pkg.includes.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {pkg.kind === 'enquiry' && (
          <p className="tile-extra">Skop, harga akhir dan jadual dipersetujui secara bertulis sebelum kerja bermula.</p>
        )}
      </div>
      {pkg.kind === 'checkout' ? (
        <a
          className="tile-action"
          href={`?pakej=${pkg.id}#beli`}
          onClick={(e) => {
            e.preventDefault();
            onChoose(pkg.id);
          }}
        >
          {pkg.cta}
        </a>
      ) : (
        <a className="tile-action" href={pkg.enquiryPath}>
          {pkg.cta}
        </a>
      )}
    </article>
  );
}
