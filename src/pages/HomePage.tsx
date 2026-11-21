import { fromPriceSen, products } from '../data/products';
import { site } from '../data/site';
import { formatRM } from '../lib/money';
import { Bars } from '../components/Mark';

export function HomePage() {
  const autopost = products[0]!;
  const siap = autopost.packages.find((p) => p.kind === 'enquiry');

  return (
    <>
      <section className="h-hero" aria-labelledby="h-title">
        <Bars className="h-hero-bars" />
        <div className="frame h-hero-text">
          <h1 id="h-title" className="t-1">
            Sistem AI dan automasi untuk bisnes anda.
          </h1>
          <p className="h-hero-lead t-3">
            Belajar sendiri, setup bersama saya, atau biar saya bina untuk anda. Semuanya berjalan
            dalam akaun anda sendiri.
          </p>
          <a className="btn" href="#produk">
            Lihat produk
          </a>
        </div>
      </section>

      <section id="produk" className="h-products" aria-labelledby="produk-title">
        <div className="frame">
          <h2 id="produk-title" className="t-2">
            Produk
          </h2>
          <div className="h-products-grid">
            {products.map((p) => (
              <article key={p.slug} className="h-product h-product-main" aria-labelledby={`hp-${p.slug}`}>
                <img
                  className="h-product-img"
                  src={p.demo.posterSrc}
                  alt="Content Bank Threads Queue dalam Notion, dari video demo."
                  width={720}
                  height={1280}
                  loading="lazy"
                  decoding="async"
                />
                <div className="h-product-body">
                  <h3 id={`hp-${p.slug}`} className="t-3">
                    {p.name}
                  </h3>
                  <p>{p.card.summary}</p>
                  <p className="h-product-price">Dari {formatRM(fromPriceSen(p))}</p>
                  <a className="btn" href={`/produk/${p.slug}`}>
                    {p.card.cta}
                  </a>
                </div>
              </article>
            ))}
            {siap && siap.kind === 'enquiry' && (
              <article className="h-product h-product-siap" aria-labelledby="hp-siap">
                <div className="h-product-body">
                  <h3 id="hp-siap" className="t-3">
                    Siap Pasang
                  </h3>
                  <p>Saya bina sistem lengkap dalam akaun anda.</p>
                  <p className="h-product-price">{formatRM(siap.displayPriceSen)}</p>
                  <a className="btn btn-dark" href={siap.enquiryPath}>
                    {siap.cta}
                  </a>
                </div>
                <img
                  className="h-product-img"
                  src="/media/step-make.webp"
                  alt="Lima modul automasi dalam Make, dari video demo."
                  width={1080}
                  height={600}
                  loading="lazy"
                  decoding="async"
                />
              </article>
            )}
          </div>
        </div>
      </section>

      <section className="about" aria-labelledby="tentang-title">
        <div className="frame about-grid">
          <h2 id="tentang-title" className="t-2">
            Tentang saya
          </h2>
          <div className="about-text">
            <p className="statement">
              Saya {site.owner}, {site.ownerRole} dan pengasas Growth Bridge.
            </p>
            <p>
              Saya bina sistem automasi dengan AI supaya kerja berulang berjalan sendiri, dan anda
              boleh fokus pada kerja yang betul-betul perlukan anda.
            </p>
            <p>
              Sistem autopost Threads yang saya ajar di sini ialah sistem yang saya guna setiap hari
              untuk akaun saya sendiri. Apa yang anda beli ialah apa yang saya pakai.
            </p>
            <p>
              Ikuti saya di Threads:{' '}
              <a href={site.threadsUrl} rel="noopener">
                {site.threadsHandle}
              </a>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
