import "server-only";
import { APLIKASI, nilaiAplikasi, urlPintu, type JenisPintu, type Penilaian } from "./aplikasi-murni";

// Ringkasan semua aplikasi Kyai dari pintu baca-saja masing-masing. Satu kode rahasia untuk semua
// pintu (secret PINTU_BAKAFRAWI_RAHASIA di tiap proyek Supabase); di Vercel: PINTU_RAHASIA, atau
// LEKKOPI_PINTU_RAHASIA yang sudah ada untuk Studio Lek Kopi.

export type RingkasAplikasi = {
  slug: string;
  nama: string;
  jenis: JenisPintu | null;
  ok: boolean;
  data?: Record<string, unknown>;
  galat?: string;
  penilaian?: Penilaian;
};

const rahasia = () => process.env.PINTU_RAHASIA || process.env.LEKKOPI_PINTU_RAHASIA || "";

async function satu(a: (typeof APLIKASI)[number], sekarang: Date): Promise<RingkasAplikasi> {
  const dasar = { slug: a.slug, nama: a.nama, jenis: a.jenis };
  const url = urlPintu(a);
  if (!url || !a.jenis) return { ...dasar, ok: false, galat: a.tunda ?? "Belum ada pintu." };
  if (!rahasia()) return { ...dasar, ok: false, galat: "PINTU_RAHASIA belum diisi di Vercel." };
  try {
    // Disimpan 5 menit di cache data Next: dasbor, APK, dan bot tak memanggil 4 proyek tiap kali dibuka.
    const r = await fetch(url, { headers: { "x-pintu-rahasia": rahasia() }, next: { revalidate: 300 }, signal: AbortSignal.timeout(12_000) });
    if (r.status === 403) return { ...dasar, ok: false, galat: "Pintu menolak — kode rahasia beda atau belum disimpan di Supabase aplikasi ini." };
    if (r.status === 404) return { ...dasar, ok: false, galat: "Pintu belum di-deploy (npx supabase functions deploy pintu-bakafrawi --no-verify-jwt)." };
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) return { ...dasar, ok: false, galat: `Pintu galat (${r.status}${j.pesan ? `: ${String(j.pesan).slice(0, 120)}` : ""}).` };
    return { ...dasar, ok: true, data: j.data, penilaian: nilaiAplikasi(a.jenis, j.data, sekarang) };
  } catch (e) {
    return { ...dasar, ok: false, galat: e instanceof Error && e.name === "TimeoutError" ? "Pintu tidak menjawab (12 dtk)." : `Gagal: ${e instanceof Error ? e.message : e}` };
  }
}

export async function ringkasanAplikasi(sekarang = new Date()): Promise<RingkasAplikasi[]> {
  return Promise.all(APLIKASI.map((a) => satu(a, sekarang)));
}
