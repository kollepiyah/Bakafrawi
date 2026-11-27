// Struktur data & kalkulasi waktu murni untuk komposisi Remotion `WebShowcase` (3D Agency).
// Sengaja tanpa impor React agar bisa diimpor langsung oleh worker Node.js maupun Remotion.

export const FPS_SHOWCASE = 30;
export const JEDA_AWAL_SHOWCASE = 0.25;

export type KataShowcase = {
  teks: string;
  mulai: number;
  selesai: number;
};

export type SuaraBabakShowcase = {
  berkas: string | null;
  durasi: number;
  kata: KataShowcase[];
};

export type PropsWebShowcase = {
  merek: {
    nama: string;
    domain: string;
    url: string;
    aksen: string;
    aksenKedua: string;
    logo?: string;
    info: string;
    situsBakafrawi: string;
  };
  media: {
    desktopFull?: string;
    desktopFullTinggi?: number;
    desktopFullLebar?: number;
    desktopHero?: string;
    desktopMid?: string;
    mobileFull?: string;
    mobileFullTinggi?: number;
    mobileFullLebar?: number;
    mobileHero?: string;
  };
  hook: {
    badge: string;
    judul: string;
    sorotKata: string;
    sub: string;
    narasi: string;
    kataSorot: string[];
  };
  browser: {
    judulBagian: string;
    chips: string[];
    narasi: string;
    kataSorot: string[];
  };
  responsive: {
    badge: string;
    judul: string;
    poin: string[];
    narasi: string;
    kataSorot: string[];
  };
  spotlight: {
    badge: string;
    judul: string;
    labelKlik: string;
    daftar: string[];
    narasi: string;
    kataSorot: string[];
  };
  penutup: {
    judul: string;
    tombol: string;
    narasi: string;
    kataSorot: string[];
  };
  suara: SuaraBabakShowcase[];
  musik?: string | null;
  sfx?: {
    whoosh?: string | null;
    pop?: string | null;
    chime?: string | null;
  };
};

const DURASI_MIN_BABAK = [4.2, 6.2, 5.2, 5.5, 4.4];

/** Hitung frame mulai & durasi tiap babak (5 babak: hook, browser, responsive, spotlight, penutup). Murni. */
export function hitungDurasiWebShowcase(p: PropsWebShowcase) {
  let mulai = 0;
  const babak = DURASI_MIN_BABAK.map((minDetik, i) => {
    const s = p.suara?.[i];
    const detikSuara = Number(s?.durasi) > 0 ? Number(s.durasi) + JEDA_AWAL_SHOWCASE + 0.55 : minDetik;
    const detik = Math.max(minDetik, Math.min(18, detikSuara));
    const durasi = Math.round(detik * FPS_SHOWCASE);
    const item = { mulai, durasi };
    mulai += durasi;
    return item;
  });
  return { babak, total: Math.max(FPS_SHOWCASE * 15, mulai) };
}

export const contohWebShowcase: PropsWebShowcase = {
  merek: {
    nama: 'Pesantren Al Manshur',
    domain: 'almansur.id',
    url: 'https://almansur.id',
    aksen: '#10B981',
    aksenKedua: '#34E0CD',
    info: 'WA 0857-1047-7372 · bakafrawi.com',
    situsBakafrawi: 'bakafrawi.com',
  },
  media: {},
  hook: {
    badge: 'JASA WEB CUSTOM · PESANTREN',
    judul: 'WEBSITE MODERN SEPERTI ALMANSUR.ID',
    sorotKata: 'ALMANSUR.ID',
    sub: 'Contoh karya website custom dari Bakafrawi Project untuk lembaga pendidikan & pesantren.',
    narasi: 'Ingin pesantren atau lembaga Anda punya website sekeren almansur.id? Lihat hasil karya custom dari Bakafrawi Project ini.',
    kataSorot: ['pesantren', 'almansur.id', 'Bakafrawi'],
  },
  browser: {
    judulBagian: 'Tampilan Lengkap almansur.id',
    chips: ['Profil Pesantren', 'Info Pendaftaran', 'Berita & Galeri'],
    narasi: 'Desainnya bersih, berwibawa, dan langsung menyajikan profil, program pendidikan, hingga info pendaftaran santri secara rapi.',
    kataSorot: ['bersih', 'berwibawa', 'rapi'],
  },
  responsive: {
    badge: '100% RESPONSIF',
    judul: 'Rapi di Laptop Maupun HP',
    poin: ['Ringan dibuka di HP wali santri', 'Navigasi jelas & nyaman', 'Siap tampil di pencarian Google'],
    narasi: 'Baik dibuka lewat laptop maupun HP wali santri, seluruh tampilan otomatis menyesuaikan layar dengan cepat dan nyaman.',
    kataSorot: ['laptop', 'HP', 'cepat'],
  },
  spotlight: {
    badge: 'FITUR CUSTOM SESUAI KEBUTUHAN',
    judul: 'Bukan Templat Kaku',
    labelKlik: 'Lihat Program',
    daftar: ['Profil & visi misi lembaga lengkap', 'Formulir pendaftaran santri online', 'Panel admin mudah diperbarui sendiri'],
    narasi: 'Setiap halaman dirancang khusus sesuai karakter lembaga Anda, mudah dikelola admin, dan bisa ditambah sistem informasi pesantren.',
    kataSorot: ['khusus', 'mudah', 'pesantren'],
  },
  penutup: {
    judul: 'Mau Website Seperti almansur.id?',
    tombol: 'Konsultasi Gratis',
    narasi: 'Yuk konsultasi gratis bareng Bakafrawi Project sekarang. Klik link di bio atau hubungi WhatsApp kami!',
    kataSorot: ['konsultasi', 'gratis', 'Bakafrawi'],
  },
  suara: [],
  musik: null,
};
