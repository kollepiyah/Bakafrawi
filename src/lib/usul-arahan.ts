import "server-only";
import type { Produk } from "@/content/skema";
import { rest } from "./db-server";
import { SISTEM_KONTEN } from "./lekkopi/konten-murni";
import { promptArahan, rapikanUsulan, SISTEM_ARAHAN, SKEMA_ARAHAN, type UsulanArahan } from "./usul-arahan-murni";
import { panggilLlmJson } from "./llm-router";

const IDE_LEKKOPI_BAWAAN: UsulanArahan[] = [
  {
    judul: "Vibes Malam Minggu Waru",
    arahan: "Suasana kedai malam minggu yang hangat, lampu temaram, barista menuang es kopi susu gula aren, ajak nongkrong santai bareng teman.",
  },
  {
    judul: "Menu Favorit & Cemilan Sore",
    arahan: "Kombinasi Es Kopi Susu Lek dingin dan sepiring Cireng Crispy hangat saat jam rehat sore 16.30 WIB, bikin mood balik lagi.",
  },
  {
    judul: "Behind The Bar: Racik Kopi",
    arahan: "Bidikan estetik close-up biji kopi digiling, uap espresso mengepul, dan tuangan latte art presisi tanpa suara narasi, musik chill.",
  },
  {
    judul: "Rehat Tenang Sendirian",
    arahan: "Pojok tenang kedai, buku bacaan atau laptop ditemani secangkir Kopi Tubruk hangat di Waru, tempat pas buat recharge energi.",
  },
];

const IDE_LEKKOPI_POSTER_BAWAAN: UsulanArahan[] = [
  {
    judul: "Promo Hari Spesial di Kedai",
    arahan: "Poster promo hari spesial (seperti Hari Guru / akhir pekan) dengan suasana kedai kopi hangat, kopi susu andalan, dan ajakan mampir bareng teman.",
  },
  {
    judul: "Sorotan Menu Andalan",
    arahan: "Poster editorial close-up segelas Es Kopi Susu & Matcha dingin dengan es batu bening di meja kayu kafe, menonjolkan kesegaran minuman.",
  },
  {
    judul: "Paket Nongkrong Sore & Malam",
    arahan: "Poster ajakan ngopi sore hingga malam pukul 14.00–23.00 WIB di area outdoor Panjunan Waru yang santai dan ramah kantong.",
  },
  {
    judul: "Pesan Online Anti Ribet",
    arahan: "Poster pengingat kopi favorit tetap bisa dipesan dari rumah lewat GoFood, GrabFood, ShopeeFood, dan TikTok GO.",
  },
];

const SKEMA_IDE_SINGKAT = {
  type: "object",
  properties: {
    usulan: {
      type: "array",
      items: {
        type: "object",
        properties: { judul: { type: "string" }, arahan: { type: "string" } },
        required: ["judul", "arahan"],
      },
    },
  },
  required: ["usulan"],
};

export async function usulkanArahan(produk: Produk, jenis: "video" | "gambar") {
  const { data } = await panggilLlmJson<unknown>({
    system: SISTEM_ARAHAN,
    prompt: promptArahan(produk, jenis),
    skema: SKEMA_ARAHAN,
    maksToken: 4000,
  });
  const usulan = rapikanUsulan(data);
  if (!usulan.length) throw new Error("AI tidak memberikan usulan arahan.");
  return usulan;
}

/** Usulan ide/arahan konten Full AI (poster atau video) untuk kedai Lek Kopi. */
export async function usulkanArahanLekKopi(jenis: "video" | "gambar", fokus = ""): Promise<UsulanArahan[]> {
  const adalahPoster = jenis === "gambar";
  try {
    const riwayatBaris = (await rest(
      "studio_tugas?merek=eq.lekkopi&select=arahan,naskah&order=dibuat.desc&limit=12",
    ).catch(() => null)) as { arahan?: string | null; naskah?: { judul?: string } | null }[] | null;
    const riwayat = (riwayatBaris ?? [])
      .map((r) => String(r.naskah?.judul || r.arahan || "").replace(/\s+/g, " ").trim().slice(0, 80))
      .filter((t) => t.length > 6);
    const hindari = riwayat.length
      ? `\n\nDILARANG mengulang tema/judul yang mirip dengan riwayat terbaru ini:\n${riwayat.map((x, i) => `${i + 1}. ${x}`).join("\n")}`
      : "";

    const fokusTeks =
      fokus === "lekkopi-promo"
        ? "Fokus utama: Promo & Momen Hari Spesial."
        : fokus === "lekkopi-menu"
        ? "Fokus utama: Menu Minuman & Produk Unggulan."
        : fokus === "lekkopi-suasana"
        ? "Fokus utama: Suasana Kedai & Nongkrong."
        : fokus === "lekkopi-story"
        ? "Fokus utama: Cerita & Edukasi Kopi."
        : "";

    const prompt = adalahPoster
      ? `Usulkan 4 ide POSTER PROMOSI Full AI (ukuran Feed 1:1, Potret 4:5, dan Story 9:16) yang SEGAR & BERAGAM untuk Lek Kopi (kedai kopi di Panjunan, Waru, Sidoarjo). ${fokusTeks} Variasikan 4 sudut poster berbeda: (1) Promo hari spesial / apresiasi pelanggan (mis. Hari Guru, weekend, traktiran), (2) Highlight visual menu kopi/matcha dingin yang menggugah selera, (3) Ajakan nongkrong sore-malam yang hangat, (4) Kemudahan pesan online (GoFood/GrabFood/ShopeeFood/TikTok GO). Tiap ide: judul pendek + arahan 1-2 kalimat berisi pesan promo & suasana visual poster.${hindari}`
      : `Usulkan 4 ide VIDEO Reels/TikTok Full AI yang SEGAR & BERAGAM untuk Lek Kopi (kedai kopi di Panjunan, Waru, Sidoarjo). ${fokusTeks} Variasikan 4 gaya berbeda: (1) Storytelling / sketsa santai logat Jawa Timur/Indonesia, (2) POV pelanggan/barista yang relatable, (3) Visual sinematik produk kopi/matcha/es kopi susu bergaya AI editorial, (4) Humor ringan nongkrong malam. Tiap ide: judul pendek + arahan 1-2 kalimat.${hindari}`;

    const { data } = await panggilLlmJson<{ usulan?: UsulanArahan[] }>({
      system: SISTEM_KONTEN,
      prompt,
      skema: SKEMA_IDE_SINGKAT,
      suhu: 0.9,
      maksToken: 1500,
      valid: (d) => Array.isArray((d as { usulan?: unknown[] })?.usulan) && (d as { usulan: unknown[] }).usulan.length > 0,
    }, "usulan ide");
    return (data.usulan ?? []).slice(0, 4);
  } catch (err) {
    console.error("Usulan ide Lek Kopi gagal, memakai ide cadangan:", err);
    return adalahPoster ? IDE_LEKKOPI_POSTER_BAWAAN : IDE_LEKKOPI_BAWAAN;
  }
}
