// Modul murni untuk meringkas statistik Insight Instagram & membangun prompt Audit Performa AI.
// Sengaja tanpa impor "server-only" atau alias "@/..." agar berjalan mulus di `node --test` maupun Next.js.

export type MerekAuditIg = "semua" | "lekkopi" | "bakafrawi";

export type PostAuditMasukan = {
  id: string;
  merek: string;
  produk: string;
  jenis: string;
  format: "reels" | "feed" | "story";
  caption: string | null;
  dibuat: string;
  tayangWaktu: string | null;
  likes: number;
  comments: number;
  views?: number | null;
  reach?: number | null;
  saved?: number | null;
  shares?: number | null;
  replies?: number | null;
};

export type PostAuditRingkas = {
  id: string;
  merek: string;
  produk: string;
  format: "reels" | "feed" | "story";
  tanggalWib: string;
  views: number | null;
  reach: number | null;
  likes: number;
  comments: number;
  saved: number | null;
  shares: number | null;
  captionPendek: string;
};

export type StatistikAuditIg = {
  merekFilter: MerekAuditIg;
  totalPost: number;
  jumlahReels: number;
  jumlahFeed: number;
  jumlahStory: number;
  rataViews: number;
  rataLikes: number;
  rataComments: number;
  rataReach: number;
  postTerbaru: PostAuditRingkas | null;
  rasioTerbaruVsRata: number | null;
  tertinggi: PostAuditRingkas[];
  terendah: PostAuditRingkas[];
  daftarTerbaru: PostAuditRingkas[];
};

export type RekomendasiKontenAudit = {
  judul: string;
  format: "poster" | "video_studio" | "google_flow";
  alasan: string;
  arahanSiapPakai: string;
  gayaDisarankan: string;
};

export type HasilAuditIg = {
  ringkasanEksekutif: string;
  analisisTerbaru: string;
  polaMenang: string[];
  perbaikanPrioritas: string[];
  ideBerikutnya: RekomendasiKontenAudit[];
};

function formatTanggalWib(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  try {
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  } catch {
    return iso.slice(0, 10);
  }
}

function keRingkas(p: PostAuditMasukan): PostAuditRingkas {
  const cap = String(p.caption ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return {
    id: p.id,
    merek: p.merek,
    produk: p.produk,
    format: p.format,
    tanggalWib: formatTanggalWib(p.tayangWaktu ?? p.dibuat),
    views: typeof p.views === "number" && Number.isFinite(p.views) ? p.views : null,
    reach: typeof p.reach === "number" && Number.isFinite(p.reach) ? p.reach : null,
    likes: Number.isFinite(p.likes) ? p.likes : 0,
    comments: Number.isFinite(p.comments) ? p.comments : 0,
    saved: typeof p.saved === "number" && Number.isFinite(p.saved) ? p.saved : null,
    shares: typeof p.shares === "number" && Number.isFinite(p.shares) ? p.shares : null,
    captionPendek: cap.length > 90 ? `${cap.slice(0, 90)}…` : cap,
  };
}

function rataDari(angka: (number | null | undefined)[]): number {
  const valid = angka.filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0);
  if (!valid.length) return 0;
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
}

/** Ringkas metrik postingan IG dari cache Supabase untuk bahan Audit Performa AI. */
export function ringkasMetrikAudit(
  posts: PostAuditMasukan[],
  merekFilter: MerekAuditIg = "semua",
): StatistikAuditIg {
  const tersaring = (posts ?? []).filter((p) =>
    merekFilter === "semua" ? true : String(p.merek ?? "").toLowerCase() === merekFilter,
  );

  const terurut = [...tersaring].sort((a, b) => {
    const ta = Date.parse(a.tayangWaktu ?? a.dibuat ?? "") || 0;
    const tb = Date.parse(b.tayangWaktu ?? b.dibuat ?? "") || 0;
    return tb - ta;
  });

  const ringkas = terurut.map(keRingkas);
  const nonStory = ringkas.filter((p) => p.format !== "story");

  const rataViews = rataDari(ringkas.map((p) => p.views));
  const rataReach = rataDari(ringkas.map((p) => p.reach));
  const rataLikes = rataDari((nonStory.length ? nonStory : ringkas).map((p) => p.likes));
  const rataComments = rataDari((nonStory.length ? nonStory : ringkas).map((p) => p.comments));

  const postTerbaru = ringkas[0] ?? null;
  const rasioTerbaruVsRata =
    postTerbaru?.views != null && rataViews > 0
      ? Math.round((postTerbaru.views / rataViews) * 100) / 100
      : null;

  const nilaiUrut = (p: PostAuditRingkas) => p.views ?? p.likes;
  const berperingkat = [...ringkas].sort((a, b) => nilaiUrut(b) - nilaiUrut(a));
  const tertinggi = berperingkat.slice(0, 3);
  const idTertinggi = new Set(tertinggi.map((x) => x.id));
  const terendah =
    berperingkat.length <= 3
      ? []
      : [...berperingkat]
          .reverse()
          .filter((x) => !idTertinggi.has(x.id))
          .slice(0, 3);

  return {
    merekFilter,
    totalPost: ringkas.length,
    jumlahReels: ringkas.filter((p) => p.format === "reels").length,
    jumlahFeed: ringkas.filter((p) => p.format === "feed").length,
    jumlahStory: ringkas.filter((p) => p.format === "story").length,
    rataViews,
    rataLikes,
    rataComments,
    rataReach,
    postTerbaru,
    rasioTerbaruVsRata,
    tertinggi,
    terendah,
    daftarTerbaru: ringkas.slice(0, 15),
  };
}

export const SKEMA_AUDIT_IG = {
  type: "object",
  additionalProperties: false,
  required: [
    "ringkasanEksekutif",
    "analisisTerbaru",
    "polaMenang",
    "perbaikanPrioritas",
    "ideBerikutnya",
  ],
  properties: {
    ringkasanEksekutif: {
      type: "string",
      description: "2-3 kalimat padat merangkum kondisi performa akun Instagram berdasarkan data nyata di atas, memanggil 'Kyai'.",
    },
    analisisTerbaru: {
      type: "string",
      description: "Bedah spesifik kenapa postingan/reel terakhir sepi atau ramai dibanding rata-rata akun (merujuk angka views, likes, save, share, dan caption).",
    },
    polaMenang: {
      type: "array",
      items: { type: "string" },
      description: "3 pola konkret yang terbukti berhasil dari postingan dengan performa tertinggi di akun ini.",
    },
    perbaikanPrioritas: {
      type: "array",
      items: { type: "string" },
      description: "3 aksi perbaikan paling berdampak dan praktis untuk minggu ini.",
    },
    ideBerikutnya: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["judul", "format", "alasan", "arahanSiapPakai", "gayaDisarankan"],
        properties: {
          judul: { type: "string", description: "Judul ide singkat 3-7 kata" },
          format: { type: "string", enum: ["poster", "video_studio", "google_flow"] },
          alasan: { type: "string", description: "1 kalimat alasan kenapa ide ini berpotensi naik berdasarkan data akun" },
          arahanSiapPakai: { type: "string", description: "Teks arahan siap tempel langsung ke tab Buat AI atau Google Flow" },
          gayaDisarankan: { type: "string", description: "Contoh: photo-floating, fooh_3d, iklan_komersial, sketsa_visual, dll." },
        },
      },
      description: "2-3 ide konten berikutnya siap pakai berdasarkan evaluasi data akun.",
    },
  },
} as const;

function barisRingkas(p: PostAuditRingkas, i: number): string {
  const metrik = [
    `views=${p.views ?? "-"}`,
    `reach=${p.reach ?? "-"}`,
    `likes=${p.likes}`,
    `komen=${p.comments}`,
    p.saved != null ? `save=${p.saved}` : null,
    p.shares != null ? `share=${p.shares}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  return `${i + 1}. [${p.format.toUpperCase()} · ${p.merek} · ${p.tanggalWib}] ${metrik} | caption: "${p.captionPendek || "(tanpa caption)"}"`;
}

export function buatPromptAuditIg({
  statistik,
  pertanyaan = "",
  merekLabel,
}: {
  statistik: StatistikAuditIg;
  pertanyaan?: string;
  merekLabel?: string;
}) {
  const label =
    merekLabel ||
    (statistik.merekFilter === "lekkopi"
      ? "Lek Kopi (@lekkopi.id)"
      : statistik.merekFilter === "bakafrawi"
      ? "Bakafrawi Project (@bakafrawi.project)"
      : "Gabungan Akun (Lek Kopi & Bakafrawi)");

  const infoTerbaru = statistik.postTerbaru
    ? `Postingan terakhir: [${statistik.postTerbaru.format.toUpperCase()} · ${statistik.postTerbaru.merek} · ${statistik.postTerbaru.tanggalWib}] views=${statistik.postTerbaru.views ?? "-"}, reach=${statistik.postTerbaru.reach ?? "-"}, likes=${statistik.postTerbaru.likes}, komen=${statistik.postTerbaru.comments}, save=${statistik.postTerbaru.saved ?? "-"}, share=${statistik.postTerbaru.shares ?? "-"}, rasioViewsVsRata=${statistik.rasioTerbaruVsRata ?? "-"}x | caption: "${statistik.postTerbaru.captionPendek || "(tanpa caption)"}"`
    : "Postingan terakhir: tidak tersedia.";

  const blokTertinggi = statistik.tertinggi.length
    ? statistik.tertinggi.map(barisRingkas).join("\n")
    : "-";
  const blokTerendah = statistik.terendah.length
    ? statistik.terendah.map(barisRingkas).join("\n")
    : "(belum cukup pembanding)";
  const blokDaftar = statistik.daftarTerbaru.map(barisRingkas).join("\n");

  return {
    system:
      "Kamu adalah analis strategi konten Instagram yang jujur, tajam, dan praktis untuk Kyai (pemilik Bakafrawi Project software studio & kedai Lek Kopi di Waru, Sidoarjo). " +
      "Gunakan HANYA angka nyata yang diberikan di data. Jangan pernah mengarang angka atau metrik yang tidak tercantum. " +
      "Panggil pengguna 'Kyai', tulis dalam Bahasa Indonesia santai dan langsung ke inti masalah serta solusi yang bisa langsung dipraktikkan di Studio AI atau Google Flow.",
    prompt: [
      `Lakukan Audit Performa Instagram untuk: ${label}`,
      `Ringkasan statistik (${statistik.totalPost} postingan: ${statistik.jumlahReels} Reels, ${statistik.jumlahFeed} Feed, ${statistik.jumlahStory} Story):`,
      `- Rata-rata Views: ${statistik.rataViews} | Rata-rata Reach: ${statistik.rataReach} | Rata-rata Likes: ${statistik.rataLikes} | Rata-rata Komentar: ${statistik.rataComments}`,
      `- ${infoTerbaru}`,
      "",
      "Top 3 Konten Tertinggi:",
      blokTertinggi,
      "",
      "Konten Performa Terendah:",
      blokTerendah,
      "",
      `Daftar ${statistik.daftarTerbaru.length} Postingan Terbaru:`,
      blokDaftar,
      "",
      pertanyaan.trim()
        ? `Pertanyaan khusus Kyai: "${pertanyaan.trim()}" — jawab pertanyaan ini secara spesifik pada bagian analisisTerbaru & perbaikanPrioritas.`
        : "Pertanyaan utama: Evaluasi kenapa konten terbaru bisa naik atau sepi dibanding rata-rata, pola apa yang paling disukai audiens, dan berikan 2–3 ide konten siap eksekusi.",
    ].join("\n"),
  };
}
