import { permintaanDariAdmin } from "@/lib/admin-server";
import { rest } from "@/lib/db-server";
import { ambilKonten } from "@/lib/konten";
import { usulkanArahan } from "@/lib/usul-arahan";
import { panggilLlmJson } from "@/lib/llm-router";
import { SISTEM_KONTEN } from "@/lib/lekkopi/konten-murni";

export const maxDuration = 60;

const IDE_LEKKOPI_BAWAAN = [
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

// Tombol "Usulkan arahan / Ide" di formulir Studio (Bakafrawi & Lek Kopi). AI lewat llm-router (Gemini dulu).
export async function POST(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false }, { status: 401 });
  const isi = (await req.json().catch(() => ({}))) as { merek?: string; produk?: string; jenis?: string };
  try {
    const adalahLekKopi = isi.merek === "lekkopi" || isi.produk === "lek-kopi" || isi.produk === "lekkopi";

    if (adalahLekKopi) {
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

        const { data } = await panggilLlmJson<{ usulan?: { judul: string; arahan: string }[] }>({
          system: SISTEM_KONTEN,
          prompt: `Usulkan 4 ide konten Full AI (video Reels/TikTok atau poster) yang SEGAR & BERAGAM untuk Lek Kopi (kedai kopi di Panjunan, Waru, Sidoarjo). Variasikan 4 gaya berbeda: (1) Storytelling / sketsa santai logat Jawa Timur/Indonesia, (2) POV pelanggan/barista yang relatable, (3) Visual sinematik produk kopi/matcha/es kopi susu bergaya AI editorial, (4) Humor ringan nongkrong malam. Tiap ide: judul pendek + arahan 1-2 kalimat.${hindari}`,
          skema: SKEMA_IDE_SINGKAT,
          suhu: 0.9,
          maksToken: 1500,
          valid: (d) => Array.isArray((d as { usulan?: unknown[] })?.usulan) && (d as { usulan: unknown[] }).usulan.length > 0,
        }, "usulan ide");
        return Response.json({ ok: true, usulan: (data.usulan ?? []).slice(0, 4) });
      } catch (err) {
        console.error("Usulan ide Lek Kopi gagal, memakai ide cadangan:", err);
        return Response.json({ ok: true, usulan: IDE_LEKKOPI_BAWAAN });
      }
    }

    const produk = (await ambilKonten()).produk.find((p) => p.slug === isi.produk);
    if (!produk) return Response.json({ ok: false, pesan: "Produk tidak ditemukan." }, { status: 400 });
    const usulan = await usulkanArahan(produk, isi.jenis === "gambar" ? "gambar" : "video");
    return Response.json({ ok: true, usulan });
  } catch (e) {
    return Response.json({ ok: false, pesan: e instanceof Error ? e.message : "Gagal mengusulkan arahan." }, { status: 400 });
  }
}
