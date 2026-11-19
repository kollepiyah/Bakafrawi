// Satu-satunya tempat naskah, waktu, dan warna video iklan. Ubah teks/durasi di sini; komponen
// hanya membaca. Mesin Studio mengirim objek berbentuk sama lewat --props (naskah ditulis Claude,
// dirapikan studio/lib/video.mjs). Berkas ini hanya memakai TS yang bisa dibuang tipenya, supaya
// Node (mesin & tes) bisa mengimpornya langsung.

export type Kata = { teks: string; mulai: number; selesai: number }; // detik dari awal suara adegan
export type SuaraAdegan = { berkas: string; durasi: number; kata: Kata[] }; // berkas relatif public/
export type Layar = { berkas: string; lebar: number; tinggi: number }; // tangkapan layar aplikasi asli

// maskot: berkas pose karakter untuk adegan ini (di public/); kosong = memakai Naskah.maskot.
type Dasar = { narasi: string; kunci: string[]; durasi: number; pose?: string; maskot?: string };
export type Adegan =
  // Pembuka gaya karosel IG: label pil hitam, judul kapital bertumpuk (bagian `tekan` dalam kotak
  // warna), sub kalimat, coretan tangan berpanah, dua ikon bertegel "dari → ke".
  | (Dasar & { jenis: 'hook'; label: string; judul: string; tekan: string; sub: string; coretan: string; dari: string; ke: string })
  // Tangkapan layar asli di dalam HP + kotak perbesaran yang menyorot satu bagian.
  | (Dasar & { jenis: 'layar'; badge: string; layar: number; fokus_x: number; fokus_y: number; sorotan: string })
  // Mockup kasir (khusus aplikasi kasir/POS): produk masuk keranjang, bayar, struk.
  | (Dasar & { jenis: 'kasir'; badge: string; produk: { nama: string; harga: string }[]; total: string; lencana: string; struk: string })
  // Diagram simpul: produk di tengah tersambung ke 3 kartu, penghitung opsional, notifikasi.
  | (Dasar & { jenis: 'alur'; badge: string; simpul: string[]; notifikasi: string; hitung: { label: string; dari: number; ke: number } | null })
  // Kartu angka besar + grafik tumbuh + daftar centang.
  | (Dasar & { jenis: 'daftar'; badge: string; labelAngka: string; angka: string; catatan: string; daftar: string[] })
  | (Dasar & { jenis: 'penutup'; judul: string; tombol: string; info: string });

export type Naskah = {
  merek: { nama: string; logo?: string; utama: string; kedua: string; latar: string; kisi: string; tinta: string };
  adegan: Adegan[];
  layar?: Layar[];
  maskot?: string; // berkas di public/ (.webm transparan / .png); kosong = tata letak tanpa maskot
  musik?: string; // berkas di public/; volume otomatis mengecil saat narasi
  suara?: SuaraAdegan[]; // narasi edge-tts + waktu per kata (npm run siapkan / mesin Studio)
};

export const FPS = 30;
export const JEDA_AWAL = 0.35; // detik sebelum narasi mulai di tiap adegan (beri waktu visual masuk)
export const JEDA_AKHIR = 0.45;

export const naskahContoh: Naskah = {
  merek: { nama: 'Maktaba POS', logo: 'maktaba-logo.png', utama: '#0F2A5F', kedua: '#F5B800', latar: '#FAFAFA', kisi: '#EAEAEA', tinta: '#0B0B0F' },
  layar: [{ berkas: 'layar-dasbor.png', lebar: 1170, tinggi: 2532 }],
  adegan: [
    {
      jenis: 'hook', durasi: 5,
      narasi: 'Masih catat penjualan manual? Ini cara beresin operasional tokomu pakai Maktaba POS.',
      kunci: ['manual', 'Maktaba', 'POS'],
      label: 'Sebelum tutup toko hari ini',
      judul: 'Jangan rekap manual lagi, pakai Maktaba POS', tekan: 'Maktaba POS',
      sub: 'Kasir, stok, sampai laba — cukup dari HP.', coretan: 'beneran bisa dicoba gratis!',
      dari: 'Buku catatan', ke: 'Maktaba POS',
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
      total: 'Rp 104.500', lencana: 'Scan Barcode ✓', struk: 'Lunas · terkirim ke WhatsApp',
    },
    {
      jenis: 'alur', durasi: 10, badge: 'Pantau Stok',
      narasi: 'Kedua, stok barang otomatis terpotong setiap ada penjualan. Kalau ada barang yang mau habis, sistem langsung kasih pengingat sebelum kamu kehabisan stok.',
      kunci: ['otomatis', 'pengingat'],
      simpul: ['Stok Real-time', 'Peringatan Menipis', 'Laporan Harian'],
      notifikasi: 'Stok Kopi Arabika sisa 5!',
      hitung: { label: 'Kopi Arabika', dari: 12, ke: 5 },
    },
    {
      jenis: 'layar', durasi: 8, badge: 'Dasbor Pemilik',
      narasi: 'Omzet hari ini langsung kelihatan begitu kamu buka aplikasi.',
      kunci: ['omzet'],
      layar: 0, fokus_x: 0.4, fokus_y: 0.36, sorotan: 'Omzet hari ini',
    },
    {
      jenis: 'daftar', durasi: 13, badge: 'Laporan Otomatis',
      narasi: 'Tutup toko nggak perlu pusing rekap nota lagi. Semua omzet dan keuntungan bersih langsung terhitung otomatis, bisa kamu pantau dari HP kapan aja.',
      kunci: ['omzet', 'keuntungan', 'otomatis', 'HP'],
      labelAngka: 'Omzet hari ini', angka: 'Rp 2.885.500', catatan: '',
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
 * (tak pernah lebih pendek dari 60% durasi tulisan); tanpa suara, durasi tulisan yang dipakai. Murni.
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
