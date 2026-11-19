// Usulan "arahan untuk AI" di formulir Studio (Kyai, 19 Nov 2026: "apakah ada arahan AI?"): Claude
// memberi 3 pilihan sudut iklan untuk satu produk — sasaran, masalah yang diangkat, ajakan — yang
// Kyai pilih lalu dikirim sebagai arahan tugas. Aturan & prompt di sini (murni, diuji).
import type { Produk } from "@/content/skema";

export type UsulanArahan = { judul: string; arahan: string };

export const SKEMA_ARAHAN = {
  type: "object",
  additionalProperties: false,
  required: ["usulan"],
  properties: {
    usulan: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["judul", "arahan"],
        properties: {
          judul: { type: "string", description: "Nama sudut iklan 2-5 kata, mis. \"Capek rekap malam\"" },
          arahan: { type: "string", description: "Arahan 1-3 kalimat: sasaran penonton, masalah/sudut yang diangkat, fitur yang ditonjolkan, ajakan di akhir" },
        },
      },
    },
  },
} as const;

export const SISTEM_ARAHAN =
  "Kamu ahli strategi konten iklan Reels/TikTok untuk Bakafrawi Project (software developer di Sidoarjo). " +
  "Tulis dalam Bahasa Indonesia sehari-hari. Jangan mengarang angka, harga, promo, atau fitur yang tidak ada di data produk.";

/** Prompt usulan arahan untuk satu produk. Murni. */
export function promptArahan(produk: Pick<Produk, "nama" | "kategori" | "klien" | "judul" | "deskripsi" | "fitur">, jenis: "video" | "gambar", jumlah = 3) {
  const fitur = produk.fitur.map((f) => `- ${f.judul}: ${f.isi}`).join("\n");
  const pesanan = produk.kategori === "pesanan";
  return [
    `Usulkan ${jumlah} arahan BERBEDA SUDUT untuk ${jenis === "video" ? "video iklan Reels/TikTok 30-45 detik" : "poster promosi"} produk berikut.`,
    "Tiap arahan menyebut: siapa sasarannya, masalah/keinginan yang diangkat, 1-2 fitur yang ditonjolkan, dan ajakan di akhir. Variasikan sasaran dan nada (mis. santai, serius, lucu).",
    pesanan
      ? `Ini karya pesanan untuk ${produk.klien ?? "klien"}: posisikan sebagai bukti kemampuan Bakafrawi membuat aplikasi serupa; ajakan = konsultasi lewat WhatsApp.`
      : "Ini aplikasi siap pakai milik Bakafrawi: ajakan = coba/berlangganan.",
    "",
    `Nama: ${produk.nama}`,
    `Judul: ${produk.judul}`,
    `Deskripsi: ${produk.deskripsi}`,
    `Fitur:\n${fitur}`,
  ].join("\n");
}

/** Keluaran Claude → maksimal `jumlah` usulan yang rapi (teks dipangkas, yang kosong dibuang). Murni. */
export function rapikanUsulan(mentah: unknown, jumlah = 3): UsulanArahan[] {
  const daftar = (mentah as { usulan?: unknown })?.usulan;
  if (!Array.isArray(daftar)) return [];
  const teks = (v: unknown, maks: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, maks);
  return daftar
    .map((u) => ({ judul: teks((u as UsulanArahan)?.judul, 48), arahan: teks((u as UsulanArahan)?.arahan, 400) }))
    .filter((u) => u.arahan)
    .map((u) => ({ ...u, judul: u.judul || u.arahan.split(/[.,]/)[0].slice(0, 48) }))
    .slice(0, jumlah);
}
