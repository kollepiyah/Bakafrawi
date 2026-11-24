import { permintaanDariAdmin } from "@/lib/admin-server";
import { rest } from "@/lib/db-server";
import { panggilLlmJson } from "@/lib/llm-router";
import { formatCaptionKonsisten, normalisasiMerek } from "@/lib/caption-konsisten";
import {
  buatPromptGoogleFlow,
  SKEMA_GOOGLE_FLOW,
  type AdeganGoogleFlow,
  type BahasaFlow,
  type FormatDialogFlow,
  type GayaFlow,
} from "@/lib/google-flow-murni";

export const maxDuration = 60;

type HasilMentahFlow = {
  judul?: string;
  ringkasanKonsep?: string;
  karakterBible?: string;
  promptGambarKarakter?: string;
  adegan?: AdeganGoogleFlow[];
  isiCaption?: string;
  hashtagTambahan?: string[];
};

export async function POST(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false }, { status: 401 });

  const isi = (await req.json().catch(() => ({}))) as {
    merek?: string;
    produk?: string;
    topik?: string;
    bahasa?: BahasaFlow;
    gaya?: GayaFlow;
    formatDialog?: FormatDialogFlow;
    jumlahAdegan?: number;
  };

  try {
    const merek = normalisasiMerek(isi.merek);
    const riwayatBaris = (await rest(
      `studio_tugas?merek=eq.${encodeURIComponent(merek)}&select=arahan,naskah&order=dibuat.desc&limit=12`,
    ).catch(() => null)) as { arahan?: string | null; naskah?: { judul?: string } | null }[] | null;

    const riwayat = (riwayatBaris ?? [])
      .map((r) => String(r.naskah?.judul || r.arahan || "").replace(/\s+/g, " ").trim().slice(0, 80))
      .filter((t) => t.length > 6);

    const { system, prompt } = buatPromptGoogleFlow({
      merek,
      produk: isi.produk,
      topik: isi.topik,
      bahasa: isi.bahasa ?? "jawa_campur",
      gaya: isi.gaya ?? "storytelling_hangat",
      formatDialog: isi.formatDialog ?? "obrolan_2_orang",
      jumlahAdegan: Number(isi.jumlahAdegan) || 4,
      riwayat,
    });

    const { data, pemakaian } = await panggilLlmJson<HasilMentahFlow>(
      {
        system,
        prompt,
        skema: SKEMA_GOOGLE_FLOW as unknown as Record<string, unknown>,
        suhu: 0.85,
        maksToken: 5000,
        pakaiSearch: !isi.topik?.trim(),
        valid: (d) => Array.isArray((d as HasilMentahFlow)?.adegan) && (d as HasilMentahFlow).adegan!.length > 0,
      },
      "paket google flow",
    );

    const captionFormatted = formatCaptionKonsisten({
      merek,
      isiCaption: data.isiCaption ?? data.ringkasanKonsep ?? data.judul ?? "",
      hashtagTambahan: Array.isArray(data.hashtagTambahan) ? data.hashtagTambahan : [],
      sertakanCta: true,
    });

    return Response.json({
      ok: true,
      penyedia: pemakaian.penyedia,
      model: pemakaian.model,
      paket: {
        judul: String(data.judul ?? "Konsep Video AI"),
        ringkasanKonsep: String(data.ringkasanKonsep ?? ""),
        karakterBible: String(data.karakterBible ?? ""),
        promptGambarKarakter: String(data.promptGambarKarakter ?? ""),
        adegan: (data.adegan ?? []).map((a, idx) => ({
          nomor: Number(a.nomor) || idx + 1,
          durasiDetik: Number(a.durasiDetik) || 8,
          ringkasAksi: String(a.ringkasAksi ?? ""),
          dialog: String(a.dialog ?? ""),
          arahanLogat: String(a.arahanLogat ?? ""),
          teksLayar: String(a.teksLayar ?? ""),
          promptGoogleFlow: String(a.promptGoogleFlow ?? ""),
        })),
        caption: captionFormatted.captionLengkap,
        hashtag: captionFormatted.hashtag,
      },
    });
  } catch (e) {
    return Response.json(
      { ok: false, pesan: e instanceof Error ? e.message : "Gagal menyusun paket prompt Google Flow." },
      { status: 400 },
    );
  }
}
