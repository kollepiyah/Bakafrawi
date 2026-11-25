// Aturan, tipe, & helper murni untuk Serial Kartun 2D Lek Kopi.
// Sengaja mandiri tanpa impor runtime relatif agar langsung lolos node --test maupun Next.js.

export type MoodSerial = "komedi_ceria" | "kehidupan_santai" | "cerita_kopi";
export type GayaKartunLatar = "ceria_hangat" | "santai_sore";
export type FormatSuaraSerial = "dialog" | "narator" | "campuran";
export type PanjangSerial = "ringkas" | "sedang" | "panjang";
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
  tugasId?: string;
  dibuat: string;
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
          episode.push({
            nomor,
            judul: String(e.judul ?? "").trim().slice(0, 80) || `Episode ${nomor}`,
            ringkasan: String(e.ringkasan ?? "").trim().slice(0, 450),
            tema: String(e.tema ?? "").trim().slice(0, 120),
            mood: MOOD_SAH.has(epMood) ? epMood : "komedi_ceria",
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
    `\n\nMENU RESMI LEK KOPI (sumber: lek-kopi.web.app / database kedai):\n${baris}\n` +
    `ATURAN MENU: Bila menyebut menu atau harga, WAJIB pakai HANYA menu resmi Lek Kopi dari daftar ini / https://lek-kopi.web.app; DILARANG mengarang menu baru.`
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

/** Buat satu adegan kosong baru siap disunting di Editor Draf Naskah. Murni. */
export function buatAdeganKosongSerial(nomor: number, latarKode = "outdoor"): AdeganDrafSerial {
  return {
    nomor: Math.max(1, Math.round(Number(nomor) || 1)),
    latarKode: bersihkanKodeLokasi(latarKode, "outdoor"),
    kartuWaktu: "",
    kamera: "zoom_masuk",
    tokohKiri: { id: "mas_barista", ekspresi: "senyum", properti: "tanpa", efek: "tanpa" },
    tokohKanan: { id: "mas_pelanggan", ekspresi: "senyum", properti: "tanpa", efek: "tanpa" },
    pembicara: "narator",
    namaPembicara: "Narator",
    dialog: "",
    sfx: "tanpa",
  };
}

/** Bangun prompt saran 3 ide cerita serial dari kata kunci Kyai + memori episode sebelumnya. */
export function buatPromptSaranCeritaSerial({
  judulSerial = "Cerita di Lek Kopi",
  nomorEpisode = 1,
  kataKunci = "",
  mood = "komedi_ceria",
  panjangNaskah = "sedang",
  riwayatEpisode = [],
  daftarMenu = [],
}: {
  judulSerial?: string;
  nomorEpisode?: number;
  kataKunci?: string;
  mood?: MoodSerial;
  panjangNaskah?: PanjangSerial;
  riwayatEpisode?: EpisodeSerial[];
  daftarMenu?: MenuRingkasSerial[];
}) {
  const kw = String(kataKunci ?? "").trim().slice(0, 240);
  const spek = PANJANG_SPEK[panjangNaskah] ?? PANJANG_SPEK.sedang;
  const riwayat = riwayatEpisode.length
    ? `\n\nEPISODE SEBELUMNYA (lanjutkan benang merah, jangan ulang ide/konflik yang sama persis):\n${riwayatEpisode
        .slice(-6)
        .map((e) => `- Ep ${e.nomor} "${e.judul}": ${e.ringkasan}`)
        .join("\n")}`
    : "";

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
      `\nPastikan setiap saran punya judul menarik, premis jelas, punchline/makna hangat yang mengena, dan ideLengkap kaya detail yang siap dijadikan naskah ${spek.rentangAdegan}.`,
  };
}

/** Rapikan saran cerita AI menjadi maks 3 opsi valid. */
export function normalisasiSaranCeritaSerial(mentah: unknown, moodBawaan: MoodSerial = "komedi_ceria"): SaranCeritaSerial[] {
  const obj = mentah && typeof mentah === "object" ? (mentah as Record<string, unknown>) : {};
  const daftar = Array.isArray(obj.saran) ? obj.saran : Array.isArray(mentah) ? mentah : [];
  const hasil: SaranCeritaSerial[] = [];
  for (const item of daftar) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const judul = String(r.judul ?? "").trim().slice(0, 72);
    const premis = String(r.premis ?? "").trim().slice(0, 260);
    const punchline = String(r.punchline ?? "").trim().slice(0, 220);
    const moodMentah = String(r.mood ?? "").trim() as MoodSerial;
    const ideLengkap = String(r.ideLengkap ?? "").trim().slice(0, 650) || [premis, punchline].filter(Boolean).join(" ");
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
  ide = "",
  kataKunci = "",
  riwayatEpisode = [],
  daftarLatar = [],
  daftarMenu = [],
}: {
  judulSerial?: string;
  nomorEpisode?: number;
  mood?: MoodSerial;
  formatSuara?: FormatSuaraSerial;
  panjangNaskah?: PanjangSerial;
  bersambung?: boolean;
  ide?: string;
  kataKunci?: string;
  riwayatEpisode?: EpisodeSerial[];
  daftarLatar?: LatarKartun[];
  daftarMenu?: MenuRingkasSerial[];
}) {
  const spek = PANJANG_SPEK[panjangNaskah] ?? PANJANG_SPEK.sedang;
  const teksLatar = daftarLatar.length
    ? daftarLatar.map((l) => `- "${l.kode}": ${l.nama}${l.deskripsi ? ` (${l.deskripsi})` : ""}`).join("\n")
    : '- "bar": Meja Bar / Kasir Lek Kopi\n- "outdoor": Area Duduk Outdoor Paving\n- "meja": Close-up Meja Kopi\n- "depan": Depan Kedai Lek Kopi';

  const teksRiwayat = riwayatEpisode.length
    ? `\n\nMEMORI EPISODE SEBELUMNYA:\n${riwayatEpisode
        .slice(-5)
        .map((e) => `- Ep ${e.nomor} "${e.judul}": ${e.ringkasan}`)
        .join("\n")}`
    : "";

  const arahanMood =
    mood === "kehidupan_santai"
      ? "Nuansa: cerita kehidupan sehari-hari yang hangat, santai, reflektif, dan menenangkan hati."
      : mood === "cerita_kopi"
      ? "Nuansa: cerita naratif yang kaya — bisa berupa kisah sejarah/inspirasi kopi dunia (seperti Syekh Asy-Syadzili atau perjalanan kopi) maupun cerita racikan minuman khas; bila menyebut menu kedai, tetap wajib pakai menu resmi Lek Kopi dari daftar."
      : "Nuansa: komedi ceria slice-of-life dengan setup cerita yang kuat, tektokan hidup, dan punchline hangat.";

  const arahanSuara =
    formatSuara === "narator"
      ? 'Format suara: Mode 1 Narator (`pembicara: "narator"`, `namaPembicara: "Cerita Lek Kopi"` atau `"Narator"`).'
      : formatSuara === "campuran"
      ? 'Format suara: Mode Narator + Dialog Tokoh! Padukan **Narator VO** (`pembicara: "narator"`, `namaPembicara: "Narator"`) yang bercerita mengalir 2–3 kalimat sinematik hangat DENGAN **Dialog Karakter** (`pembicara: "kiri"` atau `"kanan"`) pada momen kunci, emosional, atau celetukan lucu.'
      : 'Format suara: Mode Dialog Antar Tokoh (`pembicara: "kiri"` atau `"kanan"` secara bergantian, jangan pendek-pendek kaku — buat percakapan terasa natural dan berisi).';

  const arahanBersambung = bersambung
    ? `\nMODE BERSAMBUNG (EPISODE): Materi cerita dari pemilik boleh dipecah menjadi beberapa episode tanpa memotong emosi cerita. Untuk **Episode ${nomorEpisode}** ini, garap bagian awalnya/porsinya secara mendalam dan utuh, tutup adegan terakhir atau \`pertanyaanPenutup\` dengan jembatan **"Bersambung ke Episode ${nomorEpisode + 1}"**, serta tuliskan \`ringkasanEpisode\` secara jelas mencatat titik akhir cerita Episode ${nomorEpisode} agar Episode ${nomorEpisode + 1} otomatis melanjutkan tepat dari bagian berikutnya.`
    : "";

  const ideBersih = String(ide ?? "").trim().slice(0, 4000);
  const kwBersih = String(kataKunci ?? "").trim().slice(0, 300);
  const topik = [ideBersih, kwBersih].filter(Boolean).join("\nKata kunci tambahan: ");

  return {
    system:
      `Kamu penulis naskah animasi kartun 2D & storytelling sinematik (Reels 9:16) untuk kedai Lek Kopi (@lekkopi.id), Panjunan, Waru, Sidoarjo. ` +
      `WAJIB ceria, hangat, inspiratif, atau santai (DILARANG horor/seram). Bahasa Indonesia lisan yang hidup, mengalir enak didengar, dengan sentuhan ramah Jawa Timur tipis bila cocok nuansa kedai. ` +
      `Tokoh visual panggung yang sah hanya: mas_barista (Mas Lek), mas_pelanggan (Mas Danu), mbak_pelanggan (Mbak Rara), pak_tetangga (Pak Budi), kucing_kedai (Cimol). ` +
      `Jika tokoh cerita sejarah/luar tidak ada di 5 tokoh visual tersebut (mis. tokoh ulama/musafir), tetap pasang tokoh visual paling pas di panggung (mis. pak_tetangga untuk sosok sepuh bijak atau mas_barista sebagai pencerita) sambil mengisi \`namaPembicara\` sesuai tokoh ceritanya atau memakai \`pembicara: "narator"\`.`,
    prompt:
      `Susun draf naskah lengkap "${judulSerial}" EPISODE ${nomorEpisode} berisi **${spek.rentangAdegan}** (target durasi **${spek.durasiLabel}**).\n` +
      `${arahanMood}\n${arahanSuara}\n` +
      `Latar tersedia (isi di \`latarKode\`):\n${teksLatar}` +
      formatMenuSerialUntukPrompt(daftarMenu) +
      teksRiwayat +
      `\n\n${topik ? `Bahan cerita / ide / naskah acuan dari pemilik:\n${topik}` : "Topik bebas yang segar, mendalam, dan hangat di kedai kopi."}` +
      arahanBersambung +
      `\n\nAturan panjang dialog & kualitas:` +
      `\n- Panjang setiap dialog/narasi: **${spek.kataPerAdegan}** (${spek.durasiAdegan})! JANGAN tulis dialog kelewat pendek (di bawah 12 kata) kecuali memang sahutan cepat satu kalimat; berikan kalimat utuh, berirama, dan bernyawa.` +
      `\n- Adegan 1 langsung dibuka dengan hook kuat yang memancing rasa ingin tahu.` +
      `\n- Gunakan variasi ekspresi, properti, efek reaksi komik, kartuWaktu saat berganti waktu/bab, dan gerak kamera agar panggung tetap dinamis.`,
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
export function normalisasiNaskahDrafSerial(mentah: unknown, nomorEpisode = 1): NaskahDrafSerial {
  const obj = mentah && typeof mentah === "object" ? (mentah as Record<string, unknown>) : {};
  const daftarAdegan = Array.isArray(obj.adegan) ? obj.adegan : [];
  const adegan: AdeganDrafSerial[] = daftarAdegan.slice(0, 16).map((item, idx) => {
    const a = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    let tokohKiri = normalisasiTokohDraf(a.tokohKiri);
    const tokohKanan = normalisasiTokohDraf(a.tokohKanan);
    if (!tokohKiri && !tokohKanan) {
      tokohKiri = { id: "mas_barista", ekspresi: "senyum", properti: "kopi_panas", efek: "tanpa" };
    }
    const pemMentah = String(a.pembicara ?? "kiri").trim();
    let pembicara: AdeganDrafSerial["pembicara"] =
      pemMentah === "kiri" || pemMentah === "kanan" || pemMentah === "narator" || pemMentah === "tanpa"
        ? pemMentah
        : "narator";
    if (pembicara === "kiri" && !tokohKiri) pembicara = tokohKanan ? "kanan" : "narator";
    if (pembicara === "kanan" && !tokohKanan) pembicara = tokohKiri ? "kiri" : "narator";
    const idPembicara = pembicara === "kiri" ? tokohKiri?.id : pembicara === "kanan" ? tokohKanan?.id : "narator";
    const kamera = String(a.kamera ?? "zoom_masuk").trim();
    const sfxMentah = String(a.sfx ?? "tanpa").trim();

    return {
      nomor: Number(a.nomor) || idx + 1,
      latarKode: bersihkanKodeLokasi(String(a.latarKode ?? "outdoor"), "outdoor"),
      kartuWaktu: String(a.kartuWaktu ?? "").trim().slice(0, 48),
      kamera: KAMERA_SAH.has(kamera) ? kamera : "zoom_masuk",
      tokohKiri,
      tokohKanan,
      pembicara,
      namaPembicara: String(a.namaPembicara ?? "").trim().slice(0, 48) || NAMA_TOKOH_PETA[idPembicara ?? "narator"] || "Lek Kopi",
      dialog: String(a.dialog ?? "").trim().slice(0, 650),
      sfx: sfxMentah === "pop" || sfxMentah === "whoosh" ? sfxMentah : "tanpa",
    };
  });

  const hashtag = (Array.isArray(obj.hashtag) ? obj.hashtag : [])
    .map((h) => String(h ?? "").replace(/^#+/, "").replace(/[^a-zA-Z0-9_]/g, "").toLowerCase())
    .filter(Boolean)
    .slice(0, 8);

  return {
    judulEpisode: String(obj.judulEpisode ?? "").trim().slice(0, 88) || `Episode ${nomorEpisode}`,
    ringkasanEpisode: String(obj.ringkasanEpisode ?? "").trim().slice(0, 450),
    tema: String(obj.tema ?? "").trim().slice(0, 80) || "Cerita Kedai",
    adegan,
    pertanyaanPenutup: String(obj.pertanyaanPenutup ?? "").trim().slice(0, 180) || "Menurutmu gimana cerita kali ini? Komen ya!",
    caption: String(obj.caption ?? "").trim().slice(0, 1000),
    hashtag,
  };
}
