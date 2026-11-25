import "server-only";
import { ringkasMetrikAudit } from "./audit-ig-murni";
import { rest } from "./db-server";
import {
  buatPromptEvaluasiMingguan,
  ekstrakGayaDariTugas,
  kunciMingguWib,
  normalisasiEvaluasiMingguan,
  SKEMA_EVALUASI_MINGGUAN,
  waktunyaEvaluasiMingguan,
  type EvaluasiMingguan,
  type MerekEvaluasi,
} from "./evaluasi-mingguan-murni";
import { ambilInsightInstagram } from "./instagram-insight";
import { panggilLlmJson } from "./llm-router";
import { bacaPengaturan, daftarMerek } from "./studio-server";
import { adaBot, kirim } from "./telegram-server";

export type HasilEvaluasiDuaMerek = {
  bakafrawi: EvaluasiMingguan | null;
  lekkopi: EvaluasiMingguan | null;
};

/** Baca hasil evaluasi mingguan terakhir yang tersimpan di profil masing-masing merek. */
export async function bacaEvaluasiMingguan(): Promise<HasilEvaluasiDuaMerek> {
  const semua = await daftarMerek();
  const ambil = (slug: MerekEvaluasi) =>
    (semua.find((m) => m.slug === slug)?.profil?.evaluasi_mingguan as EvaluasiMingguan | undefined) ?? null;
  return {
    bakafrawi: ambil("bakafrawi"),
    lekkopi: ambil("lekkopi"),
  };
}

/**
 * Jalankan evaluasi mingguan dari cache Insight IG (0 request ke Meta API) + riwayat tugas,
 * lalu simpan penyesuaian gaya prioritas ke `studio_merek.profil.evaluasi_mingguan`.
 */
export async function jalankanEvaluasiMingguan(opsi: {
  merek?: "semua" | MerekEvaluasi;
  sekarang?: Date;
} = {}): Promise<{ hasil: HasilEvaluasiDuaMerek; catatan: string[] }> {
  const sekarang = opsi.sekarang ?? new Date();
  const minggu = kunciMingguWib(sekarang);
  const target: MerekEvaluasi[] =
    opsi.merek === "bakafrawi"
      ? ["bakafrawi"]
      : opsi.merek === "lekkopi"
      ? ["lekkopi"]
      : ["bakafrawi", "lekkopi"];

  const [insight, daftarTugas, semuaMerek] = await Promise.all([
    ambilInsightInstagram(false).catch(() => ({ posts: [], diambilPada: null })),
    rest("studio_tugas?select=id,merek,jenis,produk_slug,arahan,naskah,tayang,dibuat&order=dibuat.desc&limit=60").catch(
      () => [] as { id: string; merek?: string; arahan?: string | null; naskah?: { catatan?: unknown } | null }[],
    ) as Promise<{ id: string; merek?: string; arahan?: string | null; naskah?: { catatan?: unknown } | null }[]>,
    daftarMerek(),
  ]);

  const hasil: HasilEvaluasiDuaMerek = {
    bakafrawi:
      (semuaMerek.find((m) => m.slug === "bakafrawi")?.profil?.evaluasi_mingguan as EvaluasiMingguan | undefined) ??
      null,
    lekkopi:
      (semuaMerek.find((m) => m.slug === "lekkopi")?.profil?.evaluasi_mingguan as EvaluasiMingguan | undefined) ?? null,
  };
  const catatan: string[] = [];

  for (const slug of target) {
    const barisMerek = semuaMerek.find((m) => m.slug === slug);
    if (!barisMerek) {
      catatan.push(`${slug}: profil merek tidak ditemukan.`);
      continue;
    }

    const statistik = ringkasMetrikAudit(insight.posts ?? [], slug);
    if (statistik.totalPost === 0) {
      catatan.push(`${slug}: belum ada data post IG di cache (tekan 'Tarik dari IG' di Riset & Gaya).`);
      continue;
    }

    const ringkasGaya: Record<string, number> = {};
    for (const t of daftarTugas.filter((x) => String(x.merek ?? "bakafrawi").toLowerCase() === slug)) {
      const g = ekstrakGayaDariTugas(t);
      if (g) ringkasGaya[g] = (ringkasGaya[g] ?? 0) + 1;
    }

    const { system, prompt } = buatPromptEvaluasiMingguan({ merek: slug, statistik, ringkasGaya });
    const { data, pemakaian } = await panggilLlmJson<Record<string, unknown>>(
      {
        system,
        prompt,
        skema: SKEMA_EVALUASI_MINGGUAN as unknown as Record<string, unknown>,
        suhu: 0.35,
        maksToken: 1600,
        valid: (d) => Boolean(d && typeof d === "object" && "ringkasan" in d),
      },
      `evaluasi mingguan ${slug}`,
    );

    const evaluasi = normalisasiEvaluasiMingguan(data, {
      merek: slug,
      minggu,
      dibuatPada: sekarang.toISOString(),
      penyedia: `${pemakaian.penyedia}:${pemakaian.model}`,
      totalPostDianalisis: statistik.totalPost,
      rataViews: statistik.rataViews,
    });

    await rest(`studio_merek?slug=eq.${encodeURIComponent(slug)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        profil: { ...(barisMerek.profil ?? {}), evaluasi_mingguan: evaluasi },
        diubah: sekarang.toISOString(),
      }),
    });

    hasil[slug] = evaluasi;
    catatan.push(
      `${slug}: selesai (${evaluasi.gayaPrioritas.length ? `prioritas ${evaluasi.gayaPrioritas.join(", ")}` : "rotasi seimbang"}).`,
    );
  }

  return { hasil, catatan };
}

/** Dipanggil cron 5 menit (`detakAgenda`): jalankan evaluasi mingguan tiap Senin >= 06.00 WIB. */
export async function jalankanEvaluasiMingguanJikaWaktunya(
  sekarang = new Date(),
): Promise<{ dijalankan: boolean; catatan?: string[] }> {
  const saatIni = await bacaEvaluasiMingguan().catch(() => ({ bakafrawi: null, lekkopi: null }));
  const mingguTerakhir = saatIni.bakafrawi?.minggu ?? saatIni.lekkopi?.minggu ?? null;
  if (!waktunyaEvaluasiMingguan(sekarang, mingguTerakhir)) {
    return { dijalankan: false };
  }

  const { hasil, catatan } = await jalankanEvaluasiMingguan({ merek: "semua", sekarang });
  try {
    const p = await bacaPengaturan();
    if (p?.telegram_chat_id && adaBot()) {
      const baris = [hasil.bakafrawi, hasil.lekkopi]
        .filter((e): e is EvaluasiMingguan => Boolean(e))
        .map(
          (e) =>
            `• ${e.merek.toUpperCase()} (rata views ${e.rataViews}): ${e.ringkasan}${
              e.gayaPrioritas.length ? ` [Prioritas: ${e.gayaPrioritas.join(", ")}]` : ""
            }`,
        );
      if (baris.length) {
        await kirim(p.telegram_chat_id, `📊 Evaluasi Mingguan Studio\n${baris.join("\n")}`);
      }
    }
  } catch {
    // Gagal kirim notifikasi Telegram tidak membatalkan hasil evaluasi yang sudah tersimpan.
  }

  return { dijalankan: true, catatan };
}
