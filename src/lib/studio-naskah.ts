import "server-only";
import { rest } from "./db-server";
import { tulisNaskahBank } from "./naskah-bank";
import type { Naskah } from "./lekkopi/konten-murni";
import { bacaPengaturan, daftarMerek, picuStudio, type Merek } from "./studio-server";
import { adaBot, tg } from "./telegram-server";

// Alur dua langkah untuk merek berbahan "bank media" (Lek Kopi): naskah ditulis → Kyai menyetujui
// → mesin membuat video → Kyai menyetujui video → tayang. Dipakai bersama layar Konten & bot.

/** Merek yang videonya dibuat dari bank media (bukan rekaman aplikasi). */
export const pakaiBank = (m: Merek) => Array.isArray(m.profil.bahan) && (m.profil.bahan as string[]).includes("bank");

async function merekAda(slug: string) {
  const m = (await daftarMerek()).find((x) => x.slug === slug);
  if (!m) throw new Error(`Merek "${slug}" tidak dikenal.`);
  if (!m.aktif) throw new Error(`Merek ${m.nama} belum aktif.`);
  if (!pakaiBank(m)) throw new Error(`Merek ${m.nama} tidak memakai bahan bank media.`);
  return m;
}

type BarisNaskah = { id: string; merek: string; arahan: string; status: string; naskah: Naskah | null };

async function ambil(id: string): Promise<BarisNaskah> {
  const [t] = (await rest(`studio_tugas?id=eq.${encodeURIComponent(id)}&select=id,merek,arahan,status,naskah`)) as BarisNaskah[];
  if (!t) throw new Error("Konten tidak ditemukan.");
  return t;
}

const tombolNaskah = (id: string) => ({
  inline_keyboard: [[{ text: "✅ Setujui, buat videonya", callback_data: `ns:${id}` }, { text: "❌ Tolak", callback_data: `nx:${id}` }]],
});

async function kabarNaskah(id: string, merek: Merek, teks: string, perbaikan: string[]) {
  const p = await bacaPengaturan();
  if (!p.telegram_chat_id || !adaBot()) return;
  const catatan = perbaikan.length ? `\n\n🔧 ${perbaikan.join(" · ")}` : "";
  const revisi = '\n\nMau diubah? Balas misalnya: "revisi naskah terakhir: adegan 2 pakai latte art".';
  await tg("sendMessage", {
    chat_id: p.telegram_chat_id,
    text: `[${merek.nama}] ${teks}${catatan}${revisi}`.slice(0, 4000),
    reply_markup: tombolNaskah(id),
    disable_web_page_preview: true,
  });
}

/** Catat permintaan; naskahnya ditulis terpisah (isiNaskah) supaya pemanggil bisa menjawab cepat. */
export async function pesanNaskah(isi: { merek: string; permintaan: string }) {
  const merek = await merekAda(isi.merek);
  // Ide opsional: bila kosong (atau cuma prefiks gaya), AI otomatis memilih menu/konsep terbaik dari data kedai.
  const permintaan = isi.permintaan.trim() || "Pilih otomatis menu andalan & konsep paling menarik minggu ini";
  const [t] = (await rest("studio_tugas?select=id", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ merek: merek.slug, jenis: "video", produk_slug: merek.slug, arahan: permintaan.slice(0, 1000), latar: "polos", status: "naskah" }),
  })) as { id: string }[];
  return { id: t.id, merek };
}

/** Tulis (atau revisi) naskah untuk tugas berstatus 'naskah', simpan, lalu kirim ke Telegram. */
export async function isiNaskah(id: string, revisi?: string) {
  const t = await ambil(id);
  if (t.status !== "naskah") throw new Error("Naskah ini sudah disetujui/ditolak.");
  const merek = await merekAda(t.merek);
  try {
    const h = await tulisNaskahBank(merek, t.arahan, revisi && t.naskah ? { catatan: revisi, naskahLama: t.naskah } : {});
    await rest(`studio_tugas?id=eq.${id}&status=eq.naskah`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ naskah: { ...h.naskah, sumber: "claude-sonnet-5-5" }, caption: h.caption, galat: null }),
    });
    await kabarNaskah(id, merek, h.teks, h.perbaikan);
    return h;
  } catch (e) {
    // Tanpa naskah sebelumnya tugas ini tak berguna → gagal; revisi yang gagal mempertahankan naskah lama.
    const galat = `Naskah gagal ditulis: ${e instanceof Error ? e.message : e}`.slice(0, 1000);
    await rest(`studio_tugas?id=eq.${id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(t.naskah ? { galat } : { status: "gagal", galat, selesai: new Date().toISOString() }),
    });
    throw e;
  }
}

/** Kyai menyetujui naskah → antre untuk mesin; ditolak → selesai sebagai gagal. */
export async function putuskanNaskah(id: string, aksi: "setujui" | "tolak") {
  const isi = aksi === "setujui" ? { status: "antre" } : { status: "gagal", galat: "Naskah ditolak Kyai.", selesai: new Date().toISOString() };
  const hasil = (await rest(`studio_tugas?id=eq.${encodeURIComponent(id)}&status=eq.naskah&naskah=not.is.null&select=id`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(isi),
  })) as { id: string }[];
  if (!hasil.length) throw new Error("Naskah tidak ditemukan, belum selesai ditulis, atau sudah diputuskan.");
  return { dipicu: aksi === "setujui" ? await picuStudio() : false };
}

/** Tugas naskah terbaru yang masih menunggu (untuk "revisi naskah terakhir" di bot). */
export async function naskahMenungguTerakhir(): Promise<string | null> {
  const [t] = (await rest("studio_tugas?status=eq.naskah&naskah=not.is.null&select=id&order=dibuat.desc&limit=1")) as { id: string }[];
  return t?.id ?? null;
}
