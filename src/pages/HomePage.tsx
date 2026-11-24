import { fromPriceSen, products } from '../data/products';
import { site } from '../data/site';
import { formatRM } from '../lib/money';
import { Bars } from '../components/Mark';
import { TeaserVideo } from '../components/TeaserVideo';
import { Highlight } from '../components/Highlight';

export function HomePage() {
  const autopost = products[0]!;
  const siap = autopost.packages.find((p) => p.kind === 'enquiry');
  const notion = autopost.steps.items.find((s) => s.name === 'Simpan')?.image;
  const threads = autopost.steps.items.find((s) => s.name === 'Post')?.image;

  return (
    <>
      <section className="h-hero" aria-labelledby="h-title">
        <div className="frame h-hero-grid">
          <h1 id="h-title" className="h-hero-title">
            <Highlight text="Sistem AI dan automasi untuk bisnes anda." mark="Sistem AI dan automasi" />
          </h1>
          <div className="h-hero-text">
            <p className="t-3">
              Belajar sendiri, setup bersama saya, atau biar saya bina untuk anda. Semuanya berjalan
              dalam akaun anda sendiri.
            </p>
            <a className="btn" href="#produk">
              Lihat produk
            </a>
          </div>
          <Bars className="h-hero-bars" live />
        </div>
      </section>

      <section id="produk" className="h-products" aria-labelledby="produk-title">
        <div className="frame">
          <h2 id="produk-title" className="t-2">
            Produk
          </h2>
          <div className="h-products-grid">
            {products.map((p) => (
              <article key={p.slug} className="h-product h-product-main" aria-labelledby={`hp-${p.slug}`} data-reveal>
                <div className="h-product-media">
                  <TeaserVideo src={p.demo.videoSrc} poster={p.demo.posterSrc} label={p.demo.label} />
                </div>
                <div className="h-product-body">
                  <h3 id={`hp-${p.slug}`} className="t-3">
                    {p.name}
                  </h3>
                  <p className="h-product-price">Dari {formatRM(fromPriceSen(p))}</p>
                  <p>{p.card.summary}</p>
                  <a className="btn" href={`/produk/${p.slug}`}>
                    {p.card.cta}
                  </a>
                </div>
              </article>
            ))}
            {siap && siap.kind === 'enquiry' && (
              <article className="h-product h-product-siap" aria-labelledby="hp-siap" data-reveal>
                <div className="h-product-body">
                  <h3 id="hp-siap" className="t-3">
                    Siap Pasang
                  </h3>
                  <p className="h-product-price">{siap.priceLabel}</p>
                  <p>Saya bina sistem lengkap dalam akaun anda.</p>
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
            <p className="statement">Saya {site.owner}, pengasas Growth Bridge.</p>
            <p>
              Saya bina sistem automasi dengan AI supaya kerja berulang berjalan sendiri, dan anda
              boleh fokus pada kerja yang betul-betul perlukan anda.
            </p>
            <p>
              Sistem autopost Threads yang saya ajar di sini ialah sistem yang saya guna setiap hari
              untuk akaun saya sendiri. Apa yang anda beli ialah apa yang saya pakai.
            </p>
            <p>
              Kenali latar belakang saya di{' '}
              <a href={site.ownerBackgroundUrl} rel="noopener">
                ihsanhadhrami.com
              </a>
              .
            </p>
            <p>
              Ikuti saya di Threads:{' '}
              <a href={site.threadsUrl} rel="noopener">
                {site.threadsHandle}
              </a>
            </p>
          </div>
          <div className="about-pictures">
            {notion && (
              <figure data-reveal>
                <img src={notion.src} alt={notion.alt} width={notion.width} height={notion.height} loading="lazy" decoding="async" />
                <figcaption>Content Bank saya dalam Notion.</figcaption>
              </figure>
            )}
            {threads && (
              <figure data-reveal>
                <img src={threads.src} alt={threads.alt} width={threads.width} height={threads.height} loading="lazy" decoding="async" />
                <figcaption>Post yang keluar sendiri di Threads.</figcaption>
              </figure>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
