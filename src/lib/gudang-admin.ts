"use client";

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import type { Situs } from "@/content/skema";
import { adaSupabase, modeLokal, SUPABASE_ANON, SUPABASE_URL } from "./lingkungan";

// Tempat panel admin membaca & menyimpan. Dua jalur dengan antarmuka sama: Supabase (sungguhan)
// dan mode uji lokal (berkas di laptop) — editor tak perlu tahu mana yang dipakai.

let klien: SupabaseClient | null = null;
export function supabase() {
  if (!adaSupabase) throw new Error("Supabase belum dikonfigurasi (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY).");
  klien ??= createClient(SUPABASE_URL, SUPABASE_ANON);
  return klien;
}

export const jalurGudang: "lokal" | "supabase" | "tidak-ada" = modeLokal ? "lokal" : adaSupabase ? "supabase" : "tidak-ada";

export async function muatKonten(): Promise<Situs | null> {
  if (jalurGudang === "lokal") {
    const res = await fetch("/api/lokal", { cache: "no-store" });
    return (await res.json()).data ?? null;
  }
  const { data, error } = await supabase().from("konten").select("data").eq("id", "situs").maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.data as Situs) ?? null;
}

export async function simpanKonten(isi: Situs, sesi: Session | null) {
  if (jalurGudang === "lokal") {
    const res = await fetch("/api/lokal", { method: "PUT", body: JSON.stringify(isi) });
    if (!res.ok) throw new Error("Gagal menyimpan (mode lokal).");
    return;
  }
  const { error } = await supabase().from("konten").upsert({ id: "situs", data: isi });
  if (error) throw new Error(error.message.includes("row-level security") ? "Akun ini tidak punya izin admin." : error.message);
  // Simpan sudah berhasil; kalau penyegaran cache gagal, situs tetap ikut berubah paling lambat sehari.
  const res = await fetch("/api/segarkan", { method: "POST", headers: { Authorization: `Bearer ${sesi?.access_token ?? ""}` } });
  if (!res.ok) throw new Error("Tersimpan, tetapi situs belum disegarkan. Coba simpan sekali lagi.");
}

/** Unggah gambar; mengembalikan alamat publik beserta ukuran aslinya (dibutuhkan next/image). */
export async function unggahGambar(berkas: File): Promise<{ src: string; lebar: number; tinggi: number }> {
  if (berkas.size > 5 * 1024 * 1024) throw new Error("Ukuran gambar maksimal 5 MB.");
  const bitmap = await createImageBitmap(berkas);
  const ukuran = { lebar: bitmap.width, tinggi: bitmap.height };
  bitmap.close();

  if (jalurGudang === "lokal") {
    const form = new FormData();
    form.append("berkas", berkas);
    const res = await fetch("/api/lokal", { method: "POST", body: form });
    if (!res.ok) throw new Error("Gagal mengunggah (mode lokal).");
    return { src: (await res.json()).url, ...ukuran };
  }
  const nama = `${Date.now()}-${berkas.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-")}`;
  const { error } = await supabase().storage.from("media").upload(nama, berkas, { contentType: berkas.type });
  if (error) throw new Error(error.message);
  return { src: supabase().storage.from("media").getPublicUrl(nama).data.publicUrl, ...ukuran };
}
