// Modul murni evaluasi mingguan & penyesuaian gaya video otomatis (tanpa server-only/alias).
import type { StatistikAuditIg } from "./audit-ig-murni.ts";

export type MerekEvaluasi = "bakafrawi" | "lekkopi";

export const PRESET_SAH_EVALUASI: Record<MerekEvaluasi, readonly string[]> = {
  bakafrawi: ["dark-keynote", "split-hook", "pov-chat", "sinematik-ai"],
  lekkopi: ["sinematik-kafe", "story-drop", "dial-menu", "editorial-scroll"],
};

export type EvaluasiMingguan = {
  minggu: string; // YYYY-MM-DD (Senin WIB)
  dibuatPada: string;
  merek: MerekEvaluasi;
  penyedia: string;
  ringkasan: string;
  wawasan: string[];
  gayaPrioritas: string[];
  gayaKurangi: string[];
  saranHook: string;
  totalPostDianalisis: number;
  rataViews: number;
};

/** Kembalikan tanggal Senin minggu ini (YYYY-MM-DD) pada zona waktu WIB (+07:00). */
export function kunciMingguWib(sekarang: Date = new Date()): string {
  const wib = new Date(sekarang.getTime() + 7 * 3600_000);
  const hariKe = (wib.getUTCDay() + 6) % 7; // Senin = 0 .. Minggu = 6
  const senin = new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate() - hariKe));
  const y = senin.getUTCFullYear();
  const m = String(senin.getUTCMonth() + 1).padStart(2, "0");
  const d = String(senin.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** true hanya pada Senin >= 06.00 WIB jika minggu tersebut belum dievaluasi. */
export function waktunyaEvaluasiMingguan(
  sekarang: Date = new Date(),
  mingguTerakhir?: string | null,
): boolean {
  const wib = new Date(sekarang.getTime() + 7 * 3600_000);
  if (wib.getUTCDay() !== 1) return false;
  if (wib.getUTCHours() < 6) return false;
  return kunciMingguWib(sekarang) !== (mingguTerakhir ?? "");
}

/** Baca gaya video dari naskah.catatan ("gaya video: ...") atau tag `[Gaya: ...]` di arahan. */
export function ekstrakGayaDariTugas(tugas: {
  arahan?: string | null;
  naskah?: { catatan?: unknown } | null;
}): string | null {
  const catatan = Array.isArray(tugas.naskah?.catatan) ? tugas.naskah?.catatan : [];
  for (const c of catatan) {
    const m = /^gaya video:\s*([a-z0-9-]+)/i.exec(String(c ?? "").trim());
    if (m) return m[1].toLowerCase();
  }
  const tag = /\[Gaya:\s*([a-z0-9-]+)\]/i.exec(String(tugas.arahan ?? ""));
  return tag ? tag[1].toLowerCase() : null;
}

export const SKEMA_EVALUASI_MINGGUAN = {
  type: "object",
  additionalProperties: false,
  required: ["ringkasan", "wawasan", "gayaPrioritas", "gayaKurangi", "saranHook"],
  properties: {
    ringkasan: { type: "string", description: "Ringkasan 1-2 kalimat performa minggu ini" },
    wawasan: {
      type: "array",
      items: { type: "string" },
      description: "Maksimal 3 temuan singkat berbasis angka nyata",
    },
    gayaPrioritas: {
      type: "array",
      items: { type: "string" },
      description: "1-2 kode preset sah yang layak diprioritaskan minggu depan",
    },
    gayaKurangi: {
      type: "array",
      items: { type: "string" },
      description: "0-2 kode preset sah yang performanya lemah untuk dikurangi",
    },
    saranHook: {
      type: "string",
      description: "1 kalimat arahan hook pembuka 3 detik yang paling cocok minggu depan",
    },
  },
} as const;

export function buatPromptEvaluasiMingguan(masukan: {
  merek: MerekEvaluasi;
  statistik: StatistikAuditIg;
  ringkasGaya: Record<string, number>;
}): { system: string; prompt: string } {
  const sah = PRESET_SAH_EVALUASI[masukan.merek].join(", ");
  const system =
    "Kamu analis konten Instagram & TikTok berbahasa Indonesia yang hemat kata, objektif, dan berpegang hanya pada angka yang diberikan.";
  const prompt = [
    `Evaluasi mingguan akun merek: ${masukan.merek}`,
    `Kode preset gaya SAH untuk merek ini (HANYA pilih dari daftar ini): ${sah}`,
    `Total post: ${masukan.statistik.totalPost}, rata-rata views: ${masukan.statistik.rataViews}, rata-rata likes: ${masukan.statistik.rataLikes}`,
    `Distribusi gaya video yang baru dibuat: ${JSON.stringify(masukan.ringkasGaya)}`,
    `Top 3 performa terbaik: ${JSON.stringify(masukan.statistik.tertinggi.map((p) => ({ tgl: p.tanggalWib, format: p.format, views: p.views, likes: p.likes, caption: p.captionPendek })))}`,
    `Bottom 3 performa terbawah: ${JSON.stringify(masukan.statistik.terendah.map((p) => ({ tgl: p.tanggalWib, format: p.format, views: p.views, likes: p.likes, caption: p.captionPendek })))}`,
    "Berikan JSON ringkas untuk penyesuaian rotasi gaya minggu depan (jangan pernah menyarankan kode preset di luar daftar sah).",
  ].join("\n");
  return { system, prompt };
}

/** Saring keluaran AI agar hanya memuat preset sah tanpa tumpang tindih. */
export function normalisasiEvaluasiMingguan(
  raw: Partial<{
    ringkasan: string;
    wawasan: string[];
    gayaPrioritas: string[];
    gayaKurangi: string[];
    saranHook: string;
  }>,
  meta: {
    merek: MerekEvaluasi;
    minggu: string;
    dibuatPada: string;
    penyedia: string;
    totalPostDianalisis: number;
    rataViews: number;
  },
): EvaluasiMingguan {
  const sah = new Set(PRESET_SAH_EVALUASI[meta.merek]);
  const saringPreset = (arr: unknown, batas: number) => {
    if (!Array.isArray(arr)) return [];
    const hasil: string[] = [];
    for (const v of arr) {
      const k = String(v ?? "").trim().toLowerCase();
      if (!sah.has(k) || hasil.includes(k)) continue;
      hasil.push(k);
      if (hasil.length >= batas) break;
    }
    return hasil;
  };

  const gayaPrioritas = saringPreset(raw.gayaPrioritas, 2);
  const setPrioritas = new Set(gayaPrioritas);
  const gayaKurangi = saringPreset(raw.gayaKurangi, 2).filter((g) => !setPrioritas.has(g));
  const wawasan = (Array.isArray(raw.wawasan) ? raw.wawasan : [])
    .map((x) => String(x ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 3);

  return {
    minggu: meta.minggu,
    dibuatPada: meta.dibuatPada,
    merek: meta.merek,
    penyedia: meta.penyedia,
    ringkasan: String(raw.ringkasan ?? "Evaluasi mingguan selesai.").replace(/\s+/g, " ").trim().slice(0, 320),
    wawasan,
    gayaPrioritas,
    gayaKurangi,
    saranHook: String(raw.saranHook ?? "").replace(/\s+/g, " ").trim().slice(0, 180),
    totalPostDianalisis: meta.totalPostDianalisis,
    rataViews: meta.rataViews,
  };
}
