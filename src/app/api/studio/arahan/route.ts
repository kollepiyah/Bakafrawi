import { permintaanDariAdmin } from "@/lib/admin-server";
import { ambilKonten } from "@/lib/konten";
import { usulkanArahan } from "@/lib/usul-arahan";
import Anthropic from "@anthropic-ai/sdk";
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

// Tombol "Usulkan arahan / Ide" di formulir Studio: pilihan dari Claude untuk produk Bakafrawi & Lek Kopi.
export async function POST(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false }, { status: 401 });
  const isi = (await req.json().catch(() => ({}))) as { merek?: string; produk?: string; jenis?: string };
  try {
    const adalahLekKopi =
      isi.merek === "lekkopi" ||
      isi.produk === "lek-kopi" ||
      isi.produk === "lekkopi";

    if (adalahLekKopi) {
      if (process.env.ANTHROPIC_API_KEY) {
        try {
          const client = new Anthropic();
          const res = await client.messages.create({
            model: "claude-sonnet-5-5",
            max_tokens: 1500,
            system: SISTEM_KONTEN,
            messages: [
              {
                role: "user",
                content:
                  "Usulkan 3 ide video Reels/TikTok kreatif untuk Lek Kopi (kedai kopi di Waru, Sidoarjo). Konsep sinematik tanpa suara narasi, santai, menu andalan es kopi susu, suasana malam/sore nongkrong. Kembalikan HANYA format JSON: [{\"judul\": \"...\", \"arahan\": \"... (1-2 kalimat deskripsi ide dan suasana)\"}]",
              },
            ],
          });
          const teks = res.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
          const match = teks.match(/\[[\s\S]*\]/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (Array.isArray(parsed) && parsed.length > 0) {
              return Response.json({ ok: true, usulan: parsed.slice(0, 4) });
            }
          }
        } catch (err) {
          console.error("Gagal panggil Claude untuk ide Lek Kopi, memakai ide cadangan:", err);
        }
      }
      return Response.json({ ok: true, usulan: IDE_LEKKOPI_BAWAAN });
    }

    const produk = (await ambilKonten()).produk.find((p) => p.slug === isi.produk);
    if (!produk) return Response.json({ ok: false, pesan: "Produk tidak ditemukan." }, { status: 400 });
    const usulan = await usulkanArahan(produk, isi.jenis === "gambar" ? "gambar" : "video");
    return Response.json({ ok: true, usulan });
  } catch (e) {
    return Response.json({ ok: false, pesan: e instanceof Error ? e.message : "Gagal mengusulkan arahan." }, { status: 400 });
  }
}
