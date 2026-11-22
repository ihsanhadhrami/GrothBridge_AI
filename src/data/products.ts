/**
 * The only place products, packages and prices are defined.
 * Imported by the site (pages, prerender) and by the Worker (checkout,
 * webhook amount checks). Money is always in sen: RM89.00 = 8900.
 *
 * Adding a product = a new entry in `products` + one Make delivery template.
 */

export type PackageKind = 'checkout' | 'enquiry';

interface PackageBase {
  /** Stable id. Sent to CHIP, Notion and Make; never rename once live. */
  id: string;
  name: string;
  /** Who the package is for (one short line). */
  audience: string;
  /** What the buyer gets, one line each. */
  includes: string[];
  /** Button label on the product page. */
  cta: string;
}

/** Bought on the site through CHIP. */
export interface CheckoutPackage extends PackageBase {
  kind: 'checkout';
  priceSen: number;
}

/** Not sold on the site: the button leads to an enquiry form. */
export interface EnquiryPackage extends PackageBase {
  kind: 'enquiry';
  /** Shown on the page only. Never charged; the final price is agreed in writing. */
  displayPriceSen: number;
  enquiryPath: string;
}

export type Package = CheckoutPackage | EnquiryPackage;

export interface Step {
  name: string;
  text: string;
  /** A real still from the product (crop of the demo video). */
  image?: { src: string; alt: string; width: number; height: number };
  /** Or a line of real output, set as type. */
  quote?: string;
}

export interface Faq {
  /** One or two words, used as the card's tab. */
  topic: string;
  question: string;
  answer: string;
}

export interface Product {
  slug: string;
  name: string;
  /** Home page card. */
  card: { summary: string; cta: string };
  seo: { title: string; description: string; image: string; imageAlt: string };
  /** titleMark: the opening words of the title, set on a green slab. */
  hero: { title: string; titleMark?: string; tagline: string; lead: string; cta: string };
  problem: { title: string; body: string; turn: string };
  steps: { title: string; items: Step[]; note: string };
  demo: { caption: string; videoSrc: string; posterSrc: string; label: string };
  packagesTitle: string;
  packagesNote: string;
  packages: Package[];
  faqTitle: string;
  faq: Faq[];
}

export const products: Product[] = [
  {
    slug: 'autopost-threads',
    name: 'Autopost Threads dengan AI',
    card: {
      summary: 'Post ke Threads setiap hari ikut jadual anda, tanpa upah sesiapa.',
      cta: 'Lihat pakej',
    },
    seo: {
      title: 'Autopost Threads dengan AI | GrowthBridge',
      description:
        'Sistem yang tulis, simpan dan post kandungan Threads anda ikut jadual. Starter RM89, Masterclass RM259.',
      image: '/og/og-autopost-threads.png',
      imageAlt: 'Autopost Threads dengan AI: post setiap hari, ikut jadual anda. Tanpa upah sesiapa.',
    },
    hero: {
      title: 'Post setiap hari, ikut jadual anda.',
      titleMark: 'Post setiap hari,',
      tagline: 'Ikut suara brand anda. Tanpa upah sesiapa.',
      lead: 'Sistem yang tulis, simpan dan post kandungan Threads anda ikut jadual. Anda semak, sistem yang post.',
      cta: 'Pilih pakej',
    },
    problem: {
      title: 'Konsisten di Threads itu yang paling susah.',
      body: 'Anda tahu post setiap hari membantu. Tapi hari sibuk, idea habis, dan post tertangguh. Upah admin pula kosnya bulanan.',
      turn: 'Sistem ini pisahkan dua kerja: anda tentukan apa yang hendak dikata, sistem uruskan bila ia keluar.',
    },
    steps: {
      title: 'Cara ia berfungsi',
      items: [
        {
          name: 'Tulis',
          text: 'ChatGPT atau Claude tulis draf ikut suara brand anda.',
          quote: 'Pengetahuan boleh bertambah, tapi skill belum tentu ikut bertambah.',
        },
        {
          name: 'Simpan',
          text: 'Draf masuk ke Content Bank dalam Notion. Anda semak dan tanda Ready.',
          image: {
            src: '/media/step-notion.jpg',
            alt: 'Content Bank Threads Queue dalam Notion: setiap baris satu post, dengan tarikh post dan status Posted, Draft atau Ready.',
            width: 522,
            height: 1080,
          },
        },
        {
          name: 'Jadual',
          text: 'Make ambil post Ready ikut masa yang anda tetapkan.',
          image: {
            src: '/media/step-make.webp',
            alt: 'Lima modul dalam Make: ambil post Ready hari ini, satu post pada satu masa, tuntut baris, jadualkan di Threads, tanda baris Posted.',
            width: 1080,
            height: 600,
          },
        },
        {
          name: 'Post',
          text: 'Zernio terbitkan ke Threads, dan Notion ditanda Posted.',
          image: {
            src: '/media/step-threads.jpg',
            alt: 'Post yang diterbitkan secara automatik di akaun Threads growthbridge.my.',
            width: 530,
            height: 1080,
          },
        },
      ],
      note: 'Semua akaun ialah akaun anda sendiri. Tiada apa yang berjalan dalam akaun saya.',
    },
    demo: {
      caption: 'Ini sistem sebenar yang post ke akaun saya setiap hari.',
      videoSrc: '/media/teaser-720.mp4',
      posterSrc: '/media/teaser-poster.jpg',
      label:
        'Video 40 saat: post ditanda Ready dalam Notion, kemudian keluar sendiri di Threads pada 7:30 dan 8:47 malam, diikuti langkah setup.',
    },
    packagesTitle: 'Pilih pakej anda',
    packagesNote: 'Pelan jagaan untuk Siap Pasang tersedia dari RM300/bulan (pilihan).',
    packages: [
      {
        id: 'starter',
        kind: 'checkout',
        name: 'Starter',
        priceSen: 8900,
        audience: 'Suka belajar ikut masa sendiri',
        includes: [
          'Manual PDF langkah demi langkah',
          'Video tutorial penuh',
          'Sokongan group Telegram 14 hari',
        ],
        cta: 'Beli Starter',
      },
      {
        id: 'masterclass',
        kind: 'checkout',
        name: 'Masterclass',
        priceSen: 25900,
        audience: 'Mahu setup bersama, dengan bimbingan',
        includes: [
          'Manual PDF langkah demi langkah',
          'Video tutorial penuh',
          'Sokongan group Telegram 14 hari',
          'Sesi live 1:1 online, 2 jam',
          'Runbook Claude (selepas sesi, kegunaan peribadi)',
        ],
        cta: 'Beli Masterclass',
      },
      {
        id: 'siap-pasang',
        kind: 'enquiry',
        name: 'Siap Pasang',
        displayPriceSen: 150000,
        enquiryPath: '/siap-pasang',
        audience: 'Mahu siap tanpa buat sendiri',
        includes: ['Saya bina sistem lengkap dalam akaun anda'],
        cta: 'Hantar pertanyaan',
      },
    ],
    faqTitle: 'Soalan lazim',
    faq: [
      {
        topic: 'Coding',
        question: 'Perlu pandai coding?',
        answer: 'Tidak. Anda ikut manual dan video langkah demi langkah. Anda cuma salin, tampal dan klik.',
      },
      {
        topic: 'Akaun',
        question: 'Akaun apa yang saya perlukan?',
        answer: 'Threads, Notion, Make, Zernio, dan ChatGPT atau Claude. Manual tunjuk cara buka setiap satu.',
      },
      {
        topic: 'Kos tools',
        question: 'Ada kos bulanan untuk tools ini?',
        answer:
          'Pelan percuma Notion sudah memadai. Make guna kira-kira 8 operasi sehari untuk 2 post, jadi semak had operasi bulanan pelan anda. Pelan dan harga setiap tool boleh berubah, dan kos itu dibayar terus kepada syarikat tool tersebut.',
      },
      {
        topic: 'Threads',
        question: 'Perlu tukar Threads ke akaun bisnes?',
        answer: 'Tidak perlu. Akaun Threads biasa sudah memadai.',
      },
      {
        topic: 'Kekerapan',
        question: 'Berapa kali sehari sistem boleh post?',
        answer: 'Ikut jadual yang anda tetapkan. Akaun saya post dua kali sehari.',
      },
      {
        topic: 'Penghantaran',
        question: 'Bila saya dapat bahan selepas bayar?',
        answer:
          'Emel dengan akses manual, video dan jemputan group Telegram dihantar secara automatik selepas bayaran berjaya. Jika tiada dalam 30 minit, semak folder spam atau hubungi saya.',
      },
      {
        topic: 'Sokongan',
        question: 'Sokongan group berjalan bagaimana?',
        answer: 'Anda boleh bertanya dalam group Telegram selama 14 hari dari tarikh pembelian. Saya jawab pada 9:00 pagi hingga 12:00 tengah hari.',
      },
      {
        topic: 'Masterclass',
        question: 'Bagaimana sesi Masterclass berjalan?',
        answer:
          'Selepas bayar, anda terima pautan untuk tempah slot. Sesi 2 jam secara online, one to one session. Kita setup sistem bersama dalam akaun anda. Runbook Claude diberi selepas sesi, untuk kegunaan peribadi sahaja.',
      },
      {
        topic: 'Hasil',
        question: 'Adakah sistem ini jamin viral atau naik follower?',
        answer: 'Tidak. Sistem ini membantu anda post secara konsisten. Hasilnya bergantung pada kandungan anda.',
      },
      {
        topic: 'Bayaran balik',
        question: 'Boleh dapat bayaran balik?',
        answer: 'Sila baca Polisi Bayaran Balik sebelum membeli.',
      },
    ],
  },
];

export function getProduct(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

/**
 * The price the Worker charges. Returns undefined for unknown products,
 * unknown packages and enquiry-only packages. Never accept a price from
 * the browser.
 */
export function getCheckoutPackage(
  productSlug: string,
  packageId: string,
): (CheckoutPackage & { product: Product }) | undefined {
  const product = getProduct(productSlug);
  const pkg = product?.packages.find((p) => p.id === packageId);
  if (!product || !pkg || pkg.kind !== 'checkout') return undefined;
  return { ...pkg, product };
}

export function checkoutPackages(product: Product): CheckoutPackage[] {
  return product.packages.filter((p): p is CheckoutPackage => p.kind === 'checkout');
}

/** Lowest checkout price, for "Dari RM89". */
export function fromPriceSen(product: Product): number {
  return Math.min(...checkoutPackages(product).map((p) => p.priceSen));
}
