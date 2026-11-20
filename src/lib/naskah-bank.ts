import "server-only";
import { rest } from "./db-server";
import { panggilLlmJson, type PemakaianLlm } from "./llm-router";
import {
  captionAkhir, MODE_BAWAAN, promptIde, promptNaskah, rapikanNaskah, skemaNaskah, SKEMA_IDE, SISTEM_KONTEN, teksNaskah,
  type DataKonten, type ModeVideo, type Naskah,
} from "./lekkopi/konten-murni";
import type { Merek } from "./studio-server";

// Naskah video bahan "bank media" (gaya Lek Kopi): data kedai dari pintu-bakafrawi Lek Kopi
// (baca-saja), isi bank & gaya dari tabel Bakafrawi, aturan & prompt dari konten-murni.
// Penyedia AI dipilih llm-router (Gemini → Cloudflare → Claude) supaya hemat kuota Claude.

type DataPintu = Pick<DataKonten, "periode" | "terlaris" | "turun" | "jamSepi" | "menu" | "promo" | "toko" | "ingatan">;

async function dataPintuLekKopi(): Promise<DataPintu> {
  const url = process.env.LEKKOPI_PINTU_URL;
  const rahasia = process.env.LEKKOPI_PINTU_RAHASIA;
  if (!url || !rahasia) throw new Error("LEKKOPI_PINTU_URL / LEKKOPI_PINTU_RAHASIA belum diisi di Vercel.");
  const r = await fetch(url, { headers: { "x-pintu-rahasia": rahasia }, cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(`Pintu Lek Kopi menolak (${r.status}${j.pesan ? `: ${j.pesan}` : ""}).`);
  return j.data as DataPintu;
}

const KOSONG: DataPintu = { periode: "-", terlaris: [], turun: [], jamSepi: [], menu: [], promo: [] };

/** Bahan prompt untuk satu merek: data kedai (bila merek punya pintu) + isi bank + gaya + judul terakhir. */
export async function dataKontenMerek(merek: Merek): Promise<DataKonten> {
  const m = encodeURIComponent(merek.slug);
  const [pintu, bank, gaya, terakhir] = await Promise.all([
    merek.profil.naskah === "lekkopi" ? dataPintuLekKopi() : Promise.resolve(KOSONG),
    rest(`studio_bank?merek=eq.${m}&jenis=in.(foto,video)&select=tag,jenis,kurasi`) as Promise<{ tag: string; jenis: string; kurasi: { deskripsi?: string; kualitas?: number } | null }[]>,
    rest(`studio_gaya?merek=eq.${m}&select=profil`) as Promise<{ profil: { naskah?: Record<string, unknown> } }[]>,
    rest(`studio_tugas?merek=eq.${m}&naskah=not.is.null&select=naskah->>judul&order=dibuat.desc&limit=10`) as Promise<{ judul: string | null }[]>,
  ]);
  // Isi terbaik per tag hasil kurasi (video didahulukan) — supaya naskah memilih tag yang gambarnya
  // cocok dengan tema, dan tahu tag mana yang punya rekaman bergerak.
  const perTag = new Map<string, { deskripsi: string; kualitas: number; video: boolean }[]>();
  for (const b of bank) {
    if (!b.kurasi?.deskripsi) continue;
    perTag.set(b.tag, [...(perTag.get(b.tag) ?? []), { deskripsi: b.kurasi.deskripsi, kualitas: Number(b.kurasi.kualitas) || 0, video: b.jenis === "video" }]);
  }
  const isiBank = [...perTag].flatMap(([tag, isi]) =>
    isi.sort((a, b) => Number(b.video) - Number(a.video) || b.kualitas - a.kualitas).slice(0, 4)
      .map((x) => `${tag}: [${x.video ? "VIDEO" : "foto"}] ${x.deskripsi} (kualitas ${x.kualitas || "-"})`));
  return {
    ...pintu,
    tagBank: [...new Set(bank.map((b) => b.tag))].sort(),
    isiBank,
    gaya: gaya[0]?.profil?.naskah ?? null,
    // Aktifkan B-roll gambar AI gratis (maks 2 adegan) secara bawaan agar video tidak hanya bergantung
    // pada foto bank — tetap bisa dimatikan dengan mengatur gambar_ai_maks = 0 di profil merek.
    gambarAi: merek.profil.gambar_ai_maks !== undefined ? Number(merek.profil.gambar_ai_maks) : 2,
    kontenTerakhir: terakhir.map((t) => t.judul).filter((j): j is string => Boolean(j)),
  };
}

/** Usulan ide video dari data kedai minggu lalu (seperti /ide Lek AI) → [{ judul, alasan, sudut, rekaman }]. */
export async function usulkanIde(merek: Merek, jumlah = 4) {
  const data = await dataKontenMerek(merek);
  const { data: j, pemakaian } = await panggilLlmJson<{ ide?: Record<string, string>[] }>({
    system: SISTEM_KONTEN,
    prompt: promptIde(data, jumlah),
    skema: SKEMA_IDE as Record<string, unknown>,
    maksToken: 8000,
    valid: (d) => Array.isArray((d as { ide?: unknown[] })?.ide) && ((d as { ide: unknown[] }).ide.length > 0),
  }, "ide");
  const ide = (j.ide ?? []).slice(0, jumlah);
  if (!ide.length) throw new Error("AI tidak memberi ide.");
  return { ide, bankKosong: !data.tagBank.length, pemakaian };
}

/**
 * Tulis (atau revisi) naskah video bank media dari permintaan Kyai.
 * Memulangkan naskah rapi + caption + teks Telegram + daftar perbaikan tag.
 */
export async function tulisNaskahBank(
  merek: Merek,
  permintaan: string,
  opsi: { mode?: ModeVideo; catatan?: string; naskahLama?: Naskah } = {},
) {
  const mode = opsi.mode ?? MODE_BAWAAN;
  const data = await dataKontenMerek(merek);
  if (!data.tagBank.length) throw new Error(`Bank media ${merek.nama} masih kosong — mesin Studio belum mengindeks folder Drive-nya.`);
  // Permintaan Kyai = tema utama; sudut menegaskan supaya AI tidak kembali ke alur baku.
  const ide = { judul: permintaan, alasan: "permintaan Kyai", sudut: `Ikuti persis tema permintaan ini: "${permintaan}". Pilih tag & bidikan yang paling sesuai temanya (utamakan rekaman video).` };
  const { data: mentah, pemakaian } = await panggilLlmJson<Naskah>({
    system: SISTEM_KONTEN,
    prompt: promptNaskah(data, ide, opsi.catatan, opsi.naskahLama as unknown as Record<string, unknown>, mode),
    skema: skemaNaskah(mode) as Record<string, unknown>,
    maksToken: 16000,
    valid: (d) => Array.isArray((d as { adegan?: unknown[] })?.adegan) && ((d as { adegan: unknown[] }).adegan.length > 0),
  }, opsi.catatan ? "revisi naskah" : "naskah");
  const { naskah, perbaikan } = rapikanNaskah(mentah, data.tagBank, mode, data.gambarAi ?? 0);
  if (!naskah.adegan.length) throw new Error("Naskah dari AI tidak berisi adegan.");
  // Catatan biaya ikut tersimpan di naskah → dijumlah di Deck. Revisi menambah ke catatan lama.
  const lama = ((opsi.naskahLama as unknown as { pemakaian?: PemakaianLlm[] } | undefined)?.pemakaian ?? []);
  (naskah as Naskah & { pemakaian?: PemakaianLlm[] }).pemakaian = [...lama, pemakaian];
  return { naskah, caption: captionAkhir(naskah), teks: teksNaskah(naskah), perbaikan };
}
