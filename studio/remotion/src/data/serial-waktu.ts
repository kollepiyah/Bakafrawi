import type {
  EfekKartun,
  EkspresiKartun,
  KataTimestamp,
  PropertiKartun,
  TokohKartunId,
} from '../components/KarakterKartun.tsx';

export type {
  EfekKartun,
  EkspresiKartun,
  KataTimestamp,
  PropertiKartun,
  TokohKartunId,
};

export const FPS_SERIAL = 30;
export const DURASI_INTRO_DETIK = 2.4;
export const DURASI_PENUTUP_DETIK = 2.6;

export type KameraKartun =
  | 'diam'
  | 'zoom_masuk'
  | 'zoom_keluar'
  | 'geser_kiri'
  | 'geser_kanan'
  | 'goyang_kaget';

export type TokohPanggung = {
  id: TokohKartunId;
  nama?: string;
  ekspresi?: EkspresiKartun;
  properti?: PropertiKartun;
  efek?: EfekKartun;
};

export type AdeganSerialKartun = {
  nomor: number;
  durasi: number;
  latarKode: string;
  latarBerkas?: string;
  kartuWaktu?: string;
  kamera?: KameraKartun;
  tokohKiri?: TokohPanggung | null;
  tokohKanan?: TokohPanggung | null;
  pembicara: 'kiri' | 'kanan' | 'narator' | 'tanpa';
  namaPembicara: string;
  dialog: string;
  suaraBerkas?: string | null;
  kata?: KataTimestamp[];
  sfx?: 'pop' | 'whoosh' | 'tanpa';
};

export type PropsSerialKartun = {
  judulSerial: string;
  nomorEpisode: number;
  judulEpisode: string;
  akun: string;
  mood: 'komedi_ceria' | 'kehidupan_santai' | 'cerita_kopi';
  pertanyaanPenutup: string;
  infoKedai: string;
  latarIntroBerkas?: string;
  latarIntroKode?: string;
  musik?: string | null;
  musikVolume?: number;
  sfxPop?: string | null;
  sfxWhoosh?: string | null;
  sfxChime?: string | null;
  adegan: AdeganSerialKartun[];
};

export const contohSerialKartun: PropsSerialKartun = {
  judulSerial: 'Cerita di Lek Kopi',
  nomorEpisode: 1,
  judulEpisode: 'Salah Pesan Double Shot',
  akun: '@lekkopi.id',
  mood: 'komedi_ceria',
  pertanyaanPenutup: 'Tim kopi manis atau kopi pahit nih? Tulis di komen!',
  infoKedai: 'Panjunan, Waru, Sidoarjo · 14.00–23.00 WIB',
  latarIntroKode: 'outdoor',
  musik: null,
  musikVolume: 0.16,
  adegan: [
    {
      nomor: 1,
      durasi: 4.2,
      latarKode: 'bar',
      kartuWaktu: 'SORE DI PANJUNAN · 16.30',
      kamera: 'zoom_masuk',
      tokohKiri: {
        id: 'mas_barista',
        nama: 'Mas Lek',
        ekspresi: 'senyum',
        properti: 'kopi_panas',
        efek: 'tanpa',
      },
      tokohKanan: {
        id: 'mas_pelanggan',
        nama: 'Mas Danu',
        ekspresi: 'bangga',
        properti: 'tunjuk',
        efek: 'lampu_ide',
      },
      pembicara: 'kanan',
      namaPembicara: 'Mas Danu',
      dialog: 'Mas Lek, buatkan espresso double shot paling pahit, biar kelihatan dewasa!',
      kata: [
        { teks: 'Mas', mulai: 0.1, selesai: 0.35 },
        { teks: 'Lek,', mulai: 0.36, selesai: 0.65 },
        { teks: 'buatkan', mulai: 0.68, selesai: 1.1 },
        { teks: 'espresso', mulai: 1.12, selesai: 1.75 },
        { teks: 'double', mulai: 1.78, selesai: 2.2 },
        { teks: 'shot', mulai: 2.22, selesai: 2.6 },
        { teks: 'paling', mulai: 2.62, selesai: 3.0 },
        { teks: 'pahit!', mulai: 3.02, selesai: 3.6 },
      ],
    },
    {
      nomor: 2,
      durasi: 3.8,
      latarKode: 'outdoor',
      kamera: 'goyang_kaget',
      tokohKiri: {
        id: 'mas_barista',
        nama: 'Mas Lek',
        ekspresi: 'ketawa',
        properti: 'es_kopi',
        efek: 'tawa',
      },
      tokohKanan: {
        id: 'mas_pelanggan',
        nama: 'Mas Danu',
        ekspresi: 'kaget',
        properti: 'tanpa',
        efek: 'keringat',
      },
      pembicara: 'kiri',
      namaPembicara: 'Mas Lek',
      dialog: 'Siap Mas, tapi ini sedotan sama gula arennya saya siapkan sekalian ya?',
    },
  ],
};

/** Hitung posisi frame tiap bagian serial kartun (Intro + Adegan[] + Penutup). Murni. */
export function hitungDurasiSerialKartun(props: PropsSerialKartun) {
  const introFrames = Math.round(DURASI_INTRO_DETIK * FPS_SERIAL);
  const penutupFrames = Math.round(DURASI_PENUTUP_DETIK * FPS_SERIAL);
  let mulai = introFrames;
  const jadwal = (props.adegan ?? []).map((a) => {
    const durasi = Math.max(Math.round(1.8 * FPS_SERIAL), Math.round((Number(a.durasi) || 3.4) * FPS_SERIAL));
    const seg = { mulai, durasi };
    mulai += durasi;
    return seg;
  });
  const penutupMulai = mulai;
  const total = Math.max(introFrames + penutupFrames + FPS_SERIAL, penutupMulai + penutupFrames);
  return {
    introFrames,
    jadwal,
    penutupMulai,
    penutupFrames,
    total,
    totalDetik: total / FPS_SERIAL,
  };
}
