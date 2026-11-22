import type { ReactNode } from 'react';
import { site } from '../data/site';

/**
 * Legal text, in Malay, from "Kandungan growthbridge.ai (draf untuk semakan)".
 * Values in [brackets] still need the owner's answer. Not legal advice:
 * the owner reviews every word before go-live.
 */

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

export interface LegalDoc {
  title: string;
  /** One line under the title saying what the page is. */
  lead: string;
  intro?: ReactNode;
  sections: LegalSection[];
}

const Email = () => <a href={`mailto:${site.email}`}>{site.email}</a>;

export const terma: LegalDoc = {
  title: 'Terma & Syarat',
  lead: 'Syarat pembelian produk digital, kelas dan perkhidmatan di growthbridge.ai.',
  sections: [
    {
      id: 'siapa-kami',
      title: 'Siapa kami',
      body: (
        <p>
          Laman web growthbridge.ai dikendalikan oleh {site.company} (No. Pendaftaran {site.registration}),
          Malaysia (“kami”). Dengan membuat pembelian, anda bersetuju dengan terma ini.
        </p>
      ),
    },
    {
      id: 'produk',
      title: 'Produk',
      body: (
        <p>
          Kami menjual produk digital (manual, video, runbook), kelas online dan perkhidmatan setup.
          Kandungan setiap pakej diterangkan pada halaman produk semasa pembelian.
        </p>
      ),
    },
    {
      id: 'harga',
      title: 'Harga dan bayaran',
      body: (
        <p>
          Semua harga dalam Ringgit Malaysia (RM) dan dibayar sekali, kecuali pelan jagaan bulanan.
          Bayaran diproses oleh CHIP. Kami tidak melihat atau menyimpan butiran kad atau akaun bank anda.
        </p>
      ),
    },
    {
      id: 'penghantaran',
      title: 'Penghantaran',
      body: (
        <p>
          Akses kepada produk digital dihantar ke emel yang anda berikan selepas bayaran berjaya. Pastikan
          emel anda betul. Akses diberi kepada emel tersebut sahaja.
        </p>
      ),
    },
    {
      id: 'lesen',
      title: 'Lesen kegunaan peribadi',
      body: (
        <p>
          Anda mendapat lesen untuk menggunakan bahan bagi bisnes atau akaun anda sendiri. Anda tidak
          dibenarkan menyalin, berkongsi, menjual semula, atau mengajar semula bahan ini kepada orang lain,
          sama ada percuma atau berbayar. Kami boleh menarik balik akses jika lesen ini dilanggar, tanpa
          bayaran balik.
        </p>
      ),
    },
    {
      id: 'sokongan',
      title: 'Sokongan',
      body: (
        <p>
          Sokongan group Telegram tersedia selama 14 hari dari tarikh penghantaran, pada waktu yang
          dinyatakan dalam emel penghantaran. Sokongan meliputi setup sistem seperti dalam manual sahaja.
        </p>
      ),
    },
    {
      id: 'masterclass',
      title: 'Masterclass',
      body: (
        <p>
          Sesi 2 jam secara online perlu ditempah dan dihadiri dalam tempoh [60 hari] dari tarikh
          pembelian. Anda boleh tukar slot sekali dengan notis sekurang-kurangnya 48 jam. Runbook Claude
          diberi selepas sesi selesai.
        </p>
      ),
    },
    {
      id: 'siap-pasang',
      title: 'Siap Pasang',
      body: <p>Skop, harga akhir dan jadual dipersetujui secara bertulis sebelum kerja bermula.</p>,
    },
    {
      id: 'pihak-ketiga',
      title: 'Perkhidmatan pihak ketiga',
      body: (
        <p>
          Sistem ini menggunakan Threads, Notion, Make, Zernio, ChatGPT atau Claude. Akaun dan langganan
          tools tersebut ialah tanggungjawab anda, tertakluk kepada terma dan harga syarikat
          masing-masing, yang boleh berubah tanpa kawalan kami.
        </p>
      ),
    },
    {
      id: 'tiada-jaminan',
      title: 'Tiada jaminan hasil',
      body: (
        <p>
          Kami tidak menjamin jumlah tontonan, follower, jualan atau pendapatan. Hasil bergantung pada
          kandungan dan usaha anda.
        </p>
      ),
    },
    {
      id: 'liabiliti',
      title: 'Had liabiliti',
      body: (
        <p>
          Setakat yang dibenarkan undang-undang, liabiliti kami terhad kepada jumlah yang anda bayar untuk
          pembelian tersebut.
        </p>
      ),
    },
    {
      id: 'perubahan',
      title: 'Perubahan terma',
      body: (
        <p>
          Kami boleh mengemas kini terma ini. Terma yang terpakai ialah versi pada tarikh pembelian anda.
        </p>
      ),
    },
    {
      id: 'undang-undang',
      title: 'Undang-undang',
      body: <p>Terma ini tertakluk kepada undang-undang Malaysia.</p>,
    },
  ],
};

export const privasi: LegalDoc = {
  title: 'Notis Privasi',
  lead: 'Data yang kami kumpul, kenapa, siapa yang menerimanya, dan hak anda.',
  intro: <p>Notis ini dikeluarkan menurut Akta Perlindungan Data Peribadi 2010.</p>,
  sections: [
    {
      id: 'siapa-kami',
      title: 'Siapa kami',
      body: (
        <p>
          {site.company} ({site.registration}) ialah pengguna data bagi maklumat yang anda berikan di
          growthbridge.ai.
        </p>
      ),
    },
    {
      id: 'data',
      title: 'Data yang kami kumpul',
      body: (
        <>
          <ul>
            <li>Nama, emel dan nombor telefon yang anda isi semasa membeli atau menghantar pertanyaan</li>
            <li>Butiran pesanan: produk, pakej, jumlah, tarikh dan status bayaran</li>
            <li>Maklumat bisnes dan mesej yang anda tulis dalam borang Siap Pasang</li>
          </ul>
          <p>
            Kami <strong>tidak</strong> menerima atau menyimpan nombor kad atau butiran akaun bank anda.
            Bayaran diproses terus oleh CHIP.
          </p>
        </>
      ),
    },
    {
      id: 'tujuan',
      title: 'Tujuan',
      body: (
        <p>
          Kami menggunakan data anda untuk memproses bayaran, menghantar akses produk dan invois, memberi
          sokongan, membalas pertanyaan, dan mematuhi keperluan undang-undang dan perakaunan. Kami tidak
          menjual data anda dan tidak menghantar emel pemasaran tanpa persetujuan anda.
        </p>
      ),
    },
    {
      id: 'penerima',
      title: 'Pihak yang menerima data',
      body: (
        <>
          <p>Kami berkongsi data setakat yang perlu dengan penyedia perkhidmatan yang membantu kami beroperasi:</p>
          <ul>
            <li>CHIP (pemprosesan bayaran)</li>
            <li>Cloudflare (hosting laman web)</li>
            <li>Notion (rekod pesanan)</li>
            <li>Make (automasi penghantaran)</li>
            <li>Google (emel dan perkongsian fail)</li>
            <li>Telegram (group sokongan)</li>
          </ul>
          <p>Sebahagian penyedia ini menyimpan data di pelayan luar Malaysia.</p>
        </>
      ),
    },
    {
      id: 'wajib',
      title: 'Wajib atau pilihan',
      body: (
        <p>
          Nama, emel dan telefon diperlukan untuk memproses pesanan. Tanpa maklumat ini, kami tidak dapat
          menghantar produk kepada anda.
        </p>
      ),
    },
    {
      id: 'tempoh',
      title: 'Tempoh simpanan',
      body: (
        <p>
          Rekod pesanan dan invois disimpan selama yang diperlukan oleh undang-undang cukai dan perakaunan
          Malaysia [sahkan: 7 tahun]. Data pertanyaan yang tidak menjadi pesanan dipadam selepas [12 bulan].
        </p>
      ),
    },
    {
      id: 'hak',
      title: 'Hak anda',
      body: (
        <p>
          Anda boleh meminta salinan data anda, membetulkan data yang salah, atau menarik balik persetujuan
          untuk penggunaan yang bukan wajib. Hantar permintaan ke <Email />. Kami akan membalas dalam
          tempoh 21 hari.
        </p>
      ),
    },
    {
      id: 'keselamatan',
      title: 'Keselamatan',
      body: (
        <p>
          Data disimpan dalam akaun yang dilindungi kata laluan dan pengesahan dua langkah. Akses produk
          diberi kepada emel anda sahaja.
        </p>
      ),
    },
    {
      id: 'kuki',
      title: 'Kuki',
      body: <p>Laman ini tidak menggunakan kuki pengiklanan.</p>,
    },
    {
      id: 'bahasa',
      title: 'Bahasa',
      body: <p>Jika terdapat percanggahan antara versi bahasa, versi Bahasa Melayu terpakai.</p>,
    },
  ],
};

export const bayaranBalik: LegalDoc = {
  title: 'Polisi Bayaran Balik',
  lead: 'Bila bayaran balik diberi, janji baiki atau pulang, dan cara memohon.',
  sections: [
    {
      id: 'produk-digital',
      title: 'Produk digital',
      body: (
        <p>
          Starter dan bahagian bahan dalam Masterclass ialah produk digital. Sebaik sahaja akses dihantar ke
          emel anda, bayaran tidak boleh dikembalikan, kecuali dalam keadaan di bawah.
        </p>
      ),
    },
    {
      id: 'baiki-atau-pulang',
      title: 'Janji baiki atau pulang',
      body: (
        <>
          <p>
            Jika anda ikut manual langkah demi langkah tetapi sistem tidak berfungsi, beritahu kami dalam
            group Telegram atau melalui emel dalam tempoh sokongan 14 hari. Kami akan bantu sehingga sistem
            berfungsi dalam akaun anda. Jika kami tidak dapat menjadikannya berfungsi, kami pulangkan
            bayaran penuh.
          </p>
          <p>
            Janji ini tidak meliputi masalah yang berpunca daripada perubahan, gangguan atau had pelan
            perkhidmatan pihak ketiga (Threads, Notion, Make, Zernio, ChatGPT atau Claude).
          </p>
        </>
      ),
    },
    {
      id: 'bayaran-balik-penuh',
      title: 'Bayaran balik penuh juga diberi jika',
      body: (
        <ul>
          <li>Anda dicaj dua kali untuk pesanan yang sama</li>
          <li>
            Akses tidak sampai kepada anda dan kami tidak dapat menyelesaikannya dalam 3 hari bekerja selepas
            anda menghubungi kami
          </li>
        </ul>
      ),
    },
    {
      id: 'masterclass',
      title: 'Masterclass',
      body: (
        <p>
          Jika anda batalkan sesi 1:1 sekurang-kurangnya 48 jam sebelum masa sesi, kami pulangkan RM170,
          iaitu bahagian sesi live. Bahan Starter yang telah dihantar kekal milik anda. Pembatalan kurang dari
          48 jam, atau tidak hadir tanpa notis, tidak layak untuk bayaran balik.
        </p>
      ),
    },
    {
      id: 'siap-pasang',
      title: 'Siap Pasang',
      body: <p>Tertakluk kepada perjanjian bertulis untuk projek tersebut.</p>,
    },
    {
      id: 'cara-memohon',
      title: 'Cara memohon',
      body: (
        <p>
          Emel <Email /> dengan nombor pesanan anda. Untuk caj berganda atau akses yang tidak sampai, mohon
          dalam 7 hari dari tarikh pembelian. Untuk janji baiki atau pulang, mohon dalam tempoh sokongan 14
          hari. Bayaran balik yang diluluskan dihantar melalui kaedah bayaran asal dalam 14 hari bekerja.
          Akses kepada bahan dan group sokongan akan ditarik balik.
        </p>
      ),
    },
  ],
};
