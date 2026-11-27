// Aturan murni penjadwalan tayang custom & jadwal otomatis jam buka (tanpa jaringan/database).
// Diuji di jadwal-tayang-murni.test.ts.

export type SasaranTayang = "otomatis" | "story" | "reels" | "reels+story" | "feed" | "feed+story";

export const DAFTAR_SASARAN_VIDEO: { kode: SasaranTayang; label: string }[] = [
  { kode: "otomatis", label: "Reels Instagram (bawaan)" },
  { kode: "story", label: "Story Instagram saja" },
  { kode: "reels+story", label: "Reels + Story Instagram" },
];

export const DAFTAR_SASARAN_GAMBAR: { kode: SasaranTayang; label: string }[] = [
  { kode: "otomatis", label: "Feed + Story Instagram (bawaan)" },
  { kode: "story", label: "Story Instagram saja" },
  { kode: "feed", label: "Feed Instagram saja" },
];

export const HARI_WIB: { kode: number; pendek: string; nama: string }[] = [
  { kode: 1, pendek: "Sen", nama: "Senin" },
  { kode: 2, pendek: "Sel", nama: "Selasa" },
  { kode: 3, pendek: "Rab", nama: "Rabu" },
  { kode: 4, pendek: "Kam", nama: "Kamis" },
  { kode: 5, pendek: "Jum", nama: "Jumat" },
  { kode: 6, pendek: "Sab", nama: "Sabtu" },
  { kode: 0, pendek: "Min", nama: "Minggu" },
];

export type VideoRutin = {
  id: string;
  judul: string;
  url: string;
  sampul?: string | null;
  jenis: "video" | "gambar";
  durasi?: number;
  sasaran: "story" | "reels" | "reels+story";
  /** true = selalu diupload setiap jam buka (contoh: video We Are Open). */
  wajib: boolean;
  aktif: boolean;
  caption?: string;
};

export type FormatOpeningAI = "video-animasi" | "poster";
export type GayaOpeningAI = "otomatis" | "hangat-kafe" | "terang-modern" | "minimalis-gelap";

export type JadwalRutin = {
  aktif: boolean;
  /** Jam buka dalam format HH:MM WIB (mis. "09:00" atau "14:00"). */
  jam: string;
  /** Hari aktif: 0 = Minggu, 1 = Senin, ..., 6 = Sabtu. */
  hari: number[];
  /**
   * "acak" = pilih 1 video acak tiap hari dari seluruh video aktif (tidak mengulang kemarin);
   * "wajib+bergilir" = upload semua video wajib + 1 video pendamping secara bergilir tiap hari;
   * "semua" = upload semua video aktif sekaligus setiap jam buka.
   */
  mode: "acak" | "semua" | "wajib+bergilir";
  /** ID video yang sudah pernah tayang dalam putaran acak saat ini (anti-ulang). */
  riwayatVideo?: string[];
  /** ID video terakhir yang tayang (menjaga tidak tayang 2 hari berturut-turut saat siklus baru). */
  terakhirVideoId?: string | null;
  /** Sertakan 1 konten opening baru hasil generate AI setiap jam buka (tanpa perlu bank video). */
  aiAktif?: boolean;
  /** Format konten AI jam buka: "video-animasi" (Remotion 8 dtk ala Bakafrawi) atau "poster" (Story 9:16). */
  aiFormat?: FormatOpeningAI;
  /** Gaya visual konten AI jam buka. */
  aiGaya?: GayaOpeningAI;
  /** Arahan opsional untuk AI (mis. tonjolkan menu/promo tertentu; kosong = AI pilih otomatis). */
  aiArahan?: string;
  /** true = buat pratinjau dulu di Studio & Telegram (tidak langsung tayang sebelum disetujui). */
  perluPersetujuan?: boolean;
  terakhirTayang?: string | null;
  video: VideoRutin[];
};

const ZONA_WIB_MS = 7 * 3600_000;

export const VIDEO_OPENING_BAWAAN_LEKKOPI: VideoRutin = {
  id: "opening-we-are-open",
  judul: "Story Opening — We Are Open (9AM - 11PM)",
  url: "/lekkopi-opening-story.mp4",
  sampul: "/lekkopi-opening-story.jpg",
  jenis: "video",
  durasi: 9,
  sasaran: "story",
  wajib: true,
  aktif: true,
  caption: "We are OPEN! Senin - Sabtu · Lek Kopi Waru Sidoarjo ☕",
};

/** Konfigurasi jadwal rutin bawaan per merek. */
export function jadwalRutinBawaan(merek = "lekkopi"): JadwalRutin {
  if (merek === "lekkopi") {
    return {
      aktif: false,
      jam: "09:00",
      hari: [1, 2, 3, 4, 5, 6], // Senin - Sabtu
      mode: "acak",
      riwayatVideo: [],
      terakhirVideoId: null,
      aiAktif: false,
      aiFormat: "video-animasi",
      aiGaya: "otomatis",
      aiArahan: "",
      perluPersetujuan: true,
      terakhirTayang: null,
      video: [{ ...VIDEO_OPENING_BAWAAN_LEKKOPI }],
    };
  }
  return {
    aktif: false,
    jam: "09:00",
    hari: [1, 2, 3, 4, 5, 6],
    mode: "acak",
    riwayatVideo: [],
    terakhirVideoId: null,
    aiAktif: false,
    aiFormat: "video-animasi",
    aiGaya: "otomatis",
    aiArahan: "",
    terakhirTayang: null,
    video: [],
  };
}

export function normalisasiSasaran(s?: string | null): SasaranTayang {
  const k = String(s ?? "").trim().toLowerCase();
  if (k === "story" || k === "reels" || k === "reels+story" || k === "feed" || k === "feed+story") return k;
  return "otomatis";
}

/** Pastikan objek JadwalRutin dari database/masukan selalu rapi & aman. */
export function normalisasiJadwalRutin(mentah: unknown, merek = "lekkopi"): JadwalRutin {
  const bawaan = jadwalRutinBawaan(merek);
  if (!mentah || typeof mentah !== "object") return bawaan;
  const m = mentah as Partial<JadwalRutin>;

  const cocokJam = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(m.jam ?? "").trim());
  const jam = cocokJam ? `${cocokJam[1]}:${cocokJam[2]}` : bawaan.jam;

  const hariValid = Array.isArray(m.hari)
    ? [...new Set(m.hari.map((h) => Number(h)).filter((h) => Number.isInteger(h) && h >= 0 && h <= 6))]
    : bawaan.hari;

  const mode: JadwalRutin["mode"] =
    m.mode === "acak" || m.mode === "wajib+bergilir" || m.mode === "semua" ? m.mode : bawaan.mode;

  const riwayatVideo = Array.isArray(m.riwayatVideo)
    ? [...new Set(m.riwayatVideo.map((id) => String(id ?? "").trim()).filter(Boolean))].slice(-30)
    : [];
  const terakhirVideoId =
    typeof m.terakhirVideoId === "string" && m.terakhirVideoId.trim() ? m.terakhirVideoId.trim() : null;

  let video: VideoRutin[] = [];
  if (Array.isArray(m.video)) {
    video = m.video
      .filter((v): v is VideoRutin => Boolean(v && typeof v === "object" && typeof v.url === "string" && v.url.trim()))
      .map((v, idx) => ({
        id: String(v.id || `video-${idx + 1}`).trim(),
        judul: String(v.judul || `Video Opening #${idx + 1}`).trim().slice(0, 120),
        url: String(v.url).trim(),
        sampul: v.sampul ? String(v.sampul).trim() : null,
        jenis: v.jenis === "gambar" ? "gambar" : "video",
        durasi: Number.isFinite(Number(v.durasi)) && Number(v.durasi) > 0 ? Math.round(Number(v.durasi)) : undefined,
        sasaran: v.sasaran === "reels" || v.sasaran === "reels+story" ? v.sasaran : "story",
        wajib: typeof v.wajib === "boolean" ? v.wajib : true,
        aktif: typeof v.aktif === "boolean" ? v.aktif : true,
        caption: typeof v.caption === "string" ? v.caption.slice(0, 1500) : "",
      }));
  } else {
    video = bawaan.video;
  }

  const aiFormat: FormatOpeningAI = m.aiFormat === "poster" ? "poster" : "video-animasi";
  const aiGaya: GayaOpeningAI =
    m.aiGaya === "hangat-kafe" || m.aiGaya === "terang-modern" || m.aiGaya === "minimalis-gelap" ? m.aiGaya : "otomatis";

  return {
    aktif: Boolean(m.aktif),
    jam,
    hari: hariValid,
    mode,
    riwayatVideo,
    terakhirVideoId,
    aiAktif: Boolean(m.aiAktif),
    aiFormat,
    aiGaya,
    aiArahan: typeof m.aiArahan === "string" ? m.aiArahan.trim().slice(0, 300) : "",
    perluPersetujuan: typeof m.perluPersetujuan === "boolean" ? m.perluPersetujuan : true,
    terakhirTayang: typeof m.terakhirTayang === "string" ? m.terakhirTayang : null,
    video,
  };
}

/** Tanggal YYYY-MM-DD dalam zona waktu WIB (UTC+7). */
export function tanggalWibDari(d: Date): string {
  const wib = new Date(d.getTime() + ZONA_WIB_MS);
  const y = wib.getUTCFullYear();
  const m = String(wib.getUTCMonth() + 1).padStart(2, "0");
  const t = String(wib.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${t}`;
}

/** Format Date ke string input datetime-local WIB: YYYY-MM-DDTHH:MM. */
export function keInputDatetimeWIB(d: Date): string {
  const wib = new Date(d.getTime() + ZONA_WIB_MS);
  const y = wib.getUTCFullYear();
  const m = String(wib.getUTCMonth() + 1).padStart(2, "0");
  const t = String(wib.getUTCDate()).padStart(2, "0");
  const j = String(wib.getUTCHours()).padStart(2, "0");
  const mn = String(wib.getUTCMinutes()).padStart(2, "0");
  return `${y}-${m}-${t}T${j}:${mn}`;
}

/**
 * Urai waktu jadwal custom dari input admin / bot:
 * - "YYYY-MM-DDTHH:MM" (dianggap WIB / UTC+7)
 * - atau string ISO dengan offset/Z.
 * Mengembalikan { ok: true, tanggal: Date } atau { ok: false, pesan: string }.
 */
export function uraiJadwalCustomWIB(
  masukan: string,
  sekarang = new Date(),
): { ok: true; tanggal: Date } | { ok: false; pesan: string } {
  const teks = String(masukan ?? "").trim();
  if (!teks) return { ok: false, pesan: "Waktu jadwal belum diisi." };

  let d: Date;
  const lokal = /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(teks);
  if (lokal) {
    const [, y, mo, da, h, mi, s] = lokal;
    const utcMs = Date.UTC(Number(y), Number(mo) - 1, Number(da), Number(h), Number(mi), Number(s ?? 0)) - ZONA_WIB_MS;
    d = new Date(utcMs);
  } else {
    d = new Date(teks);
  }

  if (Number.isNaN(d.getTime())) {
    return { ok: false, pesan: "Format waktu jadwal tidak sah (gunakan YYYY-MM-DDTHH:MM WIB)." };
  }
  if (d.getTime() < sekarang.getTime() - 60_000) {
    return { ok: false, pesan: "Waktu jadwal sudah lewat — pilih waktu ke depan (WIB)." };
  }
  return { ok: true, tanggal: d };
}

/** Buat Date untuk jam:menit WIB tertentu berikutnya (hari ini bila belum lewat, atau besok). */
export function jamWibBerikutnya(jam: number, menit = 0, sekarang = new Date(), tambahHari = 0): Date {
  const wib = new Date(sekarang.getTime() + ZONA_WIB_MS);
  const targetUtc = new Date(
    Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate() + tambahHari, jam, menit, 0) - ZONA_WIB_MS,
  );
  if (tambahHari === 0 && targetUtc.getTime() <= sekarang.getTime() + 2 * 60_000) {
    targetUtc.setUTCDate(targetUtc.getUTCDate() + 1);
  }
  return targetUtc;
}

export type SlotCepatJadwal = {
  kode: string;
  label: string;
  waktuIso: string;
  inputWib: string;
};

/** Pilihan tombol jadwal cepat (WIB) untuk kartu tugas & formulir. */
export function daftarSlotCepatWIB(sekarang = new Date()): SlotCepatJadwal[] {
  const slot: { kode: string; label: string; jam: number; menit: number; tambahHari?: number }[] = [
    { kode: "buka-pagi", label: "Buka 09.00", jam: 9, menit: 0 },
    { kode: "siang", label: "Siang 12.00", jam: 12, menit: 0 },
    { kode: "buka-sore", label: "Sore 14.00", jam: 14, menit: 0 },
    { kode: "prime", label: "Prime 19.00", jam: 19, menit: 0 },
    { kode: "malam", label: "Malam 20.30", jam: 20, menit: 30 },
  ];
  return slot.map((s) => {
    const d = jamWibBerikutnya(s.jam, s.menit, sekarang, s.tambahHari ?? 0);
    return {
      kode: s.kode,
      label: s.label,
      waktuIso: d.toISOString(),
      inputWib: keInputDatetimeWIB(d),
    };
  });
}

/**
 * Hitung waktu tayang jadwal buka otomatis berikutnya (WIB).
 * Mengembalikan null bila jadwal tidak aktif, tidak ada hari yang dipilih, atau tidak ada video aktif.
 */
export function jamBukaBerikutnya(jadwal: JadwalRutin, sekarang = new Date()): Date | null {
  const j = normalisasiJadwalRutin(jadwal);
  const punyaKonten = j.aiAktif || j.video.some((v) => v.aktif);
  if (!j.aktif || !j.hari.length || !punyaKonten) return null;

  const [jamNum, menitNum] = j.jam.split(":").map(Number);
  const wibSekarang = new Date(sekarang.getTime() + ZONA_WIB_MS);
  const hariIniStr = tanggalWibDari(sekarang);

  for (let offset = 0; offset <= 7; offset++) {
    const kandidatWib = new Date(
      Date.UTC(
        wibSekarang.getUTCFullYear(),
        wibSekarang.getUTCMonth(),
        wibSekarang.getUTCDate() + offset,
        jamNum,
        menitNum,
        0,
      ),
    );
    const hariKe = kandidatWib.getUTCDay(); // 0 = Minggu .. 6 = Sabtu
    if (!j.hari.includes(hariKe)) continue;

    const targetUtc = new Date(kandidatWib.getTime() - ZONA_WIB_MS);
    const tglKandidat = tanggalWibDari(targetUtc);

    // Jika hari ini sudah pernah tayang otomatis, lompati ke hari buka berikutnya.
    if (j.terakhirTayang && tglKandidat === j.terakhirTayang) continue;

    // Jika waktu hari ini sudah lewat lebih dari 2 menit, lompati ke hari buka berikutnya.
    if (offset === 0 && targetUtc.getTime() <= sekarang.getTime() + 2 * 60_000 && tglKandidat === hariIniStr) {
      continue;
    }

    return targetUtc;
  }

  return null;
}

/**
 * Tentukan apakah baris antrean `rutin-buka` yang sudah `dijadwalkan` masih berlaku dan TIDAK boleh
 * ditimpa/digeser ke besok oleh detak cron 5 menit.
 * Mencegah bug jadwal hari ini tergeser ke besok sesaat sebelum/tepat saat jam buka tiba.
 */
export function apakahAntreanRutinMasihBerlaku(
  jadwalTayangIso: string | null | undefined,
  jadwal: JadwalRutin,
  sekarang = new Date(),
  batasLewatMs = 6 * 3600_000,
): boolean {
  const j = normalisasiJadwalRutin(jadwal);
  if (!j.aktif || !jadwalTayangIso) return false;
  const targetMs = new Date(jadwalTayangIso).getTime();
  if (!Number.isFinite(targetMs)) return false;
  const tglTarget = tanggalWibDari(new Date(targetMs));
  // Jika tanggal tersebut sudah tercatat tayang, jadwal ini boleh diganti ke hari buka berikutnya.
  if (j.terakhirTayang && tglTarget === j.terakhirTayang) return false;
  const lewatMs = sekarang.getTime() - targetMs;
  // Pertahankan jadwal masa depan, jadwal yang hampir tiba, maupun jadwal yang baru jatuh tempo (<= 6 jam)
  // supaya worker sempat memicu & menayangkannya.
  return lewatMs <= batasLewatMs;
}

/**
 * Pilih daftar video yang akan diupload pada saat jam buka:
 * - Mode "acak": pilih 1 video secara acak dari semua video aktif, menghindari video yang sudah
 *   tayang dalam siklus saat ini (`riwayatVideo`) dan tidak pernah mengulang `terakhirVideoId`
 *   selama tersedia minimal 2 video aktif.
 * - Mode "semua": semua video aktif (video wajib di urutan pertama, diikuti video lainnya).
 * - Mode "wajib+bergilir": semua video aktif yang ditandai wajib + 1 video pendamping bergilir berdasarkan tanggal.
 */
export function pilihVideoBuka(
  jadwal: JadwalRutin,
  untukTanggal = new Date(),
  opsi?: { acak?: () => number; hindariId?: string | null },
): VideoRutin[] {
  const j = normalisasiJadwalRutin(jadwal);
  const aktif = j.video.filter((v) => v.aktif);
  if (!aktif.length) return [];

  if (j.mode === "acak") {
    if (aktif.length === 1) return [aktif[0]];
    const sudah = new Set(j.riwayatVideo ?? []);
    const terakhir = opsi?.hindariId ?? j.terakhirVideoId ?? (j.riwayatVideo?.length ? j.riwayatVideo[j.riwayatVideo.length - 1] : null);
    let kandidat = aktif.filter((v) => !sudah.has(v.id) && v.id !== terakhir);
    if (!kandidat.length) {
      kandidat = aktif.filter((v) => v.id !== terakhir);
    }
    if (!kandidat.length) kandidat = aktif;
    const rng = opsi?.acak ?? Math.random;
    const r = Math.min(0.999999, Math.max(0, Number(rng())));
    const idx = Math.floor(r * kandidat.length);
    return [kandidat[idx] ?? kandidat[0]];
  }

  const wajib = aktif.filter((v) => v.wajib);
  const pendamping = aktif.filter((v) => !v.wajib);

  if (j.mode === "semua") {
    return [...wajib, ...pendamping];
  }

  // Mode "wajib+bergilir": semua video wajib selalu diupload + 1 video pendamping bergilir per hari
  const hariEpoch = Math.floor((untukTanggal.getTime() + ZONA_WIB_MS) / 86_400_000);
  if (pendamping.length > 0) {
    const giliran = pendamping[Math.abs(hariEpoch) % pendamping.length];
    return [...wajib, giliran];
  }
  if (wajib.length > 0) return wajib;
  return [aktif[Math.abs(hariEpoch) % aktif.length]];
}

/** Perbarui catatan riwayat video setelah satu video selesai tayang (untuk siklus acak anti-ulang). */
export function catatRiwayatVideoBuka(
  jadwal: JadwalRutin,
  videoId: string | null | undefined,
): { riwayatVideo: string[]; terakhirVideoId: string | null } {
  const j = normalisasiJadwalRutin(jadwal);
  const id = String(videoId ?? "").trim();
  if (!id) return { riwayatVideo: j.riwayatVideo ?? [], terakhirVideoId: j.terakhirVideoId ?? null };
  const aktifIds = new Set(j.video.filter((v) => v.aktif).map((v) => v.id));
  const lama = (j.riwayatVideo ?? []).filter((x) => aktifIds.has(x) && x !== id);
  const baru = [...lama, id];
  // Jika seluruh video aktif sudah kebagian giliran, reset siklus mulai dari video terakhir ini saja.
  const riwayatFinal = aktifIds.size > 1 && baru.length >= aktifIds.size ? [id] : baru;
  return { riwayatVideo: riwayatFinal, terakhirVideoId: id };
}
