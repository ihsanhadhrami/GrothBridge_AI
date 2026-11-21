import { site } from '../data/site';
import { products } from '../data/products';
import { formatRM } from '../lib/money';
import { Bars } from '../components/Mark';
import { EnquiryForm } from '../components/EnquiryForm';

export function SiapPasangPage() {
  const siap = products[0]!.packages.find((p) => p.kind === 'enquiry');
  const price = siap && siap.kind === 'enquiry' ? formatRM(siap.displayPriceSen) : '';
  return (
    <section className="enquiry" aria-labelledby="sp-title">
      <div className="frame enquiry-grid">
        <div className="enquiry-intro">
          <h1 id="sp-title" className="t-1">
            Siap Pasang
          </h1>
          <p className="t-3">
            Saya bina sistem autopost Threads lengkap dalam akaun anda sendiri. {price}.
          </p>
          <h2 className="t-3 enquiry-next-title">Selepas anda hantar</h2>
          <ol className="enquiry-next">
            <li>Saya baca pertanyaan anda dan membalas dalam 1–2 hari bekerja.</li>
            <li>Kita setuju skop, harga akhir dan jadual secara bertulis sebelum kerja bermula.</li>
            <li>Saya bina sistem dalam akaun anda. Semua akaun kekal milik anda.</li>
          </ol>
          <p className="enquiry-note">{products[0]!.packagesNote}</p>
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
  );
}

export function ThankYouPage() {
  return (
    <section className="thanks" aria-labelledby="ty-title">
      <div className="frame thanks-grid">
        <div>
          <h1 id="ty-title" className="t-1">
            Terima kasih, bayaran anda sedang diproses.
          </h1>
          <p className="t-3">
            Semak emel anda dalam beberapa minit untuk akses produk, jemputan group Telegram dan invois.
          </p>
          <p>
            Jika tiada dalam 30 minit, semak folder spam atau hubungi{' '}
            <a href={`mailto:${site.email}`}>{site.email}</a> dengan nombor pesanan anda.
          </p>
          <a className="btn" href="/">
            Kembali ke laman utama
          </a>
        </div>
        <Bars className="thanks-bars" />
      </div>
    </section>
  );
}

export function ContactPage() {
  return (
    <section className="contact" aria-labelledby="hb-title">
      <div className="frame contact-grid">
        <div>
          <h1 id="hb-title" className="t-1">
            Hubungi kami
          </h1>
          <p className="t-3">
            Ada soalan tentang produk atau pesanan anda? Hubungi kami dan kami akan membalas dalam 1–2
            hari bekerja.
          </p>
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
              <dd>Tanya terus dalam group Telegram sepanjang tempoh sokongan.</dd>
            </div>
          </dl>
        </div>
        <div className="company-card">
          <h2 className="t-3">Maklumat syarikat</h2>
          <p>
            <strong>{site.company}</strong>
            <br />
            No. Pendaftaran: {site.registration}
            <br />
            {site.address}
          </p>
          <p>Untuk pertanyaan pesanan, sertakan nombor pesanan anda (contoh: GB-…).</p>
        </div>
      </div>
    </section>
  );
}

export function NotFoundPage() {
  return (
    <section className="thanks" aria-labelledby="nf-title">
      <div className="frame thanks-grid">
        <div>
          <h1 id="nf-title" className="t-1">
            Halaman ini tidak dijumpai.
          </h1>
          <p className="t-3">Pautan mungkin salah atau halaman telah dipindahkan.</p>
          <a className="btn" href="/">
            Ke laman utama
          </a>
        </div>
        <Bars className="thanks-bars" />
      </div>
    </section>
  );
}
