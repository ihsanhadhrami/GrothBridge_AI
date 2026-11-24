import type { ReactNode } from 'react';
import { products } from './data/products';
import { site } from './data/site';
import type { PageMeta } from './seo';
import { HomePage } from './pages/HomePage';
import { ProductPage } from './pages/ProductPage';
import { LegalPage } from './pages/LegalPage';
import { ContactPage, NotFoundPage, SiapPasangPage, ThankYouPage } from './pages/SimplePages';
import { bayaranBalik, penghantaran, privasi, terma } from './content/legal';

export interface RouteDef {
  meta: PageMeta;
  render: () => ReactNode;
}

/** Every page on the site. Product routes come from src/data/products.ts. */
export const routes: RouteDef[] = [
  {
    meta: {
      path: '/',
      title: 'GrowthBridge | Sistem AI dan automasi untuk bisnes anda',
      description:
        'Produk dan kelas AI oleh Ihsan Hadhrami. Belajar sendiri, setup bersama, atau siap pasang. Semuanya berjalan dalam akaun anda sendiri.',
    },
    render: () => <HomePage />,
  },
  ...products.map(
    (p): RouteDef => ({
      meta: {
        path: `/produk/${p.slug}`,
        title: p.seo.title,
        description: p.seo.description,
        image: p.seo.image,
        imageAlt: p.seo.imageAlt,
        type: 'product',
      },
      render: () => <ProductPage product={p} />,
    }),
  ),
  {
    meta: {
      path: '/siap-pasang',
      title: 'Siap Pasang | GrowthBridge',
      description: 'Saya bina sistem autopost Threads lengkap dalam akaun anda sendiri. Hantar pertanyaan.',
    },
    render: () => <SiapPasangPage />,
  },
  {
    meta: {
      path: '/terima-kasih',
      title: 'Terima kasih | GrowthBridge',
      description: 'Bayaran anda sedang diproses. Semak emel anda untuk akses produk dan invois.',
      noindex: true,
    },
    render: () => <ThankYouPage />,
  },
  {
    meta: {
      path: '/terma',
      title: 'Terma & Syarat | GrowthBridge',
      description: `Terma dan syarat pembelian di growthbridge.my, dikendalikan oleh ${site.company}.`,
      type: 'article',
    },
    render: () => <LegalPage doc={terma} />,
  },
  {
    meta: {
      path: '/privasi',
      title: 'Notis Privasi | GrowthBridge',
      description: 'Notis privasi menurut Akta Perlindungan Data Peribadi 2010: data yang kami kumpul dan hak anda.',
      type: 'article',
    },
    render: () => <LegalPage doc={privasi} />,
  },
  {
    meta: {
      path: '/bayaran-balik',
      title: 'Polisi Bayaran Balik | GrowthBridge',
      description: 'Bila bayaran balik diberi, proses troubleshooting atau refund, dan cara memohon.',
      type: 'article',
    },
    render: () => <LegalPage doc={bayaranBalik} />,
  },
  {
    meta: {
      path: '/penghantaran',
      title: 'Polisi Penghantaran | GrowthBridge',
      description: 'Penghantaran produk digital melalui emel: tempoh, apa perlu dibuat jika tidak sampai, dan pemulangan.',
      type: 'article',
    },
    render: () => <LegalPage doc={penghantaran} />,
  },
  {
    meta: {
      path: '/hubungi',
      title: 'Hubungi Kami | GrowthBridge',
      description: `Hubungi ${site.company} (${site.registration}) melalui emel atau Threads.`,
    },
    render: () => <ContactPage />,
  },
];

export const notFound: RouteDef = {
  meta: {
    path: '/404',
    title: 'Halaman tidak dijumpai | GrowthBridge',
    description: 'Halaman ini tidak dijumpai.',
    noindex: true,
  },
  render: () => <NotFoundPage />,
};

export function normalisePath(pathname: string): string {
  let p = pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return p || '/';
}

export function matchRoute(pathname: string): RouteDef {
  const p = normalisePath(pathname);
  return routes.find((r) => r.meta.path === p) ?? notFound;
}
