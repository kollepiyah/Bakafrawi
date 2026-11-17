import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { situsBawaan } from "@/content/situs";
import { skemaSitus, type Situs } from "@/content/skema";
import { adaSupabase, modeLokal, SUPABASE_ANON, SUPABASE_URL } from "./lingkungan";

export const TAG_KONTEN = "konten";

async function bacaMentah(): Promise<unknown> {
  if (modeLokal) {
    const { bacaKontenLokal } = await import("./penyimpanan-lokal");
    return bacaKontenLokal();
  }
  if (!adaSupabase) return null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/konten?id=eq.situs&select=data`, {
    // Cukup header apikey: berlaku untuk kunci anon lama (eyJ…) maupun publishable baru (sb_publishable_…).
    headers: { apikey: SUPABASE_ANON },
  });
  if (!res.ok) throw new Error(`Gagal membaca konten: ${res.status}`);
  const baris = (await res.json()) as { data: unknown }[];
  return baris[0]?.data ?? null;
}

/**
 * Isi situs yang tayang. Di-cache dan diberi tag; panel admin memanggil /api/segarkan setelah
 * menyimpan sehingga perubahan langsung terlihat. Isi rusak / database mati → isi bawaan,
 * supaya situs tak pernah kosong.
 */
export async function ambilKonten(): Promise<Situs> {
  "use cache";
  cacheTag(TAG_KONTEN);
  cacheLife("days");
  try {
    const mentah = await bacaMentah();
    if (!mentah) return situsBawaan;
    const hasil = skemaSitus.safeParse(mentah);
    if (!hasil.success) {
      console.error("Konten di database tidak valid, memakai isi bawaan:", hasil.error.issues.slice(0, 3));
      return situsBawaan;
    }
    return hasil.data;
  } catch (e) {
    console.error("Konten tak terbaca, memakai isi bawaan:", e);
    return situsBawaan;
  }
}
