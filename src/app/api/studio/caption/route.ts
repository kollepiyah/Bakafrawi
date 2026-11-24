import { permintaanDariAdmin } from "@/lib/admin-server";
import { panggilLlmJson, type GambarInput } from "@/lib/llm-router";
import {
  formatCaptionKonsisten,
  promptCaptionOtomatis,
  SKEMA_CAPTION_OTOMATIS,
} from "@/lib/caption-konsisten";

export const maxDuration = 45;

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

  try {
    const { system, prompt } = promptCaptionOtomatis({
      merek: isi.merek,
      judul: isi.judul,
      konteks: isi.konteks,
      jenis: isi.jenis,
      sasaran: isi.sasaran,
    });

    const { data, pemakaian } = await panggilLlmJson<{ isiCaption?: string; hashtagTambahan?: string[] }>(
      {
        system,
        prompt,
        gambar: Array.isArray(isi.gambar) ? isi.gambar.slice(0, 2) : undefined,
        skema: SKEMA_CAPTION_OTOMATIS as unknown as Record<string, unknown>,
        suhu: 0.75,
        maksToken: 800,
        valid: (d) => Boolean((d as { isiCaption?: string })?.isiCaption?.trim()),
      },
      "caption otomatis",
    );

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
      penyedia: pemakaian.penyedia,
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
      catatan: e instanceof Error ? e.message : "Memakai templat caption konsisten.",
    });
  }
}
