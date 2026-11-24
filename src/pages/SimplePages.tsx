import { site } from '../data/site';
import { products, type EnquiryPackage } from '../data/products';
import { PageHead } from '../components/PageHead';
import { EnquiryForm } from '../components/EnquiryForm';
import { TeaserVideo } from '../components/TeaserVideo';

export function SiapPasangPage() {
  const product = products[0]!;
  const siap = product.packages.find((p): p is EnquiryPackage => p.kind === 'enquiry');
  const stills = product.steps.items.filter((s) => s.image);
  return (
    <>
      <PageHead id="sp-title" title="Siap Pasang: saya bina untuk anda." titleMark="Siap Pasang:">
        {siap && <p className="sp-price">{siap.priceLabel}</p>}
        <p className="t-3">
          Saya bina sistem lengkap dalam akaun anda. Harga asas untuk 1 akaun Threads. Akaun tambahan, post
          bergambar atau penulisan kandungan disebut harga selepas sesi 15 minit.
        </p>
      </PageHead>

      {siap && (
        <section className="scope" aria-label="Skop dan harga Siap Pasang">
          <div className="frame scope-grid">
            <div className="scope-col">
              <h2 className="t-3">Termasuk dalam harga asas</h2>
              <ul className="ticks">
                {siap.baseScope.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            <div className="scope-col">
              <h2 className="t-3">Disebut harga berasingan</h2>
              <ul className="ticks ticks-quoted">
                {siap.quotedSeparately.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="scope-care">{siap.carePlan}</p>
            </div>
            <div className="scope-how">
              <h2 className="t-3">Cara ia berjalan</h2>
              <ol className="how-steps">
                <li>Hantar pertanyaan</li>
                <li>Sesi 15 minit untuk faham keperluan anda</li>
                <li>Sebut harga bertulis</li>
                <li>Kerja bermula selepas sebut harga dipersetujui</li>
              </ol>
            </div>
          </div>
        </section>
      )}

      <section className="build" aria-labelledby="bina-title">
        <div className="frame">
          <h2 id="bina-title" className="t-2">
            Apa yang saya bina
          </h2>
          {/* Card grid of the real interface (Framer-style): video card plus one card per screenshot. */}
          <div className="bento">
            <div className="bento-card build-video bento-video">
              <TeaserVideo src={product.demo.videoSrc} poster={product.demo.posterSrc} label={product.demo.label} />
            </div>
            {stills.map((s) => (
              <figure key={s.name} className={`bento-card bento-shot bento-${s.name.toLowerCase()}`} data-reveal>
                <div className="bento-media">
                  <img src={s.image!.src} alt={s.image!.alt} width={s.image!.width} height={s.image!.height} loading="lazy" decoding="async" />
                </div>
                <figcaption>
                  <strong>{s.name}</strong>
                  <span>{s.text}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="enquiry" aria-labelledby="tanya-title">
        <div className="frame enquiry-grid">
          <div className="enquiry-intro">
            <h2 id="tanya-title" className="t-2">
              Selepas anda hantar
            </h2>
            <ul className="enquiry-next">
              <li>Saya baca pertanyaan anda dan membalas dalam 1–2 hari bekerja.</li>
              <li>Kita setuju skop, harga akhir dan jadual secara bertulis sebelum kerja bermula.</li>
              <li>Saya bina sistem dalam akaun anda. Semua akaun kekal milik anda.</li>
            </ul>
            <p className="enquiry-note">
              Mahu buat sendiri? Lihat pakej <a href="/produk/autopost-threads#pakej">Starter dan Masterclass</a>.
            </p>
          </div>
          <div className="enquiry-panel">
            <h2 className="t-3">Hantar pertanyaan</h2>
            <EnquiryForm />
          </div>
        </div>
      </section>
    </>
  );
}

export function ThankYouPage() {
  return (
    <PageHead id="ty-title" title="Terima kasih, bayaran anda sedang diproses.">
      <p className="t-3">
        Semak emel anda dalam beberapa minit untuk akses produk, jemputan group Telegram dan invois.
      </p>
      <p>
        Jika tiada dalam 30 minit, semak folder spam atau hubungi{' '}
        <a href={`mailto:${site.email}`}>{site.email}</a> dengan nombor pesanan anda.
      </p>
      <p>
        <a className="btn" href="/">
          Kembali ke laman utama
        </a>
      </p>
    </PageHead>
  );
}

export function ContactPage() {
  return (
    <>
      <PageHead id="hb-title" title="Hubungi kami">
        <p className="t-3">
          Ada soalan tentang produk atau pesanan anda? Kami membalas dalam 1–2 hari bekerja.
        </p>
      </PageHead>
      <section className="contact" aria-label="Cara menghubungi kami">
        <div className="frame contact-grid">
          <dl className="contact-list">
            <div>
              <dt>Emel</dt>
              <dd>
                <a href={`mailto:${site.email}`}>{site.email}</a>
              </dd>
            </div>
            <div>
              <dt>Threads</dt>
              <dd>
                <a href={site.threadsUrl} rel="noopener">
                  {site.threadsHandle}
                </a>
              </dd>
            </div>
            <div>
              <dt>Pembeli sedia ada</dt>
              <dd>
                Tanya terus dalam group Telegram sepanjang tempoh sokongan, {site.supportHours}.
              </dd>
            </div>
          </dl>
          <div className="company-card">
            <h2 className="t-3">Maklumat syarikat</h2>
            <p>
              <strong>{site.company}</strong>
              <br />
              No. Pendaftaran: {site.registration}
            </p>
            <p>Untuk pertanyaan pesanan, sertakan nombor pesanan anda (contoh: GB-…).</p>
          </div>
        </div>
      </section>
    </>
  );
}

export function NotFoundPage() {
  return (
    <PageHead id="nf-title" title="Halaman ini tidak dijumpai.">
      <p className="t-3">Pautan mungkin salah atau halaman telah dipindahkan.</p>
      <p>
        <a className="btn" href="/">
          Ke laman utama
        </a>
      </p>
    </PageHead>
  );
}
