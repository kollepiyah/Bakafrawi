import "server-only";
import type { Produk } from "@/content/skema";
import { rest } from "./db-server";
import {
  promptRisetReels,
  rapikanRisetReels,
  SISTEM_RISET_REELS,
  SKEMA_RISET_REELS,
  type KonsepReelsViral,
} from "./riset-reels-murni";
import { panggilLlmJson } from "./llm-router";

type TugasRiwayat = {
  arahan?: string | null;
  caption?: string | null;
  naskah?: { judul?: string } | null;
};

/** Ambil daftar ide/judul terakhir agar AI tidak mengulang pola yang sama. */
async function ambilRiwayatIde(merek: string): Promise<string[]> {
  try {
    const baris = (await rest(
      `studio_tugas?merek=eq.${encodeURIComponent(merek)}&select=arahan,caption,naskah&order=dibuat.desc&limit=18`,
    )) as TugasRiwayat[] | null;
    if (!Array.isArray(baris)) return [];
    return baris
      .map((b) => String(b.naskah?.judul || b.arahan || b.caption || "").replace(/\s+/g, " ").trim().slice(0, 90))
      .filter((t) => t.length > 6)
      .slice(0, 12);
  } catch {
    return [];
  }
}

export async function risetKonsepReels(produk: Produk, topikKhusus?: string): Promise<KonsepReelsViral[]> {
  const adalahLekKopi = produk.slug === "lekkopi" || produk.slug === "lek-kopi";
  const merek = adalahLekKopi ? "lekkopi" : "bakafrawi";
  const riwayat = await ambilRiwayatIde(merek);

  const blokRiwayat = riwayat.length
    ? `\n\nRIWAYAT KONTEN SEBELUMNYA (WAJIB HINDARI — dilarang mengulang judul, hook, atau sudut cerita yang mirip dengan daftar ini):\n${riwayat.map((r, i) => `${i + 1}. ${r}`).join("\n")}`
    : "";

  const konteksMerek = adalahLekKopi
    ? "Ini untuk akun kedai kopi Lek Kopi (@lekkopi.id, Panjunan, Waru, Sidoarjo). Variasikan format: (1) Storytelling/sketsa berlogat Jawa Timur/Indonesia santai, (2) POV barista/pelanggan relatable, (3) Tren minuman kopi/matcha/seasonal ala Reels & TikTok Indonesia, (4) Konten Full AI sinematik yang bisa dibuat lewat Google Flow / gambar AI."
    : "Ini untuk akun Bakafrawi Project (@bakafrawi.project, studio software & desain Sidoarjo). Variasikan format: (1) Storytelling keluh kesah pemilik UMKM/pesantren, (2) Sketsa perbandingan cara manual vs aplikasi otomatis, (3) Edukasi singkat bisnis digital, (4) Konten Full AI sinematik yang bisa dibuat lewat Google Flow / Remotion.";

  const { data } = await panggilLlmJson<unknown>({
    system: SISTEM_RISET_REELS,
    prompt: `${promptRisetReels(produk, topikKhusus)}\n\n${konteksMerek}\nGunakan pencarian Google terkini untuk menangkap tren format Instagram Reels & TikTok Indonesia terbaru yang sedang viral (hook 3 detik, gaya storytelling, ritme edit, tren audio/dialog). Pastikan setiap konsep punya sudut BERBEDA dan SEGAR.${blokRiwayat}`,
    skema: SKEMA_RISET_REELS,
    suhu: 0.9,
    maksToken: 4000,
    pakaiSearch: true,
  }, "riset tren");
  const hasil = rapikanRisetReels(data);
  if (!hasil.length) throw new Error("AI tidak memberikan konsep Reels.");
  return hasil;
}
