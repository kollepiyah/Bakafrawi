// Aturan agenda yang murni (tanpa jaringan) — dipakai server situs, bot Telegram, dan diuji di
// agenda-murni.test.ts. Semua "hari" dihitung dalam WIB (UTC+7, tanpa musim panas).

export const ZONA = "Asia/Jakarta";
const WIB = 7 * 3600_000;
const MENIT = 60_000;
const HARI = 24 * 3600_000;

export type Acara = {
  id: string;
  judul: string;
  mulai: string; // ISO UTC
  selesai: string;
  seharian: boolean;
  lokasi: string | null;
  catatan: string | null;
  google_id: string | null;
  status: "aktif" | "batal";
  perlu_sinkron: boolean;
  diingatkan: string | null;
  berulang: boolean;
};

/** Bentuk acara Google Calendar (hanya kolom yang dipakai). */
export type AcaraGoogle = {
  id: string;
  status?: string;
  summary?: string;
  location?: string;
  description?: string;
  recurringEventId?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

const dua = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" menurut kalender WIB. */
export function tanggalWIB(d: Date): string {
  const w = new Date(d.getTime() + WIB);
  return `${w.getUTCFullYear()}-${dua(w.getUTCMonth() + 1)}-${dua(w.getUTCDate())}`;
}

/** Pukul 00.00 WIB pada tanggal itu, sebagai instan UTC. */
export function awalHariWIB(tanggal: string): Date {
  const [y, m, d] = tanggal.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - WIB);
}

/** Rentang satu hari WIB (hariKe 0 = hari ini, 1 = besok). */
export function rentangHariWIB(sekarang: Date, hariKe = 0, jumlahHari = 1) {
  const dari = new Date(awalHariWIB(tanggalWIB(sekarang)).getTime() + hariKe * HARI);
  return { dari, sampai: new Date(dari.getTime() + jumlahHari * HARI) };
}

export type MasukanAcara = {
  judul?: string;
  mulai?: string;
  selesai?: string | null;
  seharian?: boolean;
  lokasi?: string | null;
  catatan?: string | null;
};

/** Waktu tanpa zona ("2026-11-20T09:00") dianggap WIB — begitulah Kyai dan bot menulisnya. */
function uraiWaktu(s: string): Date | null {
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return awalHariWIB(t);
  const ada_zona = /(Z|[+-]\d{2}:?\d{2})$/i.test(t);
  const d = new Date(ada_zona ? t : `${t}+07:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type HasilNormal =
  | { ok: true; data: Pick<Acara, "judul" | "mulai" | "selesai" | "seharian" | "lokasi" | "catatan"> }
  | { ok: false; galat: string };

/**
 * Rapikan & periksa masukan acara (dari layar, APK, atau bot). Selesai kosong → 1 jam; acara seharian
 * dibulatkan ke 00.00 WIB dengan selesai eksklusif (seperti Google Calendar).
 */
export function normalisasiAcara(m: MasukanAcara): HasilNormal {
  const judul = (m.judul ?? "").trim().replace(/\s+/g, " ");
  if (!judul) return { ok: false, galat: "Judul acara wajib diisi." };
  if (judul.length > 200) return { ok: false, galat: "Judul terlalu panjang (maks. 200 huruf)." };
  if (!m.mulai) return { ok: false, galat: "Waktu mulai wajib diisi." };
  let mulai = uraiWaktu(m.mulai);
  if (!mulai) return { ok: false, galat: "Waktu mulai tidak terbaca." };
  let selesai = m.selesai ? uraiWaktu(m.selesai) : null;
  if (m.selesai && !selesai) return { ok: false, galat: "Waktu selesai tidak terbaca." };
  const seharian = Boolean(m.seharian);
  if (seharian) {
    mulai = awalHariWIB(tanggalWIB(mulai));
    // Selesai seharian ditulis inklusif ("sampai tanggal 22") lalu disimpan eksklusif seperti Google.
    const akhir = selesai ? awalHariWIB(tanggalWIB(selesai)) : mulai;
    selesai = new Date(Math.max(akhir.getTime(), mulai.getTime()) + HARI);
  } else {
    selesai ??= new Date(mulai.getTime() + 60 * MENIT);
    if (selesai.getTime() <= mulai.getTime()) return { ok: false, galat: "Waktu selesai harus sesudah waktu mulai." };
  }
  if (selesai.getTime() - mulai.getTime() > 31 * HARI) return { ok: false, galat: "Acara paling lama 31 hari." };
  const bersih = (s?: string | null) => (s ?? "").trim() || null;
  return {
    ok: true,
    data: { judul, mulai: mulai.toISOString(), selesai: selesai.toISOString(), seharian, lokasi: bersih(m.lokasi), catatan: bersih(m.catatan) },
  };
}

/**
 * Acara tersimpan → masukan untuk normalisasiAcara, dipakai saat mengubah sebagian kolom. Selesai
 * seharian dikembalikan ke bentuk inklusif supaya ubah berulang tak memanjangkan acara sehari-sehari.
 */
export function masukanDariAcara(a: Pick<Acara, "judul" | "mulai" | "selesai" | "seharian" | "lokasi" | "catatan">): MasukanAcara {
  const selesai = a.seharian ? new Date(new Date(a.selesai).getTime() - HARI).toISOString() : a.selesai;
  return { judul: a.judul, mulai: a.mulai, selesai, seharian: a.seharian, lokasi: a.lokasi, catatan: a.catatan };
}

/** Id acara Google dari id lokal: uuid tanpa tanda hubung (huruf 0-9a-f sah untuk base32hex Google). */
export const idGoogle = (id: string) => id.replace(/-/g, "").toLowerCase();

/** Isi acara untuk API Google Calendar. */
export function keGoogle(a: Pick<Acara, "judul" | "mulai" | "selesai" | "seharian" | "lokasi" | "catatan">) {
  const waktu = (iso: string) =>
    a.seharian ? { date: tanggalWIB(new Date(iso)), dateTime: null, timeZone: null } : { dateTime: iso, date: null, timeZone: ZONA };
  return { summary: a.judul, location: a.lokasi ?? "", description: a.catatan ?? "", start: waktu(a.mulai), end: waktu(a.selesai) };
}

/** Acara Google → kolom lokal. null bila tak bisa dibaca (tanpa waktu). */
export function dariGoogle(g: AcaraGoogle): (Pick<Acara, "judul" | "mulai" | "selesai" | "seharian" | "lokasi" | "catatan" | "status" | "berulang"> & { google_id: string }) | null {
  const seharian = Boolean(g.start?.date && !g.start?.dateTime);
  const mulai = g.start?.dateTime ? new Date(g.start.dateTime) : g.start?.date ? awalHariWIB(g.start.date) : null;
  const selesai = g.end?.dateTime ? new Date(g.end.dateTime) : g.end?.date ? awalHariWIB(g.end.date) : null;
  if (!mulai || Number.isNaN(mulai.getTime())) return null;
  const akhir = selesai && !Number.isNaN(selesai.getTime()) && selesai > mulai ? selesai : new Date(mulai.getTime() + (seharian ? HARI : 60 * MENIT));
  return {
    google_id: g.id,
    judul: (g.summary ?? "").trim() || "(tanpa judul)",
    mulai: mulai.toISOString(),
    selesai: akhir.toISOString(),
    seharian,
    lokasi: g.location?.trim() || null,
    catatan: g.description?.trim() || null,
    status: g.status === "cancelled" ? "batal" : "aktif",
    berulang: Boolean(g.recurringEventId),
  };
}

type LokalSinkron = Pick<Acara, "id" | "google_id" | "perlu_sinkron" | "status" | "judul" | "mulai" | "selesai" | "seharian" | "lokasi" | "catatan" | "berulang">;

const samaWaktu = (a: string, b: string) => new Date(a).getTime() === new Date(b).getTime();

/**
 * Bandingkan isi Google dalam satu jendela waktu dengan salinan lokal yang tertaut Google.
 * - simpan: acara Google yang baru/berubah (yang sama persis dilewati supaya tak menulis tiap 5 menit);
 * - hilang: acara lokal tertaut yang tak muncul lagi di jendela — dicek satu per satu oleh pemanggil
 *   (bisa dihapus di Google, bisa juga hanya digeser ke luar jendela).
 * Perubahan lokal yang belum terkirim (perlu_sinkron) menang: ia didorong dulu, lalu ditarik lagi.
 */
export function rencanaSinkron(lokal: LokalSinkron[], google: AcaraGoogle[]) {
  const perGoogle = new Map(lokal.filter((l) => l.google_id).map((l) => [l.google_id!, l]));
  const simpan = google
    .map(dariGoogle)
    .filter((g): g is NonNullable<ReturnType<typeof dariGoogle>> => {
      if (!g) return false;
      const l = perGoogle.get(g.google_id);
      if (!l) return true;
      if (l.perlu_sinkron) return false;
      return !(
        l.judul === g.judul && samaWaktu(l.mulai, g.mulai) && samaWaktu(l.selesai, g.selesai) && l.seharian === g.seharian &&
        (l.lokasi ?? null) === g.lokasi && (l.catatan ?? null) === g.catatan && l.status === g.status && l.berulang === g.berulang
      );
    });
  const adaDiGoogle = new Set(google.map((g) => g.id));
  const hilang = lokal.filter((l) => l.google_id && !l.perlu_sinkron && l.status === "aktif" && !adaDiGoogle.has(l.google_id)).map((l) => l.id);
  return { simpan, hilang };
}

/** Acara yang mulai dalam `menit` ke depan dan belum diingatkan (acara seharian tak diingatkan). */
export function perluDiingatkan<T extends Pick<Acara, "mulai" | "seharian" | "status" | "diingatkan">>(acara: T[], sekarang: Date, menit = 30): T[] {
  const t = sekarang.getTime();
  return acara.filter((a) => {
    const m = new Date(a.mulai).getTime();
    return a.status === "aktif" && !a.seharian && !a.diingatkan && m > t && m <= t + menit * MENIT;
  });
}

/** Ringkasan pagi dikirim sekali sehari antara 05.30 dan 12.00 WIB. */
export function waktunyaRingkasanPagi(sekarang: Date, terakhir: string | null): boolean {
  const w = new Date(sekarang.getTime() + WIB);
  const menitHari = w.getUTCHours() * 60 + w.getUTCMinutes();
  return menitHari >= 5 * 60 + 30 && menitHari < 12 * 60 && terakhir !== tanggalWIB(sekarang);
}

const NAMA_HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const NAMA_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** "Kamis, 19 November 2026" */
export function namaTanggal(tanggal: string): string {
  const [y, m, d] = tanggal.split("-").map(Number);
  return `${NAMA_HARI[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${d} ${NAMA_BULAN[m - 1]} ${y}`;
}

/** "09.30" (WIB) */
export function jamWIB(iso: string): string {
  const w = new Date(new Date(iso).getTime() + WIB);
  return `${dua(w.getUTCHours())}.${dua(w.getUTCMinutes())}`;
}

/** Satu baris acara untuk pesan Telegram. */
export function barisAcara(a: Pick<Acara, "judul" | "mulai" | "selesai" | "seharian" | "lokasi">): string {
  const waktu = a.seharian ? "Seharian" : `${jamWIB(a.mulai)}–${jamWIB(a.selesai)}`;
  return `• ${waktu} ${a.judul}${a.lokasi ? ` (${a.lokasi})` : ""}`;
}

/** Daftar acara satu hari untuk Telegram (ringkasan pagi ☀️ atau perintah /agenda 📅). */
export function pesanRingkasanPagi(acara: Pick<Acara, "judul" | "mulai" | "selesai" | "seharian" | "lokasi">[], tanggal: string, ikon = "☀️"): string {
  const kepala = `${ikon} Agenda ${namaTanggal(tanggal)}`;
  if (!acara.length) return `${kepala}\nTidak ada acara.`;
  return `${kepala}\n${[...acara].sort((a, b) => a.mulai.localeCompare(b.mulai)).map(barisAcara).join("\n")}`;
}

export function pesanPengingat(a: Pick<Acara, "judul" | "mulai" | "lokasi">, sekarang: Date): string {
  const sisa = Math.max(1, Math.round((new Date(a.mulai).getTime() - sekarang.getTime()) / MENIT));
  return `⏰ ${sisa} menit lagi: ${a.judul} — pukul ${jamWIB(a.mulai)} WIB${a.lokasi ? ` di ${a.lokasi}` : ""}.`;
}
