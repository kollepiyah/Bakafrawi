import "server-only";
import {
  buatPromptAuditIg,
  ringkasMetrikAudit,
  SKEMA_AUDIT_IG,
  type HasilAuditIg,
  type MerekAuditIg,
  type StatistikAuditIg,
} from "./audit-ig-murni";
import { ambilInsightInstagram } from "./instagram-insight";
import { panggilLlmJson, type Penyedia } from "./llm-router";

export type HasilAuditServer = {
  penyedia: Penyedia;
  model: string;
  biayaUsd: number;
  diambilPada: string | null;
  statistik: StatistikAuditIg;
  audit: HasilAuditIg;
};

/**
 * Audit performa Instagram berbasis data cache Supabase (0 request tambahan ke Meta Graph API)
 * lewat router AI hemat (NVIDIA NIM → Gemini → Cloudflare → Claude).
 */
export async function jalankanAuditInstagram(opsi: {
  merek?: MerekAuditIg;
  pertanyaan?: string;
} = {}): Promise<HasilAuditServer> {
  const merek: MerekAuditIg =
    opsi.merek === "lekkopi" || opsi.merek === "bakafrawi" ? opsi.merek : "semua";

  // Wajib false: hanya membaca cache persisten Supabase agar aman dari rate-limit Meta API.
  const insight = await ambilInsightInstagram(false);
  const statistik = ringkasMetrikAudit(insight.posts ?? [], merek);

  if (statistik.totalPost === 0) {
    throw new Error(
      "Belum ada data postingan Instagram tersimpan di cache. Tekan 'Tarik dari IG' dulu sekali di tab Insight Instagram.",
    );
  }

  const { system, prompt } = buatPromptAuditIg({
    statistik,
    pertanyaan: opsi.pertanyaan ?? "",
  });

  const { data, pemakaian } = await panggilLlmJson<HasilAuditIg>(
    {
      system,
      prompt,
      skema: SKEMA_AUDIT_IG as unknown as Record<string, unknown>,
      suhu: 0.4,
      maksToken: 3500,
      valid: (d) => {
        const x = d as Partial<HasilAuditIg> | null;
        return Boolean(x?.ringkasanEksekutif && x?.analisisTerbaru);
      },
    },
    "audit performa ig",
  );

  return {
    penyedia: pemakaian.penyedia,
    model: pemakaian.model,
    biayaUsd: pemakaian.biayaUsd,
    diambilPada: insight.diambilPada ?? null,
    statistik,
    audit: {
      ringkasanEksekutif: String(data.ringkasanEksekutif ?? ""),
      analisisTerbaru: String(data.analisisTerbaru ?? ""),
      polaMenang: Array.isArray(data.polaMenang) ? data.polaMenang.map(String).filter(Boolean) : [],
      perbaikanPrioritas: Array.isArray(data.perbaikanPrioritas)
        ? data.perbaikanPrioritas.map(String).filter(Boolean)
        : [],
      ideBerikutnya: Array.isArray(data.ideBerikutnya)
        ? data.ideBerikutnya.map((i) => ({
            judul: String(i.judul ?? "Ide Konten"),
            format:
              i.format === "poster" || i.format === "google_flow" ? i.format : "video_studio",
            alasan: String(i.alasan ?? ""),
            arahanSiapPakai: String(i.arahanSiapPakai ?? ""),
            gayaDisarankan: String(i.gayaDisarankan ?? "otomatis"),
          }))
        : [],
    },
  };
}
