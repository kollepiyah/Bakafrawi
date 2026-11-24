import { permintaanDariAdmin } from "@/lib/admin-server";
import { panggilLlmJson, type GambarInput } from "@/lib/llm-router";
import {
  formatCaptionKonsisten,
  promptCaptionOtomatis,
  SKEMA_CAPTION_OTOMATIS,
} from "@/lib/caption-konsisten";

export const maxDuration = 45;

type HasilLlmCaption = {
  ringkasVisual?: string;
  judulSaran?: string;
  isiCaption?: string;
  hashtagTambahan?: string[];
};

export async function POST(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false }, { status: 401 });
  const isi = (await req.json().catch(() => ({}))) as {
    merek?: string;
    judul?: string;
    konteks?: string;
    jenis?: "video" | "gambar";
    sasaran?: string;
    gambar?: GambarInput[];
  };

  const bingkai = Array.isArray(isi.gambar)
    ? isi.gambar
        .filter((g): g is GambarInput => Boolean(g && typeof g.mimeType === "string" && typeof g.data === "string" && g.data.length > 32))
        .slice(0, 5)
    : [];

  try {
    let data: HasilLlmCaption;
    let penyedia = "";
    let pakaiVision = false;
    let catatan: string | undefined;

    try {
      const p = promptCaptionOtomatis({
        merek: isi.merek,
        judul: isi.judul,
        konteks: isi.konteks,
        jenis: isi.jenis,
        sasaran: isi.sasaran,
        jumlahBingkai: bingkai.length,
      });
      const res = await panggilLlmJson<HasilLlmCaption>(
        {
          system: p.system,
          prompt: p.prompt,
          gambar: bingkai.length > 0 ? bingkai : undefined,
          skema: SKEMA_CAPTION_OTOMATIS as unknown as Record<string, unknown>,
          suhu: 0.7,
          maksToken: 1000,
          valid: (d) => Boolean((d as HasilLlmCaption)?.isiCaption?.trim()),
        },
        bingkai.length > 0 ? "caption otomatis (vision)" : "caption otomatis",
      );
      data = res.data;
      penyedia = res.pemakaian.penyedia;
      pakaiVision = bingkai.length > 0;
    } catch (eVision) {
      // Bila ada gambar tetapi penyedia Vision (Gemini/Claude) gagal/limit, coba sekali lagi via teks
      if (bingkai.length === 0) throw eVision;
      const pTeks = promptCaptionOtomatis({
        merek: isi.merek,
        judul: isi.judul,
        konteks: isi.konteks,
        jenis: isi.jenis,
        sasaran: isi.sasaran,
        jumlahBingkai: 0,
      });
      const resTeks = await panggilLlmJson<HasilLlmCaption>(
        {
          system: pTeks.system,
          prompt: pTeks.prompt,
          skema: SKEMA_CAPTION_OTOMATIS as unknown as Record<string, unknown>,
          suhu: 0.7,
          maksToken: 900,
          valid: (d) => Boolean((d as HasilLlmCaption)?.isiCaption?.trim()),
        },
        "caption otomatis (fallback teks)",
      );
      data = resTeks.data;
      penyedia = resTeks.pemakaian.penyedia;
      pakaiVision = false;
      catatan = "Analisis visual bingkai sedang tidak tersedia — caption disusun dari judul/catatan.";
    }

    const hasil = formatCaptionKonsisten({
      merek: isi.merek,
      isiCaption: data.isiCaption ?? "",
      hashtagTambahan: Array.isArray(data.hashtagTambahan) ? data.hashtagTambahan : [],
      sertakanCta: isi.sasaran !== "story",
    });

    return Response.json({
      ok: true,
      caption: hasil.captionLengkap,
      hashtag: hasil.hashtag,
      ringkasVisual: String(data.ringkasVisual ?? "").trim(),
      judulSaran: String(data.judulSaran ?? "").trim().slice(0, 80),
      penyedia,
      jumlahBingkai: bingkai.length,
      pakaiVision,
      ...(catatan ? { catatan } : {}),
    });
  } catch (e) {
    // Fallback aman tanpa gagal total: tetap kembalikan caption konsisten minimal dari judul
    const fallback = formatCaptionKonsisten({
      merek: isi.merek,
      isiCaption: isi.judul?.trim() || "Momen terbaru hari ini.",
      sertakanCta: isi.sasaran !== "story",
    });
    return Response.json({
      ok: true,
      caption: fallback.captionLengkap,
      hashtag: fallback.hashtag,
      ringkasVisual: "",
      judulSaran: "",
      jumlahBingkai: bingkai.length,
      pakaiVision: false,
      catatan: e instanceof Error ? e.message : "Memakai templat caption konsisten.",
    });
  }
}
