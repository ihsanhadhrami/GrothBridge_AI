import type { ReactNode } from 'react';
import { site } from '../data/site';
import { products } from '../data/products';
import { Bars, Mark } from './Mark';

const nav = [
  { href: '/produk/autopost-threads', label: 'Autopost Threads' },
  { href: '/siap-pasang', label: 'Siap Pasang' },
  { href: '/hubungi', label: 'Hubungi' },
];

const legal = [
  { href: '/terma', label: 'Terma & Syarat' },
  { href: '/privasi', label: 'Notis Privasi' },
  { href: '/bayaran-balik', label: 'Polisi Bayaran Balik' },
  { href: '/penghantaran', label: 'Polisi Penghantaran' },
  { href: '/hubungi', label: 'Hubungi Kami' },
];

export function Layout({ path, children }: { path: string; children: ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#kandungan">
        Langkau ke kandungan
      </a>
      <header className="site-header">
        <div className="frame header-row">
          <a href="/" className="wordmark" aria-label="GrowthBridge, laman utama">
            <Mark className="wordmark-mark" />
            <span>GrowthBridge</span>
          </a>
          <nav aria-label="Utama" className="main-nav">
            <ul>
              {nav.map((l) => (
                <li key={l.href}>
                  <a href={l.href} aria-current={path === l.href ? 'page' : undefined}>
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <a className="btn btn-small" href="/produk/autopost-threads#pakej">
            Lihat pakej
          </a>
        </div>
      </header>

      <main id="kandungan" tabIndex={-1}>
        {children}
      </main>

      <footer className="site-footer">
        <div className="frame">
          <Bars className="footer-bars" live />
          <div className="footer-grid">
            <div className="footer-intro">
              <p className="footer-brand">GrowthBridge</p>
              <p>
                Produk dan kelas AI oleh {site.owner}. Semuanya berjalan dalam akaun anda sendiri.
              </p>
            </div>
            <nav aria-label="Produk">
              <h2 className="footer-head">Produk</h2>
              <ul>
                {products.map((p) => (
                  <li key={p.slug}>
                    <a href={`/produk/${p.slug}`}>{p.name}</a>
                  </li>
                ))}
                <li>
                  <a href="/siap-pasang">Siap Pasang</a>
                </li>
              </ul>
            </nav>
            <nav aria-label="Polisi">
              <h2 className="footer-head">Polisi</h2>
              <ul>
                {legal.map((l) => (
                  <li key={l.href}>
                    <a href={l.href}>{l.label}</a>
                  </li>
                ))}
              </ul>
            </nav>
            <div>
              <h2 className="footer-head">Hubungi</h2>
              <ul>
                <li>
                  <a href={`mailto:${site.email}`}>{site.email}</a>
                </li>
                <li>
                  <a href={site.threadsUrl} rel="noopener">
                    Threads {site.threadsHandle}
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <p className="footer-legal">
            © 2026 {site.company} ({site.registration}) ·{' '}
            <a href={`mailto:${site.email}`}>{site.email}</a>
          </p>
        </div>
      </footer>
    </>
  );
}
