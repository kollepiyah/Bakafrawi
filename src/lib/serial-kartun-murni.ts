// Aturan, tipe, & helper murni untuk Serial Kartun 2D Lek Kopi.
// Sengaja mandiri tanpa impor runtime relatif agar langsung lolos node --test maupun Next.js.

export type MoodSerial = "komedi_ceria" | "kehidupan_santai" | "cerita_kopi";
export type GayaKartunLatar = "ceria_hangat" | "santai_sore";
export type FormatSuaraSerial = "dialog" | "narator" | "campuran";
export type PanjangSerial = "ringkas" | "sedang" | "panjang";
export type GayaCeritaSerial = "kedai" | "dokumenter";
export type TemaVisualMotion = "malam" | "perkamen";
export type JenisAdeganMotion = "pembuka" | "perkamen" | "peta" | "ilustrasi" | "arsip" | "penutup";
export type GenderNaratorSerial = "pria" | "wanita";
export type GayaKarakterCerita = "ilustrasi" | "siluet";
export type TipeKarakterCerita =
  | "petualang"
  | "santri"
  | "petani"
  | "pedagang"
  | "wanita"
  | "pria"
  | "tetua"
  | "pemuda";
export type AksiKarakterCerita =
  | "jalan_kanan"
  | "jalan_kiri"
  | "dialog_dua"
  | "duduk_seduh"
  | "tatap_horizon"
  | "ramai_tiga"
  | "periksa_arsip"
  | "tunjuk_arsip"
  | "berdiri_tenang"
  | "tanpa";

export type KarakterMotionDraf = {
  aksi?: AksiKarakterCerita;
  tokohUtama?: TipeKarakterCerita;
  tokohKedua?: TipeKarakterCerita;
  gaya?: GayaKarakterCerita;
  properti?: string;
};

export const OPSI_TOKOH_MOTION: { kode: TipeKarakterCerita; label: string }[] = [
  { kode: "petualang", label: "Petualang / Penjelajah" },
  { kode: "santri", label: "Santri / Ulama (Peci & Sarung)" },
  { kode: "petani", label: "Petani Kebun (Caping)" },
  { kode: "pedagang", label: "Pedagang / Saudagar (Sorban)" },
  { kode: "wanita", label: "Wanita / Hijab" },
  { kode: "pria", label: "Pria Klasik" },
  { kode: "tetua", label: "Tetua / Sesepuh Bijak" },
  { kode: "pemuda", label: "Pemuda / Barista Modern" },
];

export const OPSI_AKSI_MOTION: { kode: AksiKarakterCerita; label: string }[] = [
  { kode: "jalan_kanan", label: "Berjalan ke Kanan" },
  { kode: "jalan_kiri", label: "Berjalan ke Kiri" },
  { kode: "dialog_dua", label: "Dialog 2 Tokoh" },
  { kode: "duduk_seduh", label: "Duduk di Meja Seduh Kopi" },
  { kode: "tatap_horizon", label: "Tatap Jauh / Horizon" },
  { kode: "ramai_tiga", label: "Ramai 3 Tokoh Berkumpul" },
  { kode: "periksa_arsip", label: "Membungkuk Periksa Arsip" },
  { kode: "tunjuk_arsip", label: "Menjelaskan / Tunjuk Objek" },
  { kode: "berdiri_tenang", label: "Berdiri Tenang" },
  { kode: "tanpa", label: "Tanpa Karakter (Ilustrasi Penuh)" },
];
export type MenuRingkasSerial = { nama: string; harga?: number; kategori?: string };
export type TokohKartunId =
  | "mas_barista"
  | "mas_pelanggan"
  | "mbak_pelanggan"
  | "pak_tetangga"
  | "kucing_kedai";

export type TokohSuaraId = "narator" | "mas_barista" | "mas_pelanggan" | "mbak_pelanggan" | "pak_tetangga";

export type KonfigSuaraTokoh = Partial<Record<TokohSuaraId, string>>;

export type LatarKartun = {
  id: string;
  kode: string;
  nama: string;
  deskripsi: string;
  urlKartun: string;
  jalurKartun: string;
  urlAsli?: string;
  jalurAsli?: string;
  gayaKartun: GayaKartunLatar;
  dibuat: string;
};

export type EpisodeSerial = {
  nomor: number;
  judul: string;
  ringkasan: string;
  tema: string;
  mood: MoodSerial;
  gayaCerita?: GayaCeritaSerial;
  temaVisual?: TemaVisualMotion;
  formatSuara?: FormatSuaraSerial;
  panjangNaskah?: PanjangSerial;
  genderNarator?: GenderNaratorSerial;
  adeganTerakhir?: string;
  jembatanBerikutnya?: string;
  tugasId?: string;
  dibuat: string;
};

export type KonteksLanjutanEpisode = {
  nomor: number;
  judul: string;
  ringkasan: string;
  tema?: string;
  adeganTerakhir?: string;
  jembatanBerikutnya?: string;
  kutipanAdeganAkhir?: string[];
};

export type SerialKartun = {
  id: string;
  judul: string;
  tagline: string;
  moodBawaan: MoodSerial;
  formatSuara: FormatSuaraSerial;
  suaraTokoh: KonfigSuaraTokoh;
  episode: EpisodeSerial[];
  dibuat: string;
};

export type KonfigSerialLekKopi = {
  latar: LatarKartun[];
  serial: SerialKartun[];
  serialAktifId: string;
};

export const OPSI_MOOD_SERIAL: { kode: MoodSerial; label: string; ket: string }[] = [
  { kode: "komedi_ceria", label: "Komedi Ceria", ket: "Lucu, hangat, tektokan seru ala nongkrong" },
  { kode: "kehidupan_santai", label: "Kehidupan Santai", ket: "Cerita keseharian dekat, ringan & relatable" },
  { kode: "cerita_kopi", label: "Cerita, Sejarah & Kopi", ket: "Kisah inspiratif, sejarah kopi & racikan khas Lek Kopi" },
];

export const OPSI_PANJANG_SERIAL: { kode: PanjangSerial; label: string; ket: string }[] = [
  { kode: "ringkas", label: "Ringkas (45–60 dtk)", ket: "6–8 adegan · 12–22 kata/adegan, pas untuk komedi cepat" },
  { kode: "sedang", label: "Sedang / Cerita Utuh (1–1,5 mnt)", ket: "7–10 adegan · 18–34 kata/adegan (2–3 kalimat natural)" },
  { kode: "panjang", label: "Panjang / Mendalam (1,5–2,5 mnt)", ket: "9–14 adegan · 22–48 kata/adegan, cocok kisah inspiratif & seri" },
];

export const OPSI_GAYA_KARTUN_LATAR: { kode: GayaKartunLatar; label: string; ket: string }[] = [
  { kode: "ceria_hangat", label: "Ceria & Hangat", ket: "Warna cerah hangat ala animasi slice-of-life" },
  { kode: "santai_sore", label: "Santai Sore / Malam", ket: "Lampu kedai hangat keemasan & suasana tenang" },
];

export const OPSI_LOKASI_LEKKOPI: { kode: string; label: string; deskripsiBawaan: string }[] = [
  { kode: "bar", label: "Meja Bar / Kasir", deskripsiBawaan: "Meja bar racikan kopi & mesin espresso Lek Kopi" },
  { kode: "outdoor", label: "Area Duduk Outdoor", deskripsiBawaan: "Kursi & meja outdoor di paving sisi jalan Panjunan" },
  { kode: "meja", label: "Meja Kopi", deskripsiBawaan: "Close-up meja kayu dengan gelas kopi segar" },
  { kode: "depan", label: "Depan Kedai", deskripsiBawaan: "Tampak depan kedai Lek Kopi Panjunan Waru" },
  { kode: "custom", label: "Lokasi Custom…", deskripsiBawaan: "Sudut kedai Lek Kopi" },
];

export const DAFTAR_TOKOH_LEKKOPI: {
  id: TokohKartunId;
  nama: string;
  peran: string;
  suaraId?: TokohSuaraId;
  deskripsi: string;
}[] = [
  {
    id: "mas_barista",
    nama: "Mas Lek",
    peran: "Barista Lek Kopi",
    suaraId: "mas_barista",
    deskripsi: "Barista ramah berapron hitam logo LK, jago racik kopi & sering jadi tempat curhat pelanggan.",
  },
  {
    id: "mas_pelanggan",
    nama: "Mas Danu",
    peran: "Pelanggan Langganan",
    suaraId: "mas_pelanggan",
    deskripsi: "Anak muda Waru pakai hoodie teal, polos, suka nyeletuk lucu soal kopi & kerjaan.",
  },
  {
    id: "mbak_pelanggan",
    nama: "Mbak Rara",
    peran: "Pelanggan Ceria",
    suaraId: "mbak_pelanggan",
    deskripsi: "Mahasiswi/pekerja berhijab terracotta, doyan Matcha Latte & Butterscoth Latte, paling peka kalau ada promo.",
  },
  {
    id: "pak_tetangga",
    nama: "Pak Budi",
    peran: "Warga Panjunan",
    suaraId: "pak_tetangga",
    deskripsi: "Bapak berkopiah hitam & kemeja rapi berkumis tipis, bijak tapi celetukannya suka bikin ngakak.",
  },
  {
    id: "kucing_kedai",
    nama: "Cimol",
    peran: "Kucing Oren Kedai",
    deskripsi: "Kucing oren gemoy penunggu paving Lek Kopi, muncul buat ekspresi kaget/penutup komedi.",
  },
];

export const IDE_CEPAT_SERIAL: { label: string; mood: MoodSerial; ide: string }[] = [
  {
    label: "Bingung Menu Manis vs Pahit",
    mood: "komedi_ceria",
    ide: "Pelanggan sok jago pesan espresso double shot padahal biasanya pesan es kopi susu manis, akhirnya minta ditambah susu diam-diam.",
  },
  {
    label: "Gajian Tanggal 2 vs Akhir Bulan",
    mood: "komedi_ceria",
    ide: "Beda gaya nongkrong Mas Danu pas baru gajian dibanding tanggal tua di Lek Kopi, tapi tetap kebeli segelas kopi hangat.",
  },
  {
    label: "Butterscoth Latte Jadi Rebutan",
    mood: "komedi_ceria",
    ide: "Mbak Rara pesen Butterscoth Latte Rp14.000, baru ditaruh di meja malah diserobot temannya yang bilang cuma nyicip satu sedot.",
  },
  {
    label: "Pulang Kerja Mampir Paving Waru",
    mood: "kehidupan_santai",
    ide: "Sore habis macet di Sidoarjo, duduk santai di outdoor Lek Kopi ditemani angin sore dan cerita ringan soal bersyukur hari ini.",
  },
  {
    label: "Kenapa Es Kopi Susu Selalu Bikin Kangen",
    mood: "cerita_kopi",
    ide: "Mas Lek cerita santai soal takaran espresso dan gula aren biar rasanya pas tidak terlalu pahit dan tidak kemanisan.",
  },
  {
    label: "Kucing Kedai Jadi Pengawas Bar",
    mood: "komedi_ceria",
    ide: "Cimol si kucing oren mantau Mas Lek meracik kopi dari ujung meja bar, bikin Pak Budi salah kira kucingnya ikut pesan kopi.",
  },
];

const POLA_VOICE_ID = /^[A-Za-z0-9_-]{8,64}$/;
const MOOD_SAH = new Set<MoodSerial>(["komedi_ceria", "kehidupan_santai", "cerita_kopi"]);
const GAYA_LATAR_SAH = new Set<GayaKartunLatar>(["ceria_hangat", "santai_sore"]);
const TOKOH_SUARA_SAH: TokohSuaraId[] = ["narator", "mas_barista", "mas_pelanggan", "mbak_pelanggan", "pak_tetangga"];

/** Bersihkan kode/slug lokasi agar aman dipakai di jalur Storage & tag adegan. */
export function bersihkanKodeLokasi(nilai: string, bawaan = "kedai"): string {
  const s = String(nilai ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return s || bawaan;
}

/** Konfigurasi bawaan untuk serial pertama Lek Kopi. */
export function konfigSerialBawaan(): KonfigSerialLekKopi {
  return {
    latar: [],
    serial: [
      {
        id: "cerita-lek-kopi",
        judul: "Cerita di Lek Kopi",
        tagline: "Obrolan ringan, komedi kedai, & segelas kopi dari Panjunan Waru.",
        moodBawaan: "komedi_ceria",
        formatSuara: "dialog",
        suaraTokoh: {},
        episode: [],
        dibuat: "2026-11-25T00:00:00.000Z",
      },
    ],
    serialAktifId: "cerita-lek-kopi",
  };
}

/** Rapikan konfigurasi serial & latar kartun dari JSON database. */
export function normalisasiKonfigSerial(mentah: unknown): KonfigSerialLekKopi {
  const bawaan = konfigSerialBawaan();
  if (!mentah || typeof mentah !== "object") return bawaan;
  const obj = mentah as Record<string, unknown>;

  const latar: LatarKartun[] = [];
  const idLatarSudah = new Set<string>();
  if (Array.isArray(obj.latar)) {
    for (const item of obj.latar) {
      if (!item || typeof item !== "object") continue;
      const r = item as Record<string, unknown>;
      const urlKartun = String(r.urlKartun ?? "").trim();
      const jalurKartun = String(r.jalurKartun ?? "").trim().replace(/^\/+/, "");
      if (!/^https:\/\//i.test(urlKartun) || !jalurKartun) continue;
      const id = String(r.id ?? "").trim() || `latar-${latar.length + 1}`;
      if (idLatarSudah.has(id)) continue;
      idLatarSudah.add(id);
      const gayaMentah = String(r.gayaKartun ?? "").trim() as GayaKartunLatar;
      const urlAsli = String(r.urlAsli ?? "").trim();
      const jalurAsli = String(r.jalurAsli ?? "").trim().replace(/^\/+/, "");
      latar.push({
        id,
        kode: bersihkanKodeLokasi(String(r.kode ?? "kedai")),
        nama: String(r.nama ?? "").trim().slice(0, 50) || "Sudut Lek Kopi",
        deskripsi: String(r.deskripsi ?? "").trim().slice(0, 140),
        urlKartun,
        jalurKartun,
        ...( /^https:\/\//i.test(urlAsli) ? { urlAsli } : {} ),
        ...( jalurAsli ? { jalurAsli } : {} ),
        gayaKartun: GAYA_LATAR_SAH.has(gayaMentah) ? gayaMentah : "ceria_hangat",
        dibuat: String(r.dibuat ?? "").trim() || new Date().toISOString(),
      });
      if (latar.length >= 20) break;
    }
  }

  const serial: SerialKartun[] = [];
  const idSerialSudah = new Set<string>();
  if (Array.isArray(obj.serial)) {
    for (const item of obj.serial) {
      if (!item || typeof item !== "object") continue;
      const s = item as Record<string, unknown>;
      const id = bersihkanKodeLokasi(String(s.id ?? ""), "");
      if (!id || idSerialSudah.has(id)) continue;
      idSerialSudah.add(id);

      const moodMentah = String(s.moodBawaan ?? "").trim() as MoodSerial;
      const fmtMentah = String(s.formatSuara ?? "").trim();
      const formatSuara: FormatSuaraSerial =
        fmtMentah === "narator" || fmtMentah === "campuran" ? fmtMentah : "dialog";

      const suaraTokoh: KonfigSuaraTokoh = {};
      if (s.suaraTokoh && typeof s.suaraTokoh === "object") {
        const st = s.suaraTokoh as Record<string, unknown>;
        for (const k of TOKOH_SUARA_SAH) {
          const val = String(st[k] ?? "").trim();
          if (POLA_VOICE_ID.test(val)) suaraTokoh[k] = val;
        }
      }

      const episode: EpisodeSerial[] = [];
      const nomorSudah = new Set<number>();
      if (Array.isArray(s.episode)) {
        for (const ep of s.episode) {
          if (!ep || typeof ep !== "object") continue;
          const e = ep as Record<string, unknown>;
          const nomor = Math.max(1, Math.round(Number(e.nomor) || 0));
          if (!nomor || nomorSudah.has(nomor)) continue;
          nomorSudah.add(nomor);
          const epMood = String(e.mood ?? "").trim() as MoodSerial;
          const tugasId = String(e.tugasId ?? "").trim();
          const epGaya = String(e.gayaCerita ?? "").trim();
          const epTemaVis = String(e.temaVisual ?? "").trim();
          const epFmt = String(e.formatSuara ?? "").trim();
          const epPanjang = String(e.panjangNaskah ?? "").trim();
          const epGender = String(e.genderNarator ?? "").trim();
          const epAkhir = String(e.adeganTerakhir ?? "").trim().slice(0, 450);
          const epJembatan = String(e.jembatanBerikutnya ?? "").trim().slice(0, 180);
          episode.push({
            nomor,
            judul: String(e.judul ?? "").trim().slice(0, 80) || `Episode ${nomor}`,
            ringkasan: String(e.ringkasan ?? "").trim().slice(0, 450),
            tema: String(e.tema ?? "").trim().slice(0, 120),
            mood: MOOD_SAH.has(epMood) ? epMood : "komedi_ceria",
            ...(epGaya === "dokumenter" || epGaya === "kedai" ? { gayaCerita: epGaya } : {}),
            ...(epTemaVis === "malam" || epTemaVis === "perkamen" ? { temaVisual: epTemaVis } : {}),
            ...(epFmt === "dialog" || epFmt === "narator" || epFmt === "campuran" ? { formatSuara: epFmt } : {}),
            ...(epPanjang === "ringkas" || epPanjang === "sedang" || epPanjang === "panjang"
              ? { panjangNaskah: epPanjang }
              : {}),
            ...(epGender === "pria" || epGender === "wanita" ? { genderNarator: epGender } : {}),
            ...(epAkhir ? { adeganTerakhir: epAkhir } : {}),
            ...(epJembatan ? { jembatanBerikutnya: epJembatan } : {}),
            ...(tugasId ? { tugasId } : {}),
            dibuat: String(e.dibuat ?? "").trim() || new Date().toISOString(),
          });
        }
        episode.sort((a, b) => a.nomor - b.nomor);
      }

      serial.push({
        id,
        judul: String(s.judul ?? "").trim().slice(0, 60) || "Cerita di Lek Kopi",
        tagline: String(s.tagline ?? "").trim().slice(0, 140),
        moodBawaan: MOOD_SAH.has(moodMentah) ? moodMentah : "komedi_ceria",
        formatSuara,
        suaraTokoh,
        episode: episode.slice(-50),
        dibuat: String(s.dibuat ?? "").trim() || new Date().toISOString(),
      });
      if (serial.length >= 10) break;
    }
  }

  const serialFinal = serial.length > 0 ? serial : bawaan.serial;
  const aktifMentah = bersihkanKodeLokasi(String(obj.serialAktifId ?? ""), "");
  const serialAktifId = serialFinal.some((s) => s.id === aktifMentah) ? aktifMentah : serialFinal[0].id;

  return { latar, serial: serialFinal, serialAktifId };
}

/** Hitung nomor episode berikutnya untuk sebuah serial. */
export function episodeBerikutnya(serial: SerialKartun | null | undefined): number {
  if (!serial?.episode?.length) return 1;
  return serial.episode.reduce((maks, ep) => Math.max(maks, Number(ep.nomor) || 0), 0) + 1;
}

/** Pilihan gaya cerita di admin; `otomatis` dipilih sistem (bergilir format). */
export type GayaCeritaPilihan = GayaCeritaSerial | "otomatis";

export type ProfilEpisodeOtomatis = {
  gayaCerita: GayaCeritaSerial;
  temaVisual: TemaVisualMotion;
  panjangNaskah: PanjangSerial;
  bersambung: boolean;
  formatSuara: FormatSuaraSerial;
  mood: MoodSerial;
  /** Label singkat untuk admin / log. */
  label: string;
};

const POLA_VARIASI_EPISODE: ProfilEpisodeOtomatis[] = [
  {
    label: "Serial kartun kedai (bersambung)",
    gayaCerita: "kedai",
    temaVisual: "malam",
    panjangNaskah: "sedang",
    bersambung: true,
    formatSuara: "dialog",
    mood: "komedi_ceria",
  },
  {
    label: "Kartun komedi sekali putar (tanpa lanjutan)",
    gayaCerita: "kedai",
    temaVisual: "malam",
    panjangNaskah: "ringkas",
    bersambung: false,
    formatSuara: "campuran",
    mood: "komedi_ceria",
  },
  {
    label: "Cerita kartun dokumenter (1 video / CeritaMotion)",
    gayaCerita: "dokumenter",
    temaVisual: "perkamen",
    panjangNaskah: "sedang",
    bersambung: false,
    formatSuara: "narator",
    mood: "cerita_kopi",
  },
  {
    label: "Cerita malam sinematik (1 video)",
    gayaCerita: "dokumenter",
    temaVisual: "malam",
    panjangNaskah: "panjang",
    bersambung: false,
    formatSuara: "narator",
    mood: "cerita_kopi",
  },
];

/**
 * Bergilirkan format supaya feed tidak hanya serial episodik: komedi kedai bersambung,
 * kartun sekali putar, dan cerita dokumenter/CeritaMotion satu video utuh.
 * Jika `lanjutEpisode` aktif, tetap kedai bersambung agar alur tidak putus.
 */
export function pilihProfilEpisodeOtomatis(opsi: {
  nomorEpisode: number;
  riwayatEpisode?: EpisodeSerial[];
  lanjutEpisode?: boolean;
}): ProfilEpisodeOtomatis {
  const riwayat = Array.isArray(opsi.riwayatEpisode) ? opsi.riwayatEpisode : [];
  const terakhir = riwayat.at(-1);

  if (opsi.lanjutEpisode) {
    return {
      label: "Lanjutan episode serial kedai",
      gayaCerita: terakhir?.gayaCerita === "dokumenter" ? "dokumenter" : "kedai",
      temaVisual: terakhir?.temaVisual === "perkamen" ? "perkamen" : "malam",
      panjangNaskah: terakhir?.panjangNaskah ?? "sedang",
      bersambung: true,
      formatSuara: terakhir?.formatSuara ?? "dialog",
      mood: terakhir?.mood ?? "komedi_ceria",
    };
  }

  const tigaTerakhir = riwayat.slice(-3);
  const semuaDokumenter =
    tigaTerakhir.length >= 2 && tigaTerakhir.every((e) => e.gayaCerita === "dokumenter");
  const semuaKedai =
    tigaTerakhir.length >= 2 && tigaTerakhir.every((e) => !e.gayaCerita || e.gayaCerita === "kedai");

  let idx = Math.max(0, (Math.max(1, Math.round(opsi.nomorEpisode)) - 1) % POLA_VARIASI_EPISODE.length);
  if (semuaKedai) idx = 2;
  else if (semuaDokumenter) idx = 0;

  return POLA_VARIASI_EPISODE[idx] ?? POLA_VARIASI_EPISODE[0];
}

/** Ubah pilihan admin (`otomatis` → rotasi profil) menjadi gaya siap render. */
export function selesaikanGayaCeritaDariPilihan(
  pilihan: GayaCeritaPilihan,
  opsi: {
    nomorEpisode: number;
    riwayatEpisode?: EpisodeSerial[];
    lanjutEpisode?: boolean;
  },
): GayaCeritaSerial {
  if (pilihan === "kedai" || pilihan === "dokumenter") return pilihan;
  return pilihProfilEpisodeOtomatis(opsi).gayaCerita;
}

/** Catat atau perbarui episode pada serial secara idempoten (anti-duplikat by tugasId atau nomor). */
export function catatEpisodeSelesai(
  konfig: KonfigSerialLekKopi,
  serialId: string,
  episodeBaru: EpisodeSerial,
): KonfigSerialLekKopi {
  const bersih = normalisasiKonfigSerial(konfig);
  const targetId = bersihkanKodeLokasi(serialId, bersih.serialAktifId);
  const indeksSerial = bersih.serial.findIndex((s) => s.id === targetId);
  if (indeksSerial < 0) return bersih;

  const serialLama = bersih.serial[indeksSerial];
  const epNorm: EpisodeSerial = {
    nomor: Math.max(1, Math.round(Number(episodeBaru.nomor) || episodeBerikutnya(serialLama))),
    judul: String(episodeBaru.judul ?? "").trim().slice(0, 80) || `Episode ${episodeBaru.nomor}`,
    ringkasan: String(episodeBaru.ringkasan ?? "").trim().slice(0, 450),
    tema: String(episodeBaru.tema ?? "").trim().slice(0, 120),
    mood: MOOD_SAH.has(episodeBaru.mood) ? episodeBaru.mood : serialLama.moodBawaan,
    ...(episodeBaru.gayaCerita ? { gayaCerita: episodeBaru.gayaCerita } : {}),
    ...(episodeBaru.temaVisual ? { temaVisual: episodeBaru.temaVisual } : {}),
    ...(episodeBaru.formatSuara ? { formatSuara: episodeBaru.formatSuara } : {}),
    ...(episodeBaru.panjangNaskah ? { panjangNaskah: episodeBaru.panjangNaskah } : {}),
    ...(episodeBaru.genderNarator ? { genderNarator: episodeBaru.genderNarator } : {}),
    ...(episodeBaru.adeganTerakhir ? { adeganTerakhir: String(episodeBaru.adeganTerakhir).trim().slice(0, 450) } : {}),
    ...(episodeBaru.jembatanBerikutnya ? { jembatanBerikutnya: String(episodeBaru.jembatanBerikutnya).trim().slice(0, 180) } : {}),
    ...(episodeBaru.tugasId ? { tugasId: String(episodeBaru.tugasId).trim() } : {}),
    dibuat: episodeBaru.dibuat || new Date().toISOString(),
  };

  const saring = serialLama.episode.filter(
    (e) => e.nomor !== epNorm.nomor && (!epNorm.tugasId || e.tugasId !== epNorm.tugasId),
  );
  const daftarEp = [...saring, epNorm].sort((a, b) => a.nomor - b.nomor).slice(-50);

  const serialUpdate = [...bersih.serial];
  serialUpdate[indeksSerial] = { ...serialLama, episode: daftarEp };

  return {
    ...bersih,
    serial: serialUpdate,
  };
}

/** Prompt image-to-image untuk menyulap foto asli kedai Lek Kopi menjadi latar kartun 2D ceria/santai. */
export function bangunPromptKartunkanFoto(gayaKartun: GayaKartunLatar = "ceria_hangat", namaLokasi = "Indonesian coffee shop"): string {
  const namaAman = String(namaLokasi ?? "Indonesian coffee shop").replace(/\s+/g, " ").trim().slice(0, 60);
  const suasana =
    gayaKartun === "santai_sore"
      ? "warm golden-hour late afternoon and cozy evening café lights, glowing amber pendant bulbs, relaxed peaceful slice-of-life mood, soft warm teal and honey shadows"
      : "bright cheerful warm sunlight, vibrant inviting coffee shop palette, warm amber wood and fresh cream accents, cheerful slice-of-life daytime/late-afternoon mood";

  return (
    `Transform this real photograph of ${namaAman} into a clean, charming 2D cel-shaded cartoon background illustration in modern Japanese slice-of-life / indie 2D animation style. ` +
    `Preserve the exact architecture, counter layout, chairs, paving, and recognizable furniture arrangement from the reference photo, simplified into crisp hand-drawn 2D outlines and flat-shaded painted textures. ` +
    `Lighting & mood: ${suasana}. ` +
    `Vertical 9:16 composition suitable as an empty animated background stage. ` +
    `STRICTLY NO people, NO customers, NO baristas, NO characters, NO floating text, NO garbled shop signs, and NO watermarks.`
  );
}

// ------------------------------------------------------------ AI Saran Cerita & Draf Naskah Serial

export type SaranCeritaSerial = {
  judul: string;
  premis: string;
  punchline: string;
  mood: MoodSerial;
  ideLengkap: string;
};

export type TokohDrafSerial = {
  id: TokohKartunId;
  ekspresi: string;
  properti: string;
  efek: string;
};

export type RisetCeritaSerial = {
  topik: string;
  ringkasanFakta: string;
  poinKronologi: string[];
  catatanKritis: string;
  sumber: string[];
};

export const SKEMA_RISET_CERITA_SERIAL = {
  type: "object",
  additionalProperties: false,
  required: ["topik", "ringkasanFakta", "poinKronologi", "catatanKritis", "sumber"],
  properties: {
    topik: { type: "string", description: "Topik sejarah atau kisah yang diriset" },
    ringkasanFakta: { type: "string", description: "Ringkasan fakta utama yang terverifikasi (3–5 kalimat)" },
    poinKronologi: {
      type: "array",
      items: { type: "string" },
      description: "Urutan kronologi sejarah/peristiwa yang terverifikasi (4–8 butir lengkap dengan abad/tempat bila diketahui)",
    },
    catatanKritis: {
      type: "string",
      description: "Catatan kritis sumber: bedakan catatan sejarah primer vs kisah populer atau tokoh yang sering tertukar bila ada",
    },
    sumber: {
      type: "array",
      items: { type: "string" },
      description: "Daftar rujukan kitab, sejarawan, atau sumber tepercaya yang ditemukan",
    },
  },
} as const;

export type AdeganDrafSerial = {
  nomor: number;
  latarKode: string;
  kartuWaktu: string;
  kamera: string;
  tokohKiri: TokohDrafSerial | null;
  tokohKanan: TokohDrafSerial | null;
  pembicara: "kiri" | "kanan" | "narator" | "tanpa";
  namaPembicara: string;
  dialog: string;
  promptVisual?: string;
  /** Khusus mode Dokumenter / CeritaMotion: jenis tata letak adegan. */
  jenisMotion?: JenisAdeganMotion;
  /** Judul kartu pembuka / gulungan perkamen / peta / penutup. */
  judulKartu?: string;
  /** Kata kunci yang disorot warna emas/kuning pada subtitle kinetik. */
  kataSorot?: string[];
  /** Pengaturan karakter 2D CeritaMotion per adegan (opsional; kosong = pilih otomatis bervariasi). */
  karakter?: KarakterMotionDraf;
  sfx: "pop" | "whoosh" | "tanpa";
};

export type NaskahDrafSerial = {
  judulEpisode: string;
  ringkasanEpisode: string;
  tema: string;
  adegan: AdeganDrafSerial[];
  pertanyaanPenutup: string;
  caption: string;
  hashtag: string[];
};

const TOKOH_SAH = new Set<TokohKartunId>(["mas_barista", "mas_pelanggan", "mbak_pelanggan", "pak_tetangga", "kucing_kedai"]);
const EKSPRESI_SAH = new Set(["senyum", "ketawa", "kaget", "mikir", "cemberut", "ngantuk", "bangga", "malu"]);
const PROPERTI_SAH = new Set(["tanpa", "es_kopi", "kopi_panas", "matcha_latte", "hp", "uang", "jempol", "tunjuk"]);
const EFEK_SAH = new Set(["tanpa", "tanda_tanya", "tanda_seru", "keringat", "hati", "lampu_ide", "tawa"]);
const KAMERA_SAH = new Set(["diam", "zoom_masuk", "zoom_keluar", "geser_kiri", "geser_kanan", "goyang_kaget"]);
const JENIS_MOTION_SAH = new Set<JenisAdeganMotion>(["pembuka", "perkamen", "peta", "ilustrasi", "arsip", "penutup"]);
const TOKOH_MOTION_SAH = new Set<TipeKarakterCerita>([
  "petualang",
  "santri",
  "petani",
  "pedagang",
  "wanita",
  "pria",
  "tetua",
  "pemuda",
]);
const AKSI_MOTION_SAH = new Set<AksiKarakterCerita>([
  "jalan_kanan",
  "jalan_kiri",
  "dialog_dua",
  "duduk_seduh",
  "tatap_horizon",
  "ramai_tiga",
  "periksa_arsip",
  "tunjuk_arsip",
  "berdiri_tenang",
  "tanpa",
]);

/** Urutan adegan tengah yang digilir tiap episode agar CeritaMotion tidak monoton. */
const ISI_MOTION_PER_EPISODE: JenisAdeganMotion[][] = [
  ["ilustrasi", "arsip", "perkamen", "peta", "ilustrasi"],
  ["perkamen", "ilustrasi", "arsip", "ilustrasi", "arsip"],
  ["arsip", "ilustrasi", "perkamen", "ilustrasi", "perkamen"],
  ["ilustrasi", "perkamen", "arsip", "peta", "ilustrasi"],
  ["perkamen", "arsip", "ilustrasi", "perkamen", "ilustrasi"],
  ["ilustrasi", "arsip", "ilustrasi", "perkamen", "peta"],
];

const KAMERA_MOTION_SAH = ["zoom_masuk", "zoom_keluar", "geser_kanan", "geser_kiri"] as const;
const POLA_KAMERA_KEDAI = ["zoom_masuk", "diam", "geser_kanan", "goyang_kaget", "geser_kiri", "zoom_keluar", "zoom_masuk", "diam"] as const;

/** Susun `jenisMotion` per indeks adegan sesuai episode & tema visual. */
export function bangunSkemaJenisMotion(
  nomorEpisode: number,
  jumlahAdegan: number,
  temaVisual: TemaVisualMotion = "malam",
): JenisAdeganMotion[] {
  const jumlah = Math.max(1, Math.min(16, Math.round(jumlahAdegan)));
  if (jumlah === 1) return ["pembuka"];
  const isiPool = ISI_MOTION_PER_EPISODE[(Math.max(1, nomorEpisode) - 1) % ISI_MOTION_PER_EPISODE.length];
  const tengah: JenisAdeganMotion[] = [];
  for (let i = 0; i < jumlah - 2; i++) {
    let jenis = isiPool[i % isiPool.length];
    if (temaVisual === "malam" && jenis === "perkamen" && i % 2 === 1) jenis = "ilustrasi";
    if (temaVisual === "perkamen" && jenis === "ilustrasi" && i % 3 === 2) jenis = "perkamen";
    tengah.push(jenis);
  }
  let sudahPeta = false;
  const isiRapi = tengah.map((j) => {
    if (j !== "peta") return j;
    if (sudahPeta) return "arsip";
    sudahPeta = true;
    return "peta";
  });
  return ["pembuka", ...isiRapi, "penutup"];
}

/** Kamera CeritaMotion per adegan (Ken Burns bervariasi). */
export function pilihKameraMotionOtomatis(
  idx: number,
  jenis: JenisAdeganMotion,
  nomorEpisode = 1,
): (typeof KAMERA_MOTION_SAH)[number] {
  if (jenis === "penutup") return "zoom_keluar";
  if (jenis === "peta" || jenis === "arsip") return idx % 2 === 0 ? "geser_kiri" : "geser_kanan";
  const pola = KAMERA_MOTION_SAH;
  return pola[(idx + nomorEpisode) % pola.length];
}

/** Kamera Serial Kartun kedai — hindari semua adegan `zoom_masuk`. */
export function pilihKameraKedaiOtomatis(idx: number, nomorEpisode = 1): string {
  return POLA_KAMERA_KEDAI[(idx + nomorEpisode) % POLA_KAMERA_KEDAI.length];
}

/** Teks resep motion untuk prompt AI (dokumenter). */
export function teksSkemaMotionUntukPrompt(
  nomorEpisode: number,
  jumlahAdegan: number,
  temaVisual: TemaVisualMotion,
): string {
  const skema = bangunSkemaJenisMotion(nomorEpisode, jumlahAdegan, temaVisual);
  return (
    `VARIASI LAYAR WAJIB EPISODE ${nomorEpisode} (ikuti urutan jenisMotion per adegan agar video tidak monoton):\n` +
    skema.map((j, i) => `  - Adegan ${i + 1}: jenisMotion "${j}"`).join("\n") +
    `\n- Berganti kamera: zoom_masuk, geser_kanan, geser_kiri, zoom_keluar (jangan semua sama).` +
    `\n- Sesekali isi karakter { aksi, tokohUtama }: jalan_kanan, dialog_dua, periksa_arsip, tatap_horizon, ramai_tiga (maks 1x peta).`
  );
}

/** Lengkapi jenisMotion/kamera hasil AI untuk dokumenter & kedai. */
export function terapkanVariasiMotionAdegan(
  adegan: AdeganDrafSerial[],
  opsi: { nomorEpisode?: number; gayaCerita?: GayaCeritaSerial; temaVisual?: TemaVisualMotion },
): AdeganDrafSerial[] {
  const nomorEpisode = Math.max(1, Math.round(Number(opsi.nomorEpisode) || 1));
  const dokumenter = opsi.gayaCerita === "dokumenter";
  const temaVisual = opsi.temaVisual === "perkamen" ? "perkamen" : "malam";
  const skema = dokumenter ? bangunSkemaJenisMotion(nomorEpisode, adegan.length, temaVisual) : null;

  const jenisTerisi = adegan.filter((a) => a.jenisMotion && JENIS_MOTION_SAH.has(a.jenisMotion)).length;
  const jenisUnik = new Set(adegan.map((a) => a.jenisMotion).filter(Boolean)).size;
  const paksaSkemaDokumenter =
    dokumenter && skema && adegan.length >= 5 && (jenisUnik <= 2 || jenisTerisi < Math.ceil(adegan.length * 0.6));

  return adegan.map((a, idx) => {
    const jenisMotion =
      dokumenter && skema
        ? paksaSkemaDokumenter || !a.jenisMotion || !JENIS_MOTION_SAH.has(a.jenisMotion)
          ? skema[idx]
          : a.jenisMotion
        : a.jenisMotion;

    const kameraMentah = String(a.kamera ?? "").trim();
    const kameraKosong = !kameraMentah || !KAMERA_SAH.has(kameraMentah);
    const kameraBaku = dokumenter ? kameraKosong || kameraMentah === "zoom_masuk" : kameraKosong;
    let kamera = kameraBaku
      ? dokumenter && jenisMotion
        ? pilihKameraMotionOtomatis(idx, jenisMotion, nomorEpisode)
        : pilihKameraKedaiOtomatis(idx, nomorEpisode)
      : kameraMentah;
    if (!KAMERA_SAH.has(kamera)) kamera = "zoom_masuk";

    let tokohKiri = a.tokohKiri;
    let tokohKanan = a.tokohKanan;
    if (!dokumenter && tokohKiri && idx % 3 === 1 && tokohKiri.efek === "tanpa" && tokohKiri.ekspresi === "senyum") {
      const efekBergilir = ["tanda_tanya", "lampu_ide", "tawa", "keringat", "hati"] as const;
      tokohKiri = { ...tokohKiri, efek: efekBergilir[(idx + nomorEpisode) % efekBergilir.length] };
    }
    if (!dokumenter && tokohKanan && idx % 4 === 2 && tokohKanan.ekspresi === "senyum") {
      const eksp = ["kaget", "ketawa", "mikir", "bangga", "malu"] as const;
      tokohKanan = { ...tokohKanan, ekspresi: eksp[(idx + nomorEpisode) % eksp.length] };
    }

    return {
      ...a,
      kamera,
      ...(jenisMotion ? { jenisMotion } : {}),
      tokohKiri,
      tokohKanan,
    };
  });
}

const NAMA_TOKOH_PETA: Record<string, string> = {
  mas_barista: "Mas Lek",
  mas_pelanggan: "Mas Danu",
  mbak_pelanggan: "Mbak Rara",
  pak_tetangga: "Pak Budi",
  kucing_kedai: "Cimol",
  narator: "Cerita Lek Kopi",
};

export const SKEMA_SARAN_CERITA_SERIAL = {
  type: "object",
  additionalProperties: false,
  required: ["saran"],
  properties: {
    saran: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["judul", "premis", "punchline", "mood", "ideLengkap"],
        properties: {
          judul: { type: "string", description: "Judul episode singkat 3-6 kata" },
          premis: { type: "string", description: "Setup cerita lucu/hangat 1-2 kalimat" },
          punchline: { type: "string", description: "Twist/ending atau pesan hangat di akhir cerita" },
          mood: { type: "string", enum: ["komedi_ceria", "kehidupan_santai", "cerita_kopi"] },
          ideLengkap: { type: "string", description: "Paragraf ringkas 2-3 kalimat siap dipakai untuk menulis naskah" },
        },
      },
    },
  },
} as const;

export const SKEMA_NASKAH_DRAF_SERIAL = {
  type: "object",
  additionalProperties: false,
  required: ["judulEpisode", "ringkasanEpisode", "tema", "adegan", "pertanyaanPenutup", "caption", "hashtag"],
  properties: {
    judulEpisode: { type: "string" },
    ringkasanEpisode: { type: "string" },
    tema: { type: "string" },
    adegan: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["nomor", "latarKode", "kartuWaktu", "kamera", "tokohKiri", "tokohKanan", "pembicara", "namaPembicara", "dialog", "sfx"],
        properties: {
          nomor: { type: "integer" },
          latarKode: { type: "string" },
          kartuWaktu: { type: "string" },
          kamera: { type: "string", enum: ["diam", "zoom_masuk", "zoom_keluar", "geser_kiri", "geser_kanan", "goyang_kaget"] },
          tokohKiri: {
            anyOf: [
              { type: "null" },
              {
                type: "object",
                additionalProperties: false,
                required: ["id", "ekspresi", "properti", "efek"],
                properties: {
                  id: { type: "string", enum: ["mas_barista", "mas_pelanggan", "mbak_pelanggan", "pak_tetangga", "kucing_kedai"] },
                  ekspresi: { type: "string", enum: ["senyum", "ketawa", "kaget", "mikir", "cemberut", "ngantuk", "bangga", "malu"] },
                  properti: { type: "string", enum: ["tanpa", "es_kopi", "kopi_panas", "matcha_latte", "hp", "uang", "jempol", "tunjuk"] },
                  efek: { type: "string", enum: ["tanpa", "tanda_tanya", "tanda_seru", "keringat", "hati", "lampu_ide", "tawa"] },
                },
              },
            ],
          },
          tokohKanan: {
            anyOf: [
              { type: "null" },
              {
                type: "object",
                additionalProperties: false,
                required: ["id", "ekspresi", "properti", "efek"],
                properties: {
                  id: { type: "string", enum: ["mas_barista", "mas_pelanggan", "mbak_pelanggan", "pak_tetangga", "kucing_kedai"] },
                  ekspresi: { type: "string", enum: ["senyum", "ketawa", "kaget", "mikir", "cemberut", "ngantuk", "bangga", "malu"] },
                  properti: { type: "string", enum: ["tanpa", "es_kopi", "kopi_panas", "matcha_latte", "hp", "uang", "jempol", "tunjuk"] },
                  efek: { type: "string", enum: ["tanpa", "tanda_tanya", "tanda_seru", "keringat", "hati", "lampu_ide", "tawa"] },
                },
              },
            ],
          },
          pembicara: { type: "string", enum: ["kiri", "kanan", "narator", "tanpa"] },
          namaPembicara: { type: "string" },
          dialog: { type: "string" },
          promptVisual: { type: "string" },
          jenisMotion: { type: "string", enum: ["pembuka", "perkamen", "peta", "ilustrasi", "arsip", "penutup"] },
          judulKartu: { type: "string" },
          kataSorot: { type: "array", items: { type: "string" } },
          sfx: { type: "string", enum: ["pop", "whoosh", "tanpa"] },
        },
      },
    },
    pertanyaanPenutup: { type: "string" },
    caption: { type: "string" },
    hashtag: { type: "array", items: { type: "string" } },
  },
} as const;

const MENU_RESMI_LEKKOPI_CADANGAN: MenuRingkasSerial[] = [
  { nama: "Kopi Lek", harga: 10000, kategori: "Kopi" },
  { nama: "Americano", harga: 10000, kategori: "Kopi" },
  { nama: "Arum Dalu (Caramel)", harga: 12000, kategori: "Kopi" },
  { nama: "Butterscoth Latte", harga: 14000, kategori: "Kopi" },
  { nama: "Kencana (Vanilla)", harga: 12000, kategori: "Kopi" },
  { nama: "Komandan", harga: 12000, kategori: "Kopi" },
  { nama: "Kopasus", harga: 12000, kategori: "Kopi" },
  { nama: "Koramil", harga: 12000, kategori: "Kopi" },
  { nama: "Peach Americano", harga: 12000, kategori: "Kopi" },
  { nama: "Tubruk", harga: 5000, kategori: "Kopi" },
  { nama: "Matcha Latte", harga: 14000, kategori: "Non-Kopi" },
  { nama: "Es Cokelat", harga: 12000, kategori: "Non-Kopi" },
];

/** Format daftar menu resmi Lek Kopi untuk prompt AI agar tidak mengarang menu fiktif. Murni. */
export function formatMenuSerialUntukPrompt(daftarMenu?: MenuRingkasSerial[]): string {
  const valid = (Array.isArray(daftarMenu) ? daftarMenu : [])
    .filter((m) => m && String(m.nama ?? "").trim())
    .slice(0, 25);
  const sumber = valid.length > 0 ? valid : MENU_RESMI_LEKKOPI_CADANGAN;
  const baris = sumber
    .map((m) => {
      const nama = String(m.nama).trim();
      const harga = Number(m.harga) || 0;
      const kat = m.kategori ? `[${String(m.kategori).trim()}] ` : "";
      return `- ${kat}${nama}${harga > 0 ? ` (Rp${harga.toLocaleString("id-ID")})` : ""}`;
    })
    .join("\n");
  return (
    `\n\nMENU RESMI LEK KOPI (sumber: lekkopi.bakafrawi.com / database kedai):\n${baris}\n` +
    `ATURAN MENU: Bila menyebut menu atau harga, WAJIB pakai HANYA menu resmi Lek Kopi dari daftar ini / https://lekkopi.bakafrawi.com; DILARANG mengarang menu baru.`
  );
}

const PANJANG_SPEK: Record<
  PanjangSerial,
  {
    durasiLabel: string;
    rentangAdegan: string;
    kataPerAdegan: string;
    durasiAdegan: string;
  }
> = {
  ringkas: {
    durasiLabel: "45–60 detik",
    rentangAdegan: "6 sampai 8 adegan",
    kataPerAdegan: "12–22 kata per adegan (1–2 kalimat utuh)",
    durasiAdegan: "4–8 detik per adegan",
  },
  sedang: {
    durasiLabel: "1–1,5 menit",
    rentangAdegan: "7 sampai 10 adegan",
    kataPerAdegan: "18–34 kata per adegan (2–3 kalimat utuh yang mengalir natural)",
    durasiAdegan: "6–12 detik per adegan",
  },
  panjang: {
    durasiLabel: "1,5–2,5 menit",
    rentangAdegan: "9 sampai 14 adegan",
    kataPerAdegan: "22–48 kata per adegan (2–4 kalimat naratif kaya, tidak terburu-buru)",
    durasiAdegan: "8–18 detik per adegan",
  },
};

/** Hitung perkiraan total durasi video (termasuk intro 2,4 dtk & penutup 2,6 dtk) dan jumlah kata naskah. Murni. */
export function estimasiDurasiNaskahSerial(adegan: Pick<AdeganDrafSerial, "dialog">[]) {
  let totalKata = 0;
  let durasiAdegan = 0;
  for (const a of adegan ?? []) {
    const kata = String(a?.dialog ?? "").trim().split(/\s+/).filter(Boolean).length;
    totalKata += kata;
    durasiAdegan += Math.max(3.0, Math.min(22, kata * 0.44 + 1.0));
  }
  const totalDetik = Math.round((5 + durasiAdegan) * 10) / 10;
  return { totalDetik, totalKata };
}

/** Bangun prompt riset fakta Google Search sebelum menyusun naskah sejarah/dokumenter. Murni. */
export function buatPromptRisetCeritaSerial({
  topik = "",
  catatanTambahan = "",
}: {
  topik: string;
  catatanTambahan?: string;
}) {
  const topikBersih = String(topik ?? "").trim().slice(0, 1500);
  const catatanBersih = String(catatanTambahan ?? "").trim().slice(0, 500);
  return {
    system:
      `Kamu peneliti sejarah Islam, budaya kopi, dan penulis dokumenter yang kritis terhadap sumber. ` +
      `WAJIB gunakan Google Search untuk memverifikasi nama tokoh, abad/tahun, lokasi geografis, serta rujukan sejarah primer sebelum menjawab. ` +
      `Bedakan tegas antara catatan sejarah/kitab yang kuat (seperti catatan al-Jaziri dalam Umdat ash-Shafwah bila membahas sejarah qahwah) dengan kisah rakyat/populer atau kerancuan tokoh yang namanya mirip tapi berbeda abad (misalnya antara Syekh Abul Hasan Asy-Syadzili abad ke-13 dengan ulama Syadziliyah di Mokha Yaman seperti Syekh Ali bin Umar Asy-Syadzili abad ke-15, bila relevan dengan topik). ` +
      `DILARANG mengarang fakta, tahun, hadis, atau riwayat palsu — jika suatu detail belum pasti secara historis, sebut jujur sebagai kisah populer atau tradisi lisan.`,
    prompt:
      `Riset fakta sejarah & kronologi lengkap untuk topik dokumenter:\n"${topikBersih}"` +
      (catatanBersih ? `\n\nCatatan tambahan dari pemilik:\n${catatanBersih}` : "") +
      `\n\nSusun hasil riset menjadi JSON berisi ringkasan fakta terverifikasi, 4–8 poin kronologi yang runtut dan realistis, catatan kritis mengenai akurasi sumber/riwayat, serta daftar sumber atau rujukan yang ditemukan.`,
  };
}

/** Rapikan JSON hasil riset cerita AI agar tahan variasi penamaan key. Murni. */
export function normalisasiRisetCeritaSerial(mentah: unknown, topikFallback = ""): RisetCeritaSerial {
  const akar = mentah && typeof mentah === "object" && !Array.isArray(mentah) ? (mentah as Record<string, unknown>) : {};
  const isiBungkus = [akar.riset, akar.data, akar.hasil].find(
    (v): v is Record<string, unknown> => Boolean(v && typeof v === "object" && !Array.isArray(v)),
  );
  const obj = akar.ringkasanFakta || akar.ringkasan ? akar : (isiBungkus ?? akar);

  const calonKronologi = obj.poinKronologi ?? obj.kronologi ?? obj.poin ?? [];
  const poinKronologi = (Array.isArray(calonKronologi) ? calonKronologi : [])
    .map((x) => String(x ?? "").trim().slice(0, 320))
    .filter(Boolean)
    .slice(0, 10);

  const calonSumber = obj.sumber ?? obj.rujukan ?? obj.sources ?? [];
  const sumber = (Array.isArray(calonSumber) ? calonSumber : [])
    .map((x) => String(x ?? "").trim().slice(0, 200))
    .filter(Boolean)
    .slice(0, 8);

  return {
    topik: String(obj.topik ?? topikFallback ?? "").trim().slice(0, 200) || "Topik Sejarah",
    ringkasanFakta: String(obj.ringkasanFakta ?? obj.ringkasan ?? obj.fakta ?? "").trim().slice(0, 1600),
    poinKronologi,
    catatanKritis: String(obj.catatanKritis ?? obj.catatan ?? "").trim().slice(0, 800),
    sumber,
  };
}

/** Format objek hasil riset menjadi teks ringkas terstruktur untuk ditampilkan & disunting di Admin. Murni. */
export function formatRisetCeritaKeTeks(riset: RisetCeritaSerial): string {
  const bagian: string[] = [];
  if (riset.ringkasanFakta) {
    bagian.push(`RINGKASAN FAKTA:\n${riset.ringkasanFakta}`);
  }
  if (riset.poinKronologi.length > 0) {
    bagian.push(`KRONOLOGI:\n${riset.poinKronologi.map((p, i) => `${i + 1}. ${p}`).join("\n")}`);
  }
  if (riset.catatanKritis) {
    bagian.push(`CATATAN KRITIS SUMBER:\n${riset.catatanKritis}`);
  }
  if (riset.sumber.length > 0) {
    bagian.push(`RUJUKAN:\n${riset.sumber.map((s) => `- ${s}`).join("\n")}`);
  }
  return bagian.join("\n\n").trim();
}

/** Buat satu adegan kosong baru siap disunting di Editor Draf Naskah. Murni. */
export function buatAdeganKosongSerial(
  nomor: number,
  latarKode = "outdoor",
  gayaCerita: GayaCeritaSerial = "kedai",
  temaVisual: TemaVisualMotion = "malam",
): AdeganDrafSerial {
  const dokumenter = gayaCerita === "dokumenter";
  return {
    nomor: Math.max(1, Math.round(Number(nomor) || 1)),
    latarKode: dokumenter ? "sejarah" : bersihkanKodeLokasi(latarKode, "outdoor"),
    kartuWaktu: "",
    kamera: "zoom_masuk",
    tokohKiri: dokumenter ? null : { id: "mas_barista", ekspresi: "senyum", properti: "tanpa", efek: "tanpa" },
    tokohKanan: dokumenter ? null : { id: "mas_pelanggan", ekspresi: "senyum", properti: "tanpa", efek: "tanpa" },
    pembicara: "narator",
    namaPembicara: "Narator",
    dialog: "",
    ...(dokumenter
      ? {
          promptVisual: "",
          jenisMotion: temaVisual === "perkamen" ? "perkamen" : "ilustrasi",
          judulKartu: "",
          kataSorot: [],
        }
      : {}),
    sfx: "tanpa",
  };
}

/**
 * Buat kerangka draf naskah kosong siap ketik manual per bagian (tanpa AI mengubah teks Kyai). Murni.
 */
export function buatDrafManualSerial({
  judulEpisode = "",
  nomorEpisode = 1,
  gayaCerita = "dokumenter",
  temaVisual = "malam",
  latarKode = "outdoor",
}: {
  judulEpisode?: string;
  nomorEpisode?: number;
  gayaCerita?: GayaCeritaSerial;
  temaVisual?: TemaVisualMotion;
  latarKode?: string;
} = {}): NaskahDrafSerial {
  const ep = Math.max(1, Math.round(Number(nomorEpisode) || 1));
  const judul = String(judulEpisode ?? "").trim().slice(0, 88) || `Episode ${ep}`;
  if (gayaCerita === "dokumenter") {
    const skema = bangunSkemaJenisMotion(ep, 6, temaVisual);
    return {
      judulEpisode: judul,
      ringkasanEpisode: "",
      tema: temaVisual === "perkamen" ? "Sejarah Perkamen" : "Dokumenter Sinematik",
      adegan: skema.map((jenisMotion, idx) => {
        const dasar = buatAdeganKosongSerial(idx + 1, "sejarah", "dokumenter", temaVisual);
        return {
          ...dasar,
          jenisMotion,
          kamera: pilihKameraMotionOtomatis(idx, jenisMotion, ep),
          judulKartu: jenisMotion === "pembuka" ? judul : "",
          kartuWaktu: jenisMotion === "pembuka" ? `Bagian ${ep}` : "",
          dialog: "",
          kataSorot: [],
          promptVisual: "",
        };
      }),
      pertanyaanPenutup: "Simpan & bagikan kisah ini jika bermanfaat.",
      caption: "",
      hashtag: ["sejarahkopi", "qahwah", "lekkopi"],
    };
  }

  return {
    judulEpisode: judul,
    ringkasanEpisode: "",
    tema: "Cerita Kedai",
    adegan: [
      buatAdeganKosongSerial(1, latarKode, "kedai"),
      buatAdeganKosongSerial(2, latarKode, "kedai"),
      buatAdeganKosongSerial(3, latarKode, "kedai"),
    ],
    pertanyaanPenutup: "Menurutmu gimana cerita kali ini? Komen ya!",
    caption: "",
    hashtag: ["lekkopi", "ceritalekkopi"],
  };
}

/**
 * Buat kerangka draf manual Episode N+1 yang sudah membawa konteks sambungan dari Episode N. Murni.
 */
export function buatDrafLanjutanManual({
  episodeSebelumnya,
  nomorEpisode = 2,
  gayaCerita = "dokumenter",
  temaVisual = "malam",
  latarKode = "outdoor",
}: {
  episodeSebelumnya: Pick<EpisodeSerial, "nomor" | "judul" | "ringkasan" | "tema" | "adeganTerakhir" | "jembatanBerikutnya">;
  nomorEpisode?: number;
  gayaCerita?: GayaCeritaSerial;
  temaVisual?: TemaVisualMotion;
  latarKode?: string;
}): NaskahDrafSerial {
  const ep = Math.max(2, Math.round(Number(nomorEpisode) || episodeSebelumnya.nomor + 1));
  const dasar = buatDrafManualSerial({
    judulEpisode: `${episodeSebelumnya.judul} (Bagian ${ep})`,
    nomorEpisode: ep,
    gayaCerita,
    temaVisual,
    latarKode,
  });
  const pengingat = episodeSebelumnya.ringkasan
    ? `Melanjutkan Episode ${episodeSebelumnya.nomor} ("${episodeSebelumnya.judul}"): ${episodeSebelumnya.ringkasan}`
    : `Melanjutkan Episode ${episodeSebelumnya.nomor} ("${episodeSebelumnya.judul}").`;
  const adegan = dasar.adegan.map((a, idx) =>
    idx === 0
      ? {
          ...a,
          kartuWaktu: `Bagian ${ep}`,
          dialog: `${pengingat}\n`,
        }
      : a,
  );
  return {
    ...dasar,
    tema: episodeSebelumnya.tema || dasar.tema,
    ringkasanEpisode: `Lanjutan Episode ${episodeSebelumnya.nomor}: `,
    adegan,
    pertanyaanPenutup: episodeSebelumnya.jembatanBerikutnya || `Nantikan lanjutan Episode ${ep + 1}!`,
  };
}

function bangunBlokLanjutanEpisode(
  melanjutkanEpisode: KonteksLanjutanEpisode | null | undefined,
  nomorEpisode: number,
): string {
  if (!melanjutkanEpisode) return "";
  const kutipan = Array.isArray(melanjutkanEpisode.kutipanAdeganAkhir)
    ? melanjutkanEpisode.kutipanAdeganAkhir.map((k) => String(k ?? "").trim()).filter(Boolean).slice(-3)
    : [];
  const bagian: string[] = [
    `SAMBUNGAN LANGSUNG DARI EPISODE ${melanjutkanEpisode.nomor} → EPISODE ${nomorEpisode}:`,
    `- Episode ${melanjutkanEpisode.nomor}: "${melanjutkanEpisode.judul}"`,
    ...(melanjutkanEpisode.ringkasan ? [`- Ringkasan Episode ${melanjutkanEpisode.nomor}: ${melanjutkanEpisode.ringkasan}`] : []),
    ...(melanjutkanEpisode.adeganTerakhir ? [`- Titik akhir Episode ${melanjutkanEpisode.nomor}: ${melanjutkanEpisode.adeganTerakhir}`] : []),
    ...(kutipan.length
      ? [`- Kutipan persis adegan penutup Episode ${melanjutkanEpisode.nomor}:\n${kutipan.map((t, i) => `  ${i + 1}) "${t}"`).join("\n")}`]
      : []),
    ...(melanjutkanEpisode.jembatanBerikutnya
      ? [`- Cliffhanger / pertanyaan penutup Episode ${melanjutkanEpisode.nomor}: ${melanjutkanEpisode.jembatanBerikutnya}`]
      : []),
    `ATURAN KETAT SAMBUNGAN: Adegan 1 Episode ${nomorEpisode} WAJIB melanjutkan langsung dari titik akhir Episode ${melanjutkanEpisode.nomor} (pertahankan tokoh utama, nama-nama tokoh, suasana, dan alur yang sedang berjalan; boleh diawali 1 kalimat jembatan singkat "Sebelumnya..." lalu langsung lanjut ke babak baru). DILARANG mengulang pengenalan dari nol seolah ini Episode 1!`,
  ];
  return `\n\n${bagian.join("\n")}`;
}

/** Bangun prompt saran 3 ide cerita serial dari kata kunci Kyai + memori episode sebelumnya. */
export function buatPromptSaranCeritaSerial({
  judulSerial = "Cerita di Lek Kopi",
  nomorEpisode = 1,
  kataKunci = "",
  mood = "komedi_ceria",
  panjangNaskah = "sedang",
  gayaCerita = "kedai",
  hasilRiset = "",
  riwayatEpisode = [],
  melanjutkanEpisode = null,
  daftarMenu = [],
}: {
  judulSerial?: string;
  nomorEpisode?: number;
  kataKunci?: string;
  mood?: MoodSerial;
  panjangNaskah?: PanjangSerial;
  gayaCerita?: GayaCeritaSerial;
  hasilRiset?: string;
  riwayatEpisode?: EpisodeSerial[];
  melanjutkanEpisode?: KonteksLanjutanEpisode | null;
  daftarMenu?: MenuRingkasSerial[];
}) {
  const kw = String(kataKunci ?? "").trim().slice(0, 1200);
  const spek = PANJANG_SPEK[panjangNaskah] ?? PANJANG_SPEK.sedang;
  const risetBersih = String(hasilRiset ?? "").trim().slice(0, 2500);
  const blokLanjutan = bangunBlokLanjutanEpisode(melanjutkanEpisode, nomorEpisode);
  const riwayat = riwayatEpisode.length
    ? `\n\nEPISODE SEBELUMNYA (lanjutkan benang merah, jangan ulang ide/konflik yang sama persis):\n${riwayatEpisode
        .slice(-6)
        .map((e) => `- Ep ${e.nomor} "${e.judul}": ${e.ringkasan}`)
        .join("\n")}`
    : "";

  if (gayaCerita === "dokumenter") {
    return {
      system:
        `Kamu peneliti sejarah dan penulis kreatif dokumenter animasi sinematik (format video vertikal 9:16). ` +
        `Tulis dalam Bahasa Indonesia baku-hangat yang berwibawa, realistis, dan setia pada fakta sejarah hasil verifikasi. ` +
        `DILARANG keras memasukkan tokoh fiktif kedai modern, bahasa gaul/Jatim ("lho", "rek", "nih"), maupun daftar menu kafe komersial.`,
      prompt:
        `Buatkan TEPAT 3 sudut/ide penyajian episode dokumenter untuk "${judulSerial}" Episode ${nomorEpisode} (target durasi ${spek.durasiLabel}, ${spek.rentangAdegan}).` +
        `\nNuansa: ${mood.replace(/_/g, " ")}.` +
        (kw ? `\nTopik / bahan cerita dari pemilik:\n"${kw}"` : "\nTopik: pilih satu kisah sejarah kopi atau hikmah peradaban Islam yang autentik dan menginspirasi.") +
        (risetBersih ? `\n\nHASIL RISET FAKTA TERVERIFIKASI:\n${risetBersih}` : "") +
        riwayat +
        blokLanjutan +
        `\nPastikan setiap saran terasa realistis, faktual, memiliki alur kronologi jelas, pesan hikmah yang mengena, dan ideLengkap yang siap dikembangkan menjadi naskah dokumenter ${spek.rentangAdegan}.`,
    };
  }

  return {
    system:
      `Kamu penulis kreatif serial animasi pendek lucu, inspiratif & hangat untuk kedai kopi Lek Kopi (@lekkopi.id) di Panjunan, Waru, Sidoarjo (buka 14.00–23.00 WIB). ` +
      `Tokoh tetap: Mas Lek (barista ramah), Mas Danu (pelanggan polos), Mbak Rara (suka Matcha Latte & Butterscoth Latte), Pak Budi (bapak berkopiah bijak & kocak), Cimol (kucing oren kedai), plus Narator VO untuk cerita sejarah/inspirasi. ` +
      `WAJIB ceria, hangat, inspiratif, atau komedi ringan — DILARANG horor/seram.`,
    prompt:
      `Buatkan TEPAT 3 ide cerita segar untuk "${judulSerial}" Episode ${nomorEpisode} (target durasi ${spek.durasiLabel}, ${spek.rentangAdegan}).` +
      `\nNuansa utama yang diinginkan: ${mood.replace(/_/g, " ")}.` +
      (kw ? `\nKata kunci / pemicu dari pemilik: "${kw}" (wajib diolah menjadi 3 sudut cerita berbeda!).` : "\nKata kunci: bebas seputar nongkrong, kisah inspiratif kopi, gajian, hujan sore, atau obrolan Waru.") +
      formatMenuSerialUntukPrompt(daftarMenu) +
      riwayat +
      blokLanjutan +
      `\nPastikan setiap saran punya judul menarik, premis jelas, punchline/makna hangat yang mengena, dan ideLengkap kaya detail yang siap dijadikan naskah ${spek.rentangAdegan}.`,
  };
}

/** Rapikan saran cerita AI menjadi maks 3 opsi valid. */
export function normalisasiSaranCeritaSerial(mentah: unknown, moodBawaan: MoodSerial = "komedi_ceria"): SaranCeritaSerial[] {
  const obj = mentah && typeof mentah === "object" && !Array.isArray(mentah) ? (mentah as Record<string, unknown>) : {};
  const calonDaftar = Array.isArray(mentah)
    ? mentah
    : obj.saran ?? obj.ide ?? obj.ideas ?? obj.cerita ?? obj.pilihan ?? [];
  const daftar = Array.isArray(calonDaftar) ? calonDaftar : [];
  const hasil: SaranCeritaSerial[] = [];
  for (const item of daftar) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const judul = String(r.judul ?? r.title ?? "").trim().slice(0, 72);
    const premis = String(r.premis ?? r.ringkasan ?? "").trim().slice(0, 260);
    const punchline = String(r.punchline ?? r.ending ?? "").trim().slice(0, 220);
    const moodMentah = String(r.mood ?? "").trim() as MoodSerial;
    const ideLengkap = String(r.ideLengkap ?? r.ide ?? "").trim().slice(0, 650) || [premis, punchline].filter(Boolean).join(" ");
    if (!judul || !ideLengkap) continue;
    hasil.push({
      judul,
      premis: premis || ideLengkap,
      punchline,
      mood: MOOD_SAH.has(moodMentah) ? moodMentah : moodBawaan,
      ideLengkap,
    });
    if (hasil.length >= 3) break;
  }
  return hasil;
}

/** Bangun prompt penyusunan draf naskah lengkap per adegan untuk ditinjau/diedit Kyai sebelum render. */
export function buatPromptNaskahDrafSerial({
  judulSerial = "Cerita di Lek Kopi",
  nomorEpisode = 1,
  mood = "komedi_ceria",
  formatSuara = "dialog",
  panjangNaskah = "sedang",
  bersambung = false,
  gayaCerita = "kedai",
  temaVisual = "malam",
  hasilRiset = "",
  ide = "",
  kataKunci = "",
  riwayatEpisode = [],
  melanjutkanEpisode = null,
  daftarLatar = [],
  daftarMenu = [],
}: {
  judulSerial?: string;
  nomorEpisode?: number;
  mood?: MoodSerial;
  formatSuara?: FormatSuaraSerial;
  panjangNaskah?: PanjangSerial;
  bersambung?: boolean;
  gayaCerita?: GayaCeritaSerial;
  temaVisual?: TemaVisualMotion;
  hasilRiset?: string;
  ide?: string;
  kataKunci?: string;
  riwayatEpisode?: EpisodeSerial[];
  melanjutkanEpisode?: KonteksLanjutanEpisode | null;
  daftarLatar?: LatarKartun[];
  daftarMenu?: MenuRingkasSerial[];
}) {
  const spek = PANJANG_SPEK[panjangNaskah] ?? PANJANG_SPEK.sedang;
  const teksRiwayat = riwayatEpisode.length
    ? `\n\nMEMORI EPISODE SEBELUMNYA:\n${riwayatEpisode
        .slice(-5)
        .map((e) => `- Ep ${e.nomor} "${e.judul}": ${e.ringkasan}`)
        .join("\n")}`
    : "";
  const blokLanjutan = bangunBlokLanjutanEpisode(melanjutkanEpisode, nomorEpisode);

  const arahanBersambung = bersambung
    ? `\nMODE BERSAMBUNG (EPISODE): Materi cerita dari pemilik boleh dipecah menjadi beberapa episode tanpa memotong emosi cerita. Untuk **Episode ${nomorEpisode}** ini, garap bagian awalnya/porsinya secara mendalam dan utuh, tutup adegan terakhir atau \`pertanyaanPenutup\` dengan jembatan **"Bersambung ke Episode ${nomorEpisode + 1}"**, serta tuliskan \`ringkasanEpisode\` secara jelas mencatat titik akhir cerita Episode ${nomorEpisode} agar Episode ${nomorEpisode + 1} otomatis melanjutkan tepat dari bagian berikutnya.`
    : "";

  const ideBersih = String(ide ?? "").trim().slice(0, 4000);
  const kwBersih = String(kataKunci ?? "").trim().slice(0, 300);
  const topik = [ideBersih, kwBersih].filter(Boolean).join("\nKata kunci tambahan: ");
  const risetBersih = String(hasilRiset ?? "").trim().slice(0, 2800);

  if (gayaCerita === "dokumenter") {
    const gayaGambar =
      temaVisual === "perkamen"
        ? "EMPTY atmospheric vintage historical scenic environment background ONLY, strictly NO people, NO humans, NO faces, NO hands, NO characters, warm parchment paper grain, muted cream ochre terracotta umber palette, open foreground stage, soft empty upper sky, vertical 9:16 composition, strictly no text, no letters, no banners, no signage, no watermark, no floating coffee cups"
        : "EMPTY atmospheric dark 2D painterly gouache scenic environment background ONLY, strictly NO people, NO humans, NO faces, NO hands, NO characters, misty depth, deep indigo-charcoal shadows and warm glowing amber light, open foreground stage, darkened lower third, vertical 9:16 composition, strictly no text, no letters, no signage, no watermark, no floating coffee cups";
    return {
      system:
        `Kamu penulis naskah film dokumenter & kisah naratif sinematik (Reels 9:16) yang mengutamakan kesetiaan pada alur cerita pemilik, akurasi fakta, dan adab keilmuan. ` +
        `Bahasa Indonesia baku-hangat yang mengalir hidup, puitis, berwibawa, dan enak didengar sebagai voice-over dokumenter. ` +
        `ATURAN KETAT DOKUMENTER / CERITA MOTION (tema ${temaVisual}):\n` +
        `1) Set \`tokohKiri: null\` dan \`tokohKanan: null\` di SELURUH adegan (dilarang memunculkan tokoh barista/pelanggan komedi kedai yang tidak diminta pemilik).\n` +
        `2) DILARANG kata gaul/logat receh ("lho", "rek", "cak", "nih", "sih"), DILARANG menyebut kasir, mesin espresso modern, atau daftar harga menu kafe.\n` +
        `3) WAJIB IKUTI TOKOH & ALUR CERITA PEMILIK: Jika pemilik menyebut tokoh atau perjalanan spesifik (mis. perjalanan seseorang ke Aceh/Gayo/daerah tertentu), tokoh dan perjalanan tersebut HARUS menjadi tulang punggung cerita sejak Adegan 1 sampai penutup! DILARANG mengubahnya menjadi daftar tahun kering ala Wikipedia ("Pada tahun X... Pada tahun Y..."). Sisipkan fakta sejarah secara alami di dalam alur cerita yang hidup.\n` +
        `4) Gunakan \`pembicara: "narator"\`.\n` +
        `5) WAJIB isi \`jenisMotion\` bervariasi: "pembuka", "perkamen", "ilustrasi", "arsip", "peta" (maks 1x), dan "penutup" — JANGAN semua adegan tengah jenis yang sama. WAJIB isi \`judulKartu\` pada \`pembuka\`, \`perkamen\`, \`peta\`, \`arsip\`, dan \`kataSorot\` (2–4 kata dari dialog).\n` +
        `6) WAJIB isi \`promptVisual\` berbahasa Inggris pada setiap adegan non-peta menggambarkan adegan spesifik yang BENAR-BENAR sesuai lokasi & peristiwa dialog (JANGAN pernah menyebut tempat yang tidak relevan dengan cerita), dan akhiri dengan: "${gayaGambar}".`,
      prompt:
        `Susun draf naskah DOKUMENTER / CERITA MOTION (tema ${temaVisual}) untuk "${judulSerial}" EPISODE ${nomorEpisode} berisi **${spek.rentangAdegan}** (target durasi **${spek.durasiLabel}**).\n` +
        `Isi \`latarKode\` dengan 1 kata singkat sesuai lokasi adegan cerita (mis. "pelabuhan", "kebun", "perjalanan", "desa", "peta").` +
        `\n\n${topik ? `BAHAN CERITA & ALUR UTAMA DARI PEMILIK (WAJIB DIIKUTI SEBAGAI INTI CERITA):\n${topik}` : "Topik: kisah inspiratif perjalanan kopi dan ketekunan."}` +
        (risetBersih
          ? `\n\nREFERENSI FAKTA SEJARAH PENDUKUNG (gunakan untuk menjaga akurasi latar sejarah tanpa membuang tokoh/alur pemilik):\n${risetBersih}`
          : `\n\nJaga akurasi fakta era/abad dan lokasi secara cermat; jangan mengarang tahun atau sumber yang tidak pasti.`) +
        teksRiwayat +
        blokLanjutan +
        arahanBersambung +
        `\n\nAturan narasi & visual per adegan:` +
        `\n- Panjang narasi per adegan: **${spek.kataPerAdegan}** (${spek.durasiAdegan}) — tulis 2–3 kalimat naratif yang mengalir bercerita, BUKAN 1 kalimat ringkas kering.` +
        `\n- Adegan 1 (\`jenisMotion: "pembuka"\`) dibuka dengan hook sinematik yang kuat + \`judulKartu\` singkat (2–4 kata).` +
        `\n- Pada setiap adegan \`perkamen\`, WAJIB isi \`judulKartu\` singkat (2–4 kata) agar gulungan perkamen tampil rapi + \`kartuWaktu\` singkat (mis. "ACEH · BENER MERIAH" atau era sesuai cerita).` +
        `\n- Isi \`kataSorot\` (2–4 kata kunci yang persis ada di \`dialog\`) agar subtitle kinetik menyorot kata penting.` +
        `\n- Isi \`promptVisual\` (Bahasa Inggris, 15–35 kata) pada SETIAP adegan non-peta dengan adegan konkret sesuai cerita + gaya "${gayaGambar}".` +
        `\n\n${teksSkemaMotionUntukPrompt(nomorEpisode, panjangNaskah === "panjang" ? 12 : panjangNaskah === "ringkas" ? 7 : 9, temaVisual)}`,
    };
  }

  const teksLatar = daftarLatar.length
    ? daftarLatar.map((l) => `- "${l.kode}": ${l.nama}${l.deskripsi ? ` (${l.deskripsi})` : ""}`).join("\n")
    : '- "bar": Meja Bar / Kasir Lek Kopi\n- "outdoor": Area Duduk Outdoor Paving\n- "meja": Close-up Meja Kopi\n- "depan": Depan Kedai Lek Kopi';

  const arahanMood =
    mood === "kehidupan_santai"
      ? "Nuansa: cerita kehidupan sehari-hari yang hangat, santai, reflektif, dan menenangkan hati."
      : mood === "cerita_kopi"
      ? "Nuansa: cerita naratif yang kaya — bisa berupa kisah sejarah/inspirasi kopi dunia maupun cerita racikan minuman khas; bila menyebut menu kedai, tetap wajib pakai menu resmi Lek Kopi dari daftar."
      : "Nuansa: komedi ceria slice-of-life dengan setup cerita yang kuat, tektokan hidup, dan punchline hangat.";

  const arahanSuara =
    formatSuara === "narator"
      ? 'Format suara: Mode 1 Narator (`pembicara: "narator"`, `namaPembicara: "Cerita Lek Kopi"` atau `"Narator"`).'
      : formatSuara === "campuran"
      ? 'Format suara: Mode Narator + Dialog Tokoh! Padukan **Narator VO** (`pembicara: "narator"`, `namaPembicara: "Narator"`) yang bercerita mengalir 2–3 kalimat sinematik hangat DENGAN **Dialog Karakter** (`pembicara: "kiri"` atau `"kanan"`) pada momen kunci, emosional, atau celetukan lucu.'
      : 'Format suara: Mode Dialog Antar Tokoh (`pembicara: "kiri"` atau `"kanan"` secara bergantian, jangan pendek-pendek kaku — buat percakapan terasa natural dan berisi).';

  return {
    system:
      `Kamu penulis naskah animasi kartun 2D & storytelling sinematik (Reels 9:16) untuk kedai Lek Kopi (@lekkopi.id), Panjunan, Waru, Sidoarjo. ` +
      `WAJIB ceria, hangat, inspiratif, atau santai (DILARANG horor/seram). Bahasa Indonesia lisan yang hidup, mengalir enak didengar, dengan sentuhan ramah Jawa Timur tipis bila cocok nuansa kedai. ` +
      `Tokoh visual panggung yang sah hanya: mas_barista (Mas Lek), mas_pelanggan (Mas Danu), mbak_pelanggan (Mbak Rara), pak_tetangga (Pak Budi), kucing_kedai (Cimol).`,
    prompt:
      `Susun draf naskah lengkap "${judulSerial}" EPISODE ${nomorEpisode} berisi **${spek.rentangAdegan}** (target durasi **${spek.durasiLabel}**).\n` +
      `${arahanMood}\n${arahanSuara}\n` +
      `Latar tersedia (isi di \`latarKode\`):\n${teksLatar}` +
      formatMenuSerialUntukPrompt(daftarMenu) +
      teksRiwayat +
      blokLanjutan +
      `\n\n${topik ? `Bahan cerita / ide / naskah acuan dari pemilik:\n${topik}` : "Topik bebas yang segar, mendalam, dan hangat di kedai kopi."}` +
      arahanBersambung +
      `\n\nAturan panjang dialog & kualitas:` +
      `\n- Panjang setiap dialog/narasi: **${spek.kataPerAdegan}** (${spek.durasiAdegan})! JANGAN tulis dialog kelewat pendek (di bawah 12 kata) kecuali memang sahutan cepat satu kalimat; berikan kalimat utuh, berirama, dan bernyawa.` +
      `\n- Adegan 1 langsung dibuka dengan hook kuat yang memancing rasa ingin tahu.` +
      `\n- Gunakan variasi ekspresi, properti, efek reaksi komik, kartuWaktu saat berganti waktu/bab, dan gerak kamera bergilir (zoom_masuk, diam, geser_kanan, goyang_kaget, geser_kiri, zoom_keluar) — jangan semua adegan sama.\n` +
      `- Contoh pola kamera per episode ${nomorEpisode}: ${POLA_KAMERA_KEDAI.slice(0, 6).join(" → ")}.`,
  };
}

function normalisasiTokohDraf(mentah: unknown): TokohDrafSerial | null {
  if (!mentah || typeof mentah !== "object") return null;
  const t = mentah as Record<string, unknown>;
  const idMentah = String(t.id ?? "mas_barista").trim() as TokohKartunId;
  const id: TokohKartunId = TOKOH_SAH.has(idMentah) ? idMentah : "mas_barista";
  const ekspresi = String(t.ekspresi ?? "senyum").trim();
  const properti = String(t.properti ?? "tanpa").trim();
  const efek = String(t.efek ?? "tanpa").trim();
  return {
    id,
    ekspresi: EKSPRESI_SAH.has(ekspresi) ? ekspresi : "senyum",
    properti: PROPERTI_SAH.has(properti) ? properti : "tanpa",
    efek: EFEK_SAH.has(efek) ? efek : "tanpa",
  };
}

/** Rapikan draf naskah episode hasil AI agar siap diedit di UI maupun langsung dirender Remotion. */
export function normalisasiNaskahDrafSerial(
  mentah: unknown,
  nomorEpisode = 1,
  opsi?: { gayaCerita?: GayaCeritaSerial; temaVisual?: TemaVisualMotion },
): NaskahDrafSerial {
  const adalahDokumenter = opsi?.gayaCerita === "dokumenter";
  const akar = mentah && typeof mentah === "object" && !Array.isArray(mentah) ? (mentah as Record<string, unknown>) : {};
  const isiBungkus = [akar.naskah, akar.episode, akar.data].find(
    (v): v is Record<string, unknown> => Boolean(v && typeof v === "object" && !Array.isArray(v)),
  );
  const obj = Array.isArray(akar.adegan) || Array.isArray(akar.scenes) ? akar : (isiBungkus ?? akar);
  const daftarAdegan = Array.isArray(obj.adegan) ? obj.adegan : Array.isArray(obj.scenes) ? obj.scenes : [];
  const adegan: AdeganDrafSerial[] = daftarAdegan.slice(0, 16).map((item, idx) => {
    const a = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    let tokohKiri = adalahDokumenter ? null : normalisasiTokohDraf(a.tokohKiri);
    const tokohKanan = adalahDokumenter ? null : normalisasiTokohDraf(a.tokohKanan);
    if (!adalahDokumenter && !tokohKiri && !tokohKanan) {
      tokohKiri = { id: "mas_barista", ekspresi: "senyum", properti: "kopi_panas", efek: "tanpa" };
    }
    const pemMentah = String(a.pembicara ?? (adalahDokumenter ? "narator" : "kiri")).trim();
    let pembicara: AdeganDrafSerial["pembicara"] = adalahDokumenter
      ? pemMentah === "tanpa"
        ? "tanpa"
        : "narator"
      : pemMentah === "kiri" || pemMentah === "kanan" || pemMentah === "narator" || pemMentah === "tanpa"
      ? pemMentah
      : "narator";
    if (!adalahDokumenter) {
      if (pembicara === "kiri" && !tokohKiri) pembicara = tokohKanan ? "kanan" : "narator";
      if (pembicara === "kanan" && !tokohKanan) pembicara = tokohKiri ? "kiri" : "narator";
    }
    const idPembicara = pembicara === "kiri" ? tokohKiri?.id : pembicara === "kanan" ? tokohKanan?.id : "narator";
    const kamera = String(a.kamera ?? "zoom_masuk").trim();
    const sfxMentah = String(a.sfx ?? "tanpa").trim();
    const promptVisual = String(a.promptVisual ?? a.visual ?? "").trim().slice(0, 420);
    const jenisMentah = String(a.jenisMotion ?? "").trim().toLowerCase() as JenisAdeganMotion;
    const jenisMotion = JENIS_MOTION_SAH.has(jenisMentah) ? jenisMentah : undefined;
    const judulKartu = String(a.judulKartu ?? "").trim().slice(0, 80);
    const calonSorot = Array.isArray(a.kataSorot)
      ? a.kataSorot
      : typeof a.kataSorot === "string"
      ? a.kataSorot.split(/[,;]+/)
      : [];
    const kataSorot = calonSorot
      .map((k) => String(k ?? "").trim().slice(0, 32))
      .filter(Boolean)
      .slice(0, 8);

    let karakter: KarakterMotionDraf | undefined;
    if (a.karakter && typeof a.karakter === "object") {
      const km = a.karakter as Record<string, unknown>;
      const aksi = String(km.aksi ?? "").trim() as AksiKarakterCerita;
      const tokohUtama = String(km.tokohUtama ?? "").trim() as TipeKarakterCerita;
      const tokohKedua = String(km.tokohKedua ?? "").trim() as TipeKarakterCerita;
      const gaya = String(km.gaya ?? "").trim() as GayaKarakterCerita;
      const properti = String(km.properti ?? "").trim().slice(0, 24);
      const objek: KarakterMotionDraf = {
        ...(AKSI_MOTION_SAH.has(aksi) ? { aksi } : {}),
        ...(TOKOH_MOTION_SAH.has(tokohUtama) ? { tokohUtama } : {}),
        ...(TOKOH_MOTION_SAH.has(tokohKedua) ? { tokohKedua } : {}),
        ...(gaya === "ilustrasi" || gaya === "siluet" ? { gaya } : {}),
        ...(properti ? { properti } : {}),
      };
      if (Object.keys(objek).length > 0) karakter = objek;
    }

    return {
      nomor: Number(a.nomor) || idx + 1,
      latarKode: bersihkanKodeLokasi(String(a.latarKode ?? (adalahDokumenter ? "sejarah" : "outdoor")), adalahDokumenter ? "sejarah" : "outdoor"),
      kartuWaktu: String(a.kartuWaktu ?? "").trim().slice(0, 48),
      kamera: KAMERA_SAH.has(kamera) ? kamera : "zoom_masuk",
      tokohKiri,
      tokohKanan,
      pembicara,
      namaPembicara:
        String(a.namaPembicara ?? "").trim().slice(0, 48) ||
        (adalahDokumenter ? "Narator" : NAMA_TOKOH_PETA[idPembicara ?? "narator"] || "Lek Kopi"),
      dialog: String(a.dialog ?? a.narasi ?? a.teks ?? "").trim().slice(0, 650),
      ...(promptVisual ? { promptVisual } : {}),
      ...(jenisMotion ? { jenisMotion } : {}),
      ...(judulKartu ? { judulKartu } : {}),
      ...(kataSorot.length ? { kataSorot } : {}),
      ...(karakter ? { karakter } : {}),
      sfx: sfxMentah === "pop" || sfxMentah === "whoosh" ? sfxMentah : "tanpa",
    };
  });

  const hashtag = (Array.isArray(obj.hashtag) ? obj.hashtag : [])
    .map((h) => String(h ?? "").replace(/^#+/, "").replace(/[^a-zA-Z0-9_]/g, "").toLowerCase())
    .filter(Boolean)
    .slice(0, 8);

  const adeganVariasi = terapkanVariasiMotionAdegan(adegan, {
    nomorEpisode,
    gayaCerita: opsi?.gayaCerita,
    temaVisual: opsi?.temaVisual,
  });

  return {
    judulEpisode: String(obj.judulEpisode ?? "").trim().slice(0, 88) || `Episode ${nomorEpisode}`,
    ringkasanEpisode: String(obj.ringkasanEpisode ?? "").trim().slice(0, 450),
    tema: String(obj.tema ?? "").trim().slice(0, 80) || (adalahDokumenter ? "Dokumenter Sejarah" : "Cerita Kedai"),
    adegan: adeganVariasi,
    pertanyaanPenutup: String(obj.pertanyaanPenutup ?? "").trim().slice(0, 180) || "Menurutmu gimana cerita kali ini? Komen ya!",
    caption: String(obj.caption ?? "").trim().slice(0, 1000),
    hashtag,
  };
}
