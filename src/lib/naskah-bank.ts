import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { rest } from "./db-server";
import {
  captionAkhir, MODE_BAWAAN, promptIde, promptNaskah, rapikanNaskah, skemaNaskah, SKEMA_IDE, SISTEM_KONTEN, teksNaskah,
  type DataKonten, type ModeVideo, type Naskah,
} from "./lekkopi/konten-murni";
import type { Merek } from "./studio-server";

// Naskah video bahan "bank media" (gaya Lek Kopi): data kedai dari pintu-bakafrawi Lek Kopi
// (baca-saja), isi bank & gaya dari tabel Bakafrawi, aturan & prompt dari konten-murni.
// Sonnet 5.5 medium — sama dengan MODEL_KONTEN Lek Kopi.
const MODEL = "claude-sonnet-5-5";

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
    rest(`studio_bank?merek=eq.${m}&jenis=in.(foto,video)&select=tag,kurasi`) as Promise<{ tag: string; kurasi: { deskripsi?: string; kualitas?: number } | null }[]>,
    rest(`studio_gaya?merek=eq.${m}&select=profil`) as Promise<{ profil: { naskah?: Record<string, unknown> } }[]>,
    rest(`studio_tugas?merek=eq.${m}&naskah=not.is.null&select=naskah->>judul&order=dibuat.desc&limit=10`) as Promise<{ judul: string | null }[]>,
  ]);
  // Tiga isi terbaik per tag hasil kurasi — supaya naskah memilih tag yang gambarnya cocok.
  const perTag = new Map<string, { deskripsi: string; kualitas: number }[]>();
  for (const b of bank) {
    if (!b.kurasi?.deskripsi) continue;
    perTag.set(b.tag, [...(perTag.get(b.tag) ?? []), { deskripsi: b.kurasi.deskripsi, kualitas: Number(b.kurasi.kualitas) || 0 }]);
  }
  const isiBank = [...perTag].flatMap(([tag, isi]) =>
    isi.sort((a, b) => b.kualitas - a.kualitas).slice(0, 3).map((x) => `${tag}: ${x.deskripsi} (kualitas ${x.kualitas || "-"})`));
  return {
    ...pintu,
    tagBank: [...new Set(bank.map((b) => b.tag))].sort(),
    isiBank,
    gaya: gaya[0]?.profil?.naskah ?? null,
    gambarAi: Number(merek.profil.gambar_ai_maks) || 0,
    kontenTerakhir: terakhir.map((t) => t.judul).filter((j): j is string => Boolean(j)),
  };
}

/** Usulan ide video dari data kedai minggu lalu (seperti /ide Lek AI) → [{ judul, alasan, sudut, rekaman }]. */
export async function usulkanIde(merek: Merek, jumlah = 4) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY belum diisi di Vercel.");
  const data = await dataKontenMerek(merek);
  const res = await new Anthropic().messages.create({
    model: MODEL,
    max_tokens: 8000,
    output_config: { effort: "medium", format: { type: "json_schema", schema: SKEMA_IDE } },
    system: SISTEM_KONTEN,
    messages: [{ role: "user", content: promptIde(data, jumlah) }],
  });
  if (res.stop_reason === "refusal") throw new Error("Claude menolak mengusulkan ide.");
  const teks = res.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "{}";
  const ide = ((JSON.parse(teks) as { ide?: Record<string, string>[] }).ide ?? []).slice(0, jumlah);
  if (!ide.length) throw new Error("Claude tidak memberi ide.");
  return { ide, bankKosong: !data.tagBank.length };
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
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY belum diisi di Vercel.");
  const mode = opsi.mode ?? MODE_BAWAAN;
  const data = await dataKontenMerek(merek);
  if (!data.tagBank.length) throw new Error(`Bank media ${merek.nama} masih kosong — mesin Studio belum mengindeks folder Drive-nya.`);
  const ide = { judul: permintaan, alasan: "permintaan Kyai", sudut: "" };
  const client = new Anthropic();
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "medium", format: { type: "json_schema", schema: skemaNaskah(mode) } },
    system: SISTEM_KONTEN,
    messages: [{ role: "user", content: promptNaskah(data, ide, opsi.catatan, opsi.naskahLama as unknown as Record<string, unknown>, mode) }],
  });
  if (res.stop_reason === "refusal") throw new Error("Claude menolak menulis naskah ini.");
  const teks = res.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
  const mentah = JSON.parse(teks) as Naskah;
  const { naskah, perbaikan } = rapikanNaskah(mentah, data.tagBank, mode, data.gambarAi ?? 0);
  if (!naskah.adegan.length) throw new Error("Naskah dari Claude tidak berisi adegan.");
  return { naskah, caption: captionAkhir(naskah), teks: teksNaskah(naskah), perbaikan };
}
