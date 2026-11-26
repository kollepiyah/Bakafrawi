// Data, tipe, dan penghitung durasi untuk komposisi Remotion `CeritaMotion`
// (memadukan gaya Sejarah Perkamen ala @motionformat dan Malam Sinematik ala @waktunya.malam).

export const FPS_MOTION = 30;

export type TemaVisualMotion = 'perkamen' | 'malam';

export type JenisAdeganMotion = 'pembuka' | 'perkamen' | 'peta' | 'ilustrasi' | 'penutup';

export type KataWaktuMotion = {
  kata: string;
  mulai: number; // detik relatif terhadap awal adegan
  selesai: number; // detik relatif terhadap awal adegan
};

export type TitikPetaMotion = {
  nama: string;
  x: number; // koordinat pada viewBox 1080x1920
  y: number;
  pusat?: boolean;
  tunda?: number; // 0..1 progres jalur sebelum pin menyala
};

export type RutePetaMotion = {
  dariX: number;
  dariY: number;
  kontrolX: number;
  kontrolY: number;
  keX: number;
  keY: number;
  tundaMulai?: number; // 0..0.6
};

export type AdeganCeritaMotion = {
  nomor: number;
  jenis: JenisAdeganMotion;
  tema?: TemaVisualMotion;
  durasi: number; // detik
  gambarBerkas?: string; // berkas di public-dir Remotion
  /** Judul utama kartu (mis. gulungan perkamen atau judul episode pembuka). */
  judulKartu?: string;
  /** Baris kedua judul kartu (opsional, untuk dua warna ala perkamen). */
  judulBarisKedua?: string;
  /** Subjudul miring emas (pembuka/peta). */
  subjudulKartu?: string;
  /** Pil kecil (mis. "Bagian 1" / "Episode 1"). */
  lencanaBagian?: string;
  /** Pita era & lokasi (mis. "YAMAN · ABAD KE-15"). */
  pitaEra?: string;
  /** Baris atas/bawah plakat peta (mis. "Abad ke-15" / "Pelabuhan Mokha, Yaman"). */
  plakatTahun?: string;
  plakatTempat?: string;
  /** Teks narasi yang tampil sebagai subtitle kinetik. */
  narasi: string;
  /** Daftar kata (lowercase) yang disorot warna kuning/emas. */
  kataSorot?: string[];
  /** Berkas audio voice-over adegan (opsional). */
  suaraBerkas?: string;
  /** Penanda waktu tiap kata dari ElevenLabs atau estimasi proporsional. */
  kata?: KataWaktuMotion[];
  /** Gerak kamera perlahan. */
  kamera?: 'zoom_masuk' | 'zoom_keluar' | 'geser_kanan' | 'geser_kiri';
};

export type PropsCeritaMotion = {
  judulSerial: string;
  nomorEpisode: number;
  judulEpisode: string;
  akun: string;
  temaBawaan: TemaVisualMotion;
  kreditPenutup?: string;
  ajakanPenutup?: string;
  musik?: string | null;
  musikVolume?: number;
  sfxWhoosh?: string | null;
  adegan: AdeganCeritaMotion[];
};

export type JadwalAdeganMotion = {
  mulai: number;
  durasi: number;
};

export function hitungDurasiCeritaMotion(props: PropsCeritaMotion): {
  adegan: JadwalAdeganMotion[];
  total: number;
} {
  const daftar = Array.isArray(props.adegan) ? props.adegan : [];
  const adegan: JadwalAdeganMotion[] = [];
  let kursor = 0;
  for (const a of daftar) {
    const detik = Math.max(2.6, Math.min(28, Number(a.durasi) || 4.8));
    const durasi = Math.round(detik * FPS_MOTION);
    adegan.push({ mulai: kursor, durasi });
    kursor += durasi;
  }
  return { adegan, total: Math.max(FPS_MOTION * 5, kursor) };
}

/** Buat estimasi waktu per kata yang merata bila alignment presisi belum tersedia. */
export function buatWaktuKataProporsional(teks: string, durasiDetik: number, jedaAwal = 0.18): KataWaktuMotion[] {
  const kata = String(teks ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!kata.length) return [];
  const bobot = kata.map((k) => Math.max(2, k.replace(/[^a-zA-Z0-9]/g, '').length));
  const totalBobot = bobot.reduce((s, b) => s + b, 0);
  const rentang = Math.max(1.2, durasiDetik - jedaAwal - 0.35);
  let kursor = jedaAwal;
  return kata.map((k, idx) => {
    const porsi = (bobot[idx] / totalBobot) * rentang;
    const mulai = Number(kursor.toFixed(3));
    kursor += porsi;
    const selesai = Number(kursor.toFixed(3));
    return { kata: k, mulai, selesai };
  });
}

export const contohCeritaMotion: PropsCeritaMotion = {
  judulSerial: 'Jejak Qahwah',
  nomorEpisode: 1,
  judulEpisode: 'Qahwah',
  akun: '@lekkopi.id',
  temaBawaan: 'malam',
  kreditPenutup: 'Lek Kopi · Panjunan, Waru',
  ajakanPenutup: 'Simpan & bagikan jejak sejarah ini',
  musik: null,
  musikVolume: 0.18,
  sfxWhoosh: null,
  adegan: [
    {
      nomor: 1,
      jenis: 'pembuka',
      tema: 'malam',
      durasi: 5.0,
      lencanaBagian: 'Bagian 1',
      judulKartu: 'Qahwah',
      subjudulKartu: 'Jejak Sufi di Lembah Yaman',
      narasi: 'Tahukah kamu, minuman kopi lahir dari doa di sunyinya malam?',
      kataSorot: ['kopi', 'doa', 'malam'],
      kamera: 'zoom_masuk',
    },
    {
      nomor: 2,
      jenis: 'perkamen',
      tema: 'perkamen',
      durasi: 5.2,
      judulKartu: 'Buah Merah di',
      judulBarisKedua: 'Lereng Yaman',
      pitaEra: 'YAMAN · ABAD KE-15',
      narasi: 'Para ulama Syadziliyah menyeduh biji merah untuk menjaga dzikir hingga fajar.',
      kataSorot: ['Syadziliyah', 'biji', 'merah', 'dzikir', 'fajar'],
      kamera: 'zoom_masuk',
    },
    {
      nomor: 3,
      jenis: 'peta',
      tema: 'perkamen',
      durasi: 5.4,
      judulKartu: 'MOKHA',
      subjudulKartu: 'Gerbang Kopi Menuju Dunia',
      plakatTahun: 'Abad ke-15',
      plakatTempat: 'Pelabuhan Mokha, Yaman',
      narasi: 'Dari Pelabuhan Mokha, Qahwah berlayar menembus Kairo, Istanbul, hingga Nusantara.',
      kataSorot: ['Mokha', 'Qahwah', 'Nusantara'],
      kamera: 'zoom_masuk',
    },
    {
      nomor: 4,
      jenis: 'penutup',
      tema: 'malam',
      durasi: 4.4,
      judulKartu: 'Satu Tegukan, Seribu Kisah',
      subjudulKartu: 'Ketekunan yang menaklukkan zaman',
      narasi: 'Di balik setiap cangkir hangat hari ini, ada kisah ketekunan yang abadi.',
      kataSorot: ['cangkir', 'hangat', 'ketekunan', 'abadi'],
      kamera: 'zoom_keluar',
    },
  ],
};
