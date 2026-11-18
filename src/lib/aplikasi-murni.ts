// Dasbor aplikasi Bakafrawi — aturan murni (tanpa jaringan), dipakai server, layar, dan bot; diuji
// di aplikasi-murni.test.ts. Tiap aplikasi punya pintu baca-saja `pintu-bakafrawi` di Supabase-nya.

export type JenisPintu = "saas" | "kedai" | "teknis";

export type Aplikasi = {
  slug: string;
  nama: string;
  /** Ref proyek Supabase; null = belum punya pintu (mis. masih Firebase). */
  ref: string | null;
  jenis: JenisPintu | null;
  /** Kenapa belum ada pintu (ditampilkan di kartu). */
  tunda?: string;
  kueri?: string;
};

// Ammu & Waseela = data lembaga klien, Fastabiqu = data pribadi Kyai & istri → pintu TEKNIS saja
// (keputusan Kyai 18 Nov 2026).
export const APLIKASI: Aplikasi[] = [
  { slug: "maktaba", nama: "Maktaba POS", ref: "zxwjirxgijdrvysdaipb", jenis: "saas" },
  { slug: "lekkopi", nama: "Lek Kopi", ref: "vwepjebxsszoahjmiwxo", jenis: "kedai", kueri: "?jenis=dasbor" },
  { slug: "ammu", nama: "Ammu Online", ref: "rzwefjilxzsqlokkwiyt", jenis: "teknis" },
  { slug: "waseela", nama: "Waseela", ref: "vfbmaywcjurykxfetbia", jenis: "teknis" },
  { slug: "fastabiqu", nama: "Fastabiqu", ref: "sizdaztucpuxhyzrpsqe", jenis: "teknis" },
];

export const urlPintu = (a: Aplikasi) => (a.ref ? `https://${a.ref}.supabase.co/functions/v1/pintu-bakafrawi${a.kueri ?? ""}` : null);

/** Batas paket gratis Supabase 500 MB; mulai diingatkan di 400 MB. */
export const BATAS_DB_MB = 400;

type Data = Record<string, unknown>;
const n = (d: Data, k: string) => Number(d[k] ?? 0) || 0;

export const rupiah = (x: number) => `Rp${Math.round(x).toLocaleString("id-ID")}`;

/** "+12%" / "−5%" / "" (kemarin 0). */
export function selisihPersen(kini: number, lalu: number): string {
  if (!lalu) return "";
  const p = Math.round(((kini - lalu) / lalu) * 100);
  return `${p >= 0 ? "+" : "−"}${Math.abs(p)}%`;
}

export type Penilaian = { tingkat: "baik" | "perhatian"; catatan: string[] };

/** Hal yang perlu Kyai perhatikan dari ringkasan satu aplikasi. */
export function nilaiAplikasi(jenis: JenisPintu, d: Data, sekarang: Date): Penilaian {
  const c: string[] = [];
  if (jenis === "saas") {
    if (n(d, "menunggu_konfirmasi")) c.push(`${n(d, "menunggu_konfirmasi")} pembayaran langganan menunggu konfirmasi`);
    if (n(d, "habis_7h")) c.push(`${n(d, "habis_7h")} langganan habis dalam 7 hari`);
  } else if (jenis === "kedai") {
    if (n(d, "stok_menipis")) {
      const bahan = Array.isArray(d.bahan_menipis) ? (d.bahan_menipis as string[]).join(", ") : "";
      c.push(`${n(d, "stok_menipis")} bahan menipis${bahan ? `: ${bahan}` : ""}`);
    }
  } else {
    const terakhir = d.login_terakhir ? new Date(String(d.login_terakhir)).getTime() : 0;
    if (!n(d, "aktif_24j")) c.push("Tidak ada pengguna aktif 24 jam terakhir");
    if (terakhir && sekarang.getTime() - terakhir > 3 * 864e5) c.push("Tak ada yang login lebih dari 3 hari");
  }
  if (n(d, "ukuran_db_mb") >= BATAS_DB_MB) c.push(`Database ${n(d, "ukuran_db_mb")} MB — mendekati batas 500 MB paket gratis`);
  return { tingkat: c.length ? "perhatian" : "baik", catatan: c };
}

/** Baris angka utama tiap jenis kartu: [label, nilai]. */
export function angkaUtama(jenis: JenisPintu, d: Data): [string, string][] {
  if (jenis === "saas") {
    return [
      ["Toko", `${n(d, "toko")} (${n(d, "aktif")} aktif · ${n(d, "trial")} trial)`],
      ["Pendapatan bulan ini", rupiah(n(d, "pendapatan_bulan_ini"))],
      ["MRR", rupiah(n(d, "mrr"))],
      ["Toko baru 7 hari", String(n(d, "toko_baru_7h"))],
      ["Transaksi 24 jam", n(d, "transaksi_24j").toLocaleString("id-ID")],
    ];
  }
  if (jenis === "kedai") {
    const s = selisihPersen(n(d, "omzet"), n(d, "omzet_kemarin"));
    const laris = Array.isArray(d.terlaris) ? (d.terlaris as { nama: string; qty: number }[]).map((x) => `${x.nama} (${x.qty})`).join(", ") : "";
    return [
      ["Omzet hari ini", `${rupiah(n(d, "omzet"))}${s ? ` (${s} vs kemarin)` : ""}`],
      ["Transaksi", `${n(d, "trx")} · ${n(d, "cup")} cup`],
      ["Terlaris", laris || "-"],
      ["Kas hari ini", `+${rupiah(n(d, "kas_masuk"))} / −${rupiah(n(d, "kas_keluar"))}`],
      ["Bon & hutang", `bon ${rupiah(n(d, "piutang"))} · hutang ${rupiah(n(d, "hutang_toko"))}`],
    ];
  }
  return [
    ["Akun", n(d, "akun").toLocaleString("id-ID")],
    ["Aktif 24 jam / 7 hari", `${n(d, "aktif_24j")} / ${n(d, "aktif_7h")}`],
    ["Aktivitas 24 jam", n(d, "aktivitas_24j").toLocaleString("id-ID")],
    ["Database", `${n(d, "ukuran_db_mb")} MB`],
  ];
}
