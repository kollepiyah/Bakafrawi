// Satu-satunya tempat naskah, waktu, dan warna video iklan. Ubah teks/durasi di sini; komponen
// hanya membaca. Mesin Studio nanti mengirim objek berbentuk sama lewat --props (ditulis Claude).

export type Kata = { teks: string; mulai: number; selesai: number }; // detik dari awal suara adegan
export type SuaraAdegan = { berkas: string; durasi: number; kata: Kata[] }; // berkas relatif public/

export type Adegan =
  | { jenis: 'hook'; narasi: string; kunci: string[]; durasi: number; judul: string; tekan: string; dari: string; ke: string }
  | { jenis: 'kasir'; narasi: string; kunci: string[]; durasi: number; badge: string; produk: { nama: string; harga: string }[]; total: string }
  | { jenis: 'stok'; narasi: string; kunci: string[]; durasi: number; badge: string; simpul: string[]; notifikasi: string }
  | { jenis: 'laporan'; narasi: string; kunci: string[]; durasi: number; badge: string; omzet: string; daftar: string[] }
  | { jenis: 'penutup'; narasi: string; kunci: string[]; durasi: number; judul: string; tombol: string; info: string };

export type Naskah = {
  merek: { nama: string; logo?: string; utama: string; kedua: string; latar: string; kisi: string; tinta: string };
  adegan: Adegan[];
  maskot?: string; // berkas di public/ (.webm transparan / .png); kosong = tata letak tanpa maskot
  musik?: string; // berkas di public/; volume otomatis mengecil saat narasi
  suara?: SuaraAdegan[]; // hasil `npm run siapkan` (edge-tts + waktu per kata)
};

export const FPS = 30;
export const JEDA_AWAL = 0.35; // detik sebelum narasi mulai di tiap adegan (beri waktu visual masuk)
export const JEDA_AKHIR = 0.45;

export const naskahContoh: Naskah = {
  merek: { nama: 'Maktaba POS', logo: 'maktaba-logo.png', utama: '#0F2A5F', kedua: '#F5B800', latar: '#FAFAFA', kisi: '#EAEAEA', tinta: '#0B0B0F' },
  adegan: [
    {
      jenis: 'hook', durasi: 5,
      narasi: 'Masih catat penjualan manual? Ini cara beresin operasional tokomu pakai Maktaba POS.',
      kunci: ['manual', 'Maktaba', 'POS'],
      judul: 'Kelola toko', tekan: 'pakai Maktaba POS', dari: 'Buku catatan manual', ke: 'Toko rapi & untung',
    },
    {
      jenis: 'kasir', durasi: 10, badge: 'Kasir Kilat',
      narasi: 'Pertama, transaksi di kasir jauh lebih cepat. Tinggal scan produk, pilih metode bayar, struk langsung beres tanpa bikin antrean panjang.',
      kunci: ['cepat', 'scan', 'struk'],
      produk: [
        { nama: 'Kopi Arabika 250g', harga: 'Rp 65.000' },
        { nama: 'Roti Tawar', harga: 'Rp 18.000' },
        { nama: 'Susu UHT 1L', harga: 'Rp 21.500' },
      ],
      total: 'Rp 104.500',
    },
    {
      jenis: 'stok', durasi: 10, badge: 'Pantau Stok',
      narasi: 'Kedua, stok barang otomatis terpotong setiap ada penjualan. Kalau ada barang yang mau habis, sistem langsung kasih pengingat sebelum kamu kehabisan stok.',
      kunci: ['otomatis', 'pengingat'],
      simpul: ['Stok Real-time', 'Peringatan Menipis', 'Laporan Harian'],
      notifikasi: 'Stok Kopi Arabika sisa 5!',
    },
    {
      jenis: 'laporan', durasi: 13, badge: 'Laporan Otomatis',
      narasi: 'Tutup toko nggak perlu pusing rekap nota lagi. Semua omzet dan keuntungan bersih langsung terhitung otomatis, bisa kamu pantau dari HP kapan aja.',
      kunci: ['omzet', 'keuntungan', 'otomatis', 'HP'],
      omzet: 'Rp 2.885.500',
      daftar: ['Omzet harian tercatat otomatis', 'Laba bersih langsung terhitung', 'Bisa dipantau lewat HP dari mana saja'],
    },
    {
      jenis: 'penutup', durasi: 7,
      narasi: 'Saatnya bikin tokomu naik kelas. Coba Maktaba POS sekarang dan rasakan gampangnya kelola usaha dalam satu aplikasi.',
      kunci: ['naik', 'kelas', 'Maktaba', 'POS'],
      judul: 'Saatnya tokomu naik kelas', tombol: 'Coba Maktaba POS Sekarang', info: 'bakafrawi.com · WA 0878-9266-3748',
    },
  ],
};

/**
 * Waktu tiap adegan dalam bingkai. Bila narasi sudah dibuat, durasi = jeda awal + suara + jeda akhir
 * (tak pernah lebih pendek dari durasi tulisan); tanpa suara, durasi tulisan yang dipakai. Murni.
 */
export function hitungWaktu(n: Naskah, fps = FPS) {
  let mulai = 0;
  const adegan = n.adegan.map((a, i) => {
    const s = n.suara?.[i];
    const detik = s ? Math.max(a.durasi * 0.6, JEDA_AWAL + s.durasi + JEDA_AKHIR) : a.durasi;
    const durasi = Math.round(detik * fps);
    const w = { mulai, durasi };
    mulai += durasi;
    return w;
  });
  return { adegan, total: Math.max(1, mulai) };
}
